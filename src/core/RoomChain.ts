/**
 * RoomChain — orchestrates `[NEXT: name]` / `[DONE]` agent-to-agent handoff
 * chains within a single room. One agent speaks, optionally hands off to a
 * room-mate by trailing token, repeat until [DONE], unknown target, hop cap,
 * or abort.
 *
 * Streaming guarantee: the trailing handoff token is NEVER forwarded to the
 * caller. We hold a 64-char tail buffer behind real generation so a token
 * forming at the end of the stream is stripped by `parseHandoff` before any
 * `onAgentChunk` ever sees it. The user-visible stream lags ~64 chars; that
 * latency is invisible in practice.
 */

import type {
  LlmProvider,
  PermissionMode,
  ProviderId,
  StreamResult,
  ToolUseEvent,
} from '@/api/provider';
import type { AgentDef, Room } from '@/rooms/types';
import {
  composeHandoffSystem,
  composeHandoffUserPrompt,
  DEFAULT_MAX_HOPS,
  parseHandoff,
  resolveTargetAgent,
  type ChainEntry,
} from '@/core/HandoffProtocol';

/** Per-hop config resolved from the room/agent/settings layer. Mirrors the
 *  shape returned by `resolveAgentCall` in `src/core/ProviderFactory.ts`. */
export interface ResolvedAgentCall {
  readonly provider: LlmProvider;
  /** Optional — `runChain` falls back to 'default' when undefined. Matches
   *  the shape of `AgentCallOptions` from ProviderFactory. */
  readonly permissionMode?: PermissionMode;
  readonly skillsDir?: string;
  readonly maxTurns?: number;
  readonly maxTokens?: number;
}

export interface ChainRequest {
  readonly room: Room;
  readonly firstAgent: AgentDef;
  readonly userPrompt: string;
  readonly meetingId: string;
  readonly permissionMode?: PermissionMode;
  readonly thinking?: 'off' | 'low' | 'medium' | 'high';
  readonly maxHops?: number;
  readonly signal?: AbortSignal;
  /** Resolves an agent's call-time config per hop (different agents may use
   *  different providers/models). This is `resolveAgentCall` from ProviderFactory. */
  readonly resolveCall: (agent: AgentDef) => Promise<ResolvedAgentCall>;
}

export interface ChainEvents {
  /** Agent X started thinking. Emitted once per hop, before any chunks. */
  readonly onAgentThinking: (agentId: string) => void;
  /** Streamed text chunk, already free of handoff tokens. */
  readonly onAgentChunk: (agentId: string, chunk: string) => void;
  /** Tool use start/result. */
  readonly onAgentToolUse: (agentId: string, event: ToolUseEvent) => void;
  /** Stream finished cleanly. `cleanText` is the token-free body so the
   *  caller can save plan files, etc., without the routing token. */
  readonly onAgentComplete: (
    agentId: string,
    cleanText: string,
    result: StreamResult,
    providerId: ProviderId,
  ) => void;
  /** Stream errored. Caller handles + chain stops. */
  readonly onAgentError: (agentId: string, err: Error) => void;
  /** Cosmetic: A handed off to B (after onAgentComplete for A, before
   *  onAgentThinking for B). */
  readonly onHandoff: (fromAgentId: string, toAgentId: string) => void;
  /** Chain ended in a known error mode. */
  readonly onChainError: (
    kind: 'unknown_agent' | 'hop_cap_reached',
    message: string,
  ) => void;
}

const TAIL_BUFFER = 64;

/** Run a [NEXT:]/[DONE] handoff chain. Resolves when the chain ends —
 *  normal completion, error, or cancellation. The current hop always runs
 *  to completion before cancellation is checked between hops. */
export async function runChain(
  req: ChainRequest,
  events: ChainEvents,
): Promise<void> {
  const maxHops = req.maxHops ?? DEFAULT_MAX_HOPS;
  const history: ChainEntry[] = [];
  let speaker: AgentDef = req.firstAgent;

  for (let hopIdx = 0; hopIdx < maxHops; hopIdx++) {
    if (req.signal?.aborted) return;

    const isFirst = hopIdx === 0;
    const isLast = hopIdx === maxHops - 1;

    let call: ResolvedAgentCall;
    try {
      call = await req.resolveCall(speaker);
    } catch (err) {
      events.onAgentError(
        speaker.id,
        err instanceof Error ? err : new Error(String(err)),
      );
      return;
    }

    const baseSystem = `${req.room.systemPromptShared}\n\n---\n\n${speaker.systemPrompt}`;
    const system = composeHandoffSystem(baseSystem, speaker, req.room);
    const userPrompt = composeHandoffUserPrompt(
      req.userPrompt,
      history,
      isFirst,
      isLast,
    );

    let totalText = '';
    let forwarded = 0;
    const currentSpeaker = speaker; // Captured for the closure below.

    events.onAgentThinking(currentSpeaker.id);

    let streamResult: StreamResult;
    try {
      streamResult = await call.provider.stream({
        system,
        userPrompt,
        maxTokens: call.maxTokens ?? 1000,
        thinking: req.thinking,
        permissionMode: req.permissionMode ?? call.permissionMode ?? 'default',
        skillsDir: call.skillsDir,
        maxTurns: call.maxTurns,
        signal: req.signal,
        onTextChunk: (chunk) => {
          totalText += chunk;
          const safeEnd = totalText.length - TAIL_BUFFER;
          if (safeEnd > forwarded) {
            const toEmit = totalText.slice(forwarded, safeEnd);
            if (toEmit.length > 0) {
              events.onAgentChunk(currentSpeaker.id, toEmit);
            }
            forwarded = safeEnd;
          }
        },
        onToolUse: (event) => events.onAgentToolUse(currentSpeaker.id, event),
      });
    } catch (err) {
      events.onAgentError(
        currentSpeaker.id,
        err instanceof Error ? err : new Error(String(err)),
      );
      return;
    }

    const parsed = parseHandoff(totalText);

    // Drain whatever clean text we still owe the caller. If the token sat at
    // the very tail, `cleanText.length` may be ≤ `forwarded` (we already
    // forwarded part of what's now stripped). In that case we emit nothing.
    if (parsed.cleanText.length > forwarded) {
      events.onAgentChunk(
        currentSpeaker.id,
        parsed.cleanText.slice(forwarded),
      );
    }

    events.onAgentComplete(
      currentSpeaker.id,
      parsed.cleanText,
      streamResult,
      call.provider.id,
    );

    history.push({ agentName: currentSpeaker.name, text: parsed.cleanText });

    if (parsed.signal.kind === 'done' || parsed.signal.kind === 'none') {
      return;
    }

    // signal.kind === 'next'
    const target = resolveTargetAgent(parsed.signal.targetName, req.room);
    if (!target) {
      events.onChainError(
        'unknown_agent',
        `Agent "${parsed.signal.targetName}" is not in this room. Chain stopped.`,
      );
      return;
    }
    if (target.id === currentSpeaker.id) {
      // Self-handoff is treated as completion to prevent infinite loops.
      return;
    }

    events.onHandoff(currentSpeaker.id, target.id);
    speaker = target;
  }

  events.onChainError(
    'hop_cap_reached',
    `Reached the ${maxHops}-hop limit without [DONE]. Chain stopped.`,
  );
}

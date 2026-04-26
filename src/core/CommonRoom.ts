import * as vscode from 'vscode';
import type { LlmProvider, StreamResult, ToolUseEvent } from '@/api/provider';
import { costForStream } from '@/core/CostTracker';
import { pickNextSpeaker, type TranscriptEntry } from '@/core/Moderator';
import { providerForModerator, resolveAgentCall } from '@/core/ProviderFactory';
import { saveGreatHallTranscript, type TranscriptMessage } from '@/core/Persistence';
import type { Settings } from '@/core/Settings';
import { SkillsManager } from '@/core/SkillsManager';
import type { AgentDef, Room } from '@/rooms/types';

/**
 * The Great Hall convenes agents from any room. A moderator (cheap model)
 * picks the next speaker; that speaker streams a reply using their home
 * room's personality; the moderator picks again; and so on, until it says
 * DONE or we hit the turn cap.
 *
 * Design decisions:
 * - The moderator doesn't speak. It only routes. It sees the task, the roster,
 *   and the transcript so far; it replies with JSON.
 * - Each speaker gets a shared system prompt that includes the "great hall"
 *   preamble (you're in a convening; these are the other attendees; stay
 *   short) in front of their own personality prompt. We never mutate the
 *   home-room prompts.
 * - Abort: per-meeting AbortController. On abort we stop between turns; the
 *   in-flight stream's provider receives the signal too and kills its own
 *   request.
 */

export interface Attending {
  readonly room: Room;
  readonly agent: AgentDef;
}

export interface ConveneRequest {
  readonly meetingId: string;
  readonly task: string;
  readonly attending: readonly Attending[];
  /** Hard cap — default 6 per BUILD_PLAN.md §M4 acceptance. */
  readonly maxTurns?: number;
  readonly permissionMode?: 'plan' | 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk';
  readonly thinking?: 'off' | 'low' | 'medium' | 'high';
}

export interface ConveneEvents {
  readonly onModeratorPick: (agentId: string, rationale: string) => void;
  readonly onAgentThinking: (agentId: string) => void;
  readonly onAgentChunk: (agentId: string, chunk: string) => void;
  readonly onAgentComplete: (agentId: string, result: StreamResult, costUSD: number) => void;
  /** Called when a speaker's stream is aborted mid-turn. Lets the UI mark the
   *  partial turn done so the blinking caret stops. No cost is recorded. */
  readonly onAgentAborted: (agentId: string) => void;
  readonly onAgentToolUse?: (agentId: string, event: ToolUseEvent) => void;
  readonly onMeetingEnded: (end: {
    reason: 'done' | 'turn_limit' | 'cancelled' | 'error';
    turns: number;
    costUSD: number;
    transcriptPath?: string;
  }) => void;
  readonly onError: (err: Error) => void;
}

export class CommonRoom {
  constructor(
    private readonly ctx: vscode.ExtensionContext,
    private readonly settings: Settings,
    private readonly skills: SkillsManager,
  ) {}

  async convene(req: ConveneRequest, events: ConveneEvents, signal: AbortSignal): Promise<void> {
    const maxTurns = req.maxTurns ?? 6;
    const startedAt = new Date().toISOString();
    const transcript: TranscriptEntry[] = [];
    const savedMessages: TranscriptMessage[] = [];
    let totalCost = 0;
    let reason: 'done' | 'turn_limit' | 'cancelled' | 'error' = 'done';

    let moderator: LlmProvider;
    try {
      moderator = await providerForModerator(this.ctx, this.settings);
    } catch (err) {
      events.onError(err instanceof Error ? err : new Error(String(err)));
      events.onMeetingEnded({ reason: 'error', turns: 0, costUSD: 0 });
      return;
    }

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        if (signal.aborted) {
          reason = 'cancelled';
          break;
        }

        let pick;
        try {
          pick = await pickNextSpeaker(
            moderator,
            req.attending.map(({ room, agent }) => ({ room, agent })),
            req.task,
            transcript,
            signal,
          );
        } catch (err) {
          if (signal.aborted) {
            reason = 'cancelled';
            break;
          }
          throw err;
        }

        if (signal.aborted) {
          reason = 'cancelled';
          break;
        }

        if (pick.nextAgentId === null) {
          reason = 'done';
          break;
        }

        const speaker = req.attending.find((a) => a.agent.id === pick.nextAgentId);
        if (!speaker) {
          // Moderator returned a valid-looking id that isn't in the roster.
          reason = 'done';
          break;
        }

        events.onModeratorPick(speaker.agent.id, pick.rationale);
        events.onAgentThinking(speaker.agent.id);

        const call = await resolveAgentCall(
          this.ctx,
          speaker.agent,
          'common',
          this.settings,
          this.skills,
        );
        const system = composeSpeakerSystem(speaker, req.attending);
        const userPrompt = composeSpeakerUserPrompt(req.task, transcript);

        let full = '';
        let result: StreamResult;
        try {
          result = await call.provider.stream({
            system,
            userPrompt,
            maxTokens: call.maxTokens,
            thinking: req.thinking,
            signal,
            onTextChunk: (chunk) => {
              full += chunk;
              events.onAgentChunk(speaker.agent.id, chunk);
            },
            onToolUse: events.onAgentToolUse
              ? (event) => events.onAgentToolUse!(speaker.agent.id, event)
              : undefined,
            permissionMode: req.permissionMode ?? call.permissionMode,
            skillsDir: call.skillsDir,
            maxTurns: call.maxTurns,
          });
        } catch (err) {
          if (signal.aborted) {
            events.onAgentAborted(speaker.agent.id);
            reason = 'cancelled';
            break;
          }
          events.onError(err instanceof Error ? err : new Error(String(err)));
          reason = 'error';
          break;
        }

        if (signal.aborted) {
          events.onAgentAborted(speaker.agent.id);
          reason = 'cancelled';
          break;
        }

        const streamCost = costForStream({
          provider: call.provider.id,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          providerReportedCostUSD: result.providerReportedCostUSD,
        });
        totalCost += streamCost;

        events.onAgentComplete(speaker.agent.id, result, streamCost);

        const bodyText = result.fullText || full;
        transcript.push({
          agentId: speaker.agent.id,
          agentName: speaker.agent.name,
          text: bodyText,
        });
        savedMessages.push({
          agentId: speaker.agent.id,
          agentName: speaker.agent.name,
          roomId: speaker.room.id,
          text: bodyText,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUSD: streamCost,
          at: Date.now(),
        });

        if (turn === maxTurns - 1) {
          reason = 'turn_limit';
        }
      }
    } catch (err) {
      events.onError(err instanceof Error ? err : new Error(String(err)));
      reason = 'error';
    }

    let transcriptPath: string | undefined;
    if (savedMessages.length > 0) {
      try {
        transcriptPath = await saveGreatHallTranscript({
          id: req.meetingId.replace(/^m_/, ''),
          roomId: 'common',
          startedAt,
          endedAt: new Date().toISOString(),
          task: req.task,
          attending: req.attending.map((a) => a.agent.id),
          messages: savedMessages,
          costUSD: totalCost,
          endReason: reason,
        });
      } catch (err) {
        // Saving is best-effort; the meeting still happened.
        console.error('[hollow halls] failed to save transcript:', err);
      }
    }

    events.onMeetingEnded({ reason, turns: savedMessages.length, costUSD: totalCost, transcriptPath });
  }
}

const GREAT_HALL_PREAMBLE = `
You are speaking in the Great Hall — a convening of agents from across the Hollow Halls. The others at the table are listed below. You each speak in turn.

Rules of the hall:
- Be brief. The Great Hall rewards pith, not prose. Two or three short paragraphs at the most.
- Stay in your craft. Don't wander into another agent's discipline unless you're genuinely handing off. If the next move is theirs, name them and stop.
- Assume everyone has read the transcript. Don't summarize what the person before you just said. Build on it, redirect it, or politely disagree.
- You are yourself, not a chorus. Keep your voice.
`.trim();

function composeSpeakerSystem(speaker: Attending, attending: readonly Attending[]): string {
  const others = attending
    .filter((a) => a.agent.id !== speaker.agent.id)
    .map((a) => `  - ${a.agent.name} (${a.agent.tag}, from ${a.room.name.toLowerCase()})`)
    .join('\n');

  return [
    speaker.room.systemPromptShared,
    '---',
    speaker.agent.systemPrompt,
    '---',
    GREAT_HALL_PREAMBLE,
    `Also at the table:\n${others || '  (no one — you are addressing the task directly)'}`,
  ].join('\n\n');
}

function composeSpeakerUserPrompt(task: string, transcript: readonly TranscriptEntry[]): string {
  const transcriptBlock = transcript.length === 0
    ? '(you speak first)'
    : transcript
        .map((t) => `[${t.agentName.toLowerCase()}] ${t.text.trim()}`)
        .join('\n\n');

  return `The convening's task:
${task.trim()}

The conversation so far:
${transcriptBlock}

Your turn — speak as yourself, building on (or redirecting) what's been said.`;
}

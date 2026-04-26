import type { LlmProvider } from '@/api/provider';
import type { AgentDef, Room } from '@/rooms/types';

/**
 * The Speaker — a cheap routing LLM that picks who talks next in a Great Hall
 * meeting. It sees the roster, the task, and the transcript so far; it either
 * names an agent or says DONE.
 *
 * Model: the moderator-tier model per settings (Haiku on Anthropic/Claude Code;
 * the user's default on Ollama). max_tokens is tiny — we only want a JSON line.
 */

export interface ModeratorAgent {
  readonly room: Room;
  readonly agent: AgentDef;
}

export interface TranscriptEntry {
  readonly agentId: string;
  readonly agentName: string;
  readonly text: string;
}

export interface ModeratorPick {
  /** `null` means DONE — the meeting should end. */
  readonly nextAgentId: string | null;
  readonly rationale: string;
}

export async function pickNextSpeaker(
  moderator: LlmProvider,
  roster: readonly ModeratorAgent[],
  task: string,
  transcript: readonly TranscriptEntry[],
  signal?: AbortSignal,
): Promise<ModeratorPick> {
  const system = buildSystemPrompt(roster);
  const userPrompt = buildUserPrompt(roster, task, transcript);

  let full = '';
  const result = await moderator.stream({
    system,
    userPrompt,
    // Enough for a JSON line + a short reason; never needs to be a paragraph.
    maxTokens: 120,
    signal,
    onTextChunk: (c) => {
      full += c;
    },
  });

  // Some providers reply with `fullText`; prefer that when available.
  const body = result.fullText || full;
  return parsePick(body, roster);
}

function buildSystemPrompt(roster: readonly ModeratorAgent[]): string {
  const lines = roster.map(({ room, agent }) =>
    `  - ${agent.id} — ${agent.name}, ${agent.tag} (from ${room.name.toLowerCase()})`,
  ).join('\n');

  return `You are the Speaker — the moderator of a convening in the Great Hall of the Hollow Halls.

Your job is small and exact: given the task, the attending agents, and the conversation so far, pick who should speak next. You never speak yourself — you only route.

The attending agents are:
${lines}

Rules:
- Pick whoever can add something the conversation is missing right now. A threat-modeler after a designer. A copywriter after an IA. A research lead to slow a team down with evidence.
- Do not pick the same agent twice in a row unless nobody else has anything to add.
- End the meeting with "DONE" once the task has been answered, or once the agents are beginning to repeat each other.
- Respond with one JSON object on a single line. Nothing else. Example:
  {"next":"maya","why":"open with a visual recommendation"}
  or
  {"next":"DONE","why":"task answered"}
- "why" must be ≤ 10 words.`;
}

function buildUserPrompt(
  roster: readonly ModeratorAgent[],
  task: string,
  transcript: readonly TranscriptEntry[],
): string {
  const rosterIds = roster.map((r) => r.agent.id).join(', ');
  const transcriptBlock = transcript.length === 0
    ? '(no turns yet — the meeting is just beginning)'
    : transcript.map((t, i) => `[${i + 1} · ${t.agentName.toLowerCase()}] ${t.text.trim()}`).join('\n\n');

  return `TASK:
${task.trim()}

ATTENDING:
${rosterIds}

TRANSCRIPT SO FAR:
${transcriptBlock}

Who speaks next? Reply with JSON only.`;
}

function parsePick(body: string, roster: readonly ModeratorAgent[]): ModeratorPick {
  const validIds = new Set(roster.map((r) => r.agent.id));
  const json = extractLastJsonObject(body);
  if (json) {
    try {
      const parsed = JSON.parse(json) as { next?: unknown; why?: unknown };
      const next = typeof parsed.next === 'string' ? parsed.next.trim() : '';
      const why = typeof parsed.why === 'string' ? parsed.why.trim().slice(0, 80) : '';
      if (next === 'DONE' || next.toLowerCase() === 'done') {
        return { nextAgentId: null, rationale: why || 'done' };
      }
      if (validIds.has(next)) {
        return { nextAgentId: next, rationale: why || 'next speaker' };
      }
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic fallback: find an agent id mentioned in the reply.
  const lower = body.toLowerCase();
  if (/\bdone\b/.test(lower)) return { nextAgentId: null, rationale: 'done (inferred)' };
  for (const r of roster) {
    if (lower.includes(r.agent.id.toLowerCase())) {
      return { nextAgentId: r.agent.id, rationale: 'inferred from reply' };
    }
  }

  // Last resort: end the meeting cleanly rather than pick a random agent.
  return { nextAgentId: null, rationale: 'moderator gave no usable pick' };
}

function extractLastJsonObject(s: string): string | undefined {
  // Walk the string; find balanced {...} objects and return the last one.
  // Handles moderators that wrap JSON in prose or code fences.
  const stack: number[] = [];
  let last: string | undefined;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') stack.push(i);
    else if (ch === '}' && stack.length > 0) {
      const start = stack.pop()!;
      if (stack.length === 0) last = s.slice(start, i + 1);
    }
  }
  return last;
}

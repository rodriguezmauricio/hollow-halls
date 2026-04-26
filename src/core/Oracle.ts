import type { LlmProvider } from '@/api/provider';
import type { Room } from '@/rooms/types';
import type { OracleDecision } from '@/messaging/protocol';

/**
 * Ask the Oracle to route a visitor's prompt.
 *
 * Makes a single cheap Haiku call with the room roster as context.
 * Returns a parsed routing decision — room, great-hall, or direct answer.
 */
export async function consult(
  prompt: string,
  rooms: readonly Room[],
  provider: LlmProvider,
  signal?: AbortSignal,
): Promise<OracleDecision> {
  const roster = buildRoster(rooms);
  let collected = '';

  try {
    await provider.stream({
      system: oracleSystem(roster),
      userPrompt: prompt,
      maxTokens: 200,
      maxTurns: 1,
      signal,
      onTextChunk: (chunk) => { collected += chunk; },
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    // Non-abort errors → fall through to best-effort parse (may be partial).
  }

  return parseDecision(collected);
}

function buildRoster(rooms: readonly Room[]): string {
  return rooms.map((r) =>
    `- ${r.id}: ${r.agents.map((a) => `${a.id} (${a.tag})`).join(', ')}`,
  ).join('\n');
}

function parseDecision(text: string): OracleDecision {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return { route: 'direct', answer: cleaned || 'The Oracle is silent.' };
  }
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      route?: string;
      roomId?: string;
      agents?: Array<{ roomId: string; agentId: string }>;
      rationale?: string;
      answer?: string;
    };
    if (obj.route === 'room' && typeof obj.roomId === 'string') {
      return { route: 'room', roomId: obj.roomId, rationale: obj.rationale ?? '' };
    }
    if (obj.route === 'hall' && Array.isArray(obj.agents) && obj.agents.length > 0) {
      return { route: 'hall', agents: obj.agents, rationale: obj.rationale ?? '' };
    }
    if (obj.route === 'direct' && typeof obj.answer === 'string') {
      return { route: 'direct', answer: obj.answer };
    }
  } catch {
    // fall through
  }
  return { route: 'direct', answer: cleaned };
}

function oracleSystem(roster: string): string {
  return `You are the Oracle — the entrance to the Hollow Halls. Route the visitor to the right room.

ROOMS AND AGENTS:
${roster}

Room expertise:
- design: typography, visual systems, brand identity, color, motion design
- uiux: information architecture, user flows, wireframes, navigation, user research
- code: architecture review, code quality, refactoring, systems design, testing, performance
- front: React, JavaScript frameworks, state management, CSS, layout, responsive design, animations
- market: product positioning, value propositions, product copy, UI microcopy, landing pages
- sec: threat modelling, auth, security review, reverse engineering, binary analysis

Respond with ONLY valid JSON on one line. Choose one:
{"route":"room","roomId":"<id>","rationale":"<one sentence, speak to the visitor, present tense>"}
{"route":"hall","agents":[{"roomId":"<id>","agentId":"<id>"}...],"rationale":"<one sentence>"}
{"route":"direct","answer":"<concise factual answer, no fluff>"}

Rules:
- "room" for single-discipline questions
- "hall" for cross-discipline questions — pick 2-4 relevant agents
- "direct" ONLY for trivial factual questions (definitions, unit conversions, short facts) that need no expert judgment
- Rationale: speak to the visitor directly. "That's typography — sending you to Maya." or "This spans design and security — convening Maya and Kai."`.trim();
}

/**
 * Token-driven handoff protocol for in-room agent-to-agent chains.
 *
 *   [NEXT: AgentName]   end this turn, route to a room-mate
 *   [DONE]              answer is complete, end the chain
 *   (no token)          treated as implicit [DONE]
 *
 * Tokens are only honored when they sit on the trailing non-empty line, alone
 * (modulo surrounding whitespace). Inline `[NEXT:` substrings inside an
 * answer's body are left untouched. The parser strips the matched token from
 * `cleanText` so the user-visible transcript never carries it.
 */

import type { AgentDef, Room } from '@/rooms/types';

export type HandoffSignal =
  | { readonly kind: 'next'; readonly targetName: string }
  | { readonly kind: 'done' }
  | { readonly kind: 'none' };

export interface ParsedHandoff {
  readonly signal: HandoffSignal;
  readonly cleanText: string;
  /** Number of trailing characters stripped from the original input.
   *  Used by the chain to know how much of its forward-buffer to drop. */
  readonly strippedTrailingLength: number;
}

const TRAILING_TOKEN_RE = /\s*\[\s*(NEXT\s*:\s*([^\]\n]+?)|DONE)\s*\]\s*$/i;

/** Parse the trailing token (if any) and return the cleaned body. */
export function parseHandoff(text: string): ParsedHandoff {
  const match = text.match(TRAILING_TOKEN_RE);
  if (!match) {
    return { signal: { kind: 'none' }, cleanText: text, strippedTrailingLength: 0 };
  }
  const stripped = match[0].length;
  const cleanText = text.slice(0, text.length - stripped).replace(/\s+$/, '');
  const inner = match[1].toUpperCase();
  if (inner === 'DONE') {
    return { signal: { kind: 'done' }, cleanText, strippedTrailingLength: stripped };
  }
  const targetName = (match[2] ?? '').trim();
  if (!targetName) {
    return { signal: { kind: 'none' }, cleanText: text, strippedTrailingLength: 0 };
  }
  return { signal: { kind: 'next', targetName }, cleanText, strippedTrailingLength: stripped };
}

/** Find a room-mate by case-insensitive name OR id. */
export function resolveTargetAgent(name: string, room: Room): AgentDef | null {
  const needle = name.trim().toLowerCase();
  for (const a of room.agents) {
    if (a.name.toLowerCase() === needle) return a;
    if (a.id.toLowerCase() === needle) return a;
  }
  return null;
}

/** Build the handoff vocabulary preamble appended to each chained agent's
 *  system prompt. Lists the room-mates by display name so the model knows
 *  exactly which names are valid targets. */
export function composeHandoffSystem(
  baseSystem: string,
  speaker: AgentDef,
  room: Room,
): string {
  const others = room.agents.filter((a) => a.id !== speaker.id);
  if (others.length === 0) return baseSystem;
  const roster = others.map((a) => `  - ${a.name} (${a.tag})`).join('\n');
  return [
    baseSystem,
    '',
    '--- HANDOFF PROTOCOL ---',
    `You are working alongside other specialists in the ${room.name} room.`,
    'When the next move belongs to a different specialist, end your reply with:',
    '  [NEXT: AgentName]',
    'When the answer is complete, end your reply with:',
    '  [DONE]',
    '',
    'Rules:',
    '  - The token MUST appear on its own trailing line, with nothing after it.',
    '  - Use [NEXT:] sparingly — only when the next step genuinely needs a different specialist.',
    '  - Do not chain unnecessarily. If you can finish the answer yourself, finish it and end with [DONE].',
    '  - Do NOT mention the protocol or these tokens in your prose. They are routing only.',
    '',
    'Available room-mates:',
    roster,
    '--- END HANDOFF PROTOCOL ---',
  ].join('\n');
}

export interface ChainEntry {
  readonly agentName: string;
  readonly text: string;
}

/** Build the user prompt for hop N. First hop sees the original prompt; later
 *  hops see a transcript of prior hops + an instruction to continue or close. */
export function composeHandoffUserPrompt(
  originalPrompt: string,
  history: readonly ChainEntry[],
  isFirst: boolean,
  appendWrapUpNudge: boolean,
): string {
  let body: string;
  if (isFirst) {
    body = originalPrompt;
  } else {
    const transcript = history
      .map((e) => `[${e.agentName}]\n${e.text}`)
      .join('\n\n');
    body = [
      `Original request from the user:`,
      originalPrompt,
      '',
      `Conversation so far in this room:`,
      transcript,
      '',
      `You have been called in. Continue the work, or close the chain with [DONE] if the answer is complete.`,
    ].join('\n');
  }
  if (appendWrapUpNudge) {
    body += '\n\n' + WRAP_UP_NUDGE;
  }
  return body;
}

export const WRAP_UP_NUDGE =
  'NOTE: This is the final allowed hop. Conclude the answer in this turn ' +
  'and end with [DONE]. Do not hand off again.';

export const DEFAULT_MAX_HOPS = 8;

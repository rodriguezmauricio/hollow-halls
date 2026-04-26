/**
 * Single source of truth for messages crossing the extension host <-> webview boundary.
 * Both sides import from this module (webview via esbuild bundling).
 */

/** Oracle routing decision — shared between extension host and webview. */
export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';
export type PickerMode = 'plan' | 'acceptEdits' | 'bypassPermissions';

export type OracleDecision =
  | { readonly route: 'room'; readonly roomId: string; readonly rationale: string }
  | {
      readonly route: 'hall';
      readonly agents: ReadonlyArray<{ readonly roomId: string; readonly agentId: string }>;
      readonly rationale: string;
    }
  | { readonly route: 'direct'; readonly answer: string };

/** Visual identity hooks. Rendered by webview/scene/Agent.ts. All fields
 *  are hex colors unless noted. Agents may be visually "empty" in which case
 *  the renderer falls back to a silhouette. */
export interface AgentVisual {
  readonly skin: string;          // face/hand tone
  readonly hair: string;          // hair color
  readonly hairStyle: 'short' | 'bob' | 'long' | 'buzz' | 'bun';
  readonly outfit: string;        // main clothing body
  readonly outfitTrim?: string;   // stripe / apron / collar color
  readonly accessory?: 'paintbrush' | 'glasses' | 'headphones' | 'pipe' | 'pin';
  readonly accent?: string;       // accessory highlight color
}

export interface AgentPublicInfo {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly visual: AgentVisual;
}

export interface RoomPublicInfo {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly accentColor: string;
  readonly agents: readonly AgentPublicInfo[];
}

/** One attending agent at a Great Hall meeting, carrying its source room's
 *  accent so the transcript can paint each turn with the right soul color. */
export interface AttendingAgent {
  readonly roomId: string;
  readonly roomName: string;
  readonly accentColor: string;
  readonly agent: AgentPublicInfo;
}

export type WebviewMsg =
  | { readonly type: 'ready' }
  | { readonly type: 'open_room'; readonly roomId: string }
  | { readonly type: 'close_room' }
  | {
      readonly type: 'send_prompt';
      readonly roomId: string;
      readonly agentIds: readonly string[];
      readonly prompt: string;
      /** Optional mode override ('acceptEdits' triggered by a BUILD button). */
      readonly permissionMode?:
        | 'plan' | 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk';
      readonly thinking?: ThinkingLevel;
    }
  | {
      /** Re-send the most recent user prompt to the same agent in acceptEdits.
       *  main.ts retained the original prompt + agent ids per room. */
      readonly type: 'build_last_turn';
      readonly roomId: string;
      readonly agentId: string;
      readonly prompt: string;
    }
  | { readonly type: 'open_great_hall' }
  | { readonly type: 'close_great_hall' }
  | {
      readonly type: 'convene';
      /** Selected participants, each as {roomId, agentId}. */
      readonly picks: ReadonlyArray<{ readonly roomId: string; readonly agentId: string }>;
      readonly task: string;
      readonly permissionMode?: 'plan' | 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk';
      readonly thinking?: ThinkingLevel;
    }
  | { readonly type: 'cancel_meeting'; readonly meetingId: string }
  | { readonly type: 'cancel_room_stream'; readonly roomId: string }
  | { readonly type: 'oracle_consult'; readonly prompt: string }
  | { readonly type: 'open_file'; readonly path: string };

export type ExtensionMsg =
  | {
      readonly type: 'init';
      readonly rooms: readonly RoomPublicInfo[];
    }
  | {
      readonly type: 'room_opened';
      readonly room: RoomPublicInfo;
    }
  | {
      readonly type: 'user_prompt';
      readonly roomId: string;
      readonly text: string;
    }
  | {
      readonly type: 'agent_thinking';
      readonly roomId: string;
      readonly meetingId: string;
      readonly agentId: string;
    }
  | {
      readonly type: 'agent_text_chunk';
      readonly roomId: string;
      readonly meetingId: string;
      readonly agentId: string;
      readonly chunk: string;
    }
  | {
      readonly type: 'agent_message_complete';
      readonly roomId: string;
      readonly meetingId: string;
      readonly agentId: string;
    }
  | {
      readonly type: 'room_activity';
      readonly roomId: string;
      /** true when any stream in the room is in-flight, false when idle. */
      readonly busy: boolean;
    }
  | {
      readonly type: 'cost_update';
      readonly roomId: string;
      readonly agentId: string;
      readonly provider: 'anthropic' | 'ollama' | 'claude-code';
      readonly model: string;
      readonly inputTokens: number;
      readonly outputTokens: number;
      /** Session total after this entry is recorded (USD). */
      readonly sessionTotalUSD: number;
      /** Cost of this specific stream (USD). */
      readonly thisStreamUSD: number;
    }
  | {
      readonly type: 'great_hall_opened';
      /** Agents available to convene, grouped by their home room. */
      readonly roster: ReadonlyArray<{
        readonly roomId: string;
        readonly roomName: string;
        readonly accentColor: string;
        readonly agents: readonly AgentPublicInfo[];
      }>;
    }
  | {
      readonly type: 'meeting_started';
      readonly meetingId: string;
      readonly attending: readonly AttendingAgent[];
      readonly task: string;
    }
  | {
      readonly type: 'moderator_pick';
      readonly meetingId: string;
      readonly agentId: string;
      /** Short why-next rationale from the moderator (≤10 words). */
      readonly rationale: string;
    }
  | {
      readonly type: 'meeting_ended';
      readonly meetingId: string;
      readonly reason: 'done' | 'turn_limit' | 'cancelled' | 'error';
      readonly turns: number;
      readonly costUSD: number;
      /** Filesystem path of the saved transcript, if persistence succeeded. */
      readonly transcriptPath?: string;
    }
  | {
      readonly type: 'agent_tool_use';
      readonly roomId: string;
      readonly meetingId: string;
      readonly agentId: string;
      readonly phase: 'start' | 'result';
      readonly toolName: string;
      /** Pre-formatted one-line summary for display. */
      readonly summary: string;
      readonly isError?: boolean;
      /** Opaque correlation id so the webview can pair start→result. */
      readonly toolUseId?: string;
    }
  | {
      /** A plan-mode reply finished streaming; text has been saved to disk. */
      readonly type: 'plan_saved';
      readonly roomId: string;
      readonly agentId: string;
      readonly path: string;
    }
  | { readonly type: 'oracle_thinking' }
  | { readonly type: 'oracle_response'; readonly decision: OracleDecision }
  | {
      /** Chain hop: agent A handed off to agent B in the same room.
       *  Cosmetic — webview draws a "→ B" marker between turns. */
      readonly type: 'chain_handoff';
      readonly roomId: string;
      readonly meetingId: string;
      readonly fromAgentId: string;
      readonly toAgentId: string;
    }
  | {
      /** Chain terminated abnormally — unknown handoff target or hop cap. */
      readonly type: 'chain_error';
      readonly roomId: string;
      readonly meetingId: string;
      readonly kind: 'unknown_agent' | 'hop_cap_reached';
      readonly message: string;
    }
  | {
      readonly type: 'error';
      readonly message: string;
    };

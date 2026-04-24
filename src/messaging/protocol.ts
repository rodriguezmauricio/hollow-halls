/**
 * Single source of truth for messages crossing the extension host <-> webview boundary.
 * Both sides import from this module (webview via esbuild bundling).
 */

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

export type WebviewMsg =
  | { readonly type: 'ready' }
  | { readonly type: 'open_room'; readonly roomId: string }
  | { readonly type: 'close_room' }
  | {
      readonly type: 'send_prompt';
      readonly roomId: string;
      readonly agentIds: readonly string[];
      readonly prompt: string;
    };

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
      readonly type: 'error';
      readonly message: string;
    };

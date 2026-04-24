# ARCHITECTURE — The Hollow Halls

## High-level

```
┌──────────────────────── VS Code ────────────────────────────┐
│                                                              │
│  Extension Host (Node.js)        Webview (Sandboxed Browser) │
│  ┌──────────────────────┐        ┌──────────────────────┐    │
│  │  HollowExtension     │        │  BuildingScene       │    │
│  │   ├─ AgentManager    │ ─────► │   ├─ Room components │    │
│  │   ├─ RoomRegistry    │ msgs   │   ├─ Speech bubbles  │    │
│  │   ├─ CommonRoom      │ ◄───── │   ├─ Modal           │    │
│  │   ├─ Oracle          │        │   └─ Cost meter HUD  │    │
│  │   ├─ ToolRunner      │        └──────────────────────┘    │
│  │   ├─ Persistence     │                                    │
│  │   └─ CostTracker     │                                    │
│  └────────┬─────────────┘                                    │
│           │                                                  │
│           ▼                                                  │
│   Anthropic SDK (streaming)                                  │
│           │                                                  │
└───────────┼──────────────────────────────────────────────────┘
            ▼
       Anthropic API
```

**Key principle**: the extension host owns all logic and state. The webview is a render layer that receives semantic events (`agent_speaking_chunk`, `meeting_started`) and dispatches user intents (`open_room`, `send_prompt`). The webview has no business logic and no API keys.

This split exists so that:
- The frontend can be swapped (terminal TUI, web app) without touching orchestration
- API keys never leave the extension host (webview is sandboxed)
- Persistence can use the workspace filesystem cleanly
- Tools can run with the user's filesystem permissions

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension host | TypeScript, Node 20+ | VS Code extension standard |
| LLM client | `@anthropic-ai/sdk` | First-party, streaming support, MCP support |
| Webview | TypeScript + Vite + vanilla web components OR React | React if team is comfy; vanilla if minimizing bundle |
| Rendering | SVG for static rooms, CSS animations for ambient, requestAnimationFrame for figure breathing | SVG gives crisp scaling and easy theme variables; canvas only if perf demands |
| Bundling | esbuild (fast extension reload) | Standard in VS Code extensions |
| Testing | Vitest (unit), `@vscode/test-electron` (integration) | Standard |
| Persistence | JSON files in `<workspace>/.hollow/` | Simple, git-ignorable, debuggable |
| State (webview) | Lightweight: Zustand or vanilla pub/sub | Avoid Redux overhead |

---

## Directory Structure

```
hollow-halls/
├── package.json              # extension manifest
├── CLAUDE.md                 # rules for Claude Code (see CLAUDE.md doc)
├── README.md
├── src/
│   ├── extension.ts          # entry; registers commands, opens webview
│   ├── core/
│   │   ├── AgentManager.ts   # per-agent state, system prompt assembly
│   │   ├── RoomRegistry.ts   # rooms config (built-in + custom)
│   │   ├── CommonRoom.ts     # synchronous multi-agent meeting orchestration
│   │   ├── Oracle.ts         # routing agent
│   │   ├── ToolRunner.ts     # tool execution (file ops, etc.)
│   │   ├── CostTracker.ts    # token accounting
│   │   └── Persistence.ts    # JSON file load/save
│   ├── api/
│   │   ├── client.ts         # Anthropic SDK wrapper
│   │   └── streaming.ts      # event normalization
│   ├── messaging/
│   │   ├── protocol.ts       # shared message types (extension <-> webview)
│   │   └── bridge.ts         # postMessage bridge
│   └── rooms/
│       ├── design.ts
│       ├── uiux.ts
│       ├── code.ts
│       ├── front.ts
│       ├── market.ts
│       └── sec.ts
├── webview/
│   ├── index.html
│   ├── main.ts               # entry; sets up scene + message bridge
│   ├── scene/
│   │   ├── Building.ts       # the SVG floor plan
│   │   ├── Room.ts           # one room (svg group, hover, click)
│   │   ├── Agent.ts          # masked figure renderer
│   │   ├── SpeechBubble.ts   # streaming typewriter
│   │   ├── Hallway.ts
│   │   └── GreatHall.ts
│   ├── modal/
│   │   ├── ChamberModal.ts   # the prompt + agent picker dialog
│   │   └── styles.css
│   ├── theme/
│   │   ├── hollow.css        # default theme; CSS vars
│   │   └── tokens.ts         # color/font tokens shared with TS
│   └── styles/
│       └── global.css
├── assets/
│   ├── fonts/                # bundled Cinzel + IBM Plex Mono
│   └── icons/
├── test/
│   ├── unit/
│   └── integration/
└── .hollow/                  # workspace-local; gitignored example
    ├── rooms.json            # custom rooms
    ├── settings.json         # api key ref, model defaults
    └── transcripts/          # per-meeting logs
```

---

## Core Abstractions

### `Room`

```ts
interface Room {
  id: string;                    // 'design', 'uiux', etc. (or uuid for custom)
  name: string;                  // 'DESIGN'
  subtitle: string;              // '— atelier'
  description: string;           // shown in modal subtitle
  accentColor: string;           // soul color hex
  systemPromptShared: string;    // appended to every agent's prompt in this room
  tools: ToolName[];             // tools all agents in this room can call
  agents: AgentDef[];
  position: RoomPosition;        // grid coords for the building layout
  isBuiltIn: boolean;
}

interface AgentDef {
  id: string;                    // 'maya'
  name: string;                  // 'Maya'
  tag: string;                   // 'design lead'
  systemPrompt: string;          // the personality + craft prompt
  model?: 'sonnet' | 'haiku' | 'opus';  // override default
  voice?: { tone: string; quirks: string[] };  // optional flavor metadata
}

type RoomPosition =
  | { kind: 'grid'; row: 0 | 1; col: 0 | 1 | 2 }
  | { kind: 'oracle' }
  | { kind: 'great-hall' };
```

### `AgentManager`

Owns the per-conversation state for each agent. Builds the final system prompt by composing:

```
[Room shared prompt]
[Agent personality prompt]
[Optional context: workspace info, current files, etc.]
```

Calls the Anthropic API with streaming. Emits events through the bridge:
- `agent.thinking_started`
- `agent.text_chunk`
- `agent.tool_use_started`
- `agent.tool_use_result`
- `agent.message_complete`

### `CommonRoom` (the Great Hall)

Implements the moderator pattern:

```ts
class CommonRoom {
  async convene(opts: ConveneOptions): Promise<MeetingResult> {
    // opts.task         — user's prompt
    // opts.attending    — AgentDef[] (max 7)
    // opts.maxTurns     — default 6
    // opts.handoff      — optional next room to hand result to
    // opts.budgetUSD    — soft cap; warn user if approached

    while (turn < maxTurns) {
      const nextSpeaker = await this.moderator.pickNext(transcript, attending);
      if (nextSpeaker === 'DONE') break;
      const reply = await this.streamAgent(nextSpeaker, transcript);
      transcript.push(reply);
    }
    if (handoff) return this.handoff(handoff, transcript);
    return { transcript, costUSD };
  }
}
```

The moderator is a Haiku call with a system prompt that picks the next speaker by id or returns "DONE". This is cheap and natural.

### `Oracle`

Routes a fuzzy user request to one of:
- A single room (`{ kind: 'route_to_room', roomId: 'design' }`)
- The Great Hall with a roster (`{ kind: 'convene', agents: [...] }`)
- A direct answer (`{ kind: 'direct_answer', text: '...' }`) — for trivial routing-isn't-needed cases

Implementation: one Haiku call with the room registry + agent roster as context. Returns structured JSON; extension host validates and dispatches.

### `ToolRunner`

Tools are functions the extension host can invoke on behalf of an agent. V1 ships with:

- `read_file(path)` — reads a workspace file
- `list_files(glob)` — globs the workspace
- `write_file(path, content)` — writes (with user confirmation)
- `web_search(query)` — uses Anthropic's web search tool
- `run_terminal(cmd)` — runs a shell command in the integrated terminal (with user confirmation)

Tools are registered per-room. Each tool call goes through a permission gate; the user can pre-approve a tool for a session or always-allow.

### `CostTracker`

Hooks every API call:
- Records input tokens × model rate + output tokens × model rate
- Surfaces running total in the VS Code status bar: `Hollow Halls · $0.42 today`
- Fires a soft warning at $1.00/session (configurable)
- Per-meeting cost shown in the meeting's modal footer

---

## Message Protocol (Extension Host ↔ Webview)

All messages are JSON over `webview.postMessage`. Discriminated unions, single source of truth in `src/messaging/protocol.ts`.

### Webview → Extension

```ts
type WebviewMsg =
  | { type: 'ready' }
  | { type: 'open_room'; roomId: string }
  | { type: 'close_modal' }
  | { type: 'send_prompt';
      roomId: string;
      prompt: string;
      agentIds: string[];        // [] = all
      handoffRoomId?: string;
    }
  | { type: 'cancel_meeting'; meetingId: string }
  | { type: 'get_room_config'; roomId: string }
  | { type: 'open_settings' };
```

### Extension → Webview

```ts
type ExtensionMsg =
  | { type: 'init';
      rooms: Room[];                // public-shape only — no system prompts
      stats: { agentsTotal: number; activeMeetings: number };
      theme: ThemeTokens;
    }
  | { type: 'meeting_started'; meetingId: string; roomId: string; attending: string[] }
  | { type: 'agent_thinking'; meetingId: string; agentId: string }
  | { type: 'agent_text_chunk'; meetingId: string; agentId: string; chunk: string }
  | { type: 'agent_tool_use'; meetingId: string; agentId: string; tool: string; status: 'started' | 'completed' | 'error' }
  | { type: 'agent_message_complete'; meetingId: string; agentId: string; fullText: string }
  | { type: 'meeting_ended'; meetingId: string; reason: 'done' | 'turn_limit' | 'cancelled' | 'error'; costUSD: number }
  | { type: 'oracle_routed'; targetRoomId?: string; agentRoster?: string[]; reason: string }
  | { type: 'cost_update'; sessionUSD: number; todayUSD: number }
  | { type: 'error'; code: string; message: string };
```

### Why streaming chunks instead of full messages

- Speech bubbles type out character-by-character → feels alive
- User sees the meeting start within ~200ms
- Cancelable mid-stream

---

## Data Persistence

Stored under `<workspace>/.hollow/`:

```
.hollow/
├── settings.json        # { apiKeyRef: "vscode-secrets://...", defaultModel: "sonnet", theme: "hollow" }
├── rooms.json           # custom rooms (built-in rooms are code, not data)
└── transcripts/
    └── 2026-04-23T14-22-38_great-hall_a3f9.json
```

API keys are stored via VS Code's `SecretStorage` API, not in JSON. The settings file references them by key.

Transcripts are append-only JSON, one file per meeting:

```json
{
  "id": "a3f9",
  "roomId": "common",
  "startedAt": "2026-04-23T14:22:38Z",
  "endedAt": "2026-04-23T14:24:11Z",
  "task": "Design a passwordless login flow",
  "attending": ["maya", "kai", "pell"],
  "messages": [
    { "agentId": "maya", "role": "assistant", "text": "...", "tokensIn": 412, "tokensOut": 88 }
  ],
  "costUSD": 0.038,
  "endReason": "done"
}
```

---

## Threading Model

- All API calls happen in the extension host on the Node event loop
- Multiple meetings can run concurrently (different rooms, different conversations)
- The webview is single-threaded; animations use `requestAnimationFrame`
- Token streaming uses async iterators; no worker threads needed for V1

---

## Security & Privacy

- API key stored in VS Code `SecretStorage` only
- Webview has no direct network access; all API calls go through extension host
- Tool execution requires user confirmation by default (configurable per-tool)
- No telemetry in V1
- Transcripts can be configured to be ephemeral (memory only, not persisted)

---

## Performance Budget

| Metric | Target |
|--------|--------|
| Extension activation | < 300ms |
| Webview first paint | < 500ms after activation |
| Idle CPU | < 1% (no animation work when nothing is happening) |
| Animation frame rate | 60fps with all 7 great-hall agents breathing |
| Time-to-first-token in a meeting | < 1.5s |
| Memory footprint (idle) | < 80MB extension host, < 60MB webview |

---

## Future-Proofing

Decisions that look forward to V2/V3:

- **Themes**: every visual constant lives in CSS variables and a `tokens.ts` map. A theme is a pair of those files.
- **Custom rooms**: the `Room` interface treats built-in and custom identically; built-ins just live in code, customs in JSON.
- **Community rooms**: the JSON shape is a stable API. A future "share to community" button serializes a room to a `.hollowroom` file.
- **MCP tools**: `ToolRunner` should be designed to accept MCP server URLs as a tool source from day one, even if V1 ships with hardcoded tools. The interface is the same.
- **Voice**: speech bubbles can degrade gracefully to TTS later without changing message protocol.

# 02 — Architecture

This is the most important technical doc in the package. Read it carefully before writing any code.

---

## High-level model

Hollow Halls is a **VS Code extension** with three layers:

```
┌─────────────────────────────────────────────────────┐
│           VS CODE EXTENSION HOST                    │
│   (Node.js process, runs in VS Code)                │
│                                                     │
│   ┌──────────────────────────────────────────────┐  │
│   │  ORCHESTRATOR                                │  │
│   │  • Spawns claude CLI subprocesses            │  │
│   │  • Parses their stdout for protocol tokens   │  │
│   │  • Routes messages between agents            │  │
│   │  • Manages hall state, task lifecycle        │  │
│   └──────────────────────────────────────────────┘  │
│                       │                             │
│                       │  IPC (stdin/stdout, JSON)   │
│                       ▼                             │
│   ┌──────────────────────────────────────────────┐  │
│   │  CLAUDE CODE SUBPROCESSES (one per agent)    │  │
│   │  • Spawned via `claude` CLI                  │  │
│   │  • Inherit user's OAuth credentials          │  │
│   │  • Each has its own working directory        │  │
│   │    (Git worktree for isolation)              │  │
│   │  • Each has its own skill, tools, model      │  │
│   └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        │  postMessage()
                        ▼
┌─────────────────────────────────────────────────────┐
│           WEBVIEW PANEL                             │
│   (HTML/JS in VS Code's webview, renders UI)        │
│                                                     │
│   • React + Vite                                    │
│   • Talks to extension host via postMessage         │
│   • Renders halls, agents, chat, scenes             │
│   • Never touches Claude Code directly              │
└─────────────────────────────────────────────────────┘
```

**Key separations:**

- The **webview is dumb.** It renders UI and emits user actions. It does not contain orchestration logic.
- The **orchestrator owns Claude Code.** All spawning, routing, and parsing happens in the extension host.
- **Claude Code subprocesses are sealed.** They don't know about Hollow Halls. They just receive prompts and emit replies. The orchestrator translates between Hollow Halls semantics (halls, agents, tokens) and Claude Code semantics (skills, tools, models).

---

## How a single agent task works

User clicks an agent in a hall and sends a message. Here's the flow:

```
User types in chat → Webview emits userMessage event
                                  │
                                  ▼
                  Orchestrator receives event
                                  │
                                  ▼
            Looks up agent's config:
            • Skill file path
            • Tool allowlist
            • Model tier (resolves to latest in tier)
            • Working directory (Git worktree)
                                  │
                                  ▼
        Spawns `claude` subprocess if not already running:
        ┌──────────────────────────────────────────┐
        │  claude --resume <session-id> \          │
        │    --model claude-sonnet-4-6 \           │
        │    --allowed-tools Edit,Read,Bash \      │
        │    --output-format json-stream \         │
        │    --append-system-prompt "$SKILL"       │
        └──────────────────────────────────────────┘
                                  │
                                  ▼
        Writes user message to subprocess stdin
                                  │
                                  ▼
        Reads JSON-streamed events from stdout:
        • text deltas → forwards to webview as streaming chat
        • tool calls → shows tool icon in agent's status
        • tool results → updates UI accordingly
        • final message → checks for protocol tokens
                                  │
                                  ▼
        Parses for protocol tokens:
        • [NEXT: name] → routes to next agent in same hall
        • [SUGGEST: name] → records suggestion (Council mode)
        • [DONE] → finalizes task, surfaces output to user
        • Plain text → continues to user as final reply
```

---

## How multi-agent conversations work

When agent A's reply contains `[NEXT: B]`:

1. Orchestrator extracts the routing token
2. Confirms B exists in the same hall (otherwise → bad-handoff error path)
3. Constructs a message for B: A's full reply (sans the NEXT token) becomes B's user input
4. Spawns or resumes B's Claude Code subprocess
5. Writes the message to B's stdin
6. Streams B's reply back to the webview, attributing it to B
7. When B emits `[NEXT: A]` or `[DONE]`, repeats

**Hop counting** is done in the orchestrator. Once 8 hops have occurred without `[DONE]`, the orchestrator injects a system message into the current speaker: *"Hop cap reached. Deliver a conclusion: what was decided, what remains open, what you suggest next. End with [DONE]."*

---

## How the Council Chamber works

When the user starts a Council:

1. Webview shows the Council surface — a circular layout of avatars representing each hall's Head
2. User picks which halls participate (default: all halls with a designated Head)
3. User types the topic
4. Orchestrator spawns all participating Heads' Claude Code subprocesses in parallel (each in their own Git worktree)
5. Orchestrator spawns a separate **Moderator** subprocess (Haiku) with a special prompt:

   > You are the moderator of a council meeting. The participating Heads are: [list with halls]. The user's topic is: [topic]. Pick which Head should speak next. Respond with `[SPEAK: name]` only. After each Head's reply, you'll see their content; pick the next speaker. End the meeting with `[CLOSE]` followed by a synthesis when consensus is reached, max turns hit, or no further insight is being added.

6. Each turn:
   - Moderator emits `[SPEAK: Aldric]`
   - Orchestrator forwards the conversation history so far to Aldric
   - Aldric replies; may include `[SUGGEST: Maya]` at the end
   - Orchestrator passes Aldric's content + suggestion (if any) back to the moderator
   - Moderator picks next speaker
7. End conditions:
   - Moderator emits `[CLOSE]` → final synthesis is presented to user
   - 12 turns reached → moderator forced to close
   - 200K tokens cumulative → moderator forced to close
   - 5 minutes wall time → moderator forced to close
   - User clicks Stop → orchestrator injects close prompt

---

## How the Oracle works

The Oracle is a routing classifier. When the user types into the Oracle (`⌘K`):

1. Orchestrator spawns a one-shot Claude Code subprocess with `--model haiku` and a routing prompt:

   > You are the Oracle. The user said: "[input]". Available halls: [list with descriptions]. Available agents: [list with hall + role]. Return JSON: `{"primary_hall": "name", "confidence": 0-1, "secondary_halls": ["name", "name"], "suggested_agent": "name", "reason": "brief"}`. If confidence < 0.4, set primary_hall to null and ask one clarifying question in `clarification` field.

2. Subprocess returns JSON
3. Orchestrator displays the suggestion in the Oracle UI
4. User confirms → orchestrator routes message to that hall/agent
5. User redirects → orchestrator either narrows to a different hall or runs another Oracle pass

---

## Process management

### When are subprocesses spawned?

- **Lazy.** A Claude Code subprocess is only spawned when an agent is about to receive a message.
- **Persistent across messages within a task.** Once spawned for a task, the subprocess stays alive (using `--resume`) until the task completes or 5 minutes idle.
- **Multiple simultaneous subprocesses are normal.** A user can have 3+ tasks running in parallel halls, each with their own subprocess(es).

### How are credentials handled?

Hollow Halls does **not** manage credentials. Claude Code does that natively:

- On first run, the user authenticates via Claude Code itself (`claude` in terminal opens browser OAuth)
- Credentials are written to `~/.claude/.credentials.json` (or equivalent)
- Subprocesses spawned by Hollow Halls inherit those credentials automatically
- If credentials are missing or invalid, the subprocess returns an auth error → orchestrator surfaces a "Sign into Claude Code" CTA

### How are working directories handled?

Each agent's subprocess runs in its own Git worktree under `.hollow-halls/worktrees/<hall>/<agent>/`. This ensures:

- Two agents never edit the same file simultaneously
- Failed agent work can be discarded without affecting other agents
- The user's main working tree is untouched until the orchestrator merges a successful task back

The orchestrator handles worktree creation, cleanup, and merge.

### How are tools configured per-agent?

Each agent's tool allowlist is passed via the `--allowed-tools` flag at spawn time:

```bash
claude --allowed-tools "Edit,Read,Bash(git:*),Bash(npm:*)" --append-system-prompt "$SKILL"
```

Tool allowlists are stored in the agent's config (see `docs/05-data-model.md`). Dangerous tools (Bash without restrictions, Write to non-worktree paths, etc.) are gated behind the one-time-per-agent confirmation in the agent creation wizard.

---

## How skills are loaded

Each hall has a **skill file** at `.hollow-halls/halls/<hall>/skill.md`. This file is the hall's system prompt — its identity, capabilities, do/don't lists, examples.

Each agent has its own **role overlay** at `.hollow-halls/halls/<hall>/agents/<agent>.md` — appended to the hall skill to specialize the agent.

When spawning an agent's subprocess:

```bash
claude --append-system-prompt "$(cat .hollow-halls/halls/dev/skill.md .hollow-halls/halls/dev/agents/aldric.md)"
```

This concatenation gives the subprocess: **hall's skill + agent's role overlay** as one combined system prompt.

The four skill acquisition paths from the wizard (AI-assisted / template / upload / prompt-as-skill) all produce a `skill.md` file with the same shape. The orchestrator doesn't care how the file was created.

---

## Message protocol tokens

The orchestrator parses the **last line(s)** of each agent's reply for these tokens. See `docs/05-data-model.md` for the formal grammar.

| Token | Meaning | Used in |
|---|---|---|
| `[NEXT: name]` | Hand off to a sibling agent in the same hall | In-hall conversation |
| `[DONE]` | Task is complete; surface output to user | In-hall conversation |
| `[SUGGEST: name]` | Recommend next speaker (advisory) | Council Chamber |
| `[SPEAK: name]` | Moderator picks next speaker | Council Chamber (emitted by moderator only) |
| `[CLOSE]` | Moderator ends meeting | Council Chamber (emitted by moderator only) |

**Parsing rule:** the orchestrator reads the agent's reply, scans for these tokens (regex against the trailing portion of the message), strips them from the user-visible content, and acts on them. If a token references an unknown name, that's a bad-handoff error (see flowmap §XIII).

---

## Modes (Plan / Build / Review)

Each task has a mode. The mode controls the agent's tool allowlist at spawn time:

| Mode | Tools |
|---|---|
| **Plan** | Read, web_search, Grep, Glob — but no Edit, Write, Bash |
| **Build** | All tools the agent is configured for, including Edit/Write/Bash |
| **Review** | Read, Grep, Glob, Bash(`git diff`, `npm test`, etc. — read-only) |

The orchestrator switches modes by killing the current subprocess and respawning with new flags. The conversation history is preserved via `--resume`.

---

## State persistence

Hollow Halls persists everything to a local SQLite database at `.hollow-halls/state.db`. This includes:

- Halls (id, name, soul color, tagline, skill file path)
- Agents (id, hall_id, name, role, model_tier, tool_allowlist, character config, is_head)
- Tasks (id, hall_id, mode, status, started_at, ended_at, transcript_jsonl_path)
- Council meetings (id, participating_hall_ids, topic, transcript_jsonl_path)
- Settings (api_key_path, theme, keybindings, budgets)

Transcripts are stored as JSONL (one event per line) in `.hollow-halls/transcripts/`. SQLite holds metadata only; large blobs go to files.

State survives extension restarts, VS Code restarts, and machine restarts. Tasks in `RUNNING` state when the extension restarts are marked `INTERRUPTED` and offered a resume option.

---

## Cost / budget management

Hollow Halls cannot directly observe a user's Claude Max usage (Anthropic doesn't expose that to third-party tools). Instead, it estimates:

- Each spawned subprocess records its input/output token counts (Claude Code emits these in the JSON stream)
- Orchestrator sums tokens per hall, per task, per day
- User sets per-tier daily token caps (e.g., "max 500K Opus tokens/day")
- When a cap is approached, halls pulse in warning state; when hit, halls lock

Prompt caching is handled by Claude Code itself; we don't manage it. The orchestrator just displays cached vs fresh tokens in the cost inspector.

---

## What we are NOT doing

To prevent scope creep, here is the explicit list of architectural choices we are **not** making:

- ❌ **No direct Anthropic API calls.** All AI work goes through `claude` CLI.
- ❌ **No web server.** Hollow Halls is purely local.
- ❌ **No remote agents.** Subprocesses run on the user's machine. No cloud agents in v1.
- ❌ **No new tool implementations.** We use Claude Code's existing tools and MCP. If a tool is needed that Claude Code doesn't have, we add it via MCP, not by reimplementing.
- ❌ **No custom model routing.** The user picks a tier (Opus/Sonnet/Haiku); we resolve to the latest in that tier and pass to Claude Code. Claude Code handles the actual API call.
- ❌ **No agent training, fine-tuning, or memory layers beyond what Claude Code offers.** Skills are just markdown files.
- ❌ **No multi-user features.** Single user, single machine. v2 might revisit.

---

## Acceptance test for the architecture

Before any other code is written, the architecture is "proven" if:

1. We can spawn a `claude` subprocess from the extension host, write a prompt to its stdin, and read the streaming reply from stdout
2. We can pass `--allowed-tools` and `--append-system-prompt` and observe the agent respect them
3. We can spawn two subprocesses concurrently in different Git worktrees without conflicts
4. We can parse `[NEXT:]` and `[DONE]` tokens from the streamed output reliably
5. We can resume a subprocess across multiple turns using `--resume <session-id>`

This is **Milestone M1** in `docs/03-build-plan.md`. Get this working before building any UI.

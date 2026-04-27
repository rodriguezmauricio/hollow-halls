# 03 — Build Plan

Ten milestones, M0–M9, sequenced for a solo developer with parallel-capable Claude Code instances. Each milestone has an acceptance gate; do not proceed past it without Mauricio's confirmation.

---

## Milestone overview

| ID | Title | Estimated effort | Parallelizable |
|---|---|---|---|
| M0 | Project scaffold | 2h | No |
| M1 | Subprocess spike | 4h | No |
| M2 | Single agent end-to-end | 6h | No |
| M3 | Hall + agent + task data model | 4h | No |
| M4 | Webview + theme tokens | 8h | Partial |
| M5 | Halls Dashboard | 8h | Yes [parallel] |
| M6 | Hall Detail + chat | 10h | Yes [parallel] |
| M7 | Multi-agent (in-hall conversation) | 8h | No |
| M8 | Council Chamber | 12h | Yes [parallel] |
| M9 | Wizards + Oracle + polish | 16h | Yes [parallel] |

Total: ~78 hours of focused work. With one Claude Code instance, that's ~2 weeks of evenings. With parallel worktrees on M5/M6/M8/M9, can compress to ~1 week.

---

## M0 — Project Scaffold

**Goal:** A working VS Code extension skeleton that activates and shows a placeholder webview.

**Tasks:**

1. Initialize the repo with `npm init`, install VS Code extension generator boilerplate, scaffold a TypeScript extension
2. Add tooling: ESLint, Prettier, Vitest, Husky pre-commit hook
3. Create the folder structure from `CLAUDE.md`
4. Add a Vite project for the webview at `webview/` (separate package, builds to `dist/webview/`)
5. Wire up extension → webview postMessage roundtrip with a hello world
6. Set up `.vscode/launch.json` so F5 runs the extension in a dev host
7. Add MIT LICENSE file to repo root
8. Create initial public-facing README at repo root (separate from this handoff README)

**Acceptance gate:**
- Run `npm run watch` and `F5`; a new VS Code window opens with the extension loaded
- Run command `Hollow Halls: Open Dashboard` from command palette
- Webview opens, displays "hello halls" text
- Click a button in the webview, see a notification fire from the extension host

---

## M1 — Subprocess Spike

**Goal:** Prove the core architecture works. Spawn `claude` subprocess, write to its stdin, read its stdout, parse a protocol token.

**Tasks:**

1. Create `src/orchestrator/claude-process.ts` — a class wrapping `child_process.spawn`
2. Implement methods:
   - `start(opts: SpawnOptions)` — spawn `claude` with given flags
   - `send(message: string)` — write to stdin
   - `onMessage(handler)` — emit each parsed event from JSON-stream stdout
   - `kill()` — clean shutdown
3. Implement protocol token parser at `src/orchestrator/protocol.ts`:
   - Regex extraction of `[NEXT: name]`, `[DONE]`, `[SUGGEST: name]`, `[SPEAK: name]`, `[CLOSE]`
   - Strip tokens from user-visible content
   - Return `{ content: string, tokens: ParsedToken[] }`
4. Write a smoke-test script (`scripts/spike.ts`) that:
   - Spawns a `claude` subprocess
   - Sends "Reply with just `[DONE]`. Nothing else."
   - Confirms the parser detects the `[DONE]` token
5. Test resuming: spawn → send msg → kill → respawn with `--resume <session-id>` → confirm context is preserved

**Acceptance gate:**
- `npm run spike` outputs: subprocess spawned, message sent, reply received, `[DONE]` token detected, session resumed successfully
- All five architecture acceptance tests from `docs/02-architecture.md` pass

---

## M2 — Single Agent End-to-End

**Goal:** A user can send a message in the dashboard, see one agent respond. No halls, no characters, no UI polish — just the pipeline working.

**Tasks:**

1. Define minimal `Agent` type (id, name, model_tier, skill content)
2. Implement `src/orchestrator/agent-runner.ts`:
   - Takes an agent definition + user message
   - Spawns a Claude Code subprocess with the agent's skill as `--append-system-prompt`
   - Streams the reply back via callback
3. Add a barebones webview UI:
   - One text input
   - One scrollable message area
   - Each message tagged with sender (user / agent name)
4. Wire webview → extension host → agent runner → back to webview
5. Hardcode a single agent: name "Aldric", role "Senior Developer", tier "sonnet", skill "You are a senior software engineer"

**Acceptance gate:**
- Open dashboard, type "explain async/await in 2 sentences"
- See "Aldric" reply stream in token-by-token
- Reply is sensible (the model is actually engaged, not a placeholder)
- Total time from send → first token < 3 seconds

This is the **critical gate** for the project. If this works, the architecture is proven. If it doesn't, stop and debug before proceeding.

---

## M3 — Hall + Agent + Task Data Model

**Goal:** Full data layer with SQLite + JSONL transcripts. No UI changes.

**Tasks:**

1. Add `better-sqlite3` dependency
2. Create schema migration system at `src/shared/db/migrations/`:
   - `001_init.sql` — halls, agents, tasks, councils, settings tables
3. Implement repositories at `src/shared/db/repos/`:
   - `halls-repo.ts` — CRUD for halls
   - `agents-repo.ts` — CRUD for agents, including head designation
   - `tasks-repo.ts` — CRUD for tasks + state transitions
   - `transcripts.ts` — append-only JSONL write/read
4. Create seed data:
   - 3 default halls: Design (green), Development (purple), Research (orange)
   - 6 default agents (2 per hall) with default character configs
   - First agent in each hall marked as Head
5. Migrate M2's hardcoded agent to use the repo

**Acceptance gate:**
- `.hollow-halls/state.db` is created on first run
- Halls and agents seed correctly
- Restarting the extension preserves all state
- Transcripts append correctly to JSONL files

---

## M4 — Webview + Theme Tokens

**Goal:** The webview renders with the full Hollow Halls aesthetic — typography, colors, ornaments. Reusable component library.

**Parallelizable:** Two worktrees can split this:
- **Worktree A:** theme tokens + base components (buttons, inputs, panels, ornament SVGs)
- **Worktree B:** layout primitives (sidebar, panel headers, scrollable lists)

**Tasks:**

1. Implement `src/webview/theme/tokens.ts`:
   - Color tokens (soul colors per discipline + base palette from `docs/04-design-system.md`)
   - Typography tokens (Cinzel + IBM Plex Mono with sizes/weights)
   - Spacing scale (4/8/16/24/32/48 px)
   - Border + ornament tokens
2. Set up Tailwind with custom token integration (or styled-components, whichever Mauricio prefers — default to Tailwind)
3. Build base components:
   - `Panel` (with corner ornaments)
   - `Button` (primary / ghost / danger variants)
   - `Input` (text / textarea / search)
   - `Badge` (head badge ◆, status dots)
   - `Avatar` (placeholder for character compositor)
4. Build layout primitives:
   - `Sidebar` (the left nav from the UI mockup)
   - `PanelHeader` (Cinzel title + subtitle + actions)
   - `ScrollList` (with custom scrollbar styling)

**Acceptance gate:**
- A storybook-style page exists at `webview/src/storybook.tsx`
- It renders all base components and layout primitives
- Visual inspection: matches the aesthetic of `reference/ui-mockup.html` at component level

---

## M5 — Halls Dashboard

**Goal:** The main dashboard surface — sidebar, halls grid, agents panel, channels, chat, task panel. Static data; no agent execution yet.

**Parallelizable:** Three worktrees:
- **Worktree A:** Sidebar + Halls grid (with Oracle and Council wide cards)
- **Worktree B:** Agents panel (the row of 6 character cards)
- **Worktree C:** Bottom row (channels + main chat + task details)

**Tasks per worktree:**

(See `reference/ui-mockup.html` for the exact layout. Each worktree implements one section, wired up to read from the SQLite repos created in M3.)

**Acceptance gate:**
- All worktrees merged
- Dashboard renders with seeded halls + agents
- Clicking a hall card highlights it (visual state only)
- Clicking an agent card opens an empty profile panel (placeholder)
- Layout matches the mockup at high fidelity

---

## M6 — Hall Detail + Chat

**Goal:** Click a hall card → see the hall detail view (scene + agent list + chat). The chat actually invokes the agent runner from M2.

**Parallelizable:**
- **Worktree A:** Hall detail layout (header, scene placeholder, agent list, chat area)
- **Worktree B:** Mode tabs (Plan / Build / Review) and mode-switch logic in orchestrator

**Tasks:**

1. Implement hall detail view: tabs (Plan/Build/Review default Plan), large scene area (placeholder image for now), agent list, chat
2. Wire the chat input to the agent runner from M2 — but now picking an agent based on the hall's first available agent or @-mention in the message
3. Implement mode switching: changing tab kills the current subprocess and respawns with a new tool allowlist. The transcript persists.
4. Add character placeholder SVGs in the scene (just the base hk-t silhouette from the mockup; full character compositor comes in M9)

**Acceptance gate:**
- Click "Development" hall → detail view opens
- Type a message → first agent in that hall responds
- Switch to Build mode → subprocess respawns with full tools
- Send another message → it has the full context from before mode switch (`--resume` working)
- Visual matches the mockup's hall detail panel

---

## M7 — Multi-Agent (In-Hall Conversation)

**Goal:** When agent A's reply contains `[NEXT: B]`, the orchestrator routes to B. Hop counting, conclusion-on-cap, error paths.

**Tasks:**

1. Update agent runner to inspect every reply for protocol tokens
2. Implement routing: `[NEXT: name]` → look up agent in same hall → if not found, surface bad-handoff error
3. Implement hop counter: track agent-to-agent transitions per task; at 8 hops without `[DONE]`, inject conclusion prompt to current speaker
4. Implement `[DONE]` finalization: stop the chain, mark task COMPLETED, surface final reply to user
5. Update chat UI to render multi-agent conversations: each message tagged with the agent's name, character avatar, hall-color accent
6. Build error UI for bad handoffs: yellow banner in chat, "Unknown agent · routed to user" with options to retry / accept / edit

**Acceptance gate:**
- Hardcode a test scenario: Aldric in Dev hall, Mire in Dev hall. System prompt for Aldric: "After answering, if you need a code review, end with [NEXT: Mire]"
- Send a message that triggers handoff
- Watch Aldric reply, then Mire reply, then `[DONE]`
- Hop cap also tested with a forced loop

---

## M8 — Council Chamber

**Goal:** Cross-hall meetings of Heads of Department with a Haiku moderator. Full visualization of the ring of speakers and turn order.

**Parallelizable:**
- **Worktree A:** Council UI (circular layout, head ornaments, Moderator avatar)
- **Worktree B:** Council orchestration logic (moderator subprocess, [SPEAK:] / [SUGGEST:] / [CLOSE] handling)

**Tasks:**

1. Build the Council surface UI per `reference/flowmap.html` §V
2. Implement moderator subprocess spawning with the special routing prompt from `docs/02-architecture.md`
3. Implement turn loop: moderator picks → speaker replies → moderator picks again
4. Wire `[SUGGEST: name]` from speakers as advisory hints to the moderator (passed back in the next moderator prompt)
5. Implement end conditions: `[CLOSE]` from moderator, max 12 turns, 200K tokens, 5 min wall, user stop
6. Render the synthesis output prominently in the chat

**Acceptance gate:**
- Convene a Council across the 3 default halls (Design, Dev, Research)
- Topic: "How should we structure a new feature for X?"
- Watch moderator pick speakers, speakers reply, suggestions weighted, conclusion delivered
- Final synthesis is presented clearly to the user

---

## M9 — Wizards + Oracle + Polish

**Goal:** Hall creation wizard (5 steps + 4 skill paths), agent creation wizard (7 steps with character compositor), Oracle routing, theme polish.

**Parallelizable:** Four worktrees, one per major feature:
- **Worktree A:** Hall Creation Wizard (5 steps + 4 skill acquisition paths from §X)
- **Worktree B:** Agent Creation Wizard (7 steps + character compositor)
- **Worktree C:** Oracle (⌘K hotkey, classifier subprocess, suggestion UI)
- **Worktree D:** Visual polish (room scenes per hall, soul-color theming, animations)

**Tasks:**

### Worktree A — Hall Wizard
- 5-step modal per `reference/flowmap.html` §X
- Skill acquisition paths:
  - **A · AI-Assisted:** Oracle interviews user, generates skill.md
  - **B · Template:** Pre-filled markdown editor based on Step 3 selection
  - **C · Upload:** File drop, paste, OR GitHub URL fetcher
  - **D · Prompt-as-Skill:** Plain prompt → wrapped as skill.md

### Worktree B — Agent Wizard
- 7-step modal per `reference/flowmap.html` §XI
- Character compositor (see `docs/04-design-system.md` for the SVG part system)
- Live preview that updates as parts are picked
- One-time confirmation for dangerous tools at the end

### Worktree C — Oracle
- ⌘K hotkey opens the Oracle modal
- Free-text input
- On submit, spawn Haiku subprocess with the routing prompt from `docs/02-architecture.md`
- Display ranked hall suggestions with confidence
- Confirm → route. Redirect → re-classify with narrowed scope.

### Worktree D — Polish
- Build per-hall scene SVGs (each hall has a unique "room" illustration)
- Implement state animations: idle → active → in-meeting pulses
- Add keyboard shortcuts table per `reference/flowmap.html` §XIV
- Implement slash commands (`/code`, `/design`, `/plan`, `/build`, `/council`, `/clear`, `/cost`)

**Acceptance gate:**
- All wizards work end-to-end
- A new hall can be created via the AI-Assisted path and used immediately
- A new agent can be created with a custom character and used immediately
- Oracle routes accurately on test prompts
- Visual polish matches the mockup

---

## After M9

The product is now feature-complete for v1. Remaining work before public release:

- Pre-launch testing on real workflows (Mauricio dogfoods on a real project)
- Documentation site (just GitHub Pages from the public README + screenshots)
- Submit to VS Code Marketplace
- Public announcement (Twitter, dev.to, Hacker News)

These are out of scope for this build plan. Mauricio handles them.

---

## How to handle blockers

If you hit a blocker that is not resolvable from this documentation:

1. **First**, re-read the relevant doc carefully
2. **Second**, check `reference/flowmap.html` for the UX intent
3. **Third**, search the codebase for similar patterns
4. **Fourth**, ask Mauricio with a concrete question (don't speculate; ask directly)

Do not invent architectural decisions. Do not silently add features not in this plan. Do not skip acceptance gates.

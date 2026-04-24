# BUILD PLAN — The Hollow Halls

> Ordered milestones. Each one has a clear acceptance test. **Do not move to the next milestone until the current one passes its acceptance test in a real VS Code window.**

The order is deliberate: it front-loads the riskiest unknowns (does a single agent talking in a webview feel good?) so that if the concept doesn't work, you find out in milestone 2, not milestone 9.

---

## Milestone 0 — Repo & Extension Skeleton

**Goal**: a VS Code extension that activates and opens a blank webview.

### Tasks
1. `npm init`, install: `@types/vscode`, `typescript`, `esbuild`, `@vscode/test-electron`, `vitest`
2. Create `package.json` with `contributes.commands` registering `hollowHalls.open`
3. `src/extension.ts` activates on command, creates `WebviewPanel` with HTML "the hollow halls"
4. esbuild config: bundle `src/extension.ts` → `out/extension.js` and `webview/main.ts` → `out/webview.js`
5. Launch config in `.vscode/launch.json` for F5 debug

### Acceptance
- F5 launches Extension Development Host
- Command Palette → "Hollow Halls: Open" opens a webview with placeholder text
- Webview survives reload

---

## Milestone 1 — Hollow Aesthetic Shell

**Goal**: the webview renders the building from the HTML mockup, no interactivity yet.

### Tasks
1. Port the static SVG building from `hollow-halls-continuous.html` into `webview/scene/Building.ts`
2. Set up CSS variables in `webview/theme/hollow.css`
3. Bundle Cinzel + IBM Plex Mono as local assets (don't load from Google Fonts — extensions should work offline)
4. Implement dust mote ambient animation
5. Implement breathing animation on agent figures (CSS-only)
6. Header with brand mark, stats placeholders, theme indicator
7. Footer

### Acceptance
- Webview renders the full building, oracle, and great hall, visually matching the mockup ≥ 95%
- Dust drifts, figures breathe, soul candles pulse — all at 60fps
- Resize the panel: SVG scales correctly, no layout breakage
- No console errors

---

## Milestone 2 — One Agent Talks (the riskiest milestone)

**Goal**: click the Design room → scene transitions into the room interior → Maya is visible at a long table → type a prompt → Maya streams a reply into the table transcript. Leave the room and the building shows she's still thinking.

This is the make-or-break milestone for the whole concept. If watching Maya answer from across her table doesn't feel alive, no amount of further building will save the project.

### Tasks
1. LLM providers (`src/api/provider.ts` + three implementations: Anthropic API, Ollama, Claude Code CLI). Pluggable per CLAUDE.md rule #6.
2. `src/core/AgentManager.ts`: compose system prompt, stream to callbacks; `max_tokens` 300 so agents stay pithy.
3. Define the Design room with Maya — **personality prompt must be opinionated and specific** (see PRD risks).
4. Message protocol: `open_room`, `send_prompt`, `agent_text_chunk`, `agent_message_complete`, `room_activity`.
5. Per-agent visual identity (hair, outfit, skin, accessory) rendered as chunky SVG characters so agents are visually distinct from their roles.
6. Building view (outside) stays the current top-down floor plan. Clicking a room transitions into that room's scene.
7. Room scene (inside): floor + walls in the room's soul color, a long rectangular table centered, seats for each agent, the agent character at each seat, a speaker-pointer on the table edge, a back arrow, a transcript panel tied to the table, and a prompt bar at the bottom.
8. Transcript streams the reply character-by-character with a blinking caret; scrolls automatically; preserves history across re-entries.
9. Leaving the room while a stream is in flight: building view shows a dim soul-color pulse on that room's shell until the stream ends.

### Acceptance
- Click Design from the building view → fade transition into a room scene with Maya seated at the table.
- The room is visibly the Design atelier (amber accents, easel/canvas props).
- Maya's character is distinct (auburn hair, amber apron, visible face) — not the same silhouette as any other agent.
- Prompt "what fonts pair well with a brutalist tech brand" → COMMUNE → the speaker-pointer on the table edge glows amber toward Maya, and her reply streams into the transcript.
- Maya sounds like *Maya*, not generic Claude (compare to a vanilla `claude -p` reply to the same question — the voice difference should be obvious).
- Reply finishes; transcript stays visible; user can send a follow-up.
- Back arrow → fade out → building view. If a stream is still in flight, Design's chamber shows a soft amber pulse until it ends.
- Re-entering Design restores the transcript.

### Honest checkpoint
**At this point, stop and judge the project.** If Maya feels alive, continue. If she feels like a chatbot in a costume, the personality prompts need a complete rewrite before any further milestones. Don't paper over a bad foundation with more rooms.

---

## Milestone 3 — All Six Rooms Speak

**Goal**: every team room has at least one functional agent with a distinct voice.

### Tasks
1. Define all 12 agents (2 per room) with personality prompts
2. Each room's modal lists its agents with checkboxes
3. Selecting multiple agents in a single room: agents respond in sequence (round-robin), not in parallel — keeps it readable
4. Speech bubble queue: handles overlapping speakers gracefully (one bubble at a time per agent)
5. Cost tracker: log every API call, surface running session cost in the modal footer

### Acceptance
- Every room can be entered, agents chosen, prompt sent, replies streamed
- Each agent has a recognizably distinct voice when given the same prompt
- Cost meter updates live; clicking it shows breakdown by room and agent
- Status bar shows session cost: `Hollow Halls · $0.NN`

---

## Milestone 4 — The Great Hall (Synchronous Multi-Agent Meeting)

**Goal**: convene multiple agents from different rooms; they deliberate in turn with a moderator.

### Tasks
1. `src/core/CommonRoom.ts`: implement the moderator pattern from the architecture doc
2. The moderator is a Haiku call; speakers are their normal models
3. Webview: when a meeting is in the Great Hall, the camera (visual focus) stays on the Great Hall scene; speech bubbles appear above the speaker; previous speakers' bubbles fade as new ones appear
4. "Cancel meeting" button in Great Hall modal — terminates the in-flight stream cleanly
5. End-of-meeting summary: total turns, total cost, transcript exportable

### Acceptance
- Open Great Hall → select Maya, Kai, Pell → ask "Design a passwordless login flow"
- They speak in turn (moderator picks who's next based on context)
- Each speaks within their personality (Maya designs, Kai threat-models, Pell implements)
- Meeting ends naturally with `[DONE]` from moderator OR hits 6-turn cap
- Cost shown at end; transcript saved to `.hollow/transcripts/`

---

## Milestone 5 — The Oracle (Routing)

**Goal**: ambiguous user prompts get routed to the right room or great-hall convening.

### Tasks
1. `src/core/Oracle.ts`: Haiku call with structured JSON output (room registry + agent roster as context)
2. Click Oracle chamber → modal looks slightly different (no agent picker, just a prompt: "What do you need?")
3. Oracle responds in one of three ways:
   - "I'll send you to the Design room" → opens that room's modal pre-loaded with the prompt
   - "This needs a meeting" → opens Great Hall pre-loaded with selected agents and prompt
   - Direct answer for trivial things ("what time is it" → just answers)
4. Visual feedback: Oracle's chamber pulses; arrow/effect shows routing direction across the building

### Acceptance
- "Help me launch a side project" → Oracle convenes Marketing + Design + Front-End in Great Hall
- "What's a good monospace font" → Oracle routes to Design with prompt pre-filled
- "What does TLS stand for" → Oracle answers directly without routing
- Routing decisions feel sensible (sanity-check 10 prompts manually)

---

## Milestone 6 — Tool Use (Files & Search)

**Goal**: agents can read workspace files and search the web.

### Tasks
1. `src/core/ToolRunner.ts`: implement `read_file`, `list_files`, `web_search`
2. Wire tools to the SDK's tool-use loop
3. Permission gate: first time a tool is invoked, user confirms; option to "allow for session" or "always allow"
4. Visual feedback: when an agent uses a tool, a small icon appears next to their figure (book = reading file, magnifying glass = searching)
5. Tool results are appended to the agent's context invisibly; agent's spoken reply incorporates them naturally

### Acceptance
- "Maya, look at my CSS files and suggest improvements" → Maya invokes `list_files('**/*.css')`, then `read_file` on the relevant ones, then responds with specific suggestions
- Permission prompt appears the first time
- Tool icons appear in the chamber during use

---

## Milestone 7 — Handoff Between Rooms

**Goal**: complete a task in one room and chain its result to another.

### Tasks
1. The "then hand to" dropdown in the modal becomes functional
2. After room A's agents finish, the result is passed as context to room B with a system message: "The [room A name] team produced this. Build on it."
3. Visual transition: the user sees the active room briefly highlight in room A, then the camera (focus) pans to room B
4. Handoff cost is itemized separately

### Acceptance
- Send "design a hero section" to Design with handoff = Front-End
- Maya/Iri respond → automatically passed to Pell/Rue who produce HTML/CSS based on Maya's design notes
- Both responses visible in their respective chambers' bubbles
- Total cost = both turns combined

---

## Milestone 8 — Persistence & Settings

**Goal**: conversations and settings survive VS Code restarts.

### Tasks
1. `src/core/Persistence.ts`: load/save `rooms.json`, `settings.json`, `transcripts/`
2. Settings UI in modal: API key, default model per room, max turn limit, cost warning threshold
3. Recent meetings: small history panel showing last 10 meetings, clickable to view transcript
4. Workspace integration: `.hollow/` is gitignored by default (the extension creates it)

### Acceptance
- Restart VS Code, reopen extension: settings preserved, transcripts visible
- Cost meter restores today's total
- API key not visible in any JSON file (lives in SecretStorage)

---

## Milestone 9 — Polish Pass

**Goal**: ship-quality UX details.

### Tasks
1. First-launch tour (PRD §9 risk mitigation): rooms dim, Oracle highlighted, "Start by asking the Oracle"
2. Loading states everywhere — never a blank moment > 200ms
3. Error states: API errors surface inline with retry; rate limits show wait time; network errors offer offline mode (browse transcripts)
4. Keyboard navigation: tab through rooms, enter to open, escape to close
5. Accessibility: aria-labels on every interactive SVG element, focus rings, screen-reader announcements for streaming text
6. README with screenshots/GIF
7. Marketplace listing draft

### Acceptance
- Fresh install → tour walks new user through Oracle
- Every error has a recovery path
- Full keyboard navigation possible without a mouse
- Lighthouse-style accessibility audit passes

---

## Milestone 10 — Open Source Release

**Goal**: public GitHub repo + Marketplace listing.

### Tasks
1. License (MIT or Apache-2.0)
2. CONTRIBUTING.md, CODE_OF_CONDUCT.md
3. Issue templates
4. GitHub Actions: CI runs tests on PR, releases build .vsix on tag
5. Publish to VS Code Marketplace
6. Launch post (HN, Twitter/X, dev.to)

### Acceptance
- Repo is public
- A first-time contributor can clone, install, and build in under 5 minutes following README
- Extension installable from Marketplace

---

## Post-V1 Backlog (Not in Build Plan)

- Custom Halls UI (forge/edit/delete custom rooms)
- Theme system (Ash, Stargrove, Studio Ghibli, 1-bit Obra Dinn)
- Community Halls (browse/import shared rooms)
- MCP server tool sources
- Long-term agent memory across sessions
- Multi-workspace support (rooms scoped per project)
- Inline agent invocation from text editor (`// @maya what about this color?`)
- Voice mode
- Mobile companion (read-only transcript viewer)

---

## Working Style Guidance for Claude Code

- **Build vertically, not horizontally.** Each milestone produces something runnable. Resist the urge to scaffold all six rooms before any of them work.
- **Stop after Milestone 2 and validate.** Show the user a video of Maya talking. Get explicit approval before continuing.
- **Test with real prompts, not lorem ipsum.** Use prompts the actual user (a developer building things) would send.
- **Keep system prompts in version-controlled `.ts` files**, not JSON, so they can be commented and refactored.
- **The aesthetic is a feature, not decoration.** When in doubt, push the visual polish higher rather than lower.

# CLAUDE.md

You are working on **The Hollow Halls** — a VS Code extension that gives developers a spatial UI for orchestrating Claude agents. Each "room" is a discipline (design, code review, security, etc.) staffed by named agents with distinct personalities.

This file is your operating manual for this repo. Read it first, then reference the linked docs as needed.

---

## Documents to Read Before You Code

In this order:

1. **`PRD.md`** — what we're building, who for, success metrics, what's out of scope. **Required reading.**
2. **`ARCHITECTURE.md`** — module layout, message protocol, data shapes. Reference whenever touching structure.
3. **`BUILD_PLAN.md`** — ordered milestones with acceptance tests. **Always work the active milestone; do not jump ahead.**
4. **`hollow-halls-continuous.html`** — the visual mockup; the source of truth for what the building should look like. Match it ≥95%.

---

## Hard Rules

These are non-negotiable. Push back on the user if you're asked to violate them.

1. **One milestone at a time.** Each milestone in `BUILD_PLAN.md` has an acceptance test. Do not start the next milestone until the current one passes that test in a real VS Code window. If the user asks you to skip ahead, point them at the build plan and ask them to confirm.

2. **Stop and validate after Milestone 2.** Milestone 2 is the make-or-break test for the whole concept (one agent talking inside a chamber). Do not continue to Milestone 3 without explicit user sign-off that the agent feels alive.

3. **Extension host owns logic; webview is dumb.** No business logic in the webview. No API keys in the webview. All LLM calls happen in the extension host. The webview only renders and dispatches user intents. See `ARCHITECTURE.md` for the message protocol.

4. **System prompts live in TypeScript, not JSON.** Per-agent personality prompts are the most important code in the project. They go in `src/rooms/*.ts` so they can be commented, refactored, and reviewed. Never put them in JSON.

5. **Personality > capability.** When designing or revising an agent, prioritize a distinct, opinionated voice over feature breadth. The whole product collapses if all agents sound like generic Claude. See `BUILD_PLAN.md` Milestone 2's "honest checkpoint."

6. **LLM providers are pluggable; never hardcode model names at call sites.** Three providers ship: Claude Code CLI (uses the user's Max subscription via keychain OAuth — no API key needed), Ollama (free local models), and the Anthropic API (pay-per-token). All three implement `LlmProvider` in `src/api/provider.ts`. When the Anthropic or Claude Code providers are active, default to Sonnet for room agents and Haiku for Oracle/moderator calls. When Ollama is active, the user picks the model via `.hollow/settings.json`. All defaults live in `src/core/Settings.ts` — no model strings in call sites.

   **Skills and permission modes (Claude Code only).** Each bundled agent has a SKILL.md at `assets/skills/<agent-id>/SKILL.md` — that's the agent's *procedure* layered on top of the *personality* prompt. The build script copies each skill into `out/skills/<id>/.claude/skills/<id>/SKILL.md`, and the extension hands only that directory to `claude --add-dir` so one agent's call never sees another agent's skill. User-authored skills live in `<workspace>/.claude/skills/` (scaffold with the `Hollow Halls: Create Skill` command) and are overlaid globally by the CLI — their visibility across agents is a known tradeoff for this milestone.

   Every room defaults to `--permission-mode plan` (configurable via `settings.defaultPermissionMode` / `roomOverrides` / `agentOverrides`). Plan mode streams a written plan into the transcript and auto-saves it to `.hollow/plans/`. The BUILD button on a plan-mode turn re-runs the same prompt in `acceptEdits` so Claude can execute with tool use (reads, edits, bash). Tool calls render in the transcript as inline `[tool] toolName · input` blocks — deliberately lo-fi; structured tool-use UI (diff accept/reject, plan boxes) is M6.

7. **Stream everything user-facing.** Any agent reply that appears in a speech bubble must be streamed character-by-character. Non-streamed responses feel dead and undermine the whole metaphor.

8. **Cost is a first-class concern.** Every API call goes through `CostTracker`. The status bar always shows session cost. Default soft warning at $0.50/session (tool-use in acceptEdits can burn Max's rate budget fast — the warning is your chance to cap it). Never add a new API call without wiring it into the tracker.

9. **The aesthetic is a feature.** When in doubt about visual choices, match the mockup. When deviating, push toward *more* atmospheric, not less. No emojis in the UI. No generic Material/Tailwind shadcn aesthetic — this is Cinzel + IBM Plex Mono + Hollow Knight, and that's intentional.

10. **No telemetry. No analytics. No phone-home.** Open-source, privacy-first. Do not add any external service calls beyond the user's configured Anthropic endpoint.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript (strict mode) |
| Extension API | `vscode` |
| LLM providers | `@anthropic-ai/sdk` (API), `ollama` (local), `claude` CLI subprocess (Max subscription) |
| Bundler | esbuild |
| Webview rendering | SVG + CSS animations; vanilla TS unless React is justified |
| State (webview) | Lightweight pub/sub or Zustand if React is chosen |
| Persistence | JSON in `<workspace>/.hollow/`; secrets in VS Code `SecretStorage` |
| Tests | Vitest (unit), `@vscode/test-electron` (integration) |
| Fonts | **Bundled locally** — Cinzel + IBM Plex Mono. Never load from Google Fonts at runtime. |

---

## Conventions

### TypeScript
- Strict mode on. No `any` without a comment explaining why.
- Discriminated unions for all message types and event payloads.
- Prefer `readonly` and `const` aggressively.
- File naming: `PascalCase.ts` for classes, `camelCase.ts` for utilities.

### Imports
- Use path aliases (`@/core/*`, `@/api/*`) configured in `tsconfig.json`. No deep relative imports (`../../../`).

### CSS
- All visual constants are CSS variables in `webview/theme/hollow.css`.
- Component styles colocated with components (`Modal.ts` + `Modal.css`).
- No CSS-in-JS, no Tailwind, no styled-components.

### Commits
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- One milestone = one PR if reviewing; many small commits within a milestone are fine.

### Tests
- Every core class (`AgentManager`, `CommonRoom`, `Oracle`, `CostTracker`) gets unit tests.
- Integration test for: webview opens, message bridge round-trips, one full meeting from prompt to transcript.
- Don't write speculative tests for code that doesn't exist yet.

---

## Performance Budget

Hard limits — fail the build if exceeded:

| Metric | Limit |
|--------|-------|
| Extension activation | < 300ms |
| Webview first paint | < 500ms after activation |
| Idle CPU | < 1% |
| Animation frame rate | 60fps with all 7 great-hall agents breathing |
| Time-to-first-token in a meeting | < 1.5s |
| Bundle size (extension) | < 500KB |
| Bundle size (webview) | < 800KB including bundled fonts |

If you can't meet these, surface the problem to the user — don't ship a slow product silently.

---

## LLM Provider Notes

General:
- Use streaming for every user-facing reply — each provider's `stream()` pushes chunks through `onTextChunk`.
- Include the system prompt every call (all three providers are stateless from our perspective).
- Tool use (Milestone 6+): pass tools per-call. Each room's allowed tools are determined by `Room.tools`.
- If the Anthropic SDK or Claude Code CLI docs shown here have changed since this file was written, check `https://docs.claude.com` and `https://code.claude.com/docs` before assuming.

Anthropic API (`AnthropicProvider`):
- Uses `@anthropic-ai/sdk` `messages.stream`. Requires a `sk-ant-…` key in VS Code `SecretStorage`.
- Defaults per `Settings`: Sonnet (`claude-sonnet-4-6`) for room agents, `max_tokens: 600`. Haiku (`claude-haiku-4-5-20251001`) for Oracle / moderator calls, `max_tokens: 50`.

Claude Code CLI (`ClaudeCodeProvider`):
- Shells out to `claude -p --system-prompt-file … --model sonnet --max-turns 1 --output-format stream-json --verbose --include-partial-messages`, user prompt piped via stdin.
- **No `--bare`** — bare mode skips OAuth keychain reads, which defeats the purpose (we need the user's Max subscription).
- Filter stream events: `type === 'stream_event' && event.type === 'content_block_delta' && event.delta?.type === 'text_delta'` → `event.delta.text`.
- Final usage lives in the terminal `type === 'result'` event.

Ollama (`OllamaProvider`):
- Uses the `ollama` npm package's async-iterable `chat({ stream: true })`. Free, local, BYO model.
- Model tag is user-configurable — don't enum-constrain, just pass through.

---

## VS Code Extension Notes

- Activation event: `onCommand:hollowHalls.open` (lazy activation; don't activate on `*`).
- Webview: `enableScripts: true`, `localResourceRoots` set to the extension's `out/` and `assets/` dirs.
- Use `webview.cspSource` and a strict CSP — no inline scripts, no external script sources.
- API key stored only in `context.secrets` (SecretStorage), never in workspace state.
- All file writes (transcripts, settings) use `vscode.workspace.fs`, not Node's `fs` directly — this respects virtual workspaces.

---

## What "Done" Looks Like for a Milestone

A milestone is done when **all** of these are true:

1. Code is written and reviewed (self-review at minimum)
2. Tests pass (`npm test`)
3. Manual acceptance test in a real Extension Development Host passes
4. Performance budgets are met
5. The user has tried it and signed off

Saying "it should work" or "it compiles" is not done. Show the running thing.

---

## When You Get Stuck

In order of preference:

1. **Re-read the relevant doc.** PRD for "why," ARCHITECTURE for "how," BUILD_PLAN for "what next."
2. **Check the mockup.** The HTML mockup answers most "what should this look like" questions.
3. **Ask the user.** Specifically: surface the decision, show the options, recommend one. Don't ask open-ended "what do you want."
4. **Search Anthropic docs.** For SDK behavior, model availability, current rates.
5. **Don't invent.** If a piece of information is missing — a model name, a VS Code API, a library version — ask or look it up. Do not guess.

---

## Files & Directories You'll Touch Most

```
src/extension.ts             # extension entry, command registration
src/core/AgentManager.ts     # agent state + system prompt assembly
src/core/CommonRoom.ts       # great hall orchestration
src/core/Oracle.ts           # routing
src/rooms/*.ts               # one file per room: room config + agent personality prompts
src/messaging/protocol.ts    # message types — single source of truth
webview/scene/Building.ts    # the SVG floor plan
webview/scene/Room.ts        # one room
webview/scene/SpeechBubble.ts
webview/modal/ChamberModal.ts
.hollow/                     # workspace-local persistence (gitignored)
```

---

## Final Note

This product lives or dies by feel. A hundred small details — the breathing of the figures, the way a speech bubble types, the exact shade of amber in the Design room — are what make it Hollow Halls instead of "yet another agent dashboard." Do not optimize away atmosphere for the sake of code purity.

When you finish a milestone, the question to ask is not "does it work" but "does it feel like a place."

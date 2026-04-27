# CLAUDE.md — Operating Manual for Claude Code

You are working on **Hollow Halls**, a VS Code extension. This document is auto-loaded at the start of every Claude Code session. Read it carefully and refer back to it whenever you're uncertain about conventions or scope.

---

## Project Snapshot

- **Product:** Hollow Halls — spatial multi-agent UI for VS Code
- **Architecture:** VS Code extension that orchestrates `claude` CLI subprocesses (Architecture D)
- **License:** MIT, public repo
- **Monetization:** None. Fully free.
- **Target user:** Solo developer using Claude Max subscription
- **Current phase:** Build from scratch following `docs/03-build-plan.md`

---

## Where to find what

When in doubt, check the relevant doc rather than guessing:

| If you need to know about... | Read... |
|---|---|
| Why we're building this | `docs/01-vision.md` |
| How the subprocess orchestration works | `docs/02-architecture.md` |
| What to build next | `docs/03-build-plan.md` |
| Visual styling, colors, character parts | `docs/04-design-system.md` |
| Data types, message protocol tokens | `docs/05-data-model.md` |
| The 14 UX flows in detail | `reference/flowmap.html` |
| What the UI looks like | `reference/ui-mockup.html` |

---

## Working Conventions

### Code style

- **Language:** TypeScript (strict mode)
- **Formatter:** Prettier with default config
- **Linter:** ESLint with `@typescript-eslint/recommended`
- **File names:** `kebab-case.ts` for utilities, `PascalCase.ts` for classes/components, `camelCase.ts` for hooks
- **Imports:** Absolute paths via `@/` alias for `src/`
- **Comments:** Avoid them unless the code is genuinely non-obvious. Self-documenting code first.
- **Async:** `async/await` over `.then()`. Never mix the two.

### Folder structure

```
src/
├── extension.ts              # VS Code extension entry point
├── orchestrator/             # Subprocess management, message routing
├── webview/                  # The UI (React + Vite, runs in webview)
│   ├── components/           # Shared UI components
│   ├── views/                # Top-level surfaces (Dashboard, Hall, Council, etc.)
│   ├── stores/               # State management (Zustand)
│   └── theme/                # Theme tokens, hollow-knight aesthetic
├── characters/               # SVG character compositor
├── halls/                    # Hall logic (state, members, head designation)
├── council/                  # Council Chamber + moderator pattern
├── oracle/                   # Routing classifier
├── skills/                   # Skill ingestion (md template / upload / AI-assisted)
└── shared/                   # Types shared between extension host + webview
```

### Commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- One commit per logical change. Don't squash unrelated work.
- Reference the milestone in the body: `Closes M2 acceptance gate 1.`

### Testing

- **Unit tests:** Vitest, co-located with source (`foo.ts` + `foo.test.ts`)
- **E2E:** Playwright with VS Code extension test harness
- **Don't test the UI visually.** Test behavior. Visual regressions are acceptable risk.

### When you're unsure

- **First:** check the relevant doc.
- **Second:** check `reference/flowmap.html` for the UX intent.
- **Third:** ask Mauricio. Don't guess on architectural decisions.

---

## Tone & Communication

- Talk like a senior engineer, not a marketer. Avoid words like "robust", "powerful", "delightful", "leverage", "synergy".
- Lead with the answer. Justification follows if requested.
- When proposing options, give numbered alternatives with concrete trade-offs.
- Don't pad responses with apologies, restatements, or "Let me know if..." closers.
- Use plain prose for explanations; tables only when comparing structured options.

---

## No-Go Zones

You **MUST NOT** do any of the following without explicit permission from Mauricio:

1. **Add a payment system.** This product is free forever. No Stripe, no licensing, no Pro tier.
2. **Send any data off-device** beyond the calls Claude Code itself makes. No telemetry, no analytics, no error reporting services. Local logs only.
3. **Add cloud sync, accounts, or login.** Everything is local. There is no server.
4. **Direct Anthropic API calls.** All AI work goes through `claude` CLI subprocesses. The only allowed exception is Oracle/Moderator (Haiku) routing calls; even those should default to spawning Claude Code with `--model haiku` rather than direct API.
5. **Bundle non-MIT-compatible dependencies.** Check licenses before adding any package.
6. **Auto-publish to the VS Code marketplace.** Publishing is Mauricio's call.

---

## Acceptance Gates

Each milestone in `docs/03-build-plan.md` ends with an acceptance gate. When you reach one:

1. Stop work.
2. Demonstrate the milestone is complete (run the relevant flow, show it working).
3. Wait for Mauricio's confirmation before starting the next milestone.

Do not proceed past an acceptance gate without confirmation. If you're stuck on a gate for more than 30 minutes of attempts, escalate to Mauricio rather than thrashing.

---

## Parallelization with Git Worktrees

Some milestones have parallelizable subtasks. When that's the case, the build plan will explicitly mark them with a `[parallel]` tag and list which worktrees to create.

To spawn a parallel Claude Code instance:

```bash
git worktree add ../hollow-halls-feature feature/some-feature
cd ../hollow-halls-feature
claude
```

Each worktree maintains its own file state. Multiple Claude Codes can work without conflicts. When the work is done, the worktree is merged back into main and removed.

**Rule:** Only the orchestrator instance (the one Mauricio is in) writes to `main`. Worktrees write to their own branches and open PRs.

---

## Known Constraints

- **Node.js 20+** required for the extension host
- **VS Code 1.85+** for webview API features used
- **Claude Code 2.x** required at runtime (the extension assumes the user has it installed)
- **macOS / Linux native, Windows via WSL2** (matches Claude Code's own support matrix)

---

## What success looks like

By the time we're done, a user should be able to:

1. Install Hollow Halls from the VS Code marketplace
2. Sign in with their Claude Max subscription (one-click via Claude Code's existing OAuth)
3. See a populated dashboard with three default halls (Design, Development, Research) and six default agents
4. Type "refactor my auth flow" into the Oracle, watch it route to the Development hall
5. See two agents (Aldric and Mire) converse with `[NEXT:]` tokens, then deliver a final result
6. Convene a Council Chamber across all three halls, watch the Heads debate and produce a conclusion
7. Create their own custom hall via the wizard, including AI-assisted skill generation
8. All without paying a cent beyond their existing Claude Max subscription

That's the bar. Now go read `docs/01-vision.md` and `docs/02-architecture.md`, then tell me which milestone you're starting on.

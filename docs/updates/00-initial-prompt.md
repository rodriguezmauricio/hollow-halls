# Initial Prompt for Claude Code

Copy and paste **everything below the dashed line** into Claude Code as your first message. Don't modify it.

---

I'm starting a new project called **Hollow Halls** — a VS Code extension that orchestrates Claude Code subprocesses to give developers a spatial multi-agent workspace.

The full specification is in this repository. Before doing anything else, please:

**1. Read these files in order:**

- `CLAUDE.md` (root) — operating manual, conventions, no-go zones
- `docs/01-vision.md` — what we're building and why
- `docs/02-architecture.md` — the technical architecture (this is the most important doc)
- `docs/03-build-plan.md` — milestones M0 through M9 with acceptance gates
- `docs/04-design-system.md` — visual tokens, character system spec
- `docs/05-data-model.md` — type definitions and message protocol grammar
- `docs/06-flows-summary.md` — abridged UX flows

**2. Skim these visual references:**

- `reference/flowmap.html` — open it; this is the source of truth for UX flows
- `reference/ui-mockup.html` — open it; this is the production-fidelity UI target

**3. Once you've read everything, respond with:**

- A short confirmation that you've understood the project
- Your summary of the architecture in your own words (so I can verify your understanding)
- The list of milestones in order, with the parallelization tags
- Any genuine questions you have before starting M0

**4. Do not start writing code until I confirm your understanding.**

After confirmation, you'll begin Milestone M0 (Project Scaffold). Work through milestones sequentially. At each acceptance gate, stop and demonstrate the milestone is complete before moving on. Do not skip gates.

Where the build plan marks a milestone `[parallel]`, ask me before spawning Git worktrees so I can decide whether to run them concurrently or sequentially.

Some critical constraints to remember:

- **No direct Anthropic API calls.** All AI work goes through `claude` CLI subprocesses.
- **No payment system, no cloud sync, no telemetry.** This is a free, local, public-source project.
- **Latest Claude models always.** Smart defaults per role (Opus for Heads/architects, Sonnet for general agents, Haiku for routing/moderation). Auto-bump when Anthropic ships a new model.
- **The webview is a dumb renderer.** All orchestration logic lives in the extension host.
- **Use my Claude Max subscription.** I'm signed into Claude Code already; subprocesses inherit my credentials.

When you're ready, summarize your understanding and we'll begin.

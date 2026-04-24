# Contributing to The Hollow Halls

Thanks for being here. A few things to know before you open a PR.

## Read these first

In order:

1. [`PRD.md`](PRD.md) — what we're building and why
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — module layout and message protocol
3. [`BUILD_PLAN.md`](BUILD_PLAN.md) — milestone ladder; **work the active milestone, don't jump ahead**
4. [`CLAUDE.md`](CLAUDE.md) — the hard rules that govern this repo (both for human contributors and AI pair-programmers)
5. [`MOCKUP.html`](MOCKUP.html) — the visual reference; the building view matches this ≥95%

## Dev setup

```bash
npm install
npm run build        # one-shot; use `npm run watch` while iterating
```

Press `F5` in VS Code to launch an Extension Development Host, then run **Hollow Halls: Open** from the Command Palette.

## Running agents without paying

Three providers ship. Default resolution is auto-detected; override in `.hollow/settings.json` (see [`README.md`](README.md#llm-providers)):

- **Claude Code CLI** — uses your Max/Pro subscription via `claude auth login`; no API key needed
- **Ollama** — free, local; `ollama serve` + `ollama pull <model>`
- **Anthropic API** — pay-per-token; `sk-ant-…` key via the first-use prompt

## Before you open a PR

1. `npm run typecheck` — clean
2. `npm run build` — both bundles produced, within [performance budgets](CLAUDE.md#performance-budget)
3. Manually test in an Extension Development Host — "it compiles" isn't done
4. One milestone per PR when possible; many small commits within a milestone are fine
5. [Conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`

## House rules (load-bearing)

These come from [`CLAUDE.md`](CLAUDE.md) — worth re-reading before any nontrivial change:

- **Personality > capability.** Agent system prompts are the most important code in the repo. Don't dilute a voice to make it "safer."
- **Extension host owns logic; webview is dumb.** No business logic, no API keys in the webview.
- **System prompts in TypeScript, not JSON.** `src/rooms/*.ts`.
- **LLM providers are pluggable.** Never hardcode model names at call sites — read from `src/core/Settings.ts`.
- **Stream everything user-facing.** Non-streamed replies kill the spatial metaphor.
- **No telemetry. No analytics. No phone-home.** Privacy-first.
- **The aesthetic is a feature.** When in doubt, push toward more atmospheric, not less. No emojis in the UI.

## Reporting bugs / proposing features

Use the issue templates. For bugs, include the provider you were using (Claude Code CLI / Ollama / Anthropic API), a model id if applicable, and any console errors from the webview devtools.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

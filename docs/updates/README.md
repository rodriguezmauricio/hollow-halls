# Hollow Halls — Handoff Package

This folder is the complete specification for **Hollow Halls**, a VS Code extension that gives developers a spatial, game-inspired interface for orchestrating multiple Claude Code agents. It is designed to be ingested and executed by **Claude Code**.

---

## What is Hollow Halls?

A VS Code extension that lets you organize AI agents into themed "halls" (Design, Development, Research, etc.), each populated by characters with distinct skills. Agents converse with each other to complete tasks. A central Oracle routes ambiguous requests; a Council Chamber convenes Heads of Department for cross-discipline decisions.

Visually, the extension borrows the gothic, vector-art aesthetic of Hollow Knight — soul-colored borders, Cinzel typography, character ornamentation.

Architecturally, Hollow Halls is an **orchestration layer over Claude Code**. It does not call Anthropic's API directly. It spawns `claude` CLI subprocesses, one per active agent, and routes their conversations. This means users get to use their **Claude Max subscription** instead of paying per-token, and the extension inherits Claude Code's skill system, MCP integrations, and tool ecosystem for free.

---

## How to Use This Folder

### 1. Create a new GitHub repository

```bash
mkdir hollow-halls
cd hollow-halls
git init
gh repo create hollow-halls --public --license MIT
```

### 2. Drop these files into the repo root

Copy everything from this `hollow-halls-handoff/` folder into your new repo's root. Final structure:

```
hollow-halls/
├── CLAUDE.md
├── README.md (you'll replace this with a public-facing one later)
├── docs/
├── reference/
└── prompts/
```

### 3. Open in VS Code, run Claude Code

```bash
code .
# Then in VS Code, open the Claude Code panel (or terminal)
# Claude Code auto-loads CLAUDE.md
```

### 4. Paste the initial prompt

Open `prompts/00-initial-prompt.md`, copy its contents, and paste into Claude Code's first message.

Claude Code will:
1. Read all the docs
2. Confirm understanding
3. Begin executing milestone M0 (project scaffold)
4. Continue through milestones, asking for your input at each acceptance gate

### 5. Use Git worktrees for parallel work

When Claude Code reaches milestones that can run in parallel (UI work, agent system, character compositor), spawn parallel Claude Code instances using `--worktree`:

```bash
claude --worktree feature/character-system
```

Each worktree is an isolated checkout. Multiple Claude Codes can work concurrently without conflicts.

---

## File Index

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Auto-loaded by Claude Code on every session. Conventions, tone, no-go zones. |
| `docs/01-vision.md` | What we're building and why. The big picture. |
| `docs/02-architecture.md` | **The key technical doc.** How the subprocess orchestration works. |
| `docs/03-build-plan.md` | Milestones M0–M9 with acceptance criteria. |
| `docs/04-design-system.md` | Visual tokens, character system, theme structure. |
| `docs/05-data-model.md` | Type definitions + message protocol tokens. |
| `docs/06-flows-summary.md` | Summary of UX flows; refers to flowmap for full detail. |
| `reference/flowmap.html` | Visual flowmap, 14 sections covering every flow. Open in browser. |
| `reference/ui-mockup.html` | UI mockup at production fidelity. Open in browser. |
| `prompts/00-initial-prompt.md` | First message to paste into Claude Code. |

---

## License

MIT. See `LICENSE` once the repo is initialized.

---

## Contact

Built by Mauricio + Claude. Issues and PRs welcome on the public repo.

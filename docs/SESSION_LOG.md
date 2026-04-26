# Session Log

Chronological log of working sessions. Each entry: date, scope, outcome,
follow-ups. Per the durable rule "commit + document every change," every
session ends with a commit and an entry here.

---

## 2026-04-26 — M5 work-in-progress checkpoint + Phase -1 strip pass

### Scope
Two layers landed in one commit because they accumulated across several
prior sessions before the new "commit every change" rule was adopted:

1. **M5 milestone work** (uncommitted backlog now captured):
   - `src/core/SkillsManager.ts` — bundles per-agent SKILL.md files into
     isolated `--add-dir` directories so one agent's skill never bleeds into
     another.
   - `src/core/Persistence.ts` — saves Great Hall transcripts and plan-mode
     bodies to `.hollow/transcripts/` and `.hollow/plans/`.
   - `src/core/Oracle.ts`, `src/core/Moderator.ts` — Oracle routing and
     Great Hall moderator orchestration.
   - `src/core/CommonRoom.ts` — Great Hall meeting state machine.
   - Permission modes (`plan`, `acceptEdits`, etc.) wired through every
     provider, with the BUILD button promoting plan-mode replies into
     acceptEdits runs.
   - `webview/scene/room/GreatHallView.ts`, `OracleView.ts` — webview
     surfaces for the Great Hall meeting flow and the Oracle consultation.
   - Tool-use rendering in the transcript (inline tool chips, BUILD button,
     plan-path badge, cost badge per turn).

2. **Phase -1 strip pass** (this session, per the new
   functionality-first roadmap at `~/.claude/plans/ok-where-do-i-memoized-gadget.md`):
   - Removed `roomCorners()` helper and all 8 corner-bracket calls from
     `webview/scene/Building.ts`.
   - Removed body radial gradients in `webview/theme/hollow.css` — body is
     flat `--ink` again.
   - Removed `.tool-chip-error` red tint and the soul-dot glow on the
     transcript's accent border-stripe.
   - Removed the `box-shadow` glow on `.gh-agent-card.picked` and the
     `gh-dot-pulse` keyframe animation on the active dot.
   - Kept all structural changes (chat-card transcript layout, Great Hall
     portrait card grid, Oracle + Great Hall top-row floor plan).

### Outcome
- `npm run typecheck` clean.
- `npm run build` clean (extension 90.2 KB, webview 122.0 KB — both well
  under budget).
- Visuals are now wireframe-grade and deliberate. The decorative pressure
  is off.

### Follow-ups (next sessions)
- **Phase 0**: write `STYLE.md` — a short charter that locks the
  wireframe-grade approach until the extension is functionally complete.
- **Phase 1**: run an end-to-end UX walkthrough and produce
  `UX_REVIEW.md` covering all five new product requirements (custom
  rooms, custom agents, deactivatable singletons, in-product
  explanations, live model picker).

### Working principle adopted this session
**Commit + document every change.** Every session ends with a
conventional-commits commit and a `docs/SESSION_LOG.md` entry. No
undocumented features. No "I'll commit it later" piles. (Stored in
auto-memory at
`~/.claude/projects/c--Users-conta-Desktop-PixelOffice/memory/feedback_commit_and_document.md`.)

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
- ~~**Phase 0**: write `STYLE.md`~~ ✓ done (commit `a8ab08c`)
- **Phase 1**: run an end-to-end UX walkthrough and produce
  `UX_REVIEW.md` covering all five new product requirements (custom
  rooms, custom agents, deactivatable singletons, in-product
  explanations, live model picker).

---

## 2026-04-26 — Phase 0: STYLE.md wireframe charter

### Scope
Created `STYLE.md` at repo root (~107 lines). Purpose: prevent visual
drift during the wireframe phase (Phases 0–3), not specify final polish.

Contents:
- **Aesthetic name**: Wireframe Occult — ink-on-bone grid, one room
  accent as the only warmth.
- **Canonical palette**: all 17 CSS vars from `hollow.css` with role
  and when-to-use. No new colours permitted before Phase 4.
- **Typography**: Cinzel for titles, IBM Plex Mono for body/UI, both
  bundled locally. No additional font families.
- **Room interior skeleton**: back-wall + floor + table + N agents +
  room label only. No new props, no lighting, no enrichment.
- **Modal/picker chrome**: `--ink-2` background, 1px `--stone` border,
  16px padding — shared across every overlay.
- **Empty/loading/error states**: one minimal pattern per state.
- **Anti-goals list**: what's explicitly off-limits (SVG ornament,
  raster assets, radial gradients, box-shadow glow, new animations,
  new colours, new fonts) until Phase 4.

### Outcome
- No source-code changes — docs only.
- `STYLE.md` committed as `a8ab08c`.

### Follow-ups
- ~~**Phase 1**: end-to-end UX walkthrough → `UX_REVIEW.md`~~ ✓ done (commit `062fc6f`)

---

## 2026-04-26 — Phase 1: UX_REVIEW.md

### Scope
Code audit across all 24 source files (extension host + webview layer).
Produced `UX_REVIEW.md` — a prioritised punch list.

### Findings
- **6 blockers**: 5 product requirements entirely absent (custom rooms,
  custom agents, live model picker, singleton deactivation, in-product
  explanations) + one Phase -1 regression (tool-chip-error CSS removed but
  class still applied → error chips are visually indistinguishable).
- **10 friction items**: Oracle auto-redirect too fast, mode pill uses
  internal names with no explanation, BUILD button unexplained, single-room
  transcripts not persisted, Great Hall "leave" has no rejoin affordance,
  `maxTokens` capped at 300 for all providers, Oracle stuck on error, etc.
- **5 nits**: hardcoded "active" status, Ollama cost label, etc.

### Outcome
- `UX_REVIEW.md` committed as `062fc6f`.
- Phase 2 order recommended in the document.

### Follow-ups
- ~~**B6** tool-chip-error CSS~~ ✓ `0d6d2d3`
- ~~**F5** Oracle error recovery~~ ✓ `59b41fc`
- ~~**F8** maxTokens fix~~ ✓ `b402b7c`
- **Next**: F2 — mode pill authoritative + rename (plan → PLAN MODE, etc.)

---

## 2026-04-26 — Phase 2 (first three items)

### Scope
Three isolated bug fixes from the UX_REVIEW.md punch list.

**B6 — tool-chip-error CSS restored** (`0d6d2d3`)  
Phase -1 stripped `.tool-chip.tool-chip-error` as "decorative" but the red
tint was informational (error chips were visually identical to success chips
beyond the `[✕]` prefix symbol). Restored as `color: var(--sec)` only — no
background tint, consistent with STYLE.md wireframe rules.

**F5 — Oracle error recovery** (`59b41fc`)  
When an API error fired during an Oracle consult, `showThinking()` had
disabled the form and only `showDecision()` ever re-enabled it — so the
Oracle was permanently stuck. Added `OracleView.showError(message)`:
shows the message in `--sec` colour in the status bar and re-enables the
form for retry. `main.ts` now routes `error` messages to `showError()`
when the Oracle is visible, rather than the generic toast.

**F8 — maxTokens 300 → mode-based defaults** (`b402b7c`)  
`AgentManager` was calling every provider with `maxTokens: 300` (a
leftover early-prototype cap). Added `maxTokens` to `AgentCallOptions`,
computed in `ProviderFactory.resolveAgentCall()` via `maxTokensForMode()`:
plan=2000, acceptEdits=800, other=1000. `CommonRoom.ts` had the same
hardcoded 300 — fixed there too. Claude Code CLI is unaffected (it ignores
`maxTokens`).

### Outcome
- Build clean: typecheck + build passed.
- All three fixes are isolated; no cross-file side effects.

### Follow-ups
- **F2**: mode pill authoritative + rename (needs protocol change + webview)
- Continue working down UX_REVIEW.md list.

### Working principle adopted this session
**Commit + document every change.** Every session ends with a
conventional-commits commit and a `docs/SESSION_LOG.md` entry. No
undocumented features. No "I'll commit it later" piles. (Stored in
auto-memory at
`~/.claude/projects/c--Users-conta-Desktop-PixelOffice/memory/feedback_commit_and_document.md`.)

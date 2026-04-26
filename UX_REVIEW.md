# UX_REVIEW.md — End-to-End Walkthrough

Code audit, 2026-04-26 (updated same day with second pass). All 11 message
types are wired. Core infrastructure (streaming, 3 providers, plan-mode +
BUILD, Great Hall meeting state machine, Oracle routing, cost tracking) is
complete and production-grade.

Two classes of gaps found: **(A) immediate usability problems in existing UI**
(new findings from second code read, below) and **(B) missing product surfaces**
(five new product requirements, further below).

Each item: **severity · flow · what's wrong · fix sketch**.

---

## IMMEDIATE — existing surfaces that confuse today

These are problems in the code that is already live. A user sitting down with
the extension as-shipped right now will hit each of these.

### I1 · PLAN / EDIT / BYPASS buttons have zero explanation *(blocker)*
Flow: user enters any room or the Great Hall picker.  
Problem: three buttons labelled PLAN, EDIT, BYPASS appear near the textarea.
There is no tooltip, no label, no description of what each does. PLAN = write
only; EDIT = write + file changes; BYPASS = no permission checks. A first-time
user has no idea.  
Fix: on hover, show a one-line hint in the `.prompt-status` area:
- PLAN → `writes a plan — no file changes`
- EDIT → `edits files — asks before each change`
- BYPASS → `full autonomy — no confirmations`

### I2 · BYPASS mode fires with no warning *(blocker)*
Flow: user accidentally selects BYPASS and sends a prompt.  
Problem: BYPASS grants Claude unrestricted file-system access. There is no
visual distinction from the other modes, no confirmation, no cost note.  
Fix: when BYPASS is selected, tint the send-button border red/amber and show
a persistent status line `bypass active — no permission checks`. No modal
needed; the visual difference is enough.

### I3 · Oracle auto-routes with no cancel — user is trapped *(blocker)*
Flow: user consults Oracle; Oracle picks a room.  
Problem: `OracleView.ts:98-104` fires `setTimeout(1600ms)` and navigates the
user automatically. No cancel, no way to change their mind.  
Fix (was F4 on old list): replace the timer with a countdown progress bar + a
CANCEL button. Three seconds minimum. Pressing CANCEL or Escape clears the
timer and stays on the Oracle screen.

### I4 · No first-run explanation of anything *(blocker)*
Flow: brand-new user opens the extension for the first time.  
Problem: a dark floor plan with room tiles renders. There is no hint about what
the Oracle does, what the Great Hall is, what PLAN mode means, or that these
are AI agents. The "ENTER ›" hover hints exist but explain nothing about purpose.  
Fix: on the first `init` (detect via `sessionTotalUSD === 0` and no stored
dismiss flag), show a brief overlay card on the floor plan. Three sentences max:
"Each room has AI agents for a specific discipline. Ask the Oracle what to do —
it routes you to the right room. Press Escape to dismiss." Store dismissed state
in `vscode.getState()`.

### I5 · Oracle: Enter submits; rooms use Ctrl+Enter — inconsistency *(friction)*
Flow: user types a multi-line question in the Oracle and presses Enter to
add a line break.  
Problem: `OracleView.ts:172-176` submits on bare `Enter` (no modifier). Every
other send target (rooms, Great Hall) requires `Ctrl/⌘+Enter`. A user writing
a long question will accidentally submit.  
Fix: unify on `Ctrl/⌘+Enter` everywhere. Update Oracle placeholder to:
`Ask the Oracle… (Ctrl+Enter to send)`.

### I6 · Stage resizer has no visual affordance *(friction)*
Flow: user wants to resize the scene vs transcript split.  
Problem: the `.room-resizer` / `.gh-resizer` div is invisible — no dots, no
line, no cursor hint visible before hover. Most users won't find it.  
Fix: render a centred row of 3–5 small dots (SVG or CSS `::before`) inside the
resizer div using `--stone-lo` color. This is the universally understood
drag-handle pattern.

### I7 · BUILD button appears with no explanation *(friction)*
Flow: plan-mode turn completes; a BUILD button appears on the agent card.  
Problem: "BUILD" means nothing to a user who hasn't read the docs. No tooltip,
no label explaining it re-runs the same prompt in acceptEdits mode.  
Fix: add a `title` attribute `re-runs this plan — Claude will now edit files`
and show that text in the prompt-status area on hover.

### I8 · Plan-saved badge and transcript path are plain text, not links *(friction)*
Flow: plan saved → `plan saved · .hollow/plans/...md` appears. Meeting ends →
`transcript: .hollow/meetings/...md` appears.  
Problem: both are static text. Clicking does nothing. The file is right there.  
Fix: wrap in a `<button>` that sends a VS Code `vscode.open` command for the
path. Label it `open ↗`.

### I9 · Great Hall roster shows no room of origin *(friction)*
Flow: Great Hall picker opens with agents from all 6 rooms.  
Problem: agent cards show name + tag + "active" but no room name. With 12
agents visible, the user cannot tell which agent belongs to which room.
`renderRoster()` already has `group.roomName` — it's just not rendered.  
Fix: add a group header (`div.gh-roster-group-label`) above each room's agents,
text = `group.roomName` in the room's accent color.

### I10 · No confirmation before CANCEL MEETING *(friction)*
Flow: user clicks CANCEL MEETING mid-session.  
Problem: `onCancelMeeting` fires immediately. A long valuable meeting is gone.  
Fix: on first click, change button text to `CANCEL? CLICK AGAIN` and set a
3-second timeout that resets it. Second click within the window confirms.

### I11 · Tool-use chip symbols `[▸]` and `[↩]` are cryptic *(friction)*
Flow: agent runs a tool during acceptEdits.  
Problem: `[▸] bash_20250124 · executing: ls -la` — the `▸` symbol conveys
nothing without context. `[↩]` for result is equally opaque.  
Fix: replace with text: `[run]` for start, `[done]` for success, `[err]` for
error. Same compact layout, no symbol literacy required.

### I12 · Thinking slider has no cost hint *(friction)*
Flow: user slides thinking level to HIGH.  
Problem: HIGH fires extended thinking with maximum budget tokens — can cost
5–10× a normal response. No warning anywhere in the UI.  
Fix: when thinking > OFF, show a one-line hint in `.prompt-status`:
`extended thinking — higher token cost`.

### I13 · ESC shortcut is undiscoverable *(nit)*
Flow: user wants to leave a room or the Oracle quickly.  
Problem: `main.ts` wires Escape to close any open view — a great shortcut
nobody knows about because it's not shown anywhere.  
Fix: add `esc` in small `--stone-lo` text next to every LEAVE button.

### I14 · Error toast is not dismissible *(nit)*
Flow: an error toast appears.  
Problem: auto-dismiss in 5.5 s; no manual close button. Can't copy the text.  
Fix: add an `×` button. Keep auto-dismiss.

### I15 · Cost badge format is dense *(nit)*
Flow: agent turn completes; cost badge appears in the transcript footer.  
Problem: `claude-code · claude-sonnet-4-6 · 1234→456 tok · $0.023` reads like
a log line, not a user-facing label.  
Fix: `claude sonnet · 1.7k tok · $0.02`. Short provider name, merged token count
with K suffix, shorter cost format.

---

---

## BLOCKER — prevents meaningful use

### B1 · Custom rooms — not implemented
Flow: user wants a room beyond the 6 built-ins.  
Problem: rooms are hardcoded static imports at `src/extension.ts:34`:
```
const ROOMS: readonly Room[] = [designRoom, uiuxRoom, codeRoom, frontRoom, marketRoom, secRoom];
```
No protocol messages for room CRUD. No UI entry point. No `.hollow/rooms/`
persistence layer.  
Fix: `loadAllRooms()` in extension.ts merging built-ins + custom; new
protocol messages `create_room / update_room / delete_room`; a room-editor
webview panel; `Persistence.ts` methods `saveRoom / loadCustomRooms / deleteRoom`.

### B2 · Custom agents per room — not implemented
Flow: user wants to add / edit / remove an agent within any room.  
Problem: `AgentDef[]` in each room file is a static array. No CRUD path.  
Fix: agent editor panel wired to room CRUD (B1); agent overrides extend to
full-agent authoring, not just model/permission overrides.

### B3 · Live model / provider picker — not implemented
Flow: user wants to change which model or provider an agent uses.  
Problem: the only way to change models is to manually edit `.hollow/settings.json`.
No protocol messages for picker. No UI.  
Fix: picker panel (per-agent / per-room / global scopes) writing through to
`Settings.ts`; new messages `get_settings / update_settings`; a "current
provider" status badge visible from the floor plan or room header.

### B4 · Oracle + Common Room deactivation — not implemented
Flow: user wants to hide Oracle or Great Hall from the floor plan.  
Problem: no toggle exists anywhere. No protocol messages. Oracle and Common
tiles are always rendered in Building.ts.  
Fix: deactivation toggle in room-editor (or a singleton settings panel);
`Room.active: boolean` field; Building.ts conditionally renders/dims tiles;
routing/convening fallbacks when off.

### B5 · In-product explanations — absent everywhere
Flow: user opens a room and sees a BUILD button, or a mode pill showing "plan".
Problem: there is no "how this works" affordance on any surface — not Oracle,
not Great Hall, not the BUILD button, not the mode pill, not the cost badge, not
the provider. A new user has no entry point for understanding any of these.  
Fix: pick one pattern (info icon → collapsible side panel) and apply to:
Oracle chamber, Great Hall picker, mode pill, BUILD button, cost badge, model
picker, permission modes. Oracle and Common Room tiles on the floor plan need
an especially visible "what is this?" entry point per the product requirement.

### B6 · tool-chip-error CSS removed but class still applied (Phase -1 regression)
Flow: agent runs acceptEdits and a tool call errors.  
Problem: `Transcript.ts:332` applies class `tool-chip-error` and shows `[✕]`
prefix — but the CSS rule for `.tool-chip.tool-chip-error` was removed in
Phase -1 as "decorative." The `[✕]` symbol still distinguishes errors, but the
background tint was *informational*, not decorative. Error chips now look
identical to success chips visually.  
Fix: restore a minimal error style (e.g. `color: var(--sec)` on the chip text)
that doesn't re-add the red background but keeps error chips readable.

---

## FRICTION — annoying but workable

### F1 · First run — no onboarding, no provider status
Flow: user opens extension for the first time.  
Problem: the floor plan renders with 8 tiles and no guidance. Auto-detection
runs (`autoDetectDefault()` in Settings.ts) but the result is never surfaced in
the UI. The user doesn't know which provider is active, whether they need an
API key, or where to start. Clicking any room works, but the Oracle and Common
Room tiles look the same as discipline rooms with no hint about what they do.  
Fix: a one-line provider status badge on the floor plan; a visible "start here"
affordance (e.g. dim non-Oracle tiles on first open); B5 fixes cover Oracle.

### F2 · Mode pill uses internal names — unexplained
Flow: user enters a room; a pill appears showing "plan" or "acceptEdits".  
Problem: "plan" and "acceptEdits" are Claude Code CLI permission-mode names,
not user-facing language. There is no tooltip, no label, no explanation of
what mode the agent is running in or why it matters.  
Additionally the pill is a *heuristic* (set client-side in `main.ts:47`)
rather than authoritative state from the extension — it can lag or diverge.  
Fix: rename pill labels to "PLAN MODE" / "BUILD MODE" with a clickable info
icon (B5); make the extension send the actual mode in `room_opened` / `agent_message_complete` so the pill is authoritative.

### F3 · BUILD button — no explanation
Flow: plan-mode turn completes; a BUILD button appears at the bottom of the turn card.  
Problem: there is no tooltip, label, or text explaining that BUILD re-runs the
prompt in `acceptEdits` mode so the agent can actually write files. A user who
doesn't know the plan → acceptEdits workflow will not understand what BUILD does
or that clicking it will cost more tokens.  
Fix: a short descriptive label ("BUILD — run plan, allow file edits") or an
info tooltip (B5 pattern); a cost warning if the session total approaches $0.50.

### F4 · Oracle auto-redirect is too fast and uncancellable
Flow: Oracle routes to a room or Great Hall.  
Problem: `OracleView.ts:89` — after showing the decision, a 1.6 s timer fires
and navigates automatically (`this.routeTimer = setTimeout(..., 1600)`). The
user has no way to cancel, change their mind, or re-read the rationale before
being teleported. For a `direct` answer (trivial fact), routing never fires —
that path is fine. But for `room` and `hall` routes, 1.6s is very short.  
Fix: show a "GO → DESIGN" button instead of the auto-timer (or at minimum
stretch the delay to 4 s and add an ESC-to-cancel note).

### F5 · Oracle stuck in disabled state on error
Flow: Oracle consult fails (API error, JSON parse failure).  
Problem: `OracleView.showThinking()` disables the form. If the extension sends
an `error` message instead of `oracle_response`, the Oracle view never gets
`showDecision()` called, so the input stays permanently disabled. Only a toast
(5.5 s, then gone) tells the user something went wrong.  
Fix: handle the `error` case in OracleView — re-enable the form and show the
error inline rather than as a toast.

### F6 · Single-room transcripts not persisted
Flow: user has a 20-turn conversation with an agent, closes the room, closes the
extension, reopens.  
Problem: `roomStates` in `main.ts` is an in-memory Map. It survives leaving and
re-entering a room within a session. It does NOT survive a webview reload or
extension restart. Only Great Hall transcripts go to disk (via `Persistence.ts`).
Single-room transcripts are silently lost.  
Fix: `Persistence.ts.saveRoomTranscript()` + restore on `room_opened`.

### F7 · Great Hall "leave + running" has no rejoin affordance
Flow: user clicks LEAVE mid-meeting; the floor plan shows a pulsing busy
indicator on the Common Room tile.  
Problem: the pulse communicates "something is happening" but there is no text,
tooltip, or indicator explaining that the meeting is still running and can be
rejoined by clicking the tile. `main.ts:182-190` does handle clicking Common
while meeting is active (`greatHall.reveal()`), but a user who doesn't know
this won't try it.  
Fix: a persistent "MEETING IN PROGRESS — click to rejoin" label on the Common
Room tile when `room-busy` is active.

### F8 · maxTokens capped at 300 in AgentManager
Flow: plan-mode request — agent needs to write a multi-section plan.  
Problem: `AgentManager.ts` passes `maxTokens: 300` to every provider stream.
For Anthropic API calls, `max_tokens: 300` is very short and will cut off
plan-mode responses mid-sentence on anything non-trivial. Claude Code CLI
ignores `maxTokens` (it uses `--max-turns` instead), so this only hurts
Anthropic and Ollama users, but it's still a correctness issue.  
Fix: expose `maxTokens` in `AgentCallOptions`; default 2000 for plan mode,
600 for acceptEdits (tool-heavy turns are shorter). Make it configurable.

### F9 · "No workspace" failure is silent for single-room plans
Flow: user with no workspace folder open triggers a plan-mode response.  
Problem: `Persistence.savePlan()` returns `undefined` when there's no workspace
URI. Extension.ts only sends `plan_saved` if path is truthy, so no badge appears.
The user gets no indication that plans are not being saved — the experience is
identical to "plans saved successfully" minus the badge.  
Fix: send a `plan_saved` message with `path: null` and render a `plan not saved
— open a workspace folder` note in the transcript footer.

### F10 · Provider auto-detection fails silently
Flow: user expects Claude Code CLI but it isn't on PATH.  
Problem: `Settings.autoDetectDefault()` tries `claude auth status`, falls through
to Ollama check, falls through to Anthropic. If none succeed, it defaults to
Anthropic but the user probably doesn't have an API key. The first send will
error with a toast, but the user sees no explanation of *why* or what to do.  
Fix: surface the detected provider in the floor-plan header; if Anthropic is
chosen by fallback and no API key is set, show a persistent "no provider
configured" banner with a "configure" link.

---

## NIT — minor polish

### N1 · Agent status chip always says "active"
In `GreatHallView.ts:289`: `<span class="gh-card-status-text">active</span>` —
hardcoded. No real status differentiation. Low priority but slightly misleading.

### N2 · Oracle rationale not shown for "direct" answers
When `decision.route === 'direct'`, `rationale` element is hidden and the form
is re-enabled. The direct answer goes into `rationale.textContent` but the
element is hidden (`if (dest) dest.setAttribute('hidden', '')`). Actually,
`oracle-rationale` is not hidden — only `oracle-destination` is. Re-read:
the rationale IS shown. But there's no way to ask a follow-up; the form just
re-enables in place. Acceptable but the UX for iterating on a direct answer
is slightly awkward.

### N3 · "free" label for Ollama cost
`formatUSD(0)` returns `"free"`. Ollama always returns 0 tokens. The cost badge
on Ollama turns will say `ollama · model · 0→0 tok · free`. "free" implies
zero cost, which is true in billing terms, but "0 tok" makes it look like the
agent produced nothing. Fix: Ollama-sourced turns should omit the cost badge
entirely, or show `local model — no cost tracking`.

### N4 · "No agents selected" error on empty pick deselect
If a user opens a room with one agent and deselects the chip, the COMMUNE
button disables and status shows "no agents selected." That's correct, but
the chip still looks like a normal clickable chip — no disabled state styling.
Clicking COMMUNE while deselected shows the status but doesn't stop the button
from looking active.

### N5 · Great Hall re-picks cleared on NEW MEETING
`startNewMeeting()` calls `this.picks.clear()`. If the user just ran a meeting
with agents A + B and wants to run a follow-up meeting, they must re-select from
scratch. Offer "restore previous attendees" as a quick affordance.

---

## Summary: What's missing by product requirement

| Requirement | Status |
|---|---|
| Custom rooms | Not started. No protocol, no UI, no persistence. |
| Custom agents per room | Not started. Blocked on custom rooms foundation. |
| Oracle + Common deactivation | Not started. No toggle, no protocol. |
| In-product explanations | Not started. No info affordances anywhere. |
| Live model picker | Not started. Manual JSON edit only. |

---

## Recommended Phase 2 order

Work one item per session in this order. `I*` = immediate code issues (above);
`B*`/`F*`/`N*` = product-surface gaps (below).

| # | ID | Item | Size |
|---|---|---|---|
| 1 | I1 | Mode button tooltips (PLAN/EDIT/BYPASS) | 30 min |
| 2 | I2 | BYPASS visual warning | 30 min |
| 3 | B6 | Restore tool-chip-error style | 30 min |
| 4 | I3 | Oracle countdown + cancel (was F4) | 1 hr |
| 5 | F5 | Oracle error recovery + form re-enable | 1 hr |
| 6 | I5 | Unify Enter vs Ctrl+Enter | 30 min |
| 7 | I4 | First-run overlay card | 1 hr |
| 8 | F8 | maxTokens default in AgentManager | 1 hr |
| 9 | I9 | GH roster room-name group headers | 30 min |
| 10 | I6 | Stage resizer visual affordance | 30 min |
| 11 | I10 | CANCEL MEETING double-confirm | 30 min |
| 12 | I7 | BUILD button explanation | 30 min |
| 13 | I8 | Plan path + transcript path clickable | 1 hr |
| 14 | F7 | Great Hall "meeting running" rejoin label | 30 min |
| 15 | B5 | In-product explanations (Oracle, Great Hall, cost) | 2 hr |
| 16 | F1 | Floor plan provider status badge | 1 hr |
| 17 | B3 | Live model picker | sub-plan |
| 18 | B4 | Oracle + Common deactivation | sub-plan |
| 19 | B1+B2 | Custom rooms + agents | sub-plan |
| 20 | F6 | Single-room transcript persistence | 2 hr |
| 21 | F9+F10 | No-workspace + provider-detection UX | 1 hr |

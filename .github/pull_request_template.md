<!-- Thanks for the contribution. Short is fine — a paragraph and a checklist beats a wall of text. -->

## What this does

<!-- One or two sentences. -->

## Milestone

<!-- Which BUILD_PLAN.md milestone this serves, or "post-V1" / "polish" / "fix". Per CLAUDE.md rule #1 we work one milestone at a time. -->

## Screenshots / recordings

<!-- Especially for any UI change. A GIF of the speech/transcript streaming, a before/after of the room view, etc. -->

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes; bundle sizes still under budget
- [ ] Manually tested in an Extension Development Host (not just "it compiles")
- [ ] If a new agent/room: system prompt reads as *opinionated and specific* per CLAUDE.md rule #5
- [ ] If a new LLM call: it streams (rule #7) and goes through a provider (rule #6)
- [ ] No new external service calls (rule #10)

## Notes for reviewers

<!-- Anything non-obvious, or anything you're unsure about and want a second opinion on. -->

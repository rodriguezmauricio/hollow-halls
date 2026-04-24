# PRD — The Hollow Halls

> A VS Code extension that gives developers a visual, spatial home for orchestrating multiple Claude agents. Each "room" is a discipline (design, code review, security, etc.) with its own system prompt, tools, and agent roster. Rooms can hand off work to each other or convene in a Great Hall for synchronous multi-agent meetings. An Oracle agent sits at the entrance and routes ambiguous requests to the right room.

---

## 1. Problem

Multi-agent AI tools today (CrewAI, AutoGen, sub-agents in Claude Code) are powerful but invisible. You declare roles in YAML, hope the orchestration works, and read text logs to figure out what happened. There is no sense of *place*, no spatial intuition for which agent is doing what, no visible handoff between specialists.

Result: most developers don't bother with multi-agent setups even when their task obviously spans disciplines (e.g., "design and implement a passwordless login" — that's a designer, a security engineer, a frontend dev, and a UX researcher).

## 2. Solution

A VS Code extension that renders a top-down pixel-art office in a webview. Each room contains a small team of specialist Claude agents with curated system prompts and tools. The user clicks a room, picks who they want to talk to, types a prompt, and watches the agents respond — visually, in their room. Multi-agent meetings happen in the Great Hall with a moderator pattern. An "Oracle" entry-point agent routes ambiguous requests to the right room.

The spatial metaphor is the product. Without it, this is just another agent framework.

## 3. Target Users

- **Primary**: solo developers and small teams who use Claude Code daily and want richer orchestration without writing YAML or wiring frameworks
- **Secondary**: technical creatives (indie game devs, design engineers, RE researchers) who want a "studio" feel for their AI tooling
- **Not for**: enterprise teams needing audit/compliance — explicitly out of scope for v1

## 4. Goals & Success Metrics

### Primary goal
Make multi-agent orchestration feel *legible and inviting* enough that users reach for it instead of one big monolithic prompt.

### Quantitative
- Time-to-first-meeting (install → first Great Hall convening) under 5 minutes
- ≥ 3 different rooms used by an active user in their first week
- ≥ 30% of sessions involve a handoff or Great Hall convening (vs. single-room single-agent)

### Qualitative
- "It feels alive" — users describe agents as having distinct voices, not all sounding like Claude
- Users want to customize: rename rooms, add agents, swap themes
- The aesthetic is screenshot-worthy enough that users post it unprompted

## 5. Core User Stories

1. **Quick consult**: "I want to ask the design team about color palette options." → Click Design room → Type prompt → Maya responds in a speech bubble inside the room.
2. **Cross-team task**: "I'm building a login flow and want design + security input." → Open Great Hall → Summon Maya + Kai → They deliberate synchronously, moderator routes turns.
3. **Don't know who to ask**: "Help me launch this side project." → Click Oracle → Oracle decides this needs Marketing + Design + Front-End → Convenes them in Great Hall automatically.
4. **Handoff**: "Have Design propose a layout, then have Code Review check the resulting HTML." → Send prompt to Design with handoff = Code Review → Result chains automatically.
5. **Customize**: "I want a 'Reverse Engineering' room with my own tools." → Custom Halls → Forge new room → Define system prompt, accent color, tools.

## 6. Scope (V1)

### In scope
- VS Code extension with webview UI
- Six built-in rooms: Design, UI/UX, Code Review, Front-End, Marketing, Cyber-Security
- The Great Hall (synchronous multi-agent meeting with moderator)
- The Oracle (routing agent at entrance)
- Hollow Knight aesthetic with soul-color per room
- Agent message streaming with speech bubbles
- Per-agent system prompts; no per-agent tools yet (rooms get tools, agents share them)
- Simple persistence: rooms config, conversation history, settings — saved to workspace `.hollow/`
- Cost meter (tokens used, estimated $) visible in status bar

### Out of scope (V1)
- Custom room creation UI (placeholder only — list "+ Forge new hall" but tile is non-functional in V1)
- Themes other than Hollow (CSS variables structured for future themes, but no theme switcher)
- Community-shared rooms / marketplace
- Long-term agent memory across sessions
- Agent-to-agent direct calls outside the Great Hall (rooms only hand off via user action or Oracle)
- Mobile / web version (VS Code only)
- Voice / audio
- Sub-room hierarchies (rooms within rooms)
- Tool execution sandboxing — tools run in extension host with user's permissions

## 7. Non-Goals

- Not trying to replace Claude Code or terminal workflows. Hollow Halls is for *deliberation* and *multi-disciplinary tasks*, not "write me a function."
- Not trying to be a CrewAI/AutoGen competitor. We're a UI layer on top of the Anthropic SDK; orchestration is intentionally simple.
- Not a game. The pixel art is a metaphor, not gameplay. No quests, no XP, no persistent world state beyond agent config.

## 8. Constraints

- **Cost**: Multi-agent meetings burn tokens. Default to Sonnet for room agents, Haiku for the Oracle and the Great Hall moderator. Hard cap of 6 turns per Great Hall meeting unless user overrides.
- **Latency**: Synchronous meetings must show progress immediately (thinking dots, streaming). Empty UI for >2s feels broken.
- **VS Code APIs**: Webview can't access local filesystem directly — all I/O through extension host messaging. Plan accordingly.
- **No telemetry in V1**: open-source, privacy-first. Users own their conversation logs.

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agents sound generic, metaphor collapses | High | Critical | Spend disproportionate effort on system prompts. Each agent must have a distinct *voice* (opinionated, has pet peeves, references specific concrete things). Validate with the "two agents in a room" test before shipping more rooms. |
| Cost surprises users | Medium | High | Cost meter visible at all times. Hard turn limits. Default to Haiku for routing/moderation. |
| Webview can't render fast enough | Low | Medium | Build a perf budget early: 60fps idle, agent updates batched. SVG over canvas for static elements; canvas only for heavy animation if needed. |
| VS Code extension API changes | Low | Medium | Pin to a stable API version. Avoid proposed APIs. |
| User is overwhelmed by 6 rooms on first launch | Medium | Medium | First-launch tour: dim all rooms except Oracle, prompt user to ask Oracle anything. Oracle then walks them to the right room visually. |

## 10. Open Questions

1. Should the Great Hall support multi-room handoffs *during* a meeting (moderator can pull in a third agent mid-discussion)? Probably yes for V2; V1 has fixed roster at start of meeting.
2. How are tools associated with rooms? Hardcoded in V1; user-configurable in V2.
3. Cost sharing: do we surface "this meeting will cost ~$0.40" before it starts? Probably yes — adds before estimate, then actual after.
4. Conversation persistence: per-workspace or global? Per-workspace makes sense (room context can reference workspace files).

## 11. License & Distribution

- MIT or Apache-2.0 (decide before public release)
- Distributed via VS Code Marketplace + GitHub Releases (.vsix)
- Source on GitHub from day one; build in public

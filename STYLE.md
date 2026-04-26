# STYLE.md — Hollow Halls Wireframe Charter

**Aesthetic name: Wireframe Occult.**
Clean ink-on-bone grid with one room-accent colour as the only warmth.
Everything reads as deliberate scaffolding, not a half-finished game UI.

---

## Canonical Palette

All visual constants live in `webview/theme/hollow.css` as CSS variables.
Do not introduce any colour not in this list before Phase 4.

| Variable | Hex | Role |
|---|---|---|
| `--ink` | `#070510` | Background, deep voids. Use as base surface. |
| `--ink-2` | `#0e0b1a` | Slightly lifted surface (panel, card BG). |
| `--ink-3` | `#161124` | Hover / focus lift on interactive elements. |
| `--stone` | `#4a3f5a` | Borders, dividers, inactive UI chrome. |
| `--stone-hi` | `#6a5d7d` | Highlighted border, focused ring. |
| `--stone-lo` | `#2c2438` | Subtle structural line (floor grid, table edges). |
| `--bone` | `#f2ead7` | Primary text, active labels, icon fill. |
| `--bone-dim` | `#b9b2a3` | Secondary text, metadata, placeholder. |
| `--bone-ghost` | `#6e6a60` | Disabled text, de-emphasised chrome. |
| `--orchid` | `#9de0f0` | Oracle accent; system-level feedback only. |
| `--design` | `#e8a04a` | Design room accent. |
| `--uiux` | `#5ec8c0` | UI/UX room accent. |
| `--code` | `#9d7cd8` | Code room accent. |
| `--front` | `#e07a95` | Front-end room accent. |
| `--market` | `#e4c056` | Marketing room accent. |
| `--sec` | `#d66c6c` | Security room accent. |
| `--common` | `#f2ead7` | Common / Great Hall accent (bone = neutral). |

**Rule:** one accent per room, nowhere else on that surface. Don't mix accents.

---

## Typography

| Use | Font | Weight |
|---|---|---|
| Room titles, section headings, modal titles | Cinzel | 400 or 600 |
| Body text, prompts, transcripts, labels, inputs | IBM Plex Mono | 400 |
| Status / cost / badge numbers | IBM Plex Mono | 400 |

No other font families until Phase 4. Both fonts are bundled locally in `assets/fonts/`.

---

## Wireframe Room Interior Rules

Each room interior is exactly this skeleton — nothing more until Phase 4:

1. Back wall (flat `--ink-2` rect or SVG rect, full width)
2. Floor (flat `--ink-3` rect, 30–35% of interior height)
3. Table or desk surface (thin `--stone-lo` line or rect)
4. N agent sprites (existing pixel-art SVG; no enrichment)
5. Room label (Cinzel, `--bone`, top or top-left)

Props that already exist (easel, server rack, etc.) may remain but must not be enriched.
No new props, no lighting cones, no drop shadows on structural elements.

---

## Modal and Picker Chrome

Every modal, picker panel, and overlay uses the same chrome:

- Background: `--ink-2`
- Border: 1px solid `--stone`
- Padding: 16px
- Title: Cinzel, `--bone`
- Body: IBM Plex Mono, `--bone-dim`
- Primary action button: `--bone` text on `--stone-hi` background

Do not introduce rounded corners, blur backdrops, or box-shadows before Phase 4.

---

## Empty / Loading / Error States

All three states share one minimal pattern:

- Empty: centred IBM Plex Mono label in `--bone-ghost`. One line. No illustration.
- Loading: single dot-pulse on `--orchid` (the one animation that's already in place).
- Error: `--sec` text, no background tint, no icon border.

---

## Anti-Goals (off-limits during Phases 0–3)

- No new SVG ornament (corner brackets, glyphs, decorative borders)
- No raster / PNG assets (Phase 4 introduces the asset pipeline)
- No lighting effects, fake bloom, or radial gradients
- No decorative animation beyond what already exists in the codebase
- No colours outside the canonical palette above
- No additional font families
- No box-shadow glow on interactive elements (remove any that reappear)

If a session is tempted to add any of the above, it's a Phase 4 task — defer it.

---

## When to Update This File

Update STYLE.md only when the user explicitly changes a rule.
Do not update it to justify a visual decision that conflicts with it.

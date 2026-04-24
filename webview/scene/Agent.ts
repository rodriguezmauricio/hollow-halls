import type { AgentVisual } from '@/messaging/protocol';

/**
 * Renders an agent as a chunky SVG "pixel-art" character. Not AAA art — but
 * each agent ends up visually distinct by hair shape+color, outfit, outfit
 * trim, and an optional accessory. Characters are drawn in a 24x28 viewBox
 * from waist-up, suited for sitting at a table.
 *
 * Three size presets:
 *   - 'tiny'   : building-view floor-plan glyph (≈18px tall)
 *   - 'medium' : small reference (≈48px)
 *   - 'large'  : room-view seated character (≈120px)
 *
 * shape-rendering="crispEdges" kills anti-aliasing so the blocky aesthetic
 * is honest.
 */

export type AgentSize = 'tiny' | 'medium' | 'large';

const SIZES: Record<AgentSize, { w: number; h: number }> = {
  tiny:   { w: 22,  h: 26  },
  medium: { w: 60,  h: 70  },
  large:  { w: 108, h: 126 },
};

export function agentSprite(v: AgentVisual, size: AgentSize = 'large'): string {
  const { w, h } = SIZES[size];
  return `
<svg viewBox="0 0 24 28" width="${w}" height="${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${shadow()}
  ${hairBack(v)}
  ${neck(v)}
  ${body(v)}
  ${apron(v)}
  ${head(v)}
  ${hairFront(v)}
  ${face(v)}
  ${accessory(v)}
</svg>`.trim();
}

function shadow(): string {
  return `<ellipse cx="12" cy="27" rx="9" ry="1" fill="#000" opacity="0.35"/>`;
}

function hairBack(v: AgentVisual): string {
  // Hair behind the head; shape varies by style.
  const c = v.hair;
  switch (v.hairStyle) {
    case 'long':
      return pixelRects([
        [4, 5, 16, 14], // wide mantle behind head + shoulders
      ], c);
    case 'bob':
      return pixelRects([
        [5, 4, 14, 10],
        [4, 6, 1, 7],
        [19, 6, 1, 7],
      ], c);
    case 'bun':
      return pixelRects([
        [8, 2, 8, 3], // bun top
        [6, 4, 12, 7],
      ], c);
    case 'buzz':
      return pixelRects([
        [7, 4, 10, 3],
      ], c);
    case 'short':
    default:
      return pixelRects([
        [6, 4, 12, 8],
      ], c);
  }
}

function hairFront(v: AgentVisual): string {
  // Bangs / fringe that overlays forehead.
  const c = v.hair;
  switch (v.hairStyle) {
    case 'long':
    case 'bob':
      return pixelRects([
        [6, 5, 12, 2],
        [6, 5, 2, 4],       // side bang left
        [16, 5, 2, 4],      // side bang right
        [8, 6, 4, 1],       // asymmetric sweep
      ], c);
    case 'bun':
      return pixelRects([
        [6, 5, 12, 2],
      ], c);
    case 'buzz':
      return '';
    case 'short':
    default:
      return pixelRects([
        [6, 5, 12, 2],
        [6, 5, 1, 3],
        [17, 5, 1, 3],
      ], c);
  }
}

function head(v: AgentVisual): string {
  // Face area, 10×8 block roughly centered.
  return pixelRects([
    [7, 7, 10, 8],   // face
    [6, 8, 1, 5],    // left cheek curve
    [17, 8, 1, 5],   // right cheek curve
    [8, 14, 8, 1],   // chin bottom
  ], v.skin);
}

function face(_v: AgentVisual): string {
  // Eyes, mouth. Dark ink color, not agent-specific.
  const ink = '#2a1f18';
  return [
    // Eye sockets as 1×1 dots with a 2×1 block for softness
    pixelRect(9, 10, 2, 1, ink),
    pixelRect(13, 10, 2, 1, ink),
    // Faint blush on cheeks — barely-there 1x1 warm patches
    pixelRect(8, 12, 1, 1, '#e89090'),
    pixelRect(15, 12, 1, 1, '#e89090'),
    // Mouth — a slight warm line
    pixelRect(11, 13, 2, 1, '#8a4a3c'),
  ].join('');
}

function neck(v: AgentVisual): string {
  return pixelRects([
    [10, 15, 4, 2],
  ], shade(v.skin, -0.08));
}

function body(v: AgentVisual): string {
  // Torso/shoulders block.
  return pixelRects([
    [3, 17, 18, 9],
    [4, 16, 16, 1],
    [2, 19, 1, 5],
    [21, 19, 1, 5],
  ], v.outfit);
}

function apron(v: AgentVisual): string {
  // Cream apron overlay + trim stripe. Rendered only when trim is set; otherwise
  // body alone carries the outfit color.
  if (!v.outfitTrim) return '';
  const cream = '#f0e6d2';
  const trim = v.outfitTrim;
  return [
    pixelRect(6, 17, 12, 8, cream),    // apron body
    pixelRect(6, 20, 12, 1, trim),      // sash stripe
    pixelRect(9, 17, 1, 3, shade(cream, -0.12)), // left strap shading
    pixelRect(14, 17, 1, 3, shade(cream, -0.12)), // right strap shading
  ].join('');
}

function accessory(v: AgentVisual): string {
  if (!v.accessory) return '';
  const accent = v.accent ?? '#d66c6c';
  switch (v.accessory) {
    case 'paintbrush':
      // Brush tucked into apron pocket, handle poking up.
      return [
        pixelRect(4, 18, 1, 4, '#6b4c2a'),  // handle
        pixelRect(5, 17, 1, 1, accent),      // ferrule
        pixelRect(3, 16, 2, 1, accent),      // bristles top
      ].join('');
    case 'glasses':
      return [
        pixelRect(8, 10, 3, 2, 'none'),
        pixelRect(13, 10, 3, 2, 'none'),
        `<rect x="8" y="10" width="3" height="2" fill="none" stroke="#2a1f18" stroke-width="0.3"/>`,
        `<rect x="13" y="10" width="3" height="2" fill="none" stroke="#2a1f18" stroke-width="0.3"/>`,
        pixelRect(11, 10, 2, 1, '#2a1f18'), // bridge
      ].join('');
    case 'headphones':
      return [
        pixelRect(5, 7, 1, 4, accent),
        pixelRect(18, 7, 1, 4, accent),
        pixelRect(6, 6, 12, 1, accent),
      ].join('');
    case 'pipe':
      return pixelRect(15, 13, 3, 1, '#6b4c2a');
    case 'pin':
      return pixelRect(16, 20, 1, 1, accent);
  }
}

// ---------- pixel-art primitives ----------

function pixelRect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function pixelRects(rects: ReadonlyArray<readonly [number, number, number, number]>, fill: string): string {
  return rects.map(([x, y, w, h]) => pixelRect(x, y, w, h, fill)).join('');
}

/** Lighten (+) or darken (-) a hex color by a fraction ∈ [-1, 1]. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const n = parseInt(m[1], 16);
  const r = clamp((n >> 16) & 0xff, amount);
  const g = clamp((n >> 8) & 0xff, amount);
  const b = clamp(n & 0xff, amount);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function clamp(v: number, amt: number): number {
  const out = Math.round(v + 255 * amt);
  return Math.max(0, Math.min(255, out));
}

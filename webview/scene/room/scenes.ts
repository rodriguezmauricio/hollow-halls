import type { AgentPublicInfo, RoomPublicInfo } from '@/messaging/protocol';
import { agentSprite } from '../Agent';

/**
 * Per-room interior scenes. The stage viewBox is 1200×560. The table always
 * spans x=[250, 950], y=[300, 430] — so agent seats, the speaker-pointer edge,
 * and the transcript panel below all know where to find it.
 *
 * Props (easel, monitors, arches) are room-specific. If a room has no custom
 * scene yet, `genericScene` renders a plain stone wall + wood floor.
 */

export const TABLE = {
  x: 250,
  y: 300,
  w: 700,
  h: 130,
  topEdgeY: 300,
};

const SCENE_VB = { w: 1200, h: 560 };

export function buildRoomScene(room: RoomPublicInfo): string {
  const seatPositions = computeSeatPositions(room.agents.length);
  const agentsSvg = room.agents
    .map((a, i) => {
      const pos = seatPositions[i];
      if (!pos) return '';
      return agentAtSeat(a, pos);
    })
    .join('');

  return `
<svg class="room-svg" viewBox="0 0 ${SCENE_VB.w} ${SCENE_VB.h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="room-planks" x="0" y="0" width="48" height="14" patternUnits="userSpaceOnUse">
      <rect width="48" height="14" fill="#1a1426"/>
      <line x1="0" y1="14" x2="48" y2="14" stroke="#0e0a18" stroke-width="0.6"/>
      <line x1="24" y1="0" x2="24" y2="14" stroke="#221a30" stroke-width="0.5"/>
    </pattern>
    <radialGradient id="room-glow" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="${room.accentColor}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${room.accentColor}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="table-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#6a4a2e"/>
      <stop offset="45%" stop-color="#4e3522"/>
      <stop offset="100%" stop-color="#2e1f14"/>
    </linearGradient>
    <radialGradient id="candle-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="${room.accentColor}" stop-opacity="0.9"/>
      <stop offset="40%" stop-color="${room.accentColor}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${room.accentColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- back wall -->
  <rect x="0" y="0" width="${SCENE_VB.w}" height="260" fill="#1d1730"/>
  <rect x="0" y="0" width="${SCENE_VB.w}" height="8" fill="#3a3045"/>

  <!-- ambient floor glow -->
  <ellipse cx="600" cy="420" rx="520" ry="160" fill="url(#room-glow)"/>

  ${roomProps(room)}

  <!-- wood floor -->
  <rect x="0" y="260" width="${SCENE_VB.w}" height="${SCENE_VB.h - 260}" fill="url(#room-planks)"/>

  <!-- base-board shadow -->
  <rect x="0" y="258" width="${SCENE_VB.w}" height="3" fill="#000" opacity="0.5"/>

  <!-- the long table -->
  <g class="room-table">
    <rect x="${TABLE.x}" y="${TABLE.y}" width="${TABLE.w}" height="${TABLE.h}" fill="url(#table-wood)"/>
    <rect x="${TABLE.x}" y="${TABLE.y}" width="${TABLE.w}" height="6"
          fill="#7a5540" opacity="0.55"/>
    <rect x="${TABLE.x}" y="${TABLE.y + TABLE.h - 4}" width="${TABLE.w}" height="4"
          fill="#000" opacity="0.45"/>
    <ellipse cx="${TABLE.x + TABLE.w / 2}" cy="${TABLE.y + TABLE.h + 22}"
             rx="${TABLE.w / 2 + 20}" ry="22" fill="#000" opacity="0.35"/>

    <!-- candle at table center -->
    <circle cx="${TABLE.x + TABLE.w / 2}" cy="${TABLE.y + 42}" r="4" fill="${room.accentColor}">
      <animate attributeName="opacity" values="0.95;0.6;0.95" dur="2.4s" repeatCount="indefinite"/>
    </circle>
    <ellipse cx="${TABLE.x + TABLE.w / 2}" cy="${TABLE.y + 42}" rx="40" ry="22" fill="url(#candle-glow)"/>

    <!-- speaker pointer: triangular notch on the table's front edge -->
    <polygon class="speaker-pointer" points="-14,0 14,0 0,18" transform="translate(-1000 ${TABLE.y - 6})"
             fill="${room.accentColor}" opacity="0"/>
  </g>

  <!-- agent seats (rendered after the table so heads overlap its top edge) -->
  ${agentsSvg}
</svg>`.trim();
}

function roomProps(room: RoomPublicInfo): string {
  switch (room.id) {
    case 'design': return designProps();
    default:       return genericProps();
  }
}

function designProps(): string {
  // Wall: arched window behind, easel on the left with a fresh canvas,
  // brush pot + palette on the right.
  return `
  <!-- arched window casting warm light -->
  <path d="M540 40 Q600 -20 660 40 L660 200 L540 200 Z" fill="#3a2e14" stroke="#e8a04a" stroke-opacity="0.45" stroke-width="1.5"/>
  <path d="M540 40 Q600 -20 660 40 L660 200 L540 200 Z" fill="#e8a04a" opacity="0.08"/>
  <line x1="600" y1="12" x2="600" y2="200" stroke="#e8a04a" stroke-opacity="0.35" stroke-width="1"/>
  <line x1="540" y1="120" x2="660" y2="120" stroke="#e8a04a" stroke-opacity="0.35" stroke-width="1"/>

  <!-- easel on the left -->
  <line x1="120" y1="260" x2="150" y2="110" stroke="#8a6a3a" stroke-width="3"/>
  <line x1="200" y1="260" x2="170" y2="110" stroke="#8a6a3a" stroke-width="3"/>
  <rect x="130" y="110" width="78" height="90" fill="#f2ead7"/>
  <rect x="136" y="118" width="44" height="6" fill="#e8a04a"/>
  <rect x="136" y="130" width="34" height="4" fill="#d66c6c"/>
  <rect x="136" y="140" width="50" height="4" fill="#9d7cd8"/>
  <rect x="136" y="150" width="38" height="4" fill="#5ec8c0"/>
  <line x1="140" y1="200" x2="190" y2="200" stroke="#8a6a3a" stroke-width="3"/>

  <!-- palette on the right wall -->
  <rect x="970" y="150" width="120" height="60" rx="30" fill="#d8c2a0" stroke="#8a6a3a" stroke-width="1"/>
  <circle cx="1000" cy="175" r="7" fill="#e8a04a"/>
  <circle cx="1020" cy="175" r="7" fill="#d66c6c"/>
  <circle cx="1040" cy="175" r="7" fill="#5ec8c0"/>
  <circle cx="1060" cy="175" r="7" fill="#9d7cd8"/>
  <circle cx="1020" cy="195" r="7" fill="#e4c056"/>
  <circle cx="1040" cy="195" r="7" fill="#f2ead7"/>
  `;
}

function genericProps(): string {
  return `
  <path d="M540 60 Q600 10 660 60 L660 200 L540 200 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.22" stroke-width="1"/>
  <line x1="600" y1="28" x2="600" y2="200" stroke="#f2ead7" stroke-opacity="0.2" stroke-width="0.8"/>
  `;
}

function agentAtSeat(
  agent: AgentPublicInfo,
  pos: SeatPosition,
): string {
  // Nest the character SVG inside the room SVG at the seat coords.
  const sprite = agentSprite(agent.visual, 'large')
    .replace('<svg ', `<svg x="${pos.x}" y="${pos.y}" `);
  return `<g class="agent-seat" data-seat="${agent.id}" data-seat-x="${pos.pointerX}">
    ${sprite}
    <text x="${pos.pointerX}" y="${TABLE.y + TABLE.h + 54}"
          text-anchor="middle"
          font-family="Cinzel, serif" font-size="14" letter-spacing="3"
          fill="#f2ead7" opacity="0.9">${escapeText(agent.name.toUpperCase())}</text>
    <text x="${pos.pointerX}" y="${TABLE.y + TABLE.h + 72}"
          text-anchor="middle"
          font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="1.5"
          fill="#b9b2a3" opacity="0.7">${escapeText(agent.tag)}</text>
  </g>`;
}

interface SeatPosition {
  /** Top-left of the nested SVG sprite (108×126 px large). */
  readonly x: number;
  readonly y: number;
  /** X of the seat's center, used by the speaker pointer. */
  readonly pointerX: number;
}

function computeSeatPositions(n: number): SeatPosition[] {
  const spriteW = 108;
  const spriteH = 126;
  const behindTableY = TABLE.y - spriteH + 40; // head pokes above table
  const span = TABLE.w - 40;
  const step = n <= 1 ? 0 : span / (n - 1);
  const startX = n <= 1 ? TABLE.x + TABLE.w / 2 : TABLE.x + 20;
  const out: SeatPosition[] = [];
  for (let i = 0; i < n; i++) {
    const centerX = n <= 1 ? startX : startX + step * i;
    out.push({
      x: centerX - spriteW / 2,
      y: behindTableY,
      pointerX: centerX,
    });
  }
  return out;
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

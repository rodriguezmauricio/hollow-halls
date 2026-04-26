import type { AgentPublicInfo, AttendingAgent, RoomPublicInfo } from '@/messaging/protocol';
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

  <!-- thinking bubble with three pulsing dots — positioned over the speaker -->
  <g class="thinking-bubble" transform="translate(-1000 190)" opacity="0"
     style="--bubble-color: ${room.accentColor}">
    <ellipse cx="0" cy="0" rx="32" ry="16" fill="#0e0b1a"
             style="stroke: var(--bubble-color); stroke-opacity: 0.95"
             stroke-width="1.6"/>
    <circle class="dot dot-1" cx="-12" cy="0" r="2.8"
            style="fill: var(--bubble-color)"/>
    <circle class="dot dot-2" cx="0"   cy="0" r="2.8"
            style="fill: var(--bubble-color)"/>
    <circle class="dot dot-3" cx="12"  cy="0" r="2.8"
            style="fill: var(--bubble-color)"/>
    <polygon points="-5,14 5,14 0,24" fill="#0e0b1a"
             style="stroke: var(--bubble-color); stroke-opacity: 0.95"
             stroke-width="1.2"/>
  </g>
</svg>`.trim();
}

function roomProps(room: RoomPublicInfo): string {
  switch (room.id) {
    case 'design': return designProps();
    case 'uiux':   return uiuxProps();
    case 'code':   return codeProps();
    case 'front':  return frontProps();
    case 'market': return marketProps();
    case 'sec':    return secProps();
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

function uiuxProps(): string {
  // Back wall: a wide journey-map board with flow boxes and sticky notes.
  return `
  <rect x="180" y="40" width="840" height="180" fill="#0e0b1a" stroke="#5ec8c0" stroke-opacity="0.45" stroke-width="1"/>
  <!-- flow nodes (boxes + connectors) -->
  <rect x="210" y="80" width="80" height="40" fill="none" stroke="#5ec8c0" stroke-opacity="0.85" stroke-width="1.2"/>
  <rect x="330" y="80" width="80" height="40" fill="none" stroke="#5ec8c0" stroke-opacity="0.85" stroke-width="1.2"/>
  <rect x="450" y="80" width="80" height="40" fill="#5ec8c0" opacity="0.35"/>
  <rect x="570" y="80" width="80" height="40" fill="none" stroke="#5ec8c0" stroke-opacity="0.85" stroke-width="1.2"/>
  <rect x="690" y="80" width="80" height="40" fill="none" stroke="#5ec8c0" stroke-opacity="0.85" stroke-width="1.2"/>
  <rect x="810" y="80" width="60" height="40" fill="none" stroke="#5ec8c0" stroke-opacity="0.85" stroke-width="1.2"/>
  <!-- dashed connectors -->
  <line x1="290" y1="100" x2="330" y2="100" stroke="#5ec8c0" stroke-opacity="0.6" stroke-dasharray="4,3"/>
  <line x1="410" y1="100" x2="450" y2="100" stroke="#5ec8c0" stroke-opacity="0.6" stroke-dasharray="4,3"/>
  <line x1="530" y1="100" x2="570" y2="100" stroke="#5ec8c0" stroke-opacity="0.6" stroke-dasharray="4,3"/>
  <line x1="650" y1="100" x2="690" y2="100" stroke="#5ec8c0" stroke-opacity="0.6" stroke-dasharray="4,3"/>
  <line x1="770" y1="100" x2="810" y2="100" stroke="#5ec8c0" stroke-opacity="0.6" stroke-dasharray="4,3"/>
  <!-- sticky notes -->
  <rect x="230" y="150" width="44" height="44" fill="#e4c056" opacity="0.85" transform="rotate(-4 252 172)"/>
  <rect x="430" y="140" width="44" height="44" fill="#e07a95" opacity="0.85" transform="rotate(3 452 162)"/>
  <rect x="740" y="150" width="38" height="38" fill="#5ec8c0" opacity="0.85" transform="rotate(-6 759 169)"/>
  `;
}

function codeProps(): string {
  // Back wall: twin monitors showing code; a stack of printed diffs on the right.
  return `
  <!-- left monitor -->
  <rect x="280" y="70" width="200" height="130" fill="#0e0b1a" stroke="#9d7cd8" stroke-opacity="0.7" stroke-width="1"/>
  <rect x="280" y="70" width="200" height="14" fill="#1c1830"/>
  <circle cx="290" cy="77" r="2" fill="#d66c6c"/>
  <circle cx="298" cy="77" r="2" fill="#e4c056"/>
  <circle cx="306" cy="77" r="2" fill="#5ec8c0"/>
  <!-- code lines -->
  <rect x="294" y="96"  width="120" height="3" fill="#9d7cd8" opacity="0.9"/>
  <rect x="294" y="106" width="84"  height="3" fill="#5ec8c0" opacity="0.8"/>
  <rect x="304" y="116" width="112" height="3" fill="#e4c056" opacity="0.7"/>
  <rect x="294" y="126" width="148" height="3" fill="#9d7cd8" opacity="0.6"/>
  <rect x="304" y="136" width="92"  height="3" fill="#9d7cd8" opacity="0.5"/>
  <rect x="294" y="146" width="60"  height="3" fill="#d66c6c" opacity="0.8"/>
  <rect x="304" y="156" width="120" height="3" fill="#9d7cd8" opacity="0.5"/>
  <rect x="294" y="166" width="80"  height="3" fill="#5ec8c0" opacity="0.6"/>

  <!-- right monitor -->
  <rect x="520" y="70" width="200" height="130" fill="#0e0b1a" stroke="#9d7cd8" stroke-opacity="0.7" stroke-width="1"/>
  <rect x="520" y="70" width="200" height="14" fill="#1c1830"/>
  <rect x="534" y="96"  width="110" height="3" fill="#d66c6c" opacity="0.9"/>
  <rect x="534" y="106" width="70"  height="3" fill="#9d7cd8" opacity="0.6"/>
  <rect x="544" y="116" width="140" height="3" fill="#5ec8c0" opacity="0.8"/>
  <rect x="534" y="126" width="90"  height="3" fill="#9d7cd8" opacity="0.5"/>
  <rect x="534" y="136" width="120" height="3" fill="#9d7cd8" opacity="0.6"/>
  <rect x="544" y="146" width="80"  height="3" fill="#e4c056" opacity="0.8"/>

  <!-- stack of printed diffs on the right -->
  <rect x="820" y="160" width="140" height="10" fill="#3a2a1a"/>
  <rect x="820" y="150" width="140" height="10" fill="#5a3f28"/>
  <rect x="820" y="140" width="140" height="10" fill="#3a2a1a"/>
  <rect x="820" y="130" width="140" height="10" fill="#5a3f28"/>
  <rect x="820" y="120" width="140" height="10" fill="#f2ead7" opacity="0.9"/>
  <rect x="830" y="124" width="80" height="2" fill="#9d7cd8" opacity="0.6"/>
  <rect x="830" y="128" width="100" height="2" fill="#5ec8c0" opacity="0.5"/>
  `;
}

function frontProps(): string {
  // Back wall: browser mock, phone, tablet — the looking glass.
  return `
  <!-- browser mock (main monitor) -->
  <rect x="220" y="40" width="360" height="200" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.7" stroke-width="1"/>
  <rect x="220" y="40" width="360" height="20" fill="#1c1830"/>
  <circle cx="232" cy="50" r="2.5" fill="#d66c6c"/>
  <circle cx="242" cy="50" r="2.5" fill="#e4c056"/>
  <circle cx="252" cy="50" r="2.5" fill="#5ec8c0"/>
  <rect x="264" y="46" width="160" height="8" rx="4" fill="#2c2438"/>
  <!-- hero -->
  <rect x="240" y="80" width="210" height="10" fill="#e07a95" opacity="0.75"/>
  <rect x="240" y="96" width="320" height="4" fill="#f2ead7" opacity="0.3"/>
  <rect x="240" y="106" width="280" height="4" fill="#f2ead7" opacity="0.25"/>
  <!-- card grid -->
  <rect x="240" y="128" width="96" height="84" fill="#e07a95" opacity="0.3"/>
  <rect x="348" y="128" width="96" height="84" fill="#e07a95" opacity="0.3"/>
  <rect x="456" y="128" width="96" height="84" fill="#e07a95" opacity="0.3"/>

  <!-- phone -->
  <rect x="620" y="70" width="84" height="160" rx="8" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.7" stroke-width="1"/>
  <rect x="628" y="82" width="68" height="130" fill="#e07a95" opacity="0.25"/>
  <rect x="636" y="94" width="20" height="6" fill="#f2ead7" opacity="0.6"/>
  <rect x="636" y="106" width="52" height="3" fill="#f2ead7" opacity="0.35"/>
  <rect x="636" y="114" width="42" height="3" fill="#f2ead7" opacity="0.35"/>
  <rect x="636" y="130" width="52" height="30" fill="#e07a95" opacity="0.35"/>

  <!-- tablet -->
  <rect x="740" y="110" width="170" height="120" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.6" stroke-width="1"/>
  <rect x="748" y="118" width="154" height="14" fill="#e07a95" opacity="0.55"/>
  <rect x="748" y="140" width="120" height="4" fill="#f2ead7" opacity="0.4"/>
  <rect x="748" y="150" width="140" height="4" fill="#f2ead7" opacity="0.35"/>
  <rect x="748" y="168" width="64" height="38" fill="#e07a95" opacity="0.3"/>
  <rect x="820" y="168" width="64" height="38" fill="#e07a95" opacity="0.3"/>
  `;
}

function marketProps(): string {
  // Back wall: pin board with campaign drafts on the left, analytics line
  // chart on the right.
  return `
  <!-- pin board -->
  <rect x="180" y="50" width="320" height="200" fill="#1c1830" stroke="#e4c056" stroke-opacity="0.5" stroke-width="1"/>
  <rect x="204" y="74" width="80" height="80" fill="#e07a95" opacity="0.8"/>
  <rect x="298" y="66" width="80" height="80" fill="#5ec8c0" opacity="0.8"/>
  <rect x="394" y="74" width="86" height="86" fill="#e4c056" opacity="0.85"/>
  <rect x="204" y="170" width="100" height="10" fill="#9d7cd8" opacity="0.7"/>
  <rect x="320" y="166" width="140" height="10" fill="#f2ead7" opacity="0.65"/>
  <rect x="204" y="196" width="80" height="10" fill="#e07a95" opacity="0.7"/>
  <rect x="316" y="192" width="160" height="10" fill="#e4c056" opacity="0.7"/>
  <!-- push pins -->
  <circle cx="244" cy="74" r="3" fill="#d66c6c"/>
  <circle cx="338" cy="66" r="3" fill="#e4c056"/>
  <circle cx="437" cy="74" r="3" fill="#9d7cd8"/>

  <!-- analytics screen on the right -->
  <rect x="560" y="50" width="380" height="200" fill="#0e0b1a" stroke="#e4c056" stroke-opacity="0.6" stroke-width="1"/>
  <polyline points="580,220 620,180 660,196 700,150 740,170 780,120 820,140 860,100 900,124"
            fill="none" stroke="#e4c056" stroke-width="2"/>
  <!-- small bars under the line -->
  <rect x="600" y="180" width="8" height="40" fill="#e4c056" opacity="0.6"/>
  <rect x="640" y="196" width="8" height="24" fill="#e4c056" opacity="0.6"/>
  <rect x="680" y="170" width="8" height="50" fill="#e4c056" opacity="0.6"/>
  <rect x="720" y="150" width="8" height="70" fill="#e4c056" opacity="0.6"/>
  <rect x="760" y="140" width="8" height="80" fill="#e4c056" opacity="0.6"/>
  <rect x="800" y="124" width="8" height="96" fill="#e4c056" opacity="0.7"/>
  <rect x="840" y="108" width="8" height="112" fill="#e4c056" opacity="0.7"/>
  <!-- KPI tiles -->
  <rect x="584" y="66" width="54" height="30" fill="#1c1830" stroke="#e4c056" stroke-opacity="0.4"/>
  <rect x="588" y="72" width="30" height="6" fill="#f2ead7" opacity="0.6"/>
  <rect x="588" y="82" width="40" height="3" fill="#e4c056" opacity="0.5"/>
  `;
}

function secProps(): string {
  // Back wall: a bank of four monitors — two central "active" ones with
  // terminal text, two side monitors with dim grid patterns.
  return `
  <rect x="0" y="0" width="1200" height="260" fill="#0c0814"/>

  <!-- left side monitor -->
  <rect x="150" y="70" width="170" height="130" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.4" stroke-width="1"/>
  <g opacity="0.55">
    <rect x="168" y="86"  width="6" height="6" fill="#d66c6c"/>
    <rect x="184" y="86"  width="6" height="6" fill="#d66c6c"/>
    <rect x="200" y="102" width="6" height="6" fill="#d66c6c"/>
    <rect x="216" y="86"  width="6" height="6" fill="#d66c6c"/>
    <rect x="168" y="118" width="6" height="6" fill="#d66c6c"/>
    <rect x="232" y="134" width="6" height="6" fill="#d66c6c"/>
    <rect x="248" y="102" width="6" height="6" fill="#d66c6c"/>
    <rect x="168" y="150" width="6" height="6" fill="#d66c6c"/>
    <rect x="200" y="166" width="6" height="6" fill="#d66c6c"/>
    <rect x="232" y="182" width="6" height="6" fill="#d66c6c"/>
  </g>

  <!-- main terminal (center left) -->
  <rect x="340" y="50" width="220" height="170" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.8" stroke-width="1.2"/>
  <rect x="360" y="74"  width="100" height="4" fill="#d66c6c"/>
  <rect x="360" y="84"  width="140" height="4" fill="#d66c6c" opacity="0.85"/>
  <rect x="370" y="94"  width="120" height="4" fill="#d66c6c" opacity="0.65"/>
  <rect x="360" y="104" width="170" height="4" fill="#e4c056" opacity="0.75"/>
  <rect x="360" y="114" width="80"  height="4" fill="#d66c6c">
    <animate attributeName="opacity" values="0.95;0.3;0.95" dur="1.2s" repeatCount="indefinite"/>
  </rect>
  <rect x="360" y="124" width="140" height="4" fill="#d66c6c" opacity="0.55"/>
  <rect x="370" y="134" width="100" height="4" fill="#d66c6c" opacity="0.45"/>
  <rect x="360" y="144" width="180" height="4" fill="#9d7cd8" opacity="0.55"/>
  <rect x="360" y="154" width="90"  height="4" fill="#d66c6c" opacity="0.5"/>
  <rect x="360" y="164" width="160" height="4" fill="#d66c6c" opacity="0.4"/>
  <rect x="360" y="174" width="60"  height="4" fill="#d66c6c" opacity="0.8">
    <animate attributeName="opacity" values="0.95;0.3;0.95" dur="0.8s" repeatCount="indefinite"/>
  </rect>

  <!-- main terminal (center right) -->
  <rect x="580" y="50" width="220" height="170" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.8" stroke-width="1.2"/>
  <rect x="600" y="74"  width="140" height="4" fill="#d66c6c" opacity="0.85"/>
  <rect x="600" y="84"  width="180" height="4" fill="#5ec8c0" opacity="0.7"/>
  <rect x="610" y="94"  width="120" height="4" fill="#d66c6c" opacity="0.65"/>
  <rect x="600" y="104" width="150" height="4" fill="#d66c6c" opacity="0.5"/>
  <rect x="600" y="114" width="100" height="4" fill="#5ec8c0" opacity="0.6"/>
  <rect x="600" y="124" width="170" height="4" fill="#d66c6c" opacity="0.45"/>
  <rect x="610" y="134" width="120" height="4" fill="#d66c6c" opacity="0.55"/>
  <rect x="600" y="144" width="60"  height="4" fill="#d66c6c" opacity="0.85"/>
  <rect x="600" y="154" width="140" height="4" fill="#d66c6c" opacity="0.5"/>
  <rect x="600" y="164" width="100" height="4" fill="#9d7cd8" opacity="0.6"/>
  <rect x="600" y="174" width="90"  height="4" fill="#d66c6c" opacity="0.5"/>

  <!-- right side monitor -->
  <rect x="820" y="70" width="170" height="130" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.4" stroke-width="1"/>
  <g opacity="0.55">
    <rect x="840" y="90"  width="6" height="6" fill="#d66c6c"/>
    <rect x="864" y="106" width="6" height="6" fill="#d66c6c"/>
    <rect x="888" y="90"  width="6" height="6" fill="#d66c6c"/>
    <rect x="912" y="122" width="6" height="6" fill="#d66c6c"/>
    <rect x="856" y="138" width="6" height="6" fill="#d66c6c"/>
    <rect x="880" y="154" width="6" height="6" fill="#d66c6c"/>
    <rect x="920" y="170" width="6" height="6" fill="#d66c6c"/>
    <rect x="848" y="170" width="6" height="6" fill="#d66c6c"/>
  </g>

  <!-- server rack on the far right -->
  <rect x="1020" y="50" width="40" height="190" fill="#1c1830" stroke="#d66c6c" stroke-opacity="0.5" stroke-width="1"/>
  <rect x="1026" y="60" width="28" height="6" fill="#d66c6c" opacity="0.8"/>
  <rect x="1026" y="72" width="28" height="6" fill="#d66c6c" opacity="0.55"/>
  <rect x="1026" y="84" width="28" height="6" fill="#5ec8c0" opacity="0.6">
    <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.4s" repeatCount="indefinite"/>
  </rect>
  <rect x="1026" y="96" width="28" height="6" fill="#d66c6c" opacity="0.7"/>
  <rect x="1026" y="108" width="28" height="6" fill="#d66c6c" opacity="0.55"/>
  <rect x="1026" y="120" width="28" height="6" fill="#d66c6c" opacity="0.7"/>
  <rect x="1026" y="132" width="28" height="6" fill="#d66c6c" opacity="0.45"/>
  <rect x="1026" y="144" width="28" height="6" fill="#d66c6c" opacity="0.55"/>
  <rect x="1026" y="156" width="28" height="6" fill="#e4c056" opacity="0.6"/>
  <rect x="1026" y="168" width="28" height="6" fill="#d66c6c" opacity="0.55"/>
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

/**
 * The Great Hall interior. Wider than a room, seats up to seven attendees
 * each painted with their home room's accent so different disciplines are
 * visually distinguishable at the table.
 */
export function buildGreatHallScene(attending: readonly AttendingAgent[]): string {
  const n = Math.max(1, attending.length);
  const seatPositions = computeSeatPositions(n);
  const agentsSvg = attending
    .map((a, i) => {
      const pos = seatPositions[i];
      if (!pos) return '';
      return attendingAtSeat(a, pos);
    })
    .join('');

  return `
<svg class="room-svg great-hall-svg" viewBox="0 0 ${SCENE_VB.w} ${SCENE_VB.h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="gh-planks" x="0" y="0" width="48" height="14" patternUnits="userSpaceOnUse">
      <rect width="48" height="14" fill="#1a1426"/>
      <line x1="0" y1="14" x2="48" y2="14" stroke="#0e0a18" stroke-width="0.6"/>
      <line x1="24" y1="0" x2="24" y2="14" stroke="#221a30" stroke-width="0.5"/>
    </pattern>
    <radialGradient id="gh-glow" cx="50%" cy="55%" r="65%">
      <stop offset="0%" stop-color="#f2ead7" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#f2ead7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gh-table-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#6a4a2e"/>
      <stop offset="45%" stop-color="#4e3522"/>
      <stop offset="100%" stop-color="#2e1f14"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${SCENE_VB.w}" height="260" fill="#161124"/>
  <rect x="0" y="0" width="${SCENE_VB.w}" height="8" fill="#3a3045"/>

  <!-- three tall arches -->
  <path d="M220 200 L220 80 Q300 10 380 80 L380 200 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.25" stroke-width="1"/>
  <path d="M520 220 L520 60 Q600 -10 680 60 L680 220 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.35" stroke-width="1.2"/>
  <path d="M820 200 L820 80 Q900 10 980 80 L980 200 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.25" stroke-width="1"/>
  <line x1="300" y1="22" x2="300" y2="200" stroke="#f2ead7" stroke-opacity="0.22" stroke-width="0.8"/>
  <line x1="600" y1="0"  x2="600" y2="220" stroke="#f2ead7" stroke-opacity="0.32" stroke-width="0.9"/>
  <line x1="900" y1="22" x2="900" y2="200" stroke="#f2ead7" stroke-opacity="0.22" stroke-width="0.8"/>

  <ellipse cx="600" cy="420" rx="560" ry="160" fill="url(#gh-glow)"/>

  <!-- wood floor -->
  <rect x="0" y="260" width="${SCENE_VB.w}" height="${SCENE_VB.h - 260}" fill="url(#gh-planks)"/>
  <rect x="0" y="258" width="${SCENE_VB.w}" height="3" fill="#000" opacity="0.5"/>

  <!-- long table -->
  <g class="room-table">
    <rect x="${TABLE.x}" y="${TABLE.y}" width="${TABLE.w}" height="${TABLE.h}" fill="url(#gh-table-wood)"/>
    <rect x="${TABLE.x}" y="${TABLE.y}" width="${TABLE.w}" height="6" fill="#7a5540" opacity="0.55"/>
    <rect x="${TABLE.x}" y="${TABLE.y + TABLE.h - 4}" width="${TABLE.w}" height="4" fill="#000" opacity="0.45"/>
    <ellipse cx="${TABLE.x + TABLE.w / 2}" cy="${TABLE.y + TABLE.h + 22}"
             rx="${TABLE.w / 2 + 20}" ry="22" fill="#000" opacity="0.35"/>

    <!-- three taper candles along the centre -->
    <g>
      <rect x="${TABLE.x + 200}" y="${TABLE.y + 26}" width="3" height="16" fill="#f2ead7"/>
      <circle cx="${TABLE.x + 201.5}" cy="${TABLE.y + 24}" r="2.4" fill="#e4c056">
        <animate attributeName="opacity" values="0.9;0.55;0.9" dur="2.2s" repeatCount="indefinite"/>
      </circle>
    </g>
    <g>
      <rect x="${TABLE.x + TABLE.w / 2 - 1.5}" y="${TABLE.y + 22}" width="3" height="20" fill="#f2ead7"/>
      <circle cx="${TABLE.x + TABLE.w / 2}" cy="${TABLE.y + 20}" r="3" fill="#e4c056">
        <animate attributeName="opacity" values="0.95;0.6;0.95" dur="2.6s" repeatCount="indefinite"/>
      </circle>
    </g>
    <g>
      <rect x="${TABLE.x + TABLE.w - 200}" y="${TABLE.y + 26}" width="3" height="16" fill="#f2ead7"/>
      <circle cx="${TABLE.x + TABLE.w - 198.5}" cy="${TABLE.y + 24}" r="2.4" fill="#e4c056">
        <animate attributeName="opacity" values="0.9;0.55;0.9" dur="2.4s" repeatCount="indefinite"/>
      </circle>
    </g>

    <polygon class="speaker-pointer" points="-14,0 14,0 0,18"
             transform="translate(-1000 ${TABLE.y - 6})"
             fill="#f2ead7" opacity="0"/>
  </g>

  ${agentsSvg}

  <!-- thinking bubble — positioned over the current speaker (or table center
       while the moderator is picking). Three dots pulse via CSS. -->
  <g class="thinking-bubble" transform="translate(-1000 190)" opacity="0">
    <ellipse cx="0" cy="0" rx="32" ry="16" fill="#0e0b1a"
             style="stroke: var(--bubble-color, #f2ead7); stroke-opacity: 0.95"
             stroke-width="1.6"/>
    <circle class="dot dot-1" cx="-12" cy="0" r="2.8"
            style="fill: var(--bubble-color, #f2ead7)"/>
    <circle class="dot dot-2" cx="0"   cy="0" r="2.8"
            style="fill: var(--bubble-color, #f2ead7)"/>
    <circle class="dot dot-3" cx="12"  cy="0" r="2.8"
            style="fill: var(--bubble-color, #f2ead7)"/>
    <polygon points="-5,14 5,14 0,24" fill="#0e0b1a"
             style="stroke: var(--bubble-color, #f2ead7); stroke-opacity: 0.95"
             stroke-width="1.2"/>
  </g>
</svg>`.trim();
}

function attendingAtSeat(a: AttendingAgent, pos: SeatPosition): string {
  const sprite = agentSprite(a.agent.visual, 'large')
    .replace('<svg ', `<svg x="${pos.x}" y="${pos.y}" `);
  return `<g class="agent-seat" data-seat="${a.agent.id}" data-seat-x="${pos.pointerX}" style="--seat-accent:${a.accentColor}">
    ${sprite}
    <text x="${pos.pointerX}" y="${TABLE.y + TABLE.h + 54}"
          text-anchor="middle"
          font-family="Cinzel, serif" font-size="13" letter-spacing="3"
          fill="${a.accentColor}" opacity="0.95">${escapeText(a.agent.name.toUpperCase())}</text>
    <text x="${pos.pointerX}" y="${TABLE.y + TABLE.h + 70}"
          text-anchor="middle"
          font-family="IBM Plex Mono, monospace" font-size="9" letter-spacing="1.5"
          fill="#b9b2a3" opacity="0.7">${escapeText(a.agent.tag)}</text>
  </g>`;
}

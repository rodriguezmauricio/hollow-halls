/**
 * The floor-plan SVG. Ported verbatim from MOCKUP.html to preserve the ≥95%
 * visual match required by Milestone 1. Figures, desks, and agent counts are
 * placeholder geometry — later milestones replace them with data-driven renders.
 */
export function buildingSvg(): string {
  return `
<svg class="building" viewBox="0 0 800 940" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="The Hollow Halls — floor plan">
  <defs>
    <pattern id="planks" x="0" y="0" width="50" height="14" patternUnits="userSpaceOnUse">
      <rect width="50" height="14" fill="#1a1426"/>
      <line x1="0" y1="14" x2="50" y2="14" stroke="#0e0a18" stroke-width="0.5"/>
      <line x1="25" y1="0" x2="25" y2="14" stroke="#221a30" stroke-width="0.4"/>
    </pattern>
    <pattern id="tiles" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#15101e"/>
      <rect width="20" height="20" fill="none" stroke="#0a0814" stroke-width="0.5"/>
    </pattern>
    <pattern id="hall-floor" x="0" y="0" width="40" height="14" patternUnits="userSpaceOnUse">
      <rect width="40" height="14" fill="#161122"/>
      <line x1="0" y1="14" x2="40" y2="14" stroke="#0c0816" stroke-width="0.4"/>
    </pattern>

    <radialGradient id="glow-design" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#e8a04a" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#e8a04a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-uiux" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#5ec8c0" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#5ec8c0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-code" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#9d7cd8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#9d7cd8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-front" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#e07a95" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#e07a95" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-market" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#e4c056" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#e4c056" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-sec" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#d66c6c" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#d66c6c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-oracle" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#9de0f0" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#9de0f0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-common" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#f2ead7" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#f2ead7" stop-opacity="0"/>
    </radialGradient>

    <symbol id="hk" viewBox="0 0 16 22">
      <ellipse cx="8" cy="20" rx="6" ry="1.2" fill="#000" opacity="0.45"/>
      <path d="M8 2 C5 2 3.5 4 3.5 7.5 L3.5 16 C3.5 18 4.5 19 6 19 L10 19 C11.5 19 12.5 18 12.5 16 L12.5 7.5 C12.5 4 11 2 8 2 Z" fill="#f2ead7"/>
      <path d="M4.5 4 L2 -1 L6 3 Z" fill="#f2ead7"/>
      <path d="M11.5 4 L14 -1 L10 3 Z" fill="#f2ead7"/>
      <ellipse cx="6" cy="7.5" rx="1.1" ry="1.6" fill="#070510"/>
      <ellipse cx="10" cy="7.5" rx="1.1" ry="1.6" fill="#070510"/>
    </symbol>

    <symbol id="chair" viewBox="0 0 14 14">
      <rect x="2" y="0" width="10" height="3" fill="#3a3045"/>
      <rect x="2" y="3" width="10" height="9" fill="#5d4f6d"/>
      <rect x="2" y="3" width="10" height="1" fill="#74638a" opacity="0.6"/>
    </symbol>

    <symbol id="desk" viewBox="0 0 40 16">
      <rect x="0" y="2" width="40" height="14" fill="#3a2a1a"/>
      <rect x="0" y="0" width="40" height="3" fill="#5a3f28"/>
      <rect x="0" y="0" width="40" height="1" fill="#7a5540"/>
    </symbol>

    <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
      <stop offset="60%" stop-color="#070510" stop-opacity="0"/>
      <stop offset="100%" stop-color="#070510" stop-opacity="0.6"/>
    </radialGradient>
  </defs>

  <rect width="800" height="940" fill="#070510"/>

  <!-- Oracle's Chamber -->
  <g class="room oracle" data-room="oracle">
    <rect x="280" y="20" width="240" height="130" fill="#3a3045"/>
    <rect x="285" y="25" width="230" height="120" fill="#161122"/>
    <ellipse cx="400" cy="85" rx="100" ry="50" fill="url(#glow-oracle)"/>

    <rect x="320" y="34" width="22" height="40" fill="#0a0814" stroke="#9de0f0" stroke-opacity="0.4" stroke-width="0.5"/>
    <line x1="331" y1="34" x2="331" y2="74" stroke="#9de0f0" stroke-opacity="0.3" stroke-width="0.4"/>
    <rect x="389" y="30" width="22" height="44" fill="#0a0814" stroke="#9de0f0" stroke-opacity="0.5" stroke-width="0.5"/>
    <line x1="400" y1="30" x2="400" y2="74" stroke="#9de0f0" stroke-opacity="0.3" stroke-width="0.4"/>
    <rect x="458" y="34" width="22" height="40" fill="#0a0814" stroke="#9de0f0" stroke-opacity="0.4" stroke-width="0.5"/>
    <line x1="469" y1="34" x2="469" y2="74" stroke="#9de0f0" stroke-opacity="0.3" stroke-width="0.4"/>

    <circle cx="400" cy="105" r="22" fill="none" stroke="#9de0f0" stroke-opacity="0.35" stroke-width="0.5"/>
    <circle cx="400" cy="105" r="14" fill="none" stroke="#9de0f0" stroke-opacity="0.5" stroke-width="0.5"/>
    <line x1="380" y1="105" x2="420" y2="105" stroke="#9de0f0" stroke-opacity="0.25" stroke-width="0.4"/>
    <line x1="400" y1="85"  x2="400" y2="125" stroke="#9de0f0" stroke-opacity="0.25" stroke-width="0.4"/>

    <g class="room-figure">
      <g transform="translate(392 88)" class="breath"><use href="#hk" width="16" height="22"/></g>
      <circle cx="400" cy="80" r="2.2" fill="#9de0f0" opacity="0.95">
        <animate attributeName="cy" values="80;74;80" dur="3.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.95;0.5;0.95" dur="3.5s" repeatCount="indefinite"/>
      </circle>
    </g>

    <text x="295" y="142" font-family="Cinzel, serif" font-size="10" letter-spacing="3" fill="#f2ead7" opacity="0.85">THE ORACLE</text>
    <text x="446" y="142" font-family="IBM Plex Mono, monospace" font-size="7" letter-spacing="1" fill="#9de0f0" opacity="0.75">— the entrance</text>

    <rect class="room-tint" x="285" y="25" width="230" height="120"/>
    <rect class="room-stroke" x="285" y="25" width="230" height="120" fill="none"/>
    <text class="enter-hint" x="500" y="42" font-family="IBM Plex Mono, monospace" font-size="8" fill="#9de0f0" letter-spacing="2">CONSULT ›</text>
  </g>

  <!-- corridor oracle → building -->
  <rect x="392" y="150" width="16" height="22" fill="#161122"/>
  <rect x="386" y="150" width="6" height="22" fill="#3a3045"/>
  <rect x="408" y="150" width="6" height="22" fill="#3a3045"/>

  <!-- building shell -->
  <rect x="20" y="172" width="760" height="490" fill="#3a3045"/>
  <rect x="20" y="172" width="760" height="3" fill="#5d4f6d" opacity="0.6"/>
  <rect x="20" y="659" width="760" height="3" fill="#1d1828" opacity="0.8"/>

  <!-- DESIGN -->
  <g class="room design" data-room="design">
    <rect x="26" y="178" width="246" height="198" fill="url(#planks)"/>
    <ellipse cx="149" cy="277" rx="100" ry="60" fill="url(#glow-design)"/>

    <path d="M120 184 Q149 168 178 184 L178 210 L120 210 Z" fill="#1c1830" stroke="#e8a04a" stroke-opacity="0.4" stroke-width="0.5"/>
    <line x1="149" y1="174" x2="149" y2="210" stroke="#e8a04a" stroke-opacity="0.3" stroke-width="0.4"/>

    <line x1="46" y1="290" x2="60" y2="240" stroke="#e8a04a" stroke-opacity="0.5" stroke-width="0.6"/>
    <line x1="78" y1="290" x2="60" y2="240" stroke="#e8a04a" stroke-opacity="0.5" stroke-width="0.6"/>
    <line x1="50" y1="290" x2="74" y2="290" stroke="#e8a04a" stroke-opacity="0.4" stroke-width="0.6"/>
    <rect x="44" y="232" width="36" height="28" fill="#f2ead7" opacity="0.92"/>
    <circle cx="56" cy="244" r="3" fill="#e8a04a"/>
    <rect x="62" y="242" width="12" height="2" fill="#d66c6c"/>
    <rect x="62" y="248" width="8" height="2" fill="#9d7cd8"/>
    <rect x="62" y="254" width="14" height="1.5" fill="#5ec8c0"/>

    <use href="#desk" x="180" y="298" width="64" height="22"/>
    <rect x="186" y="296" width="8" height="2" fill="#e8a04a"/>
    <rect x="198" y="296" width="6" height="2" fill="#d66c6c"/>
    <rect x="208" y="296" width="6" height="2" fill="#5ec8c0"/>
    <rect x="218" y="296" width="6" height="2" fill="#9d7cd8"/>
    <rect x="232" y="294" width="6" height="6" fill="#3a2a1a"/>
    <line x1="234" y1="285" x2="234" y2="294" stroke="#e8a04a" stroke-width="0.7"/>
    <line x1="236" y1="288" x2="236" y2="294" stroke="#d66c6c" stroke-width="0.7"/>

    <use href="#chair" x="186" y="330" width="14" height="14"/>
    <use href="#chair" x="218" y="330" width="14" height="14"/>

    <g transform="translate(64 274)" class="breath room-figure" data-agent="maya"><use href="#hk" width="14" height="20"/></g>
    <g transform="translate(190 318)" class="breath b2 room-figure" data-agent="iri"><use href="#hk" width="14" height="20"/></g>

    <circle cx="149" cy="240" r="1.4" fill="#e8a04a" opacity="0.85">
      <animate attributeName="cy" values="240;232;240" dur="4s" repeatCount="indefinite"/>
    </circle>

    <text x="36" y="370" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">DESIGN</text>
    <text x="100" y="370" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e8a04a" opacity="0.7">— atelier · 2/2</text>

    <rect class="room-tint" x="26" y="178" width="246" height="198"/>
    <rect class="room-stroke" x="26" y="178" width="246" height="198" fill="none"/>
    <text class="enter-hint" x="234" y="190" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e8a04a" letter-spacing="1.5">ENTER ›</text>
  </g>

  <rect x="272" y="178" width="6" height="198" fill="#3a3045"/>
  <rect x="272" y="178" width="6" height="3" fill="#5d4f6d" opacity="0.6"/>

  <!-- UI/UX -->
  <g class="room uiux" data-room="uiux">
    <rect x="278" y="178" width="246" height="198" fill="url(#planks)"/>
    <ellipse cx="401" cy="277" rx="100" ry="60" fill="url(#glow-uiux)"/>

    <rect x="306" y="190" width="190" height="60" fill="#0e0b1a" stroke="#5ec8c0" stroke-opacity="0.4" stroke-width="0.5"/>
    <rect x="316" y="208" width="20" height="14" fill="none" stroke="#5ec8c0" stroke-opacity="0.7" stroke-width="0.6"/>
    <rect x="356" y="208" width="20" height="14" fill="none" stroke="#5ec8c0" stroke-opacity="0.7" stroke-width="0.6"/>
    <rect x="396" y="208" width="20" height="14" fill="#5ec8c0" opacity="0.35"/>
    <rect x="436" y="208" width="20" height="14" fill="none" stroke="#5ec8c0" stroke-opacity="0.7" stroke-width="0.6"/>
    <rect x="476" y="208" width="14" height="14" fill="none" stroke="#5ec8c0" stroke-opacity="0.7" stroke-width="0.6"/>
    <line x1="336" y1="215" x2="356" y2="215" stroke="#5ec8c0" stroke-opacity="0.5" stroke-width="0.5" stroke-dasharray="2,1"/>
    <line x1="376" y1="215" x2="396" y2="215" stroke="#5ec8c0" stroke-opacity="0.5" stroke-width="0.5" stroke-dasharray="2,1"/>
    <line x1="416" y1="215" x2="436" y2="215" stroke="#5ec8c0" stroke-opacity="0.5" stroke-width="0.5" stroke-dasharray="2,1"/>
    <line x1="456" y1="215" x2="476" y2="215" stroke="#5ec8c0" stroke-opacity="0.5" stroke-width="0.5" stroke-dasharray="2,1"/>
    <rect x="318" y="230" width="12" height="12" fill="#e4c056" opacity="0.75"/>
    <rect x="398" y="230" width="12" height="12" fill="#e07a95" opacity="0.75"/>
    <rect x="478" y="230" width="10" height="10" fill="#5ec8c0" opacity="0.75"/>

    <use href="#desk" x="306" y="290" width="60" height="22"/>
    <use href="#desk" x="436" y="290" width="60" height="22"/>
    <use href="#chair" x="320" y="324" width="14" height="14"/>
    <use href="#chair" x="450" y="324" width="14" height="14"/>

    <g transform="translate(322 308)" class="breath room-figure"><use href="#hk" width="14" height="20"/></g>
    <g transform="translate(452 308)" class="breath b2 room-figure"><use href="#hk" width="14" height="20"/></g>

    <text x="288" y="370" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">UI / UX</text>
    <text x="345" y="370" font-family="IBM Plex Mono, monospace" font-size="7" fill="#5ec8c0" opacity="0.7">— wayfinding · 2/3</text>

    <rect class="room-tint" x="278" y="178" width="246" height="198"/>
    <rect class="room-stroke" x="278" y="178" width="246" height="198" fill="none"/>
    <text class="enter-hint" x="486" y="190" font-family="IBM Plex Mono, monospace" font-size="7" fill="#5ec8c0" letter-spacing="1.5">ENTER ›</text>
  </g>

  <rect x="524" y="178" width="6" height="198" fill="#3a3045"/>
  <rect x="524" y="178" width="6" height="3" fill="#5d4f6d" opacity="0.6"/>

  <!-- CODE REVIEW -->
  <g class="room code" data-room="code">
    <rect x="530" y="178" width="244" height="198" fill="url(#planks)"/>
    <ellipse cx="652" cy="277" rx="100" ry="60" fill="url(#glow-code)"/>

    <use href="#desk" x="544" y="218" width="100" height="22"/>
    <use href="#desk" x="660" y="218" width="100" height="22"/>

    <rect x="558" y="200" width="40" height="20" fill="#0e0b1a" stroke="#9d7cd8" stroke-opacity="0.55" stroke-width="0.5"/>
    <rect x="676" y="200" width="40" height="20" fill="#0e0b1a" stroke="#9d7cd8" stroke-opacity="0.55" stroke-width="0.5"/>
    <rect x="562" y="204" width="18" height="1.5" fill="#9d7cd8" opacity="0.85"/>
    <rect x="562" y="208" width="22" height="1.5" fill="#5ec8c0" opacity="0.7"/>
    <rect x="566" y="212" width="18" height="1.5" fill="#e4c056" opacity="0.6"/>
    <rect x="562" y="216" width="26" height="1.5" fill="#9d7cd8" opacity="0.5"/>
    <rect x="680" y="204" width="20" height="1.5" fill="#d66c6c" opacity="0.85"/>
    <rect x="680" y="208" width="14" height="1.5" fill="#9d7cd8" opacity="0.6"/>
    <rect x="684" y="212" width="22" height="1.5" fill="#5ec8c0" opacity="0.7"/>
    <rect x="680" y="216" width="18" height="1.5" fill="#9d7cd8" opacity="0.5"/>

    <use href="#chair" x="571" y="248" width="14" height="14"/>
    <use href="#chair" x="689" y="248" width="14" height="14"/>

    <g transform="translate(642 290)" class="breath room-figure"><use href="#hk" width="14" height="20"/></g>

    <rect x="554" y="296" width="20" height="3" fill="#3a2a1a"/>
    <rect x="554" y="293" width="20" height="3" fill="#5a3f28"/>
    <rect x="554" y="290" width="20" height="3" fill="#3a2a1a"/>

    <text x="540" y="370" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">CODE REVIEW</text>
    <text x="640" y="370" font-family="IBM Plex Mono, monospace" font-size="7" fill="#9d7cd8" opacity="0.7">— scriptorium · 1/2</text>

    <rect class="room-tint" x="530" y="178" width="244" height="198"/>
    <rect class="room-stroke" x="530" y="178" width="244" height="198" fill="none"/>
    <text class="enter-hint" x="736" y="190" font-family="IBM Plex Mono, monospace" font-size="7" fill="#9d7cd8" letter-spacing="1.5">ENTER ›</text>
  </g>

  <!-- hallway -->
  <rect x="26" y="376" width="748" height="6" fill="#3a3045"/>
  <rect x="138" y="376" width="22" height="6" fill="#161122"/>
  <rect x="390" y="376" width="22" height="6" fill="#161122"/>
  <rect x="640" y="376" width="22" height="6" fill="#161122"/>
  <rect x="138" y="376" width="2" height="6" fill="#e8a04a"/>
  <rect x="158" y="376" width="2" height="6" fill="#e8a04a"/>
  <rect x="390" y="376" width="2" height="6" fill="#5ec8c0"/>
  <rect x="410" y="376" width="2" height="6" fill="#5ec8c0"/>
  <rect x="640" y="376" width="2" height="6" fill="#9d7cd8"/>
  <rect x="660" y="376" width="2" height="6" fill="#9d7cd8"/>

  <rect x="26" y="382" width="748" height="50" fill="url(#hall-floor)"/>
  <rect x="26" y="382" width="748" height="50" fill="url(#glow-common)" opacity="0.5"/>

  <ellipse cx="40" cy="412" rx="6" ry="3" fill="#000" opacity="0.5"/>
  <rect x="36" y="402" width="8" height="10" fill="#3a2a1a"/>
  <ellipse cx="40" cy="397" rx="7" ry="6" fill="#3d7a4a"/>
  <ellipse cx="36" cy="394" rx="3" ry="4" fill="#4a9258"/>
  <ellipse cx="44" cy="395" rx="3" ry="4" fill="#4a9258"/>

  <ellipse cx="760" cy="412" rx="6" ry="3" fill="#000" opacity="0.5"/>
  <rect x="756" y="402" width="8" height="10" fill="#3a2a1a"/>
  <ellipse cx="760" cy="397" rx="7" ry="6" fill="#3d7a4a"/>
  <ellipse cx="756" cy="394" rx="3" ry="4" fill="#4a9258"/>
  <ellipse cx="764" cy="395" rx="3" ry="4" fill="#4a9258"/>

  <g transform="translate(393 402)" class="breath"><use href="#hk" width="14" height="20"/></g>

  <rect x="26" y="432" width="748" height="6" fill="#3a3045"/>
  <rect x="138" y="432" width="22" height="6" fill="#161122"/>
  <rect x="390" y="432" width="22" height="6" fill="#161122"/>
  <rect x="640" y="432" width="22" height="6" fill="#161122"/>
  <rect x="138" y="432" width="2" height="6" fill="#e07a95"/>
  <rect x="158" y="432" width="2" height="6" fill="#e07a95"/>
  <rect x="390" y="432" width="2" height="6" fill="#e4c056"/>
  <rect x="410" y="432" width="2" height="6" fill="#e4c056"/>
  <rect x="640" y="432" width="2" height="6" fill="#d66c6c"/>
  <rect x="660" y="432" width="2" height="6" fill="#d66c6c"/>

  <!-- FRONT-END -->
  <g class="room front" data-room="front">
    <rect x="26" y="438" width="246" height="218" fill="url(#planks)"/>
    <ellipse cx="149" cy="547" rx="100" ry="65" fill="url(#glow-front)"/>

    <rect x="48" y="458" width="84" height="56" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.55" stroke-width="0.5"/>
    <rect x="48" y="458" width="84" height="6" fill="#1c1830"/>
    <circle cx="52" cy="461" r="1.2" fill="#d66c6c"/>
    <circle cx="56" cy="461" r="1.2" fill="#e4c056"/>
    <circle cx="60" cy="461" r="1.2" fill="#5ec8c0"/>
    <rect x="54" y="472" width="48" height="3" fill="#e07a95" opacity="0.6"/>
    <rect x="54" y="478" width="72" height="1.5" fill="#f2ead7" opacity="0.2"/>
    <rect x="54" y="482" width="56" height="1.5" fill="#f2ead7" opacity="0.2"/>
    <rect x="54" y="490" width="22" height="14" fill="#e07a95" opacity="0.3"/>
    <rect x="80" y="490" width="22" height="14" fill="#e07a95" opacity="0.3"/>
    <rect x="106" y="490" width="22" height="14" fill="#e07a95" opacity="0.3"/>
    <use href="#desk" x="40" y="514" width="100" height="20"/>

    <rect x="160" y="468" width="20" height="36" rx="2" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.6" stroke-width="0.5"/>
    <rect x="162" y="472" width="16" height="26" fill="#e07a95" opacity="0.25"/>
    <rect x="164" y="476" width="6" height="2" fill="#f2ead7" opacity="0.5"/>

    <rect x="194" y="478" width="32" height="22" fill="#0e0b1a" stroke="#e07a95" stroke-opacity="0.5" stroke-width="0.4"/>
    <rect x="196" y="480" width="28" height="3" fill="#e07a95" opacity="0.5"/>
    <rect x="196" y="486" width="20" height="2" fill="#f2ead7" opacity="0.3"/>
    <rect x="196" y="490" width="24" height="2" fill="#f2ead7" opacity="0.3"/>

    <use href="#chair" x="60" y="540" width="14" height="14"/>
    <use href="#chair" x="100" y="540" width="14" height="14"/>
    <g transform="translate(62 524)" class="breath room-figure"><use href="#hk" width="14" height="20"/></g>
    <g transform="translate(180 540)" class="breath b2 room-figure"><use href="#hk" width="14" height="20"/></g>

    <text x="36" y="650" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">FRONT-END</text>
    <text x="118" y="650" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e07a95" opacity="0.7">— looking glass · 2/2</text>

    <rect class="room-tint" x="26" y="438" width="246" height="218"/>
    <rect class="room-stroke" x="26" y="438" width="246" height="218" fill="none"/>
    <text class="enter-hint" x="234" y="450" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e07a95" letter-spacing="1.5">ENTER ›</text>
  </g>

  <rect x="272" y="438" width="6" height="218" fill="#3a3045"/>
  <rect x="272" y="438" width="6" height="3" fill="#5d4f6d" opacity="0.6"/>

  <!-- MARKETING -->
  <g class="room market" data-room="market">
    <rect x="278" y="438" width="246" height="218" fill="url(#planks)"/>
    <ellipse cx="401" cy="547" rx="100" ry="65" fill="url(#glow-market)"/>

    <rect x="296" y="458" width="80" height="60" fill="#1c1830" stroke="#e4c056" stroke-opacity="0.45" stroke-width="0.5"/>
    <rect x="304" y="466" width="16" height="20" fill="#e07a95" opacity="0.7"/>
    <rect x="324" y="464" width="16" height="16" fill="#5ec8c0" opacity="0.7"/>
    <rect x="346" y="466" width="20" height="22" fill="#e4c056" opacity="0.7"/>
    <rect x="306" y="492" width="22" height="3" fill="#9d7cd8" opacity="0.6"/>
    <rect x="334" y="490" width="28" height="3" fill="#f2ead7" opacity="0.6"/>
    <rect x="306" y="500" width="18" height="3" fill="#e07a95" opacity="0.6"/>
    <rect x="332" y="498" width="32" height="3" fill="#e4c056" opacity="0.6"/>

    <rect x="396" y="464" width="110" height="56" fill="#0e0b1a" stroke="#e4c056" stroke-opacity="0.5" stroke-width="0.5"/>
    <polyline points="406,510 422,498 438,504 454,486 470,492 486,478 500,484" fill="none" stroke="#e4c056" stroke-width="1.2"/>
    <rect x="408" y="472" width="4" height="22" fill="#e4c056" opacity="0.5"/>
    <rect x="418" y="478" width="4" height="16" fill="#e4c056" opacity="0.5"/>
    <rect x="428" y="470" width="4" height="24" fill="#e4c056" opacity="0.5"/>
    <rect x="438" y="476" width="4" height="18" fill="#e4c056" opacity="0.5"/>

    <use href="#desk" x="320" y="540" width="120" height="22"/>
    <rect x="336" y="536" width="6" height="6" fill="#f2ead7"/>
    <rect x="338" y="538" width="3" height="2" fill="#5a3f28"/>
    <use href="#chair" x="376" y="568" width="14" height="14"/>
    <g transform="translate(378 552)" class="breath room-figure"><use href="#hk" width="14" height="20"/></g>

    <text x="288" y="650" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">MARKETING</text>
    <text x="368" y="650" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e4c056" opacity="0.7">— heralds · 1/2</text>

    <rect class="room-tint" x="278" y="438" width="246" height="218"/>
    <rect class="room-stroke" x="278" y="438" width="246" height="218" fill="none"/>
    <text class="enter-hint" x="486" y="450" font-family="IBM Plex Mono, monospace" font-size="7" fill="#e4c056" letter-spacing="1.5">ENTER ›</text>
  </g>

  <rect x="524" y="438" width="6" height="218" fill="#3a3045"/>
  <rect x="524" y="438" width="6" height="3" fill="#5d4f6d" opacity="0.6"/>

  <!-- CYBER-SEC -->
  <g class="room sec" data-room="sec">
    <rect x="530" y="438" width="244" height="218" fill="#0c0814"/>
    <ellipse cx="652" cy="547" rx="100" ry="65" fill="url(#glow-sec)"/>

    <rect x="548" y="464" width="36" height="26" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.4" stroke-width="0.5"/>
    <rect x="592" y="458" width="42" height="32" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.7" stroke-width="0.6"/>
    <rect x="642" y="458" width="42" height="32" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.7" stroke-width="0.6"/>
    <rect x="692" y="464" width="36" height="26" fill="#0e0b1a" stroke="#d66c6c" stroke-opacity="0.4" stroke-width="0.5"/>

    <rect x="596" y="464" width="16" height="1.6" fill="#d66c6c"/>
    <rect x="596" y="468" width="22" height="1.6" fill="#d66c6c" opacity="0.85"/>
    <rect x="600" y="472" width="18" height="1.6" fill="#d66c6c" opacity="0.65"/>
    <rect x="596" y="476" width="28" height="1.6" fill="#e4c056" opacity="0.7"/>
    <rect x="596" y="480" width="14" height="1.6" fill="#d66c6c">
      <animate attributeName="opacity" values="0.95;0.3;0.95" dur="1.2s" repeatCount="indefinite"/>
    </rect>
    <rect x="596" y="484" width="20" height="1.6" fill="#d66c6c" opacity="0.55"/>

    <rect x="646" y="464" width="20" height="1.6" fill="#d66c6c" opacity="0.85"/>
    <rect x="646" y="468" width="32" height="1.6" fill="#5ec8c0" opacity="0.7"/>
    <rect x="650" y="472" width="22" height="1.6" fill="#d66c6c" opacity="0.65"/>
    <rect x="646" y="476" width="28" height="1.6" fill="#d66c6c" opacity="0.5"/>

    <g opacity="0.45">
      <rect x="552" y="468" width="3" height="3" fill="#d66c6c"/>
      <rect x="558" y="468" width="3" height="3" fill="#d66c6c"/>
      <rect x="564" y="474" width="3" height="3" fill="#d66c6c"/>
      <rect x="570" y="468" width="3" height="3" fill="#d66c6c"/>
      <rect x="552" y="478" width="3" height="3" fill="#d66c6c"/>
      <rect x="576" y="482" width="3" height="3" fill="#d66c6c"/>
    </g>
    <g opacity="0.45">
      <rect x="696" y="470" width="3" height="3" fill="#d66c6c"/>
      <rect x="704" y="476" width="3" height="3" fill="#d66c6c"/>
      <rect x="712" y="470" width="3" height="3" fill="#d66c6c"/>
      <rect x="720" y="478" width="3" height="3" fill="#d66c6c"/>
      <rect x="704" y="482" width="3" height="3" fill="#d66c6c"/>
    </g>

    <use href="#desk" x="544" y="500" width="220" height="20"/>

    <use href="#chair" x="645" y="528" width="14" height="14"/>
    <g transform="translate(647 512)" class="breath room-figure"><use href="#hk" width="14" height="20"/></g>

    <rect x="744" y="500" width="14" height="60" fill="#1c1830" stroke="#d66c6c" stroke-opacity="0.4" stroke-width="0.4"/>
    <rect x="746" y="504" width="10" height="2" fill="#d66c6c" opacity="0.7"/>
    <rect x="746" y="510" width="10" height="2" fill="#d66c6c" opacity="0.5"/>
    <rect x="746" y="516" width="10" height="2" fill="#5ec8c0" opacity="0.5"/>
    <rect x="746" y="522" width="10" height="2" fill="#d66c6c" opacity="0.7"/>
    <rect x="746" y="528" width="10" height="2" fill="#d66c6c" opacity="0.5"/>

    <text x="540" y="650" font-family="Cinzel, serif" font-size="9" letter-spacing="3" fill="#f2ead7">CYBER-SEC</text>
    <text x="612" y="650" font-family="IBM Plex Mono, monospace" font-size="7" fill="#d66c6c" opacity="0.7">— watchtower · 1/2</text>

    <rect class="room-tint" x="530" y="438" width="244" height="218"/>
    <rect class="room-stroke" x="530" y="438" width="244" height="218" fill="none"/>
    <text class="enter-hint" x="736" y="450" font-family="IBM Plex Mono, monospace" font-size="7" fill="#d66c6c" letter-spacing="1.5">ENTER ›</text>
  </g>

  <!-- corridor to great hall -->
  <rect x="392" y="662" width="16" height="22" fill="#161122"/>
  <rect x="386" y="662" width="6" height="22" fill="#3a3045"/>
  <rect x="408" y="662" width="6" height="22" fill="#3a3045"/>

  <!-- THE GREAT HALL -->
  <g class="room common" data-room="common">
    <rect x="20" y="684" width="760" height="246" fill="#3a3045"/>
    <rect x="26" y="690" width="748" height="234" fill="#15101e"/>
    <ellipse cx="400" cy="800" rx="320" ry="100" fill="url(#glow-common)"/>

    <path d="M120 760 L120 720 Q170 685 220 720 L220 760 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.22" stroke-width="0.6"/>
    <path d="M340 760 L340 712 Q400 680 460 712 L460 760 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.32" stroke-width="0.7"/>
    <path d="M580 760 L580 720 Q630 685 680 720 L680 760 Z" fill="#1c1830" stroke="#f2ead7" stroke-opacity="0.22" stroke-width="0.6"/>
    <ellipse cx="400" cy="740" rx="60" ry="20" fill="#f2ead7" opacity="0.06"/>

    <rect x="116" y="690" width="6" height="70" fill="#0a0814"/>
    <rect x="218" y="690" width="6" height="70" fill="#0a0814"/>
    <rect x="336" y="690" width="6" height="70" fill="#0a0814"/>
    <rect x="458" y="690" width="6" height="70" fill="#0a0814"/>
    <rect x="576" y="690" width="6" height="70" fill="#0a0814"/>
    <rect x="678" y="690" width="6" height="70" fill="#0a0814"/>

    <line x1="26" y1="780" x2="774" y2="780" stroke="#f2ead7" stroke-opacity="0.05"/>
    <line x1="26" y1="820" x2="774" y2="820" stroke="#f2ead7" stroke-opacity="0.04"/>
    <line x1="26" y1="870" x2="774" y2="870" stroke="#f2ead7" stroke-opacity="0.03"/>

    <ellipse cx="400" cy="850" rx="120" ry="22" fill="#3a2a1a"/>
    <ellipse cx="400" cy="844" rx="120" ry="22" fill="#5a3f28"/>
    <ellipse cx="400" cy="844" rx="114" ry="18" fill="#3a2a1a"/>
    <ellipse cx="400" cy="844" rx="114" ry="18" fill="none" stroke="#7a5540" stroke-opacity="0.5" stroke-width="0.6"/>
    <rect x="368" y="836" width="12" height="6" fill="#f2ead7" opacity="0.6" transform="rotate(8 374 839)"/>
    <rect x="412" y="838" width="14" height="6" fill="#f2ead7" opacity="0.4" transform="rotate(-4 419 841)"/>
    <circle cx="400" cy="841" r="3" fill="#e4c056" opacity="0.95">
      <animate attributeName="opacity" values="0.95;0.55;0.95" dur="3s" repeatCount="indefinite"/>
    </circle>

    <g class="room-figure">
      <g transform="translate(280 818)" class="breath"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(312 808)" class="breath b2"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(352 802)" class="breath b3"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(392 800)" class="breath"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(432 802)" class="breath b2"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(472 808)" class="breath b3"><use href="#hk" width="16" height="22"/></g>
      <g transform="translate(504 818)" class="breath"><use href="#hk" width="16" height="22"/></g>
    </g>

    <circle cx="276" cy="826" r="2" fill="#e8a04a" opacity="0.85"/>
    <circle cx="308" cy="816" r="2" fill="#5ec8c0" opacity="0.85"/>
    <circle cx="348" cy="810" r="2" fill="#9d7cd8" opacity="0.85"/>
    <circle cx="388" cy="808" r="2" fill="#9de0f0" opacity="0.95"/>
    <circle cx="448" cy="810" r="2" fill="#e07a95" opacity="0.85"/>
    <circle cx="488" cy="816" r="2" fill="#e4c056" opacity="0.85"/>
    <circle cx="520" cy="826" r="2" fill="#d66c6c" opacity="0.85"/>

    <circle cx="400" cy="730" r="1.6" fill="#f2ead7" opacity="0.85">
      <animate attributeName="cy" values="730;716;730" dur="5s" repeatCount="indefinite"/>
    </circle>
    <circle cx="170" cy="740" r="1.2" fill="#5ec8c0" opacity="0.7">
      <animate attributeName="cy" values="740;726;740" dur="6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="630" cy="740" r="1.2" fill="#e8a04a" opacity="0.7">
      <animate attributeName="cy" values="740;724;740" dur="5.5s" repeatCount="indefinite"/>
    </circle>

    <text x="32" y="920" font-family="Cinzel, serif" font-size="11" letter-spacing="5" fill="#f2ead7">THE GREAT HALL</text>
    <text x="220" y="920" font-family="IBM Plex Mono, monospace" font-size="8" fill="#b9b2a3" opacity="0.7">— where all agents gather and speak in turn</text>
    <text x="700" y="920" font-family="IBM Plex Mono, monospace" font-size="8" fill="#b9b2a3" opacity="0.7" text-anchor="end">7 present</text>

    <rect class="room-tint" x="26" y="690" width="748" height="234"/>
    <rect class="room-stroke" x="26" y="690" width="748" height="234" fill="none"/>
    <text class="enter-hint" x="700" y="704" font-family="IBM Plex Mono, monospace" font-size="8" fill="#f2ead7" letter-spacing="2" text-anchor="end">CONVENE ›</text>
  </g>

  <rect width="800" height="940" fill="url(#vignette)" pointer-events="none"/>
</svg>`.trim();
}

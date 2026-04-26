import { mountShell } from './scene/Shell';
import { RoomView } from './scene/room/RoomView';
import { GreatHallView } from './scene/room/GreatHallView';
import { OracleView } from './scene/room/OracleView';
import { RoomCreatorView } from './scene/RoomCreatorView';
import type { Turn } from './scene/room/Transcript';
import type { AgentPublicInfo, ExtensionMsg, RoomPublicInfo, WebviewMsg } from '@/messaging/protocol';

let sessionTotalUSD = 0;

declare const acquireVsCodeApi: () => {
  postMessage: (msg: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

const vscode = acquireVsCodeApi();
function send(msg: WebviewMsg): void {
  vscode.postMessage(msg);
}

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
mountShell(root);

const buildingFrame = root.querySelector<HTMLElement>('.frame')!;
const svg = root.querySelector<SVGSVGElement>('svg.building')!;

const rooms = new Map<string, RoomPublicInfo>();

interface RoomState {
  turns: Turn[];
  busy: boolean;
}
const roomStates = new Map<string, RoomState>();

/** Per-agent pending send: prompt + mode the turn is running under. On
 *  agent_message_complete, if mode === 'plan' we attach a BUILD button. */
interface PendingAgentTurn {
  prompt: string;
  mode: 'plan' | 'acceptEdits' | 'bypassPermissions';
}
const pendingByAgent = new Map<string, PendingAgentTurn>();
function pkey(roomId: string, agentId: string) { return `${roomId}|${agentId}`; }

/** Current display mode per room (drives the header pill). Heuristic — the
 *  extension decides the real mode; we mirror it best-effort. */
const currentModeByRoom = new Map<string, 'plan' | 'acceptEdits' | 'bypassPermissions'>();

function stateFor(id: string): RoomState {
  let s = roomStates.get(id);
  if (!s) {
    s = { turns: [], busy: false };
    roomStates.set(id, s);
  }
  return s;
}

const roomView = new RoomView(document.body, {
  onLeave: () => {
    const id = roomView.currentRoomId();
    if (id) {
      const snap = roomView.snapshotTranscript();
      stateFor(id).turns = snap;
      persistRoomState(id);
    }
    roomView.close();
    buildingFrame.classList.remove('frame-hidden');
    send({ type: 'close_room' });
  },
  onSend: (roomId, agentIds, prompt) => {
    const mode = roomView.selectedMode();
    const thinking = roomView.selectedThinking();
    for (const id of agentIds) pendingByAgent.set(pkey(roomId, id), { prompt, mode });
    currentModeByRoom.set(roomId, mode);
    send({ type: 'send_prompt', roomId, agentIds, prompt, permissionMode: mode, thinking });
  },
  onBuild: (roomId, agentId, prompt) => {
    pendingByAgent.set(pkey(roomId, agentId), { prompt, mode: 'acceptEdits' });
    currentModeByRoom.set(roomId, 'acceptEdits');
    roomView.setMode('acceptEdits');
    send({ type: 'build_last_turn', roomId, agentId, prompt });
  },
  onStop: (roomId) => {
    send({ type: 'cancel_room_stream', roomId });
    // Lock down whatever turn is in-flight in the retained state so late
    // chunks (the subprocess can take a beat to die) don't append after
    // the marker, then drop the marker into both retained state + the
    // visible transcript.
    const st = stateFor(roomId);
    for (let i = st.turns.length - 1; i >= 0; i--) {
      const t = st.turns[i];
      if (t && t.kind === 'agent' && !t.done) { t.done = true; break; }
    }
    st.turns.push({ kind: 'interrupted', at: Date.now() });
    if (roomView.currentRoomId() === roomId) {
      roomView.addInterrupted();
    }
  },
});

const greatHall = new GreatHallView(document.body, {
  onLeave: () => {
    // Leaving never cancels — the meeting keeps running in the background;
    // the building view shows the Great Hall busy-pulsing while it does.
    greatHall.close();
    buildingFrame.classList.remove('frame-hidden');
    send({ type: 'close_great_hall' });
  },
  onConvene: (picks, task) => {
    const mode = greatHall.selectedMode();
    const thinking = greatHall.selectedThinking();
    for (const p of picks) pendingByAgent.set(pkey('common', p.agentId), { prompt: task, mode });
    currentModeByRoom.set('common', mode);
    send({ type: 'convene', picks, task, permissionMode: mode, thinking });
  },
  onCancelMeeting: (meetingId) => {
    send({ type: 'cancel_meeting', meetingId });
  },
  onBuild: (agentId, prompt) => {
    pendingByAgent.set(pkey('common', agentId), { prompt, mode: 'acceptEdits' });
    currentModeByRoom.set('common', 'acceptEdits');
    greatHall.setMode('acceptEdits');
    send({ type: 'build_last_turn', roomId: 'common', agentId, prompt });
  },
});

/** Last prompt typed in the Oracle — used to pre-fill the destination. */
let oracleLastPrompt = '';

const oracleView = new OracleView(document.body, {
  onLeave: () => {
    oracleView.close();
    buildingFrame.classList.remove('frame-hidden');
  },
  onConsult: (prompt) => {
    oracleLastPrompt = prompt;
    send({ type: 'oracle_consult', prompt });
  },
  onRouteToRoom: (roomId, prompt) => {
    oracleView.close();
    buildingFrame.classList.remove('frame-hidden');
    // Flash the target room on the floor plan, then open it.
    flashRoom(svg, roomId);
    setTimeout(() => {
      send({ type: 'open_room', roomId });
      oracleLastPrompt = prompt; // retained for room_opened handler
    }, 300);
  },
  onRouteToHall: (agents, task) => {
    oracleView.close();
    buildingFrame.classList.remove('frame-hidden');
    flashRoom(svg, 'common');
    setTimeout(() => {
      // Pre-populate Great Hall with the oracle-selected agents + task.
      if (!greatHall.hasMeeting()) {
        for (const a of agents) pendingByAgent.set(pkey('common', a.agentId), { prompt: task, mode: 'plan' });
        currentModeByRoom.set('common', 'plan');
      }
      send({ type: 'open_great_hall' });
    }, 300);
  },
});

// ---- Custom room creator ----

const roomCreator = new RoomCreatorView(document.body, {
  onSave: (name, description, accentColor) => {
    roomCreator.close();
    // building frame restored when room_created fires
    send({ type: 'create_room', name, description, accentColor });
  },
  onUpdate: (roomId, name, description, accentColor) => {
    roomCreator.close();
    send({ type: 'update_room', roomId, name, description, accentColor });
  },
  onDelete: (roomId) => {
    roomCreator.close();
    send({ type: 'delete_room', roomId });
  },
  onSaveAgent: (roomId, agentId, name, tag, systemPrompt, visualPreset) => {
    send({ type: 'save_agent', roomId, agentId, name, tag, systemPrompt, visualPreset });
    // UI will refresh when room_updated fires
  },
  onDeleteAgent: (roomId, agentId) => {
    send({ type: 'delete_agent', roomId, agentId });
  },
  onCancel: () => {
    roomCreator.close();
    buildingFrame.classList.remove('frame-hidden');
  },
});

// ---- Custom room tiles ----

/** Container for custom room tiles, shown below the building SVG. */
const customRoomSection = (() => {
  const sec = document.createElement('div');
  sec.className = 'custom-rooms-section';
  sec.innerHTML = `
    <div class="custom-rooms-header">
      <span class="custom-rooms-label">CUSTOM ROOMS</span>
      <button class="new-room-btn" type="button">+ NEW ROOM</button>
    </div>
    <div class="custom-rooms-grid"></div>
  `;
  sec.querySelector('.new-room-btn')!.addEventListener('click', () => {
    buildingFrame.classList.add('frame-hidden');
    roomCreator.openNew();
  });
  return sec;
})();

buildingFrame.appendChild(customRoomSection);

function makeCustomRoomTile(room: RoomPublicInfo): HTMLDivElement {
  const tile = document.createElement('div');
  tile.className = 'custom-room-tile';
  tile.dataset.room = room.id;
  tile.style.setProperty('--accent', room.accentColor);
  tile.innerHTML = `
    <div class="crt-name"></div>
    <div class="crt-desc"></div>
    <div class="crt-hint">ENTER ›</div>
    <button class="crt-edit" type="button" aria-label="edit room">✎</button>
  `;
  (tile.querySelector('.crt-name') as HTMLElement).textContent = room.name.toUpperCase();
  (tile.querySelector('.crt-desc') as HTMLElement).textContent =
    room.description || 'custom room';

  tile.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.crt-edit')) return;
    send({ type: 'open_room', roomId: room.id });
  });
  tile.querySelector<HTMLButtonElement>('.crt-edit')!.addEventListener('click', (e) => {
    e.stopPropagation();
    buildingFrame.classList.add('frame-hidden');
    const latest = rooms.get(room.id) ?? room;
    roomCreator.openEdit({
      id: latest.id,
      name: latest.name,
      description: latest.description,
      accentColor: latest.accentColor,
      agents: [...latest.agents],
    });
  });
  return tile;
}

function addCustomRoomTile(room: RoomPublicInfo): void {
  const grid = customRoomSection.querySelector<HTMLElement>('.custom-rooms-grid')!;
  // Remove existing tile for this room (update case).
  grid.querySelector(`[data-room="${CSS.escape(room.id)}"]`)?.remove();
  grid.appendChild(makeCustomRoomTile(room));
}

function removeCustomRoomTile(roomId: string): void {
  customRoomSection.querySelector(`[data-room="${CSS.escape(roomId)}"]`)?.remove();
}

// Escape closes whichever view is open. Meetings/streams keep running.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (roomCreator.isVisible()) {
    roomCreator.close();
    buildingFrame.classList.remove('frame-hidden');
  } else if (roomView.isVisible()) {
    leaveRoom();
  } else if (greatHall.isVisible()) {
    greatHall.close();
    buildingFrame.classList.remove('frame-hidden');
    send({ type: 'close_great_hall' });
  } else if (oracleView.isVisible()) {
    oracleView.close();
    buildingFrame.classList.remove('frame-hidden');
  }
});

function leaveRoom(): void {
  if (!roomView.currentRoomId()) return;
  const id = roomView.currentRoomId()!;
  stateFor(id).turns = roomView.snapshotTranscript();
  persistRoomState(id);
  roomView.close();
  buildingFrame.classList.remove('frame-hidden');
  send({ type: 'close_room' });
}

/** Cap and persist a room's transcript so it survives VS Code restarts. */
const MAX_PERSISTED_TURNS = 60;
function persistRoomState(roomId: string): void {
  const st = stateFor(roomId);
  const turns = st.turns.length > MAX_PERSISTED_TURNS
    ? st.turns.slice(st.turns.length - MAX_PERSISTED_TURNS)
    : st.turns;
  send({ type: 'save_room_state', roomId, stateJson: JSON.stringify(turns) });
}

// Wire room clicks on the building view.
svg.querySelectorAll<SVGGElement>('.room').forEach((g) => {
  g.addEventListener('click', () => {
    const id = g.dataset.room;
    if (!id) return;
    if (id === 'oracle') {
      buildingFrame.classList.add('frame-hidden');
      oracleView.open();
      return;
    }
    if (id === 'common') {
      buildingFrame.classList.add('frame-hidden');
      if (greatHall.hasMeeting()) {
        greatHall.reveal();
      } else {
        send({ type: 'open_great_hall' });
      }
      return;
    }
    if (!rooms.has(id)) return;
    send({ type: 'open_room', roomId: id });
  });
});

// Open-file events dispatched by plan-path / transcript-path buttons in the webview.
document.addEventListener('hollow:open-file', (e) => {
  send({ type: 'open_file', path: (e as CustomEvent<string>).detail });
});

window.addEventListener('message', (e: MessageEvent<ExtensionMsg>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      msg.rooms.forEach((r) => rooms.set(r.id, r));
      markLiveRooms(svg, rooms);
      showProviderBadge(buildingFrame, msg.provider, msg.model);
      // Render tiles for custom rooms (not in the static SVG).
      msg.rooms
        .filter((r) => !svg.querySelector(`[data-room="${CSS.escape(r.id)}"]`))
        .forEach((r) => addCustomRoomTile(r));
      showFirstRunOverlay();
      return;

    case 'room_opened': {
      const st = stateFor(msg.room.id);
      rooms.set(msg.room.id, msg.room);
      // Restore persisted history if in-memory is empty (fresh start / restart).
      if (msg.savedStateJson && st.turns.length === 0) {
        try {
          const restored = JSON.parse(msg.savedStateJson) as Turn[];
          if (Array.isArray(restored)) st.turns = restored;
        } catch {
          // stale / malformed save — ignore
        }
      }
      const mode = currentModeByRoom.get(msg.room.id) ?? 'plan';
      roomView.open(msg.room, st.turns, st.busy, mode);
      roomView.setSessionTotal(sessionTotalUSD);
      buildingFrame.classList.add('frame-hidden');
      // If the Oracle routed here, pre-fill the prompt bar.
      if (oracleLastPrompt) {
        roomView.prefillPrompt(oracleLastPrompt);
        oracleLastPrompt = '';
      }
      return;
    }

    case 'user_prompt': {
      // Only non-common rooms echo user_prompt — common meetings seed the
      // task through meeting_started directly.
      if (msg.roomId === 'common') return;
      const st = stateFor(msg.roomId);
      st.turns.push({ kind: 'user', text: msg.text, at: Date.now() });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.appendUserPrompt(msg.text);
      }
      return;
    }

    case 'agent_thinking': {
      if (msg.roomId === 'common') {
        greatHall.startAgentTurn(msg.agentId);
        return;
      }
      const st = stateFor(msg.roomId);
      st.turns.push({ kind: 'agent', agentId: msg.agentId, text: '', done: false, at: Date.now() });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.startAgentTurn(msg.agentId);
      }
      return;
    }

    case 'agent_text_chunk': {
      if (msg.roomId === 'common') {
        greatHall.appendAgentChunk(msg.agentId, msg.chunk);
        return;
      }
      const st = stateFor(msg.roomId);
      const inflight = findInflightAgentTurn(st.turns, msg.agentId);
      if (inflight) inflight.text += msg.chunk;
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.appendAgentChunk(msg.agentId, msg.chunk);
      }
      return;
    }

    case 'agent_tool_use': {
      const entry = {
        agentId: msg.agentId,
        toolName: msg.toolName,
        summary: msg.summary,
        isError: msg.isError,
        toolUseId: msg.toolUseId,
        phase: msg.phase,
      } as const;
      if (msg.roomId === 'common') {
        greatHall.addToolUse(entry);
      } else {
        const st = stateFor(msg.roomId);
        st.turns.push({ kind: 'tool', at: Date.now(), ...entry });
        if (roomView.currentRoomId() === msg.roomId) {
          roomView.addToolUse(entry);
        }
      }
      return;
    }

    case 'agent_message_complete': {
      const pending = pendingByAgent.get(pkey(msg.roomId, msg.agentId));
      pendingByAgent.delete(pkey(msg.roomId, msg.agentId));

      if (msg.roomId === 'common') {
        greatHall.completeAgentTurn(msg.agentId);
        if (pending?.mode === 'plan') {
          greatHall.showBuildOnLastAgentTurn(msg.agentId, pending.prompt);
        }
      } else {
        const st = stateFor(msg.roomId);
        const inflight = findInflightAgentTurn(st.turns, msg.agentId);
        if (inflight) inflight.done = true;
        if (roomView.currentRoomId() === msg.roomId) {
          roomView.completeAgentTurn(msg.agentId);
          if (pending?.mode === 'plan') {
            roomView.showBuildOnLastAgentTurn(msg.agentId, pending.prompt);
          }
        }
        // Persist transcript so history survives VS Code restarts.
        persistRoomState(msg.roomId);
      }

      // After an acceptEdits build finishes, the room reverts to plan for the
      // next send (plan is the default posture).
      if (pending?.mode === 'acceptEdits') {
        currentModeByRoom.set(msg.roomId, 'plan');
        if (msg.roomId === 'common') greatHall.setMode('plan');
        else if (roomView.currentRoomId() === msg.roomId) roomView.setMode('plan');
      }
      return;
    }

    case 'chain_handoff': {
      if (msg.roomId === 'common') return;
      const st = stateFor(msg.roomId);
      st.turns.push({
        kind: 'handoff',
        fromAgentId: msg.fromAgentId,
        toAgentId: msg.toAgentId,
        at: Date.now(),
      });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.addHandoff(msg.fromAgentId, msg.toAgentId);
      }
      return;
    }

    case 'chain_error': {
      if (msg.roomId === 'common') return;
      const st = stateFor(msg.roomId);
      st.turns.push({
        kind: 'chain-error',
        errorKind: msg.kind,
        message: msg.message,
        at: Date.now(),
      });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.addChainError(msg.kind, msg.message);
      }
      return;
    }

    case 'plan_saved': {
      if (msg.roomId === 'common') {
        greatHall.attachPlanPath(msg.agentId, msg.path);
      } else if (roomView.currentRoomId() === msg.roomId) {
        roomView.attachPlanPath(msg.agentId, msg.path);
      }
      // Also update the retained transcript state so the path survives re-entry.
      const st = roomStates.get(msg.roomId);
      if (st) {
        for (let i = st.turns.length - 1; i >= 0; i--) {
          const t = st.turns[i];
          if (t && t.kind === 'agent' && t.agentId === msg.agentId) {
            t.planPath = msg.path;
            break;
          }
        }
      }
      return;
    }

    case 'cost_update': {
      sessionTotalUSD = msg.sessionTotalUSD;
      const cost = {
        provider: msg.provider,
        model: msg.model,
        inputTokens: msg.inputTokens,
        outputTokens: msg.outputTokens,
        thisStreamUSD: msg.thisStreamUSD,
      };
      if (msg.roomId === 'common') {
        greatHall.applyCost(msg.agentId, cost, sessionTotalUSD);
        return;
      }
      const st = stateFor(msg.roomId);
      for (let i = st.turns.length - 1; i >= 0; i--) {
        const t = st.turns[i];
        if (t && t.kind === 'agent' && t.agentId === msg.agentId) {
          t.cost = cost;
          break;
        }
      }
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.applyCost(msg.agentId, cost, sessionTotalUSD);
      }
      return;
    }

    case 'room_activity': {
      if (msg.roomId === 'common') {
        greatHall.setBusy(msg.busy);
        const g = svg.querySelector<SVGGElement>('.room.common');
        if (g) {
          g.classList.toggle('room-busy', msg.busy);
          // Show/hide rejoin label on the floor-plan tile.
          let rejoinEl = g.querySelector<SVGTextElement>('.room-rejoin-text');
          if (msg.busy) {
            if (!rejoinEl) {
              rejoinEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              rejoinEl.classList.add('room-rejoin-text');
              rejoinEl.setAttribute('x', '590');
              rejoinEl.setAttribute('y', '60');
              rejoinEl.setAttribute('text-anchor', 'middle');
              rejoinEl.setAttribute('font-family', 'IBM Plex Mono, monospace');
              rejoinEl.setAttribute('font-size', '7');
              rejoinEl.setAttribute('fill', '#f2ead7');
              rejoinEl.setAttribute('opacity', '0.65');
              rejoinEl.setAttribute('letter-spacing', '1');
              rejoinEl.textContent = 'MEETING IN PROGRESS — click to rejoin';
              g.appendChild(rejoinEl);
            }
          } else {
            rejoinEl?.remove();
          }
        }
        return;
      }
      const st = stateFor(msg.roomId);
      st.busy = msg.busy;
      const roomGroup = svg.querySelector<SVGGElement>(`.room[data-room="${CSS.escape(msg.roomId)}"]`);
      if (roomGroup) roomGroup.classList.toggle('room-busy', msg.busy);
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.setBusy(msg.busy);
      }
      return;
    }

    case 'great_hall_opened':
      greatHall.open(msg.roster);
      return;

    case 'meeting_started':
      greatHall.meetingStarted(msg.meetingId, msg.attending, msg.task);
      greatHall.setBusy(true);
      greatHall.setMode(currentModeByRoom.get('common') ?? 'plan');
      return;

    case 'moderator_pick':
      greatHall.moderatorPick(msg.agentId, msg.rationale);
      return;

    case 'meeting_ended':
      greatHall.meetingEnded({
        reason: msg.reason,
        turns: msg.turns,
        costUSD: msg.costUSD,
        transcriptPath: msg.transcriptPath,
      });
      return;

    case 'oracle_thinking':
      oracleView.showThinking();
      return;

    case 'oracle_response':
      oracleView.showDecision(msg.decision);
      return;

    case 'room_created': {
      rooms.set(msg.room.id, msg.room);
      addCustomRoomTile(msg.room);
      buildingFrame.classList.remove('frame-hidden');
      return;
    }

    case 'room_updated': {
      rooms.set(msg.room.id, msg.room);
      addCustomRoomTile(msg.room); // removes old tile, adds updated
      if (roomCreator.isVisible()) roomCreator.updateAgents(msg.room.agents as AgentPublicInfo[]);
      buildingFrame.classList.remove('frame-hidden');
      return;
    }

    case 'room_deleted': {
      rooms.delete(msg.roomId);
      removeCustomRoomTile(msg.roomId);
      buildingFrame.classList.remove('frame-hidden');
      // If user was in this room, leave it.
      if (roomView.currentRoomId() === msg.roomId) leaveRoom();
      return;
    }

    case 'error': {
      console.error('[hollow halls] error:', msg.message);
      if (oracleView.isVisible()) {
        oracleView.showError(msg.message);
      } else {
        showErrorToast(msg.message);
      }
      return;
    }
  }
});

function findInflightAgentTurn(turns: Turn[], agentId: string) {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.kind === 'agent' && t.agentId === agentId && !t.done) return t;
  }
  return undefined;
}

function markLiveRooms(svg: SVGSVGElement, live: Map<string, RoomPublicInfo>): void {
  svg.querySelectorAll<SVGGElement>('.room').forEach((g) => {
    const id = g.dataset.room;
    if (id && live.has(id)) g.classList.add('room-live');
  });
}

function showErrorToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  const txt = document.createElement('span');
  txt.textContent = message;
  const close = document.createElement('button');
  close.className = 'error-toast-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'dismiss');
  close.addEventListener('click', () => toast.remove());
  toast.appendChild(txt);
  toast.appendChild(close);
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 5500);
}

function showFirstRunOverlay(): void {
  const state = vscode.getState() as Record<string, unknown> | null;
  if (state?.firstRunDismissed) return;
  if (document.querySelector('.first-run-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'first-run-overlay';
  overlay.innerHTML = `
    <div class="first-run-card">
      <h2>The Hollow Halls</h2>
      <p>Each room holds AI agents for a specific discipline — design, code, security, and more.</p>
      <p>Start with <strong>The Oracle</strong> if you're not sure where to go. Describe what you need and it will route you to the right room.</p>
      <p>Permission modes: <strong>PLAN</strong> writes a plan only, <strong>EDIT</strong> edits files with your approval, <strong>BYPASS</strong> acts autonomously.</p>
      <button class="first-run-dismiss" type="button">GOT IT</button>
    </div>
  `;
  overlay.querySelector('.first-run-dismiss')!.addEventListener('click', () => {
    overlay.remove();
    vscode.setState({ ...(vscode.getState() as object ?? {}), firstRunDismissed: true });
  });
  document.body.appendChild(overlay);
}

function showProviderBadge(
  frame: HTMLElement,
  provider: 'anthropic' | 'ollama' | 'claude-code',
  model: string,
): void {
  frame.querySelector('.provider-badge')?.remove();
  const badge = document.createElement('div');
  badge.className = 'provider-badge';
  const providerLabel: Record<string, string> = {
    'claude-code': 'CLAUDE MAX',
    'anthropic':   'ANTHROPIC API',
    'ollama':      'OLLAMA LOCAL',
  };
  const nameEl = document.createElement('span');
  nameEl.className = 'provider-badge-name';
  nameEl.textContent = providerLabel[provider] ?? provider.toUpperCase();
  const modelEl = document.createElement('span');
  modelEl.className = 'provider-badge-model';
  modelEl.textContent = model;
  badge.appendChild(nameEl);
  badge.appendChild(modelEl);
  frame.appendChild(badge);
}

/** Briefly pulse the Oracle-target accent on a room's SVG group. */
function flashRoom(svgEl: SVGSVGElement, roomId: string): void {
  const g = svgEl.querySelector<SVGGElement>(
    roomId === 'common' ? '.room.common' : `.room[data-room="${CSS.escape(roomId)}"]`,
  );
  if (!g) return;
  g.classList.add('room-oracle-flash');
  setTimeout(() => g.classList.remove('room-oracle-flash'), 900);
}

send({ type: 'ready' });

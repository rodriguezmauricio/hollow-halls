import { mountShell } from './scene/Shell';
import { RoomView } from './scene/room/RoomView';
import type { Turn } from './scene/room/Transcript';
import type { ExtensionMsg, RoomPublicInfo, WebviewMsg } from '@/messaging/protocol';

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
    if (roomView.currentRoomId()) {
      const snap = roomView.snapshotTranscript();
      const st = stateFor(roomView.currentRoomId()!);
      st.turns = snap;
    }
    roomView.close();
    buildingFrame.classList.remove('frame-hidden');
    send({ type: 'close_room' });
  },
  onSend: (roomId, agentIds, prompt) => {
    send({ type: 'send_prompt', roomId, agentIds, prompt });
  },
});

// Escape from the room view with Esc.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && roomView.isVisible()) {
    leaveRoom();
  }
});

function leaveRoom(): void {
  if (!roomView.currentRoomId()) return;
  const id = roomView.currentRoomId()!;
  stateFor(id).turns = roomView.snapshotTranscript();
  roomView.close();
  buildingFrame.classList.remove('frame-hidden');
  send({ type: 'close_room' });
}

// Wire room clicks on the building view.
svg.querySelectorAll<SVGGElement>('.room').forEach((g) => {
  g.addEventListener('click', () => {
    const id = g.dataset.room;
    if (!id || !rooms.has(id)) return;
    send({ type: 'open_room', roomId: id });
  });
});

window.addEventListener('message', (e: MessageEvent<ExtensionMsg>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      msg.rooms.forEach((r) => rooms.set(r.id, r));
      markLiveRooms(svg, rooms);
      return;

    case 'room_opened': {
      const st = stateFor(msg.room.id);
      rooms.set(msg.room.id, msg.room);
      roomView.open(msg.room, st.turns, st.busy);
      roomView.setSessionTotal(sessionTotalUSD);
      buildingFrame.classList.add('frame-hidden');
      return;
    }

    case 'user_prompt': {
      const st = stateFor(msg.roomId);
      st.turns.push({ kind: 'user', text: msg.text, at: Date.now() });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.appendUserPrompt(msg.text);
      }
      return;
    }

    case 'agent_thinking': {
      const st = stateFor(msg.roomId);
      st.turns.push({ kind: 'agent', agentId: msg.agentId, text: '', done: false, at: Date.now() });
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.startAgentTurn(msg.agentId);
      }
      return;
    }

    case 'agent_text_chunk': {
      const st = stateFor(msg.roomId);
      const inflight = findInflightAgentTurn(st.turns, msg.agentId);
      if (inflight) inflight.text += msg.chunk;
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.appendAgentChunk(msg.agentId, msg.chunk);
      }
      return;
    }

    case 'agent_message_complete': {
      const st = stateFor(msg.roomId);
      const inflight = findInflightAgentTurn(st.turns, msg.agentId);
      if (inflight) inflight.done = true;
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.completeAgentTurn(msg.agentId);
      }
      return;
    }

    case 'cost_update': {
      sessionTotalUSD = msg.sessionTotalUSD;
      const st = stateFor(msg.roomId);
      // Attach cost to the most recent agent turn of this agent in the
      // buffered state so re-entries restore it.
      for (let i = st.turns.length - 1; i >= 0; i--) {
        const t = st.turns[i];
        if (t && t.kind === 'agent' && t.agentId === msg.agentId) {
          t.cost = {
            provider: msg.provider,
            model: msg.model,
            inputTokens: msg.inputTokens,
            outputTokens: msg.outputTokens,
            thisStreamUSD: msg.thisStreamUSD,
          };
          break;
        }
      }
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.applyCost(msg.agentId, {
          provider: msg.provider,
          model: msg.model,
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          thisStreamUSD: msg.thisStreamUSD,
        }, sessionTotalUSD);
      }
      return;
    }

    case 'room_activity': {
      const st = stateFor(msg.roomId);
      st.busy = msg.busy;
      const roomGroup = svg.querySelector<SVGGElement>(`.room[data-room="${CSS.escape(msg.roomId)}"]`);
      if (roomGroup) roomGroup.classList.toggle('room-busy', msg.busy);
      if (roomView.currentRoomId() === msg.roomId) {
        roomView.setBusy(msg.busy);
      }
      return;
    }

    case 'error': {
      console.error('[hollow halls] error:', msg.message);
      showErrorToast(msg.message);
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
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5500);
}

send({ type: 'ready' });

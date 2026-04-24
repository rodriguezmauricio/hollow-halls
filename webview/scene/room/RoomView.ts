import type { RoomPublicInfo } from '@/messaging/protocol';
import { buildRoomScene } from './scenes';
import { Transcript, type Turn } from './Transcript';
import { PromptBar } from './PromptBar';

export interface RoomViewCallbacks {
  readonly onLeave: () => void;
  readonly onSend: (roomId: string, agentIds: string[], prompt: string) => void;
}

/**
 * The room interior. Renders the per-room scene (floor, walls, props, table,
 * agents), a transcript panel below, and a prompt bar at the bottom. Speaker
 * indication is a polygon on the table's front edge that slides toward the
 * active speaker.
 */
export class RoomView {
  readonly el: HTMLDivElement;
  private stage!: HTMLDivElement;
  private transcript!: Transcript;
  private promptBar!: PromptBar;
  private room?: RoomPublicInfo;
  private busy = false;

  constructor(private readonly host: HTMLElement, private readonly cb: RoomViewCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'room-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.el);
  }

  isVisible(): boolean {
    return this.el.classList.contains('open');
  }

  currentRoomId(): string | undefined {
    return this.room?.id;
  }

  open(room: RoomPublicInfo, history: Turn[], busy: boolean): void {
    this.room = room;
    this.el.style.setProperty('--accent', room.accentColor);
    this.el.innerHTML = `
      <header class="room-head">
        <button class="leave" type="button" aria-label="leave room">&larr; LEAVE</button>
        <div class="room-title">
          <h2 class="room-name"></h2>
          <p class="room-sub"></p>
        </div>
        <div class="room-activity" aria-live="polite"></div>
      </header>
      <div class="room-stage"></div>
      <div class="room-transcript-host"></div>
      <div class="room-prompt-host"></div>
    `;

    (this.el.querySelector('.room-name') as HTMLElement).textContent = room.name;
    (this.el.querySelector('.room-sub') as HTMLElement).textContent = room.description;
    (this.el.querySelector('.leave') as HTMLElement).addEventListener('click', () => this.cb.onLeave());

    this.stage = this.el.querySelector('.room-stage') as HTMLDivElement;
    this.stage.innerHTML = buildRoomScene(room);

    // Transcript + prompt bar
    const agentIndex = new Map(room.agents.map((a) => [a.id, a] as const));
    this.transcript = new Transcript({ accent: room.accentColor, agents: agentIndex });
    (this.el.querySelector('.room-transcript-host') as HTMLElement).appendChild(this.transcript.el);
    this.transcript.reset(history);

    this.promptBar = new PromptBar({
      onSend: (agentIds, prompt) => this.cb.onSend(room.id, agentIds, prompt),
    });
    (this.el.querySelector('.room-prompt-host') as HTMLElement).appendChild(this.promptBar.el);
    this.promptBar.setAgents([...room.agents], room.accentColor);

    this.setBusy(busy);

    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => this.promptBar.focus());
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    this.hidePointer();
    this.room = undefined;
  }

  // Streaming API — called when the corresponding extension message arrives
  // and this room is visible. The caller owns per-room transcript state so
  // closing and re-opening can restore it.

  appendUserPrompt(text: string): void {
    this.transcript.addUserPrompt(text);
  }

  startAgentTurn(agentId: string): void {
    this.transcript.startAgentTurn(agentId);
    this.pointAt(agentId);
  }

  appendAgentChunk(agentId: string, chunk: string): void {
    this.transcript.appendAgentChunk(agentId, chunk);
    this.pointAt(agentId);
  }

  completeAgentTurn(agentId: string): void {
    this.transcript.completeAgentTurn(agentId);
  }

  snapshotTranscript(): Turn[] {
    return this.transcript.turnsSnapshot;
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.promptBar.setBusy(busy);
    const ind = this.el.querySelector('.room-activity') as HTMLElement | null;
    if (ind) ind.textContent = busy ? '…deliberating' : '';
    if (!busy) this.hidePointer();
  }

  isBusy(): boolean {
    return this.busy;
  }

  // ---- Speaker pointer (in-SVG polygon) ----

  private pointAt(agentId: string): void {
    const svg = this.el.querySelector<SVGSVGElement>('svg.room-svg');
    if (!svg) return;
    const pointer = svg.querySelector<SVGPolygonElement>('.speaker-pointer');
    const seat = svg.querySelector<SVGGElement>(`.agent-seat[data-seat="${CSS.escape(agentId)}"]`);
    if (!pointer || !seat) return;
    const x = parseFloat(seat.getAttribute('data-seat-x') ?? '0');
    pointer.setAttribute('transform', `translate(${x} ${294})`);
    pointer.setAttribute('opacity', '1');
  }

  private hidePointer(): void {
    const svg = this.el.querySelector<SVGSVGElement>('svg.room-svg');
    const pointer = svg?.querySelector<SVGPolygonElement>('.speaker-pointer');
    if (pointer) pointer.setAttribute('opacity', '0');
  }
}

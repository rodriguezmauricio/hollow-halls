import type { RoomPublicInfo, PickerMode, ThinkingLevel } from '@/messaging/protocol';
import { buildRoomScene } from './scenes';
import { Transcript, type Turn, type TurnAgentCost, type TurnToolUse } from './Transcript';
import { PromptBar } from './PromptBar';

export type { PickerMode };

export interface RoomViewCallbacks {
  readonly onLeave: () => void;
  readonly onSend: (roomId: string, agentIds: string[], prompt: string) => void;
  readonly onBuild: (roomId: string, agentId: string, prompt: string) => void;
  readonly onStop: (roomId: string) => void;
  /** Called when the user clicks "Add agent" in an empty custom room.
   *  main.ts opens the room editor in agent-add mode. */
  readonly onAddAgent?: (roomId: string) => void;
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
  /** Agents who've been told to think but haven't emitted their first chunk. */
  private awaitingFirstChunk = new Set<string>();
  /** Teardown handlers (resizer listeners) attached on open(). */
  private teardown: Array<() => void> = [];

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

  selectedMode(): PickerMode {
    return this.promptBar?.selectedMode() ?? 'plan';
  }

  selectedThinking(): ThinkingLevel {
    return this.promptBar?.selectedThinking() ?? 'off';
  }

  open(room: RoomPublicInfo, history: Turn[], busy: boolean, mode?: string): void {
    this.runTeardown();
    this.room = room;
    this.el.style.setProperty('--accent', room.accentColor);
    this.el.innerHTML = `
      <header class="room-head">
        <button class="leave" type="button" aria-label="leave room">&larr; LEAVE <span class="leave-esc">esc</span></button>
        <div class="room-title">
          <h2 class="room-name"></h2>
          <p class="room-sub"></p>
        </div>
        <button class="room-stop" type="button" aria-label="stop agent" hidden>&#x25A0; STOP</button>
        <div class="room-activity" aria-live="polite"></div>
      </header>
      <div class="room-stage"></div>
      <div class="room-resizer" role="separator" aria-orientation="horizontal" aria-label="resize scene"></div>
      <div class="room-transcript-host"></div>
      <div class="room-prompt-host"></div>
    `;

    (this.el.querySelector('.room-name') as HTMLElement).textContent = room.name;
    (this.el.querySelector('.room-sub') as HTMLElement).textContent = room.description;
    (this.el.querySelector('.leave') as HTMLElement).addEventListener('click', () => this.cb.onLeave());
    (this.el.querySelector('.room-stop') as HTMLElement).addEventListener('click', () => {
      if (this.room) this.cb.onStop(this.room.id);
    });

    this.stage = this.el.querySelector('.room-stage') as HTMLDivElement;
    this.stage.innerHTML = buildRoomScene(room);

    // Transcript + prompt bar
    const agentIndex = new Map(room.agents.map((a) => [a.id, a] as const));
    this.transcript = new Transcript({ accent: room.accentColor, agents: agentIndex });
    (this.el.querySelector('.room-transcript-host') as HTMLElement).appendChild(this.transcript.el);
    this.transcript.reset(history);

    const initialMode = (mode === 'plan' || mode === 'acceptEdits' || mode === 'bypassPermissions')
      ? mode as PickerMode : 'plan';
    this.promptBar = new PromptBar({
      onSend: (agentIds, prompt) => this.cb.onSend(room.id, agentIds, prompt),
      onStop: () => { if (this.room) this.cb.onStop(this.room.id); },
      initialMode,
    });
    (this.el.querySelector('.room-prompt-host') as HTMLElement).appendChild(this.promptBar.el);
    this.promptBar.setAgents([...room.agents], room.accentColor);

    this.setBusy(busy);
    this.wireResizer();

    // Empty-room CTA: custom rooms with zero agents can't be used yet.
    if (room.agents.length === 0) {
      this.showEmptyRoomCTA(room.id);
    }

    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => this.promptBar.focus());
  }

  private showEmptyRoomCTA(roomId: string): void {
    const transcriptHost = this.el.querySelector<HTMLElement>('.room-transcript-host');
    if (!transcriptHost) return;
    const cta = document.createElement('div');
    cta.className = 'empty-room-cta';
    cta.innerHTML = `
      <div class="empty-room-cta-card">
        <div class="empty-room-cta-title">NO AGENTS YET</div>
        <p class="empty-room-cta-body">This room has no inhabitants. Add at least one agent before you can speak with them.</p>
        <button class="empty-room-cta-btn" type="button">+ ADD AGENT</button>
      </div>
    `;
    cta.querySelector<HTMLButtonElement>('.empty-room-cta-btn')!.addEventListener('click', () => {
      this.cb.onAddAgent?.(roomId);
    });
    transcriptHost.appendChild(cta);
  }

  /** Update the selected permission mode (called externally for BUILD feedback). */
  setMode(mode?: string): void {
    this.promptBar?.setMode(mode);
  }

  /** Render a tool-use block in the transcript + append it to the retained state. */
  addToolUse(event: Omit<TurnToolUse, 'kind' | 'at'>): void {
    this.transcript.addToolUse(event);
  }

  addInterrupted(): void {
    this.transcript.addInterrupted();
  }

  addHandoff(fromAgentId: string, toAgentId: string): void {
    this.transcript.addHandoff(fromAgentId, toAgentId);
  }

  addChainError(kind: 'unknown_agent' | 'hop_cap_reached', message: string): void {
    this.transcript.addChainError(kind, message);
  }

  showBuildOnLastAgentTurn(agentId: string, prompt: string): void {
    if (!this.room) return;
    const roomId = this.room.id;
    this.transcript.showBuildButton(agentId, 'BUILD', () =>
      this.cb.onBuild(roomId, agentId, prompt),
    );
  }

  attachPlanPath(agentId: string, path: string): void {
    this.transcript.attachPlanPath(agentId, path);
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
    this.hidePointer();
    this.runTeardown();
    this.room = undefined;
  }

  // Streaming API — called when the corresponding extension message arrives
  // and this room is visible. The caller owns per-room transcript state so
  // closing and re-opening can restore it.

  /** Pre-fill the prompt bar (used when the Oracle routes here). */
  prefillPrompt(text: string): void {
    this.promptBar.prefill(text);
  }

  appendUserPrompt(text: string): void {
    this.transcript.addUserPrompt(text);
  }

  startAgentTurn(agentId: string): void {
    this.transcript.startAgentTurn(agentId);
    this.pointAt(agentId);
    this.awaitingFirstChunk.add(agentId);
    this.showBubbleAtAgent(agentId);
    this.promptBar?.setActiveAgent(agentId);
  }

  appendAgentChunk(agentId: string, chunk: string): void {
    this.transcript.appendAgentChunk(agentId, chunk);
    this.pointAt(agentId);
    if (this.awaitingFirstChunk.has(agentId)) {
      this.awaitingFirstChunk.delete(agentId);
      this.hideBubble();
    }
  }

  completeAgentTurn(agentId: string): void {
    this.transcript.completeAgentTurn(agentId);
    this.awaitingFirstChunk.delete(agentId);
  }

  applyCost(agentId: string, cost: TurnAgentCost, sessionTotalUSD: number): void {
    this.transcript.applyCost(agentId, cost);
    const activity = this.el.querySelector('.room-activity') as HTMLElement | null;
    if (activity && !this.busy) activity.textContent = `session · ${formatUSD(sessionTotalUSD)}`;
  }

  setSessionTotal(sessionTotalUSD: number): void {
    const activity = this.el.querySelector('.room-activity') as HTMLElement | null;
    if (activity && !this.busy) activity.textContent = sessionTotalUSD > 0
      ? `session · ${formatUSD(sessionTotalUSD)}`
      : '';
  }

  snapshotTranscript(): Turn[] {
    return this.transcript.turnsSnapshot;
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.promptBar.setBusy(busy);
    const ind = this.el.querySelector('.room-activity') as HTMLElement | null;
    if (ind) ind.textContent = busy ? '…deliberating' : '';
    const stopBtn = this.el.querySelector<HTMLButtonElement>('.room-stop');
    if (stopBtn) stopBtn.hidden = !busy;
    if (!busy) {
      this.hidePointer();
      this.hideBubble();
      this.awaitingFirstChunk.clear();
    }
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

  private showBubbleAtAgent(agentId: string): void {
    const svg = this.el.querySelector<SVGSVGElement>('svg.room-svg');
    if (!svg) return;
    const bubble = svg.querySelector<SVGGElement>('.thinking-bubble');
    const seat = svg.querySelector<SVGGElement>(`.agent-seat[data-seat="${CSS.escape(agentId)}"]`);
    if (!bubble || !seat) return;
    const x = parseFloat(seat.getAttribute('data-seat-x') ?? '600');
    bubble.setAttribute('transform', `translate(${x} 190)`);
    bubble.setAttribute('opacity', '1');
  }

  private hideBubble(): void {
    const svg = this.el.querySelector<SVGSVGElement>('svg.room-svg');
    const bubble = svg?.querySelector<SVGGElement>('.thinking-bubble');
    if (bubble) bubble.setAttribute('opacity', '0');
  }

  // ---- resizable stage/transcript divider ----

  private wireResizer(): void {
    const resizer = this.el.querySelector<HTMLElement>('.room-resizer');
    const stage = this.el.querySelector<HTMLElement>('.room-stage');
    if (!resizer || !stage) return;

    let startY = 0;
    let startH = 0;

    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - startY;
      const newH = Math.max(140, Math.min(window.innerHeight - 360, startH + delta));
      this.el.style.setProperty('--stage-h', `${newH}px`);
    };
    const onUp = (e: PointerEvent) => {
      try { resizer.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      resizer.removeEventListener('pointermove', onMove);
      resizer.removeEventListener('pointerup', onUp);
      resizer.removeEventListener('pointercancel', onUp);
      this.el.classList.remove('room-resizing');
    };
    const onDown = (e: PointerEvent) => {
      startY = e.clientY;
      startH = stage.getBoundingClientRect().height;
      resizer.setPointerCapture(e.pointerId);
      resizer.addEventListener('pointermove', onMove);
      resizer.addEventListener('pointerup', onUp);
      resizer.addEventListener('pointercancel', onUp);
      this.el.classList.add('room-resizing');
      e.preventDefault();
    };
    resizer.addEventListener('pointerdown', onDown);
    this.teardown.push(() => resizer.removeEventListener('pointerdown', onDown));
  }

  private runTeardown(): void {
    for (const fn of this.teardown) fn();
    this.teardown = [];
  }
}

function formatUSD(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.01) return '< $0.01';
  if (usd < 1) return `$${usd.toFixed(3).slice(0, 5)}`;
  return `$${usd.toFixed(2)}`;
}

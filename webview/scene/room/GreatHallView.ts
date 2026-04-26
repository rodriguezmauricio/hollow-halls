import type { AgentPublicInfo, AttendingAgent, PickerMode, ThinkingLevel } from '@/messaging/protocol';
import { agentSprite } from '../Agent';
import { buildGreatHallScene } from './scenes';
import { Transcript, type Turn, type TurnAgentCost, type TurnToolUse } from './Transcript';

export interface GreatHallRosterGroup {
  readonly roomId: string;
  readonly roomName: string;
  readonly accentColor: string;
  readonly agents: readonly AgentPublicInfo[];
}

export interface MeetingSummary {
  readonly reason: 'done' | 'turn_limit' | 'cancelled' | 'error';
  readonly turns: number;
  readonly costUSD: number;
  readonly transcriptPath?: string;
}

export interface GreatHallCallbacks {
  /** Close the view without cancelling. Meeting keeps running in the background. */
  readonly onLeave: () => void;
  readonly onConvene: (picks: { roomId: string; agentId: string }[], task: string) => void;
  readonly onCancelMeeting: (meetingId: string) => void;
  readonly onBuild: (agentId: string, prompt: string) => void;
}

type Phase = 'picker' | 'meeting' | 'ended';

/**
 * The Great Hall. State outlives the view: the user can LEAVE mid-meeting
 * (building floor-plan keeps pulsing busy) and come back to the same scene
 * later, with the transcript still accumulating.
 *
 * Three phases:
 *  1. `picker`   — roster by room, task textarea, CONVENE.
 *  2. `meeting`  — seated attendees, speaker pointer, thinking bubble, live
 *                  transcript; CANCEL MEETING at the bottom (right); LEAVE
 *                  at top (left) walks out without stopping.
 *  3. `ended`    — final transcript + summary banner; NEW MEETING or LEAVE.
 *
 * close() only hides — it never clears state. reveal() just un-hides.
 */
export class GreatHallView {
  readonly el: HTMLDivElement;
  private phase: Phase = 'picker';
  private roster: GreatHallRosterGroup[] = [];
  private picks = new Set<string>();               // "roomId:agentId"
  private attending: AttendingAgent[] = [];
  private accentByAgent = new Map<string, string>();
  private meetingId?: string;
  private transcript?: Transcript;
  /** Agents who have been picked but haven't yet emitted a chunk. */
  private awaitingFirstChunk = new Set<string>();
  /** Teardown handlers (resizer listeners, etc.) attached on renderMeeting. */
  private teardown: Array<() => void> = [];
  private pickerMode: PickerMode = 'plan';
  private pickerThinking: ThinkingLevel = 'off';

  constructor(private readonly host: HTMLElement, private readonly cb: GreatHallCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'great-hall-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.el);
  }

  isVisible(): boolean {
    return this.el.classList.contains('open');
  }

  selectedMode(): PickerMode { return this.pickerMode; }
  selectedThinking(): ThinkingLevel { return this.pickerThinking; }

  /** True when there's a running meeting or a summary awaiting review. */
  hasMeeting(): boolean {
    return this.phase !== 'picker';
  }

  /** Initial open (fresh picker). If a meeting is already running, re-uses
   *  the existing view instead of wiping it. */
  open(roster: readonly GreatHallRosterGroup[]): void {
    if (this.phase === 'picker') {
      this.roster = [...roster];
      this.picks.clear();
      this.renderPicker();
    }
    // else: meeting or ended — keep DOM as-is, just show.
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
  }

  /** Just show the existing view (meeting is already running). */
  reveal(): void {
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  // ---- meeting state transitions ----

  meetingStarted(meetingId: string, attending: readonly AttendingAgent[], task: string): void {
    this.meetingId = meetingId;
    this.attending = [...attending];
    this.accentByAgent = new Map(attending.map((a) => [a.agent.id, a.accentColor] as const));
    this.awaitingFirstChunk.clear();
    this.phase = 'meeting';
    this.renderMeeting(task);
    // Moderator is about to pick — float the bubble over table centre.
    this.showBubbleAtCenter();
  }

  moderatorPick(agentId: string, rationale: string): void {
    if (this.phase !== 'meeting') return;
    const note = this.el.querySelector<HTMLElement>('.gh-moderator');
    if (note) {
      const speaker = this.attending.find((a) => a.agent.id === agentId)?.agent.name ?? agentId;
      note.textContent = `the speaker calls on ${speaker.toLowerCase()} — ${rationale}`;
      note.style.color = this.accentByAgent.get(agentId) ?? '#f2ead7';
    }
  }

  startAgentTurn(agentId: string): void {
    this.transcript?.startAgentTurn(agentId);
    this.pointAt(agentId);
    this.awaitingFirstChunk.add(agentId);
    this.showBubbleAtAgent(agentId);
  }

  appendAgentChunk(agentId: string, chunk: string): void {
    this.transcript?.appendAgentChunk(agentId, chunk);
    this.pointAt(agentId);
    if (this.awaitingFirstChunk.has(agentId)) {
      this.awaitingFirstChunk.delete(agentId);
      this.hideBubble();
    }
  }

  completeAgentTurn(agentId: string): void {
    this.transcript?.completeAgentTurn(agentId);
    this.awaitingFirstChunk.delete(agentId);
    if (this.phase === 'meeting') this.showBubbleAtCenter(); // moderator thinking about next
  }

  applyCost(agentId: string, cost: TurnAgentCost, sessionTotalUSD: number): void {
    this.transcript?.applyCost(agentId, cost);
    const t = this.el.querySelector<HTMLElement>('.gh-session-cost');
    if (t) t.textContent = `session · ${formatUSD(sessionTotalUSD)}`;
  }

  addToolUse(event: Omit<TurnToolUse, 'kind' | 'at'>): void {
    this.transcript?.addToolUse(event);
  }

  showBuildOnLastAgentTurn(agentId: string, prompt: string): void {
    if (!this.transcript) return;
    this.transcript.showBuildButton(agentId, 'BUILD', () => this.cb.onBuild(agentId, prompt));
  }

  attachPlanPath(agentId: string, path: string): void {
    this.transcript?.attachPlanPath(agentId, path);
  }

  setMode(mode?: string): void {
    if (mode === 'plan' || mode === 'acceptEdits' || mode === 'bypassPermissions') {
      this.pickerMode = mode as PickerMode;
      this.buildGHModeButtons();
    }
  }

  private wireThinkingSlider(): void {
    const thinkRange = this.el.querySelector<HTMLInputElement>('.think-range');
    const thinkVal = this.el.querySelector<HTMLSpanElement>('.think-val');
    if (!thinkRange || !thinkVal) return;
    const levels: ThinkingLevel[] = ['off', 'low', 'medium', 'high'];
    thinkRange.value = String(levels.indexOf(this.pickerThinking));
    thinkVal.textContent = this.pickerThinking.toUpperCase();
    thinkRange.addEventListener('input', () => {
      this.pickerThinking = levels[Number(thinkRange.value)] ?? 'off';
      thinkVal.textContent = this.pickerThinking.toUpperCase();
    });
  }

  private buildGHModeButtons(): void {
    const modeRow = this.el.querySelector<HTMLElement>('.pmode-group');
    if (!modeRow) return;

    const modeDefs: { mode: PickerMode; label: string }[] = [
      { mode: 'plan', label: 'PLAN' },
      { mode: 'acceptEdits', label: 'EDIT' },
      { mode: 'bypassPermissions', label: 'BYPASS' },
    ];
    modeRow.innerHTML = '';
    for (const { mode, label } of modeDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmode-btn' + (this.pickerMode === mode ? ' selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.pickerMode = mode;
        modeRow.querySelectorAll('.pmode-btn').forEach((b) => b.classList.toggle('selected', b === btn));
      });
      modeRow.appendChild(btn);
    }

  }

  setBusy(busy: boolean): void {
    const cancel = this.el.querySelector<HTMLButtonElement>('.gh-cancel');
    if (cancel) cancel.disabled = !busy;
    if (!busy) this.hideBubble();
  }

  meetingEnded(summary: MeetingSummary): void {
    if (this.phase !== 'meeting') return;
    this.phase = 'ended';
    this.hideBubble();
    this.awaitingFirstChunk.clear();
    const mod = this.el.querySelector<HTMLElement>('.gh-moderator');
    if (mod) {
      mod.textContent = summaryHeadline(summary);
      mod.classList.add('gh-moderator-ended');
      mod.dataset.reason = summary.reason;
    }
    const footer = this.el.querySelector<HTMLElement>('.gh-summary-footer');
    if (footer) {
      footer.innerHTML = summaryFooterHtml(summary);
      footer.dataset.reason = summary.reason;
      footer.classList.add('shown');
      const pathBtn = footer.querySelector<HTMLButtonElement>('button[data-open-path]');
      if (pathBtn) {
        const p = pathBtn.dataset.openPath!;
        pathBtn.addEventListener('click', () =>
          document.dispatchEvent(new CustomEvent('hollow:open-file', { detail: p })),
        );
      }
    }
    const controls = this.el.querySelector<HTMLElement>('.gh-controls');
    if (controls) {
      controls.innerHTML = `<button class="gh-new-meeting" type="button">NEW MEETING</button>`;
      (controls.querySelector('.gh-new-meeting') as HTMLButtonElement)
        .addEventListener('click', () => this.startNewMeeting());
    }
  }

  // ---- private: renders ----

  private renderPicker(): void {
    this.runTeardown();
    this.el.innerHTML = `
      <header class="gh-head">
        <button class="gh-leave" type="button" aria-label="leave hall">&larr; LEAVE <span class="leave-esc">esc</span></button>
        <div class="gh-title">
          <h2>THE GREAT HALL</h2>
          <p>choose who attends. the speaker will call each in turn.</p>
        </div>
        <div class="gh-activity"><span class="gh-session-cost"></span></div>
      </header>
      <div class="gh-picker">
        <div class="gh-roster"></div>
        <div class="gh-task">
          <label class="gh-task-label" for="gh-task-input">the convening's task</label>
          <textarea id="gh-task-input" class="gh-task-input" rows="3"
            placeholder="Design a passwordless login flow. Plan a launch. Triage an incident. Speak it as you'd speak it to a team."></textarea>
          <div class="gh-modes prompt-controls">
            <div class="pmode-group"></div>
            <div class="prompt-ctrl-sep" aria-hidden="true"></div>
            <div class="pthink-group">
              <div class="pthink-track">
                <input type="range" class="think-range" min="0" max="3" step="1" value="0">
                <div class="think-ticks" aria-hidden="true">
                  <span>OFF</span><span>LOW</span><span>MED</span><span>HIGH</span>
                </div>
              </div>
              <span class="think-val">OFF</span>
            </div>
          </div>
          <div class="gh-task-row">
            <span class="gh-task-status"></span>
            <button class="gh-convene" type="button" disabled>CONVENE</button>
          </div>
        </div>
      </div>
    `;

    this.wireLeaveButton();
    this.buildGHModeButtons();
    this.wireThinkingSlider();

    const rosterEl = this.el.querySelector('.gh-roster') as HTMLElement;
    rosterEl.appendChild(this.renderRoster());

    const input = this.el.querySelector('.gh-task-input') as HTMLTextAreaElement;
    const convene = this.el.querySelector('.gh-convene') as HTMLButtonElement;
    const status = this.el.querySelector('.gh-task-status') as HTMLElement;

    const refresh = () => {
      const hasText = input.value.trim().length > 0;
      const hasPicks = this.picks.size > 0;
      convene.disabled = !hasText || !hasPicks;
      if (!hasPicks) status.textContent = 'pick at least one attendee';
      else if (!hasText) status.textContent = `${this.picks.size} attending — speak your task`;
      else status.textContent = `${this.picks.size} attending · ready`;
    };
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !convene.disabled) {
        e.preventDefault();
        this.submitPicker(input.value);
      }
    });
    convene.addEventListener('click', () => this.submitPicker(input.value));
    refresh();
    requestAnimationFrame(() => input.focus());
  }

  private renderRoster(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'gh-roster-list';
    this.roster.forEach((group) => {
      const section = document.createElement('div');
      section.className = 'gh-roster-section';
      section.style.setProperty('--card-accent', group.accentColor);

      const head = document.createElement('div');
      head.className = 'gh-roster-section-head';
      head.textContent = group.roomName;
      section.appendChild(head);

      const row = document.createElement('div');
      row.className = 'gh-card-row';

      group.agents.forEach((a) => {
        const key = `${group.roomId}:${a.id}`;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'gh-agent-card';
        card.style.setProperty('--card-accent', group.accentColor);
        if (this.picks.has(key)) card.classList.add('picked');
        card.dataset.key = key;

        const spriteDiv = document.createElement('div');
        spriteDiv.className = 'gh-card-sprite';
        spriteDiv.innerHTML = agentSprite(a.visual, 'medium');

        const nameEl = document.createElement('div');
        nameEl.className = 'gh-card-name';
        nameEl.textContent = a.name;

        const tagEl = document.createElement('div');
        tagEl.className = 'gh-card-tag';
        tagEl.textContent = a.tag;

        const statusEl = document.createElement('div');
        statusEl.className = 'gh-card-status';
        statusEl.innerHTML = `<span class="gh-card-dot"></span><span class="gh-card-status-text">active</span>`;

        card.appendChild(spriteDiv);
        card.appendChild(nameEl);
        card.appendChild(tagEl);
        card.appendChild(statusEl);

        card.addEventListener('click', () => {
          if (this.picks.has(key)) {
            this.picks.delete(key);
            card.classList.remove('picked');
          } else if (this.picks.size >= 7) {
            card.animate(
              [{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
              { duration: 180 },
            );
            return;
          } else {
            this.picks.add(key);
            card.classList.add('picked');
          }
          const input = this.el.querySelector('.gh-task-input') as HTMLTextAreaElement;
          input.dispatchEvent(new Event('input'));
        });
        row.appendChild(card);
      });
      section.appendChild(row);
      container.appendChild(section);
    });
    return container;
  }

  private submitPicker(task: string): void {
    const clean = task.trim();
    if (!clean || this.picks.size === 0) return;
    const picks = Array.from(this.picks).map((key) => {
      const [roomId, agentId] = key.split(':');
      return { roomId: roomId!, agentId: agentId! };
    });
    this.cb.onConvene(picks, clean);
  }

  private renderMeeting(task: string): void {
    this.runTeardown();
    const agentsMap = new Map(this.attending.map((a) => [a.agent.id, a.agent] as const));
    this.el.innerHTML = `
      <header class="gh-head gh-head-meeting">
        <button class="gh-leave" type="button" aria-label="leave but keep meeting running">&larr; LEAVE <span class="leave-esc">esc</span></button>
        <div class="gh-title">
          <h2>THE GREAT HALL</h2>
          <p class="gh-task-echo"></p>
        </div>
        <div class="gh-activity">
          <span class="gh-session-cost"></span>
        </div>
      </header>
      <div class="gh-stage"></div>
      <div class="gh-resizer" role="separator" aria-orientation="horizontal" aria-label="resize scene"></div>
      <div class="gh-moderator" aria-live="polite">the speaker is considering…</div>
      <div class="gh-transcript-host"></div>
      <div class="gh-meeting-footer">
        <div class="gh-summary-footer"></div>
        <div class="gh-controls">
          <button class="gh-cancel" type="button">CANCEL MEETING</button>
        </div>
      </div>
    `;
    (this.el.querySelector('.gh-task-echo') as HTMLElement).textContent = `“${task}”`;

    this.wireLeaveButton();

    const cancel = this.el.querySelector('.gh-cancel') as HTMLButtonElement;
    let cancelConfirmTimer: ReturnType<typeof setTimeout> | undefined;
    cancel.addEventListener('click', () => {
      if (cancel.dataset.confirming === 'true') {
        clearTimeout(cancelConfirmTimer);
        if (this.meetingId) this.cb.onCancelMeeting(this.meetingId);
      } else {
        cancel.dataset.confirming = 'true';
        cancel.textContent = 'CANCEL? CLICK AGAIN';
        cancelConfirmTimer = setTimeout(() => {
          cancel.dataset.confirming = 'false';
          cancel.textContent = 'CANCEL MEETING';
        }, 3000);
      }
    });

    const stage = this.el.querySelector('.gh-stage') as HTMLElement;
    stage.innerHTML = buildGreatHallScene(this.attending);

    const host = this.el.querySelector('.gh-transcript-host') as HTMLElement;
    this.transcript = new Transcript({
      accent: '#f2ead7',
      agents: agentsMap,
      accentFor: (id) => this.accentByAgent.get(id),
    });
    host.appendChild(this.transcript.el);
    this.transcript.reset([{ kind: 'user', text: task, at: Date.now() } as Turn]);

    this.el.classList.add('gh-in-meeting');
    this.wireResizer();
  }

  private startNewMeeting(): void {
    this.phase = 'picker';
    this.meetingId = undefined;
    this.attending = [];
    this.accentByAgent.clear();
    this.awaitingFirstChunk.clear();
    this.transcript = undefined;
    this.picks.clear();
    this.el.classList.remove('gh-in-meeting');
    this.el.style.removeProperty('--stage-h');
    this.renderPicker();
  }

  private wireLeaveButton(): void {
    const leave = this.el.querySelector<HTMLButtonElement>('.gh-leave');
    if (!leave) return;
    leave.addEventListener('click', () => this.cb.onLeave());
  }

  private wireResizer(): void {
    const resizer = this.el.querySelector<HTMLElement>('.gh-resizer');
    const stage = this.el.querySelector<HTMLElement>('.gh-stage');
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
      this.el.classList.remove('gh-resizing');
    };
    const onDown = (e: PointerEvent) => {
      startY = e.clientY;
      startH = stage.getBoundingClientRect().height;
      resizer.setPointerCapture(e.pointerId);
      resizer.addEventListener('pointermove', onMove);
      resizer.addEventListener('pointerup', onUp);
      resizer.addEventListener('pointercancel', onUp);
      this.el.classList.add('gh-resizing');
      e.preventDefault();
    };
    resizer.addEventListener('pointerdown', onDown);
    this.teardown.push(() => resizer.removeEventListener('pointerdown', onDown));
  }

  private runTeardown(): void {
    for (const fn of this.teardown) fn();
    this.teardown = [];
  }

  // ---- private: speaker pointer + thinking bubble ----

  private pointAt(agentId: string): void {
    const svg = this.el.querySelector<SVGSVGElement>('svg.room-svg');
    if (!svg) return;
    const pointer = svg.querySelector<SVGPolygonElement>('.speaker-pointer');
    const seat = svg.querySelector<SVGGElement>(`.agent-seat[data-seat="${CSS.escape(agentId)}"]`);
    if (!pointer || !seat) return;
    const x = parseFloat(seat.getAttribute('data-seat-x') ?? '0');
    pointer.setAttribute('transform', `translate(${x} 294)`);
    const color = this.accentByAgent.get(agentId) ?? '#f2ead7';
    pointer.setAttribute('fill', color);
    pointer.setAttribute('opacity', '1');
  }

  private showBubbleAtCenter(): void {
    const b = this.el.querySelector<SVGGElement>('svg.room-svg .thinking-bubble');
    if (!b) return;
    b.setAttribute('transform', `translate(600 190)`);
    b.setAttribute('opacity', '1');
    b.style.setProperty('--bubble-color', '#f2ead7');
  }

  private showBubbleAtAgent(agentId: string): void {
    const b = this.el.querySelector<SVGGElement>('svg.room-svg .thinking-bubble');
    const seat = this.el.querySelector<SVGGElement>(`.agent-seat[data-seat="${CSS.escape(agentId)}"]`);
    if (!b || !seat) return;
    const x = parseFloat(seat.getAttribute('data-seat-x') ?? '600');
    b.setAttribute('transform', `translate(${x} 190)`);
    b.setAttribute('opacity', '1');
    const color = this.accentByAgent.get(agentId) ?? '#f2ead7';
    b.style.setProperty('--bubble-color', color);
  }

  private hideBubble(): void {
    const b = this.el.querySelector<SVGGElement>('svg.room-svg .thinking-bubble');
    if (b) b.setAttribute('opacity', '0');
  }
}

function summaryHeadline(s: MeetingSummary): string {
  switch (s.reason) {
    case 'done':       return `the convening is complete · ${s.turns} turns · ${formatUSD(s.costUSD)}`;
    case 'turn_limit': return `turn limit reached · ${s.turns} turns · ${formatUSD(s.costUSD)}`;
    case 'cancelled':  return `meeting cancelled · ${s.turns} turns · ${formatUSD(s.costUSD)}`;
    case 'error':      return `meeting ended in error · ${s.turns} turns · ${formatUSD(s.costUSD)}`;
  }
}

function summaryFooterHtml(s: MeetingSummary): string {
  const path = s.transcriptPath
    ? `<button type="button" class="gh-summary-path-btn" data-open-path="${escapeAttr(s.transcriptPath)}" title="open transcript">transcript saved · ${escapeText(s.transcriptPath)}</button>`
    : '<span class="gh-summary-path gh-summary-warn">transcript not saved — open a workspace folder to persist</span>';
  return `
    <div class="gh-summary">
      <span class="gh-summary-stat"><b>${s.turns}</b> turns</span>
      <span class="gh-summary-stat"><b>${formatUSD(s.costUSD)}</b> spent</span>
      ${path}
    </div>
  `;
}

function formatUSD(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.01) return '< $0.01';
  if (usd < 1) return `$${usd.toFixed(3).slice(0, 5)}`;
  return `$${usd.toFixed(2)}`;
}

function escapeText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

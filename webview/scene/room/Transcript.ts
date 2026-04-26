import type { AgentPublicInfo } from '@/messaging/protocol';

/** A single turn in the transcript. */
export interface TurnUser {
  readonly kind: 'user';
  readonly text: string;
  readonly at: number;
}

export interface TurnAgentCost {
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly thisStreamUSD: number;
}

export interface TurnAgent {
  readonly kind: 'agent';
  readonly agentId: string;
  text: string;             // mutated as chunks stream in
  done: boolean;
  cost?: TurnAgentCost;     // populated on cost_update
  /** Permission mode the turn ran under; drives BUILD-button visibility. */
  permissionMode?: 'plan' | 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk';
  /** Saved-plan path once the extension has written it to .hollow/plans/. */
  planPath?: string;
  readonly at: number;
}

export interface TurnToolUse {
  readonly kind: 'tool';
  readonly agentId: string;
  readonly toolName: string;
  readonly summary: string;
  readonly isError?: boolean;
  /** Opaque id matching the `start` → `result` pair. */
  readonly toolUseId?: string;
  readonly phase: 'start' | 'result';
  readonly at: number;
}

export type Turn = TurnUser | TurnAgent | TurnToolUse;

export interface RoomPalette {
  readonly accent: string;
  readonly agents: ReadonlyMap<string, AgentPublicInfo>;
  /** Optional per-agent accent override — used in the Great Hall, where each
   *  attendee wears their home room's soul color. Falls back to `accent`. */
  readonly accentFor?: (agentId: string) => string | undefined;
}

/**
 * Scrolling transcript rendered below the room scene. Styled as a chat
 * panel: each agent turn is a card with name + timestamp header, streaming
 * body text, and an optional tool-chip row. User turns are right-aligned.
 * Auto-scrolls to bottom unless the user has scrolled up to read history.
 */
export class Transcript {
  readonly el: HTMLDivElement;
  private list: HTMLOListElement;
  private turns: Turn[] = [];
  private turnEls = new WeakMap<Turn, HTMLLIElement>();
  private autoScroll = true;

  constructor(private readonly palette: RoomPalette) {
    this.el = document.createElement('div');
    this.el.className = 'transcript';
    this.el.innerHTML = `
      <div class="transcript-bar"><span class="transcript-label">transcript</span></div>
      <ol class="transcript-list"></ol>
    `;
    this.list = this.el.querySelector('.transcript-list') as HTMLOListElement;
    this.el.addEventListener('scroll', this.onScroll, { passive: true });
  }

  reset(turns: Turn[]): void {
    this.turns = [];
    this.list.innerHTML = '';
    turns.forEach((t) => this.pushExisting(t));
    this.autoScroll = true;
    this.scrollToBottom();
  }

  addUserPrompt(text: string): TurnUser {
    const turn: TurnUser = { kind: 'user', text, at: Date.now() };
    this.appendTurn(turn);
    return turn;
  }

  startAgentTurn(agentId: string): TurnAgent {
    const turn: TurnAgent = { kind: 'agent', agentId, text: '', done: false, at: Date.now() };
    this.appendTurn(turn);
    return turn;
  }

  appendAgentChunk(agentId: string, chunk: string): void {
    const turn = this.findInProgressTurn(agentId);
    if (!turn) return;
    turn.text += chunk;
    const el = this.turnEls.get(turn);
    if (el) {
      const body = el.querySelector<HTMLElement>('.turn-body');
      if (body) {
        // Preserve any tool chips already appended inside the body.
        const chips = Array.from(body.querySelectorAll<HTMLElement>('.tool-chip'));
        body.textContent = turn.text;
        chips.forEach((c) => body.appendChild(c));
        body.appendChild(makeCaret());
      }
    }
    this.scrollIfPinned();
  }

  completeAgentTurn(agentId: string): void {
    const turn = this.findInProgressTurn(agentId);
    if (!turn) return;
    turn.done = true;
    const el = this.turnEls.get(turn);
    if (el) {
      const body = el.querySelector<HTMLElement>('.turn-body');
      if (body) {
        const chips = Array.from(body.querySelectorAll<HTMLElement>('.tool-chip'));
        body.textContent = turn.text;
        chips.forEach((c) => body.appendChild(c));
      }
    }
    this.scrollIfPinned();
  }

  addToolUse(turn: Omit<TurnToolUse, 'kind' | 'at'> & { at?: number }): void {
    const full: TurnToolUse = { kind: 'tool', at: turn.at ?? Date.now(), ...turn };
    this.turns.push(full);

    // Prefer embedding inside the in-progress agent card.
    const inProgress = this.findInProgressTurn(full.agentId);
    if (inProgress) {
      const agentEl = this.turnEls.get(inProgress);
      const body = agentEl?.querySelector<HTMLElement>('.turn-body');
      if (body) {
        body.appendChild(makeToolChip(full));
        this.scrollIfPinned();
        return;
      }
    }

    // Standalone tool entry (history replay or after turn complete).
    const li = document.createElement('li');
    li.className = 'turn turn-tool-standalone';
    const accent = this.palette.accentFor?.(full.agentId) ?? this.palette.accent;
    li.style.setProperty('--turn-accent', accent);
    if (full.isError) li.classList.add('turn-tool-error');
    li.appendChild(makeToolChip(full));
    this.turnEls.set(full, li);
    this.list.appendChild(li);
    this.scrollIfPinned();
  }

  /** Attach a BUILD button to the most recent completed agent turn. */
  showBuildButton(agentId: string, label: string, onClick: () => void): void {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t && t.kind === 'agent' && t.agentId === agentId) {
        const el = this.turnEls.get(t);
        if (!el) return;
        if (el.querySelector('.turn-build')) return;
        const footer = el.querySelector<HTMLElement>('.turn-footer') ?? el;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'turn-build';
        btn.textContent = label;
        btn.title = 'Re-runs this plan in acceptEdits mode — Claude will now edit files';
        const hint = document.createElement('div');
        hint.className = 'turn-build-hint';
        hint.textContent = 're-runs as acceptEdits — Claude will edit files';
        btn.addEventListener('click', () => {
          btn.disabled = true;
          btn.textContent = '…building';
          hint.remove();
          onClick();
        });
        footer.appendChild(btn);
        footer.appendChild(hint);
        return;
      }
    }
  }

  /** Mark the saved-plan path on the most recent agent turn. */
  attachPlanPath(agentId: string, path: string): void {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t && t.kind === 'agent' && t.agentId === agentId) {
        t.planPath = path;
        const el = this.turnEls.get(t);
        if (!el) return;
        let badge = el.querySelector<HTMLButtonElement>('button.turn-plan-path');
        if (!badge) {
          badge = document.createElement('button');
          badge.type = 'button';
          badge.className = 'turn-plan-path';
          badge.title = 'open plan file';
          badge.addEventListener('click', () =>
            document.dispatchEvent(new CustomEvent('hollow:open-file', { detail: path })),
          );
          (el.querySelector('.turn-footer') ?? el).appendChild(badge);
        }
        badge.textContent = `plan saved · ${path}`;
        return;
      }
    }
  }

  applyCost(agentId: string, cost: TurnAgentCost): void {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t && t.kind === 'agent' && t.agentId === agentId) {
        t.cost = cost;
        const el = this.turnEls.get(t);
        if (el) renderCostBadge(el, cost);
        return;
      }
    }
  }

  get turnsSnapshot(): Turn[] {
    return this.turns.map((t) => ({ ...t }));
  }

  // ---- internals ----

  private appendTurn(turn: Turn): void {
    this.turns.push(turn);
    const li = this.renderTurn(turn);
    this.turnEls.set(turn, li);
    this.list.appendChild(li);
    this.scrollIfPinned();
  }

  private pushExisting(turn: Turn): void {
    this.turns.push(turn);
    const li = this.renderTurn(turn);
    this.turnEls.set(turn, li);
    this.list.appendChild(li);
  }

  private findInProgressTurn(agentId: string): TurnAgent | undefined {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t && t.kind === 'agent' && t.agentId === agentId && !t.done) return t;
    }
    return undefined;
  }

  private renderTurn(turn: Turn): HTMLLIElement {
    if (turn.kind === 'user') return this.renderUserTurn(turn);
    if (turn.kind === 'tool') return this.renderStandaloneTool(turn);
    return this.renderAgentTurn(turn);
  }

  private renderAgentTurn(turn: TurnAgent): HTMLLIElement {
    const agent = this.palette.agents.get(turn.agentId);
    const accent = this.palette.accentFor?.(turn.agentId) ?? this.palette.accent;
    const li = document.createElement('li');
    li.className = 'turn turn-card turn-agent';
    li.style.setProperty('--turn-accent', accent);

    const ts = formatTime(turn.at);
    li.innerHTML = `
      <header class="turn-header">
        <span class="soul-dot" aria-hidden="true"></span>
        <span class="turn-name"></span>
        <span class="turn-tag"></span>
        <span class="turn-ts">${ts}</span>
      </header>
      <div class="turn-body"></div>
      <div class="turn-footer"></div>
    `;
    (li.querySelector('.turn-name') as HTMLElement).textContent = agent?.name ?? turn.agentId;
    (li.querySelector('.turn-tag') as HTMLElement).textContent = agent?.tag ?? '';

    const body = li.querySelector('.turn-body') as HTMLElement;
    body.textContent = turn.text;
    if (!turn.done) body.appendChild(makeCaret());

    if (turn.cost) renderCostBadge(li, turn.cost);
    if (turn.planPath) {
      const path = turn.planPath;
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'turn-plan-path';
      badge.title = 'open plan file';
      badge.textContent = `plan saved · ${path}`;
      badge.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent('hollow:open-file', { detail: path })),
      );
      (li.querySelector('.turn-footer') as HTMLElement).appendChild(badge);
    }
    return li;
  }

  private renderUserTurn(turn: TurnUser): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'turn turn-card turn-user';
    const ts = formatTime(turn.at);
    li.innerHTML = `
      <header class="turn-header">
        <span class="turn-name">YOU</span>
        <span class="turn-ts">${ts}</span>
      </header>
      <div class="turn-body"></div>
    `;
    (li.querySelector('.turn-body') as HTMLElement).textContent = turn.text;
    return li;
  }

  private renderStandaloneTool(turn: TurnToolUse): HTMLLIElement {
    const accent = this.palette.accentFor?.(turn.agentId) ?? this.palette.accent;
    const li = document.createElement('li');
    li.className = 'turn turn-tool-standalone';
    if (turn.isError) li.classList.add('turn-tool-error');
    li.style.setProperty('--turn-accent', accent);
    li.appendChild(makeToolChip(turn));
    return li;
  }

  private onScroll = (): void => {
    const atBottom = this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 24;
    this.autoScroll = atBottom;
  };

  private scrollIfPinned(): void {
    if (this.autoScroll) this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.el.scrollTop = this.el.scrollHeight;
  }
}

function makeCaret(): HTMLSpanElement {
  const c = document.createElement('span');
  c.className = 'caret';
  return c;
}

function makeToolChip(turn: TurnToolUse): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'tool-chip' + (turn.isError ? ' tool-chip-error' : '');
  const prefix = turn.isError ? '[err]' : turn.phase === 'start' ? '[run]' : '[done]';
  const summary = turn.summary && turn.summary.length > 60
    ? turn.summary.slice(0, 57) + '…'
    : turn.summary;
  chip.innerHTML = `<span class="chip-prefix"></span><span class="chip-tname"></span><span class="chip-summary"></span>`;
  (chip.querySelector('.chip-prefix') as HTMLElement).textContent = prefix + ' ';
  (chip.querySelector('.chip-tname') as HTMLElement).textContent = turn.toolName;
  (chip.querySelector('.chip-summary') as HTMLElement).textContent = summary ? ` · ${summary}` : '';
  return chip;
}

function renderCostBadge(li: HTMLLIElement, cost: TurnAgentCost): void {
  let badge = li.querySelector<HTMLElement>('.turn-cost');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'turn-cost';
    (li.querySelector('.turn-footer') ?? li).appendChild(badge);
  }
  const providerShort = cost.provider === 'claude-code' ? 'claude cli'
    : cost.provider === 'anthropic' ? 'anthropic' : cost.provider;
  const modelShort = cost.model
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-\d{8}00\d*$/, '');
  const totalTok = cost.inputTokens + cost.outputTokens;
  const tokStr = totalTok >= 1000 ? `${(totalTok / 1000).toFixed(1)}k tok` : `${totalTok} tok`;
  badge.textContent = [providerShort, modelShort, tokStr, formatCostUSD(cost.thisStreamUSD)].join(' · ');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatCostUSD(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.01) return '< $0.01';
  if (usd < 1) return `$${usd.toFixed(3).slice(0, 5)}`;
  return `$${usd.toFixed(2)}`;
}

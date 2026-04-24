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
  readonly at: number;
}

export type Turn = TurnUser | TurnAgent;

export interface RoomPalette {
  readonly accent: string;
  readonly agents: ReadonlyMap<string, AgentPublicInfo>;
}

/**
 * Scrolling transcript rendered below the room scene. Styled as "papers on
 * the atelier table": cream paper, inky mono text, agent name in small-caps
 * Cinzel. Auto-scrolls to bottom when new content appends, unless the user
 * has scrolled up to read history.
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
      <div class="transcript-bar"><span class="transcript-label">papers on the table</span></div>
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
      const body = el.querySelector('.turn-body') as HTMLElement | null;
      if (body) {
        body.textContent = turn.text;
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
      const body = el.querySelector('.turn-body') as HTMLElement | null;
      if (body) body.textContent = turn.text;
    }
    this.scrollIfPinned();
  }

  applyCost(agentId: string, cost: TurnAgentCost): void {
    // Attach cost to the most recent agent turn for this agent (the one that
    // just finished streaming).
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t && t.kind === 'agent' && t.agentId === agentId) {
        t.cost = cost;
        const el = this.turnEls.get(t);
        if (el) renderCostFooter(el, cost);
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
      if (t && t.kind === 'agent' && t.agentId === agentId && !t.done) {
        return t;
      }
    }
    return undefined;
  }

  private renderTurn(turn: Turn): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'turn';
    if (turn.kind === 'user') {
      li.classList.add('turn-user');
      li.innerHTML = `
        <header class="turn-head">
          <span class="turn-name">you</span>
        </header>
        <div class="turn-body"></div>
      `;
      (li.querySelector('.turn-body') as HTMLElement).textContent = turn.text;
    } else {
      const agent = this.palette.agents.get(turn.agentId);
      li.classList.add('turn-agent');
      li.style.setProperty('--turn-accent', this.palette.accent);
      li.innerHTML = `
        <header class="turn-head">
          <span class="soul-dot" aria-hidden="true"></span>
          <span class="turn-name"></span>
          <span class="turn-tag"></span>
        </header>
        <div class="turn-body"></div>
      `;
      (li.querySelector('.turn-name') as HTMLElement).textContent = agent?.name ?? turn.agentId;
      (li.querySelector('.turn-tag') as HTMLElement).textContent = agent?.tag ?? '';
      const body = li.querySelector('.turn-body') as HTMLElement;
      body.textContent = turn.text;
      if (!turn.done) body.appendChild(makeCaret());
      if (turn.cost) renderCostFooter(li, turn.cost);
    }
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

function renderCostFooter(li: HTMLLIElement, cost: TurnAgentCost): void {
  let footer = li.querySelector('.turn-cost') as HTMLElement | null;
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'turn-cost';
    li.appendChild(footer);
  }
  footer.textContent = [
    cost.provider,
    cost.model,
    `${cost.inputTokens}→${cost.outputTokens} tok`,
    formatCostUSD(cost.thisStreamUSD),
  ].join(' · ');
}

function formatCostUSD(usd: number): string {
  if (usd === 0) return 'free';
  if (usd < 0.01) return '< $0.01';
  if (usd < 1) return `$${usd.toFixed(3).slice(0, 5)}`;
  return `$${usd.toFixed(2)}`;
}

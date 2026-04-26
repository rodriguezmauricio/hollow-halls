import type { OracleDecision } from '@/messaging/protocol';
import { showHelp } from '../Help';

export interface OracleViewCallbacks {
  readonly onLeave: () => void;
  readonly onConsult: (prompt: string) => void;
  readonly onRouteToRoom: (roomId: string, prompt: string) => void;
  readonly onRouteToHall: (
    agents: ReadonlyArray<{ readonly roomId: string; readonly agentId: string }>,
    task: string,
  ) => void;
}

/**
 * The Oracle's chamber. A minimal prompt-and-response view — no room scene,
 * no agents at a table. User types a question; the Oracle speaks one sentence
 * then routes them to the right room or Great Hall.
 */
export class OracleView {
  readonly el: HTMLDivElement;
  private lastPrompt = '';
  private routeTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly host: HTMLElement, private readonly cb: OracleViewCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'oracle-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.el);
    this.buildDOM();
  }

  isVisible(): boolean {
    return this.el.classList.contains('open');
  }

  open(): void {
    this.reset();
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      this.el.querySelector<HTMLTextAreaElement>('.oracle-input')?.focus();
    });
  }

  close(): void {
    clearTimeout(this.routeTimer);
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  showThinking(): void {
    this.setFormDisabled(true);
    const status = this.el.querySelector<HTMLElement>('.oracle-status');
    if (status) {
      status.textContent = 'consulting…';
      status.classList.add('shown');
      status.classList.remove('oracle-status-error');
    }
    // Hide any prior response/error so the next answer appears cleanly.
    const errorBox = this.el.querySelector<HTMLElement>('.oracle-error');
    errorBox?.setAttribute('hidden', '');
  }

  showError(message: string): void {
    clearTimeout(this.routeTimer);
    const status = this.el.querySelector<HTMLElement>('.oracle-status');
    if (status) {
      status.textContent = 'the oracle is silent';
      status.classList.add('shown', 'oracle-status-error');
    }
    // Also surface the error in the body, where the user is already looking,
    // with the actual error text + a hint that they can retry.
    let errorBox = this.el.querySelector<HTMLElement>('.oracle-error');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.className = 'oracle-error';
      const body = this.el.querySelector<HTMLElement>('.oracle-body');
      body?.appendChild(errorBox);
    }
    errorBox.removeAttribute('hidden');
    errorBox.innerHTML = `
      <div class="oracle-error-title">consultation failed</div>
      <div class="oracle-error-msg"></div>
      <div class="oracle-error-hint">try again, or rephrase your question</div>
    `;
    (errorBox.querySelector('.oracle-error-msg') as HTMLElement).textContent = message;
    this.setFormDisabled(false);
    requestAnimationFrame(() => {
      this.el.querySelector<HTMLTextAreaElement>('.oracle-input')?.focus();
    });
  }

  showDecision(decision: OracleDecision): void {
    const status = this.el.querySelector<HTMLElement>('.oracle-status');
    if (status) {
      status.textContent = '';
      status.classList.remove('shown');
    }

    const response = this.el.querySelector<HTMLElement>('.oracle-response');
    const rationale = this.el.querySelector<HTMLElement>('.oracle-rationale');
    const dest = this.el.querySelector<HTMLElement>('.oracle-destination');
    const destName = this.el.querySelector<HTMLElement>('.oracle-dest-name');
    const countdown = this.el.querySelector<HTMLElement>('.oracle-countdown');
    const cancelBtn = this.el.querySelector<HTMLButtonElement>('.oracle-cancel');
    if (!response) return;

    response.removeAttribute('hidden');

    if (decision.route === 'direct') {
      if (rationale) rationale.textContent = decision.answer;
      if (dest) dest.setAttribute('hidden', '');
      this.setFormDisabled(false);
      return;
    }

    if (rationale) rationale.textContent = decision.rationale;

    const destLabel = decision.route === 'room'
      ? decision.roomId.toUpperCase()
      : 'GREAT HALL';
    if (dest) dest.removeAttribute('hidden');
    if (destName) destName.textContent = `→ ${destLabel}`;

    // Restart countdown animation by replacing the bar element.
    if (countdown) {
      const bar = countdown.querySelector('.oracle-countdown-bar');
      if (bar) { bar.remove(); const fresh = document.createElement('div'); fresh.className = 'oracle-countdown-bar'; countdown.appendChild(fresh); }
    }

    const doRoute = () => {
      if (decision.route === 'room') {
        this.cb.onRouteToRoom(decision.roomId, this.lastPrompt);
      } else {
        this.cb.onRouteToHall(decision.agents, this.lastPrompt);
      }
    };

    this.routeTimer = setTimeout(doRoute, 3000);

    if (cancelBtn) {
      cancelBtn.hidden = false;
      const onCancel = () => {
        clearTimeout(this.routeTimer);
        cancelBtn.hidden = true;
        if (countdown) countdown.style.display = 'none';
        this.setFormDisabled(false);
        cancelBtn.removeEventListener('click', onCancel);
      };
      cancelBtn.addEventListener('click', onCancel);
    }
  }

  private buildDOM(): void {
    this.el.innerHTML = `
      <header class="oracle-head">
        <button class="leave" type="button" aria-label="leave oracle">&larr; LEAVE <span class="leave-esc">esc</span></button>
        <div class="oracle-title">THE ORACLE <span class="oracle-tag">— the entrance</span></div>
        <button class="help-btn oracle-help-btn" type="button" aria-label="how the Oracle works">?</button>
        <div class="oracle-status" aria-live="polite"></div>
      </header>
      <main class="oracle-body">
        <div class="oracle-glyph" aria-hidden="true">
          <svg viewBox="0 0 100 100" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#9de0f0" stroke-opacity="0.25" stroke-width="0.7"/>
            <circle cx="50" cy="50" r="30" fill="none" stroke="#9de0f0" stroke-opacity="0.4" stroke-width="0.7"/>
            <circle cx="50" cy="50" r="14" fill="none" stroke="#9de0f0" stroke-opacity="0.6" stroke-width="0.7"/>
            <line x1="4"  y1="50" x2="96" y2="50" stroke="#9de0f0" stroke-opacity="0.15" stroke-width="0.5"/>
            <line x1="50" y1="4"  x2="50" y2="96" stroke="#9de0f0" stroke-opacity="0.15" stroke-width="0.5"/>
            <circle cx="50" cy="50" r="5" fill="#9de0f0" opacity="0.85">
              <animate attributeName="opacity" values="0.85;0.3;0.85" dur="3.5s" repeatCount="indefinite"/>
              <animate attributeName="r" values="5;3.5;5" dur="3.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50" cy="20" r="2.5" fill="#9de0f0" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="4s" repeatCount="indefinite"/>
            </circle>
            <circle cx="80" cy="50" r="2.5" fill="#9de0f0" opacity="0.4">
              <animate attributeName="opacity" values="0.4;0.1;0.4" dur="5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="50" cy="80" r="2.5" fill="#9de0f0" opacity="0.55">
              <animate attributeName="opacity" values="0.55;0.15;0.55" dur="4.5s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
        <p class="oracle-label">What do you need?</p>
        <p class="oracle-subtext">describe your goal — the oracle routes you to the right room</p>
        <div class="oracle-response" hidden>
          <p class="oracle-rationale"></p>
          <div class="oracle-destination" hidden>
            <span class="oracle-dest-name"></span>
            <div class="oracle-countdown"><div class="oracle-countdown-bar"></div></div>
            <button class="oracle-cancel" type="button" hidden>CANCEL</button>
          </div>
        </div>
      </main>
      <div class="oracle-input-area">
        <textarea
          class="oracle-input"
          rows="2"
          placeholder="Ask the Oracle… (Ctrl+Enter to send)"
          aria-label="Ask the Oracle"
        ></textarea>
        <button class="oracle-submit" type="button">CONSULT</button>
      </div>
    `;

    this.el.querySelector<HTMLButtonElement>('.leave')!
      .addEventListener('click', () => this.cb.onLeave());

    const helpBtn = this.el.querySelector<HTMLButtonElement>('.oracle-help-btn')!;
    helpBtn.addEventListener('click', () => showHelp(helpBtn,
      'The Oracle listens to your goal and routes you to the right room.\n' +
      'Describe what you need — it picks the best discipline and sends you there.\n' +
      'For complex tasks it can convene multiple agents in the Great Hall.\n' +
      'Uses a fast model; no file edits. Just routing.',
    ));

    const input = this.el.querySelector<HTMLTextAreaElement>('.oracle-input')!;
    const submit = this.el.querySelector<HTMLButtonElement>('.oracle-submit')!;

    const doSubmit = () => {
      const prompt = input.value.trim();
      if (!prompt) return;
      this.lastPrompt = prompt;
      input.value = '';
      this.showThinking();
      this.cb.onConsult(prompt);
    };

    submit.addEventListener('click', doSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        doSubmit();
      }
    });
  }

  private reset(): void {
    clearTimeout(this.routeTimer);
    this.el.querySelector<HTMLElement>('.oracle-response')?.setAttribute('hidden', '');
    this.el.querySelector<HTMLElement>('.oracle-error')?.setAttribute('hidden', '');
    const status = this.el.querySelector<HTMLElement>('.oracle-status');
    if (status) { status.textContent = ''; status.classList.remove('shown', 'oracle-status-error'); }
    const input = this.el.querySelector<HTMLTextAreaElement>('.oracle-input');
    if (input) { input.value = ''; input.disabled = false; }
    const submit = this.el.querySelector<HTMLButtonElement>('.oracle-submit');
    if (submit) submit.disabled = false;
    const countdown = this.el.querySelector<HTMLElement>('.oracle-countdown');
    if (countdown) countdown.style.display = '';
    const cancelBtn = this.el.querySelector<HTMLButtonElement>('.oracle-cancel');
    if (cancelBtn) cancelBtn.hidden = true;
  }

  private setFormDisabled(disabled: boolean): void {
    const input = this.el.querySelector<HTMLTextAreaElement>('.oracle-input');
    const submit = this.el.querySelector<HTMLButtonElement>('.oracle-submit');
    if (input) input.disabled = disabled;
    if (submit) submit.disabled = disabled;
  }
}

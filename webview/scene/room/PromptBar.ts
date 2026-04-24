import type { AgentPublicInfo } from '@/messaging/protocol';

export interface PromptBarCallbacks {
  readonly onSend: (agentIds: string[], prompt: string) => void;
}

/**
 * Prompt bar docked at the bottom of the room view. Agents render as chips
 * above the textarea; click toggles each one. For M2 (one-agent rooms) the
 * single agent is pre-selected and the chip row serves as a visual anchor
 * for "you are speaking to Maya."
 */
export class PromptBar {
  readonly el: HTMLDivElement;
  private chipRow: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private statusEl: HTMLSpanElement;
  private picked = new Set<string>();
  private busy = false;
  private agents: AgentPublicInfo[] = [];

  constructor(private readonly cb: PromptBarCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'prompt-bar';
    this.el.innerHTML = `
      <div class="prompt-chip-row"></div>
      <div class="prompt-input-row">
        <textarea class="prompt-field" rows="2" placeholder="Speak your intent. Ctrl/⌘+Enter to commune."></textarea>
        <button class="send" type="button" disabled>COMMUNE</button>
      </div>
      <div class="prompt-status"><span class="prompt-status-text"></span></div>
    `;

    this.chipRow = this.el.querySelector('.prompt-chip-row') as HTMLDivElement;
    this.textarea = this.el.querySelector('.prompt-field') as HTMLTextAreaElement;
    this.sendBtn = this.el.querySelector('.send') as HTMLButtonElement;
    this.statusEl = this.el.querySelector('.prompt-status-text') as HTMLSpanElement;

    this.sendBtn.addEventListener('click', () => this.submit());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.submit();
      }
    });
    this.textarea.addEventListener('input', () => this.updateState());
  }

  setAgents(agents: AgentPublicInfo[], accent: string): void {
    this.agents = agents;
    this.chipRow.innerHTML = '';
    this.chipRow.style.setProperty('--accent', accent);
    this.picked = new Set();
    agents.forEach((a) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'prompt-chip picked';
      chip.innerHTML = `
        <span class="chip-dot" aria-hidden="true"></span>
        <span class="chip-name"></span>
        <span class="chip-tag"></span>
      `;
      (chip.querySelector('.chip-name') as HTMLElement).textContent = a.name;
      (chip.querySelector('.chip-tag') as HTMLElement).textContent = a.tag;
      chip.addEventListener('click', () => {
        if (this.picked.has(a.id)) {
          this.picked.delete(a.id);
          chip.classList.remove('picked');
        } else {
          this.picked.add(a.id);
          chip.classList.add('picked');
        }
        this.updateState();
      });
      this.chipRow.appendChild(chip);
      this.picked.add(a.id); // auto-select all
    });
    this.updateState();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    if (busy) {
      this.sendBtn.textContent = '…COMMUNING';
      this.sendBtn.disabled = true;
      this.statusEl.textContent = 'agents are deliberating';
    } else {
      this.sendBtn.textContent = 'COMMUNE';
      this.statusEl.textContent = '';
      this.updateState();
    }
  }

  focus(): void {
    this.textarea.focus();
  }

  reset(): void {
    this.textarea.value = '';
    this.busy = false;
    this.setBusy(false);
  }

  private submit(): void {
    if (this.busy) return;
    const text = this.textarea.value.trim();
    if (!text) {
      this.textarea.focus();
      return;
    }
    if (this.picked.size === 0) {
      this.statusEl.textContent = 'pick at least one agent';
      return;
    }
    const ids = Array.from(this.picked);
    this.textarea.value = '';
    this.setBusy(true);
    this.cb.onSend(ids, text);
  }

  private updateState(): void {
    if (this.busy) return;
    const hasText = this.textarea.value.trim().length > 0;
    const hasAgents = this.picked.size > 0;
    this.sendBtn.disabled = !hasText || !hasAgents;
    if (!hasAgents) {
      this.statusEl.textContent = 'no agents selected';
    } else if (!hasText) {
      this.statusEl.textContent = '';
    } else {
      this.statusEl.textContent = `${this.picked.size} of ${this.agents.length} attending`;
    }
  }
}

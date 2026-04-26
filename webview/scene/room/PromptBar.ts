import type { AgentPublicInfo, PickerMode, ThinkingLevel } from '@/messaging/protocol';

export interface PromptBarCallbacks {
  readonly onSend: (agentIds: string[], prompt: string) => void;
  readonly initialMode?: PickerMode;
}

export class PromptBar {
  readonly el: HTMLDivElement;
  private chipRow: HTMLDivElement;
  private modeRowEl: HTMLDivElement;
  private thinkRowEl: HTMLDivElement;
  private textarea: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private statusEl: HTMLSpanElement;
  private picked = new Set<string>();
  private busy = false;
  private agents: AgentPublicInfo[] = [];
  private pickerMode: PickerMode;
  private pickerThinking: ThinkingLevel = 'off';

  constructor(private readonly cb: PromptBarCallbacks) {
    this.pickerMode = cb.initialMode ?? 'plan';

    this.el = document.createElement('div');
    this.el.className = 'prompt-bar';
    this.el.innerHTML = `
      <div class="prompt-chip-row"></div>
      <div class="prompt-modes">
        <div class="prompt-mode-row"></div>
        <div class="prompt-think-row"></div>
      </div>
      <div class="prompt-input-row">
        <textarea class="prompt-field" rows="2" placeholder="Speak your intent. Ctrl/⌘+Enter to commune."></textarea>
        <button class="send" type="button" disabled>COMMUNE</button>
      </div>
      <div class="prompt-status"><span class="prompt-status-text"></span></div>
    `;

    this.chipRow = this.el.querySelector('.prompt-chip-row') as HTMLDivElement;
    this.modeRowEl = this.el.querySelector('.prompt-mode-row') as HTMLDivElement;
    this.thinkRowEl = this.el.querySelector('.prompt-think-row') as HTMLDivElement;
    this.textarea = this.el.querySelector('.prompt-field') as HTMLTextAreaElement;
    this.sendBtn = this.el.querySelector('.send') as HTMLButtonElement;
    this.statusEl = this.el.querySelector('.prompt-status-text') as HTMLSpanElement;

    this.buildModeButtons();
    this.buildThinkButtons();

    this.sendBtn.addEventListener('click', () => this.submit());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.submit();
      }
    });
    this.textarea.addEventListener('input', () => this.updateState());
  }

  selectedMode(): PickerMode { return this.pickerMode; }
  selectedThinking(): ThinkingLevel { return this.pickerThinking; }

  setMode(mode?: string): void {
    if (mode === 'plan' || mode === 'acceptEdits' || mode === 'bypassPermissions') {
      this.pickerMode = mode as PickerMode;
      this.buildModeButtons();
    }
  }

  private buildModeButtons(): void {
    const defs: { mode: PickerMode; label: string }[] = [
      { mode: 'plan', label: 'PLAN' },
      { mode: 'acceptEdits', label: 'EDIT' },
      { mode: 'bypassPermissions', label: 'BYPASS' },
    ];
    this.modeRowEl.innerHTML = '';
    for (const { mode, label } of defs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmode-btn' + (this.pickerMode === mode ? ' selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.pickerMode = mode;
        this.modeRowEl.querySelectorAll('.pmode-btn').forEach((b) =>
          b.classList.toggle('selected', b === btn),
        );
      });
      this.modeRowEl.appendChild(btn);
    }
  }

  private buildThinkButtons(): void {
    const defs: { level: ThinkingLevel; label: string }[] = [
      { level: 'off', label: 'OFF' },
      { level: 'low', label: 'LOW' },
      { level: 'medium', label: 'MED' },
      { level: 'high', label: 'HIGH' },
    ];
    this.thinkRowEl.innerHTML = '';
    for (const { level, label } of defs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pthink-btn' + (this.pickerThinking === level ? ' selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.pickerThinking = level;
        this.thinkRowEl.querySelectorAll('.pthink-btn').forEach((b) =>
          b.classList.toggle('selected', b === btn),
        );
      });
      this.thinkRowEl.appendChild(btn);
    }
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
      this.picked.add(a.id);
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

  prefill(text: string): void {
    this.textarea.value = text;
    this.textarea.focus();
    this.updateState();
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

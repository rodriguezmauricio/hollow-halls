import type { AgentPublicInfo, PickerMode, ThinkingLevel } from '@/messaging/protocol';

export interface PromptBarCallbacks {
  readonly onSend: (agentIds: string[], prompt: string) => void;
  readonly initialMode?: PickerMode;
}

const THINK_LEVELS: ThinkingLevel[] = ['off', 'low', 'medium', 'high'];

export class PromptBar {
  readonly el: HTMLDivElement;
  private chipRow: HTMLDivElement;
  private modeGroupEl: HTMLDivElement;
  private thinkRange: HTMLInputElement;
  private thinkValEl: HTMLSpanElement;
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
      <div class="prompt-controls">
        <div class="pmode-group"></div>
        <div class="prompt-ctrl-sep" aria-hidden="true"></div>
        <div class="pthink-group">
          <input type="range" class="think-range" min="0" max="3" step="1" value="0">
          <span class="think-val">OFF</span>
        </div>
      </div>
      <div class="prompt-input-row">
        <textarea class="prompt-field" rows="2" placeholder="Speak your intent. Ctrl/⌘+Enter to commune."></textarea>
        <button class="send" type="button" disabled>COMMUNE</button>
      </div>
      <div class="prompt-status"><span class="prompt-status-text"></span></div>
    `;

    this.chipRow = this.el.querySelector('.prompt-chip-row') as HTMLDivElement;
    this.modeGroupEl = this.el.querySelector('.pmode-group') as HTMLDivElement;
    this.thinkRange = this.el.querySelector('.think-range') as HTMLInputElement;
    this.thinkValEl = this.el.querySelector('.think-val') as HTMLSpanElement;
    this.textarea = this.el.querySelector('.prompt-field') as HTMLTextAreaElement;
    this.sendBtn = this.el.querySelector('.send') as HTMLButtonElement;
    this.statusEl = this.el.querySelector('.prompt-status-text') as HTMLSpanElement;

    this.thinkRange.addEventListener('input', () => {
      this.pickerThinking = THINK_LEVELS[Number(this.thinkRange.value)] ?? 'off';
      this.thinkValEl.textContent = this.pickerThinking.toUpperCase();
      this.updateState();
    });

    this.buildModeButtons();

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
    const defs: { mode: PickerMode; label: string; hint: string }[] = [
      { mode: 'plan',               label: 'PLAN',   hint: 'writes a plan — no file changes' },
      { mode: 'acceptEdits',        label: 'EDIT',   hint: 'edits files — asks before each change' },
      { mode: 'bypassPermissions',  label: 'BYPASS', hint: 'full autonomy — no confirmations' },
    ];
    this.modeGroupEl.innerHTML = '';
    for (const { mode, label, hint } of defs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmode-btn' + (this.pickerMode === mode ? ' selected' : '');
      btn.textContent = label;
      btn.title = hint;
      btn.addEventListener('click', () => {
        this.pickerMode = mode;
        this.modeGroupEl.querySelectorAll('.pmode-btn').forEach((b) =>
          b.classList.toggle('selected', b === btn),
        );
        this.updateState();
      });
      btn.addEventListener('mouseenter', () => {
        if (!this.busy) this.statusEl.textContent = hint;
      });
      btn.addEventListener('mouseleave', () => {
        if (!this.busy) this.updateState();
      });
      this.modeGroupEl.appendChild(btn);
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

    // Bypass warning overrides normal status; always visible when active.
    const bypass = this.pickerMode === 'bypassPermissions';
    this.sendBtn.classList.toggle('send-bypass', bypass);

    if (bypass) {
      const extra = this.pickerThinking !== 'off' ? ' · extended thinking' : '';
      this.statusEl.textContent = 'bypass — no permission checks' + extra;
    } else if (this.pickerThinking !== 'off') {
      this.statusEl.textContent = 'extended thinking — higher token cost';
    } else if (!hasAgents) {
      this.statusEl.textContent = 'no agents selected';
    } else if (!hasText) {
      this.statusEl.textContent = '';
    } else {
      this.statusEl.textContent = `${this.picked.size} of ${this.agents.length} attending`;
    }
  }
}

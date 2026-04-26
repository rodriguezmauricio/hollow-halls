/** Overlay for changing provider, model, and global defaults. */

export interface ModelPickerSettings {
  readonly provider: 'anthropic' | 'ollama' | 'claude-code';
  readonly providers: {
    readonly anthropic: { readonly defaultModel: string; readonly moderatorModel: string };
    readonly ollama: { readonly host: string; readonly defaultModel: string; readonly moderatorModel: string };
    readonly 'claude-code': { readonly defaultModel: string; readonly moderatorModel: string };
  };
  readonly defaultPermissionMode: 'plan' | 'acceptEdits' | 'bypassPermissions';
  readonly defaultMaxTurns: number;
}

export interface ModelPickerCallbacks {
  readonly onSave: (s: ModelPickerSettings) => void;
  readonly onCancel: () => void;
}

const PROVIDERS = [
  { id: 'claude-code' as const, label: 'CLAUDE MAX', hint: 'Uses your Claude Max subscription via CLI' },
  { id: 'anthropic'   as const, label: 'ANTHROPIC API', hint: 'Pay-per-token via API key in SecretStorage' },
  { id: 'ollama'      as const, label: 'OLLAMA LOCAL', hint: 'Free local models — Ollama must be running' },
];

const PERMISSION_MODES = [
  { id: 'plan'              as const, label: 'PLAN' },
  { id: 'acceptEdits'       as const, label: 'EDIT' },
  { id: 'bypassPermissions' as const, label: 'BYPASS' },
];

export class ModelPickerView {
  readonly el: HTMLDivElement;
  constructor(private readonly host: HTMLElement, private readonly cb: ModelPickerCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'model-picker-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.el);
    this.buildDOM();
  }

  isVisible(): boolean {
    return this.el.classList.contains('open');
  }

  open(settings: ModelPickerSettings): void {
    this.populate(settings);
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private populate(s: ModelPickerSettings): void {
    // Provider buttons
    this.el.querySelectorAll<HTMLButtonElement>('.mp-provider-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.provider === s.provider);
    });
    this.showProviderSection(s.provider);

    // Anthropic
    this.el.querySelector<HTMLInputElement>('.mp-ant-model')!.value = s.providers.anthropic.defaultModel;
    this.el.querySelector<HTMLInputElement>('.mp-ant-mod-model')!.value = s.providers.anthropic.moderatorModel;

    // Claude Code
    this.el.querySelector<HTMLInputElement>('.mp-cc-model')!.value = s.providers['claude-code'].defaultModel;
    this.el.querySelector<HTMLInputElement>('.mp-cc-mod-model')!.value = s.providers['claude-code'].moderatorModel;

    // Ollama
    this.el.querySelector<HTMLInputElement>('.mp-oll-host')!.value = s.providers.ollama.host;
    this.el.querySelector<HTMLInputElement>('.mp-oll-model')!.value = s.providers.ollama.defaultModel;
    this.el.querySelector<HTMLInputElement>('.mp-oll-mod-model')!.value = s.providers.ollama.moderatorModel;

    // Globals
    this.el.querySelectorAll<HTMLButtonElement>('.mp-pmode-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.mode === s.defaultPermissionMode);
    });
    this.el.querySelector<HTMLInputElement>('.mp-max-turns')!.value = String(s.defaultMaxTurns);
  }

  private showProviderSection(provider: string): void {
    ['claude-code', 'anthropic', 'ollama'].forEach((id) => {
      const sec = this.el.querySelector<HTMLElement>(`.mp-section-${id.replace('-', '_')}`)!;
      if (sec) sec.hidden = id !== provider;
    });
  }

  private selectedProvider(): 'anthropic' | 'ollama' | 'claude-code' {
    return (
      this.el.querySelector<HTMLButtonElement>('.mp-provider-btn.selected')?.dataset.provider as
        'anthropic' | 'ollama' | 'claude-code'
    ) ?? 'claude-code';
  }

  private selectedPermissionMode(): 'plan' | 'acceptEdits' | 'bypassPermissions' {
    return (
      this.el.querySelector<HTMLButtonElement>('.mp-pmode-btn.selected')?.dataset.mode as
        'plan' | 'acceptEdits' | 'bypassPermissions'
    ) ?? 'plan';
  }

  private buildDOM(): void {
    const providerBtns = PROVIDERS.map((p) => `
      <button class="mp-provider-btn" type="button" data-provider="${p.id}" title="${p.hint}">
        ${p.label}
      </button>
    `).join('');

    const pmodeBtns = PERMISSION_MODES.map((m) => `
      <button class="mp-pmode-btn" type="button" data-mode="${m.id}">${m.label}</button>
    `).join('');

    this.el.innerHTML = `
      <div class="mp-panel">
        <header class="mp-head">
          <span class="mp-title">SETTINGS</span>
          <button class="mp-cancel-btn" type="button" aria-label="cancel">✕</button>
        </header>
        <div class="mp-body">

          <div class="mp-section">
            <span class="mp-label">PROVIDER</span>
            <div class="mp-provider-row">${providerBtns}</div>
          </div>

          <div class="mp-section mp-section-claude_code">
            <span class="mp-label">CLAUDE MAX — MODELS</span>
            <div class="mp-field-row">
              <label class="mp-field">
                <span class="mp-field-label">Agent model</span>
                <input class="mp-cc-model mp-input" type="text" placeholder="sonnet">
              </label>
              <label class="mp-field">
                <span class="mp-field-label">Moderator model</span>
                <input class="mp-cc-mod-model mp-input" type="text" placeholder="haiku">
              </label>
            </div>
          </div>

          <div class="mp-section mp-section-anthropic" hidden>
            <span class="mp-label">ANTHROPIC API — MODELS</span>
            <div class="mp-field-row">
              <label class="mp-field">
                <span class="mp-field-label">Agent model</span>
                <input class="mp-ant-model mp-input" type="text" placeholder="claude-sonnet-4-6">
              </label>
              <label class="mp-field">
                <span class="mp-field-label">Moderator model</span>
                <input class="mp-ant-mod-model mp-input" type="text" placeholder="claude-haiku-4-5-20251001">
              </label>
            </div>
          </div>

          <div class="mp-section mp-section-ollama" hidden>
            <span class="mp-label">OLLAMA LOCAL — CONFIG</span>
            <label class="mp-field">
              <span class="mp-field-label">Host URL</span>
              <input class="mp-oll-host mp-input" type="text" placeholder="http://localhost:11434">
            </label>
            <div class="mp-field-row">
              <label class="mp-field">
                <span class="mp-field-label">Agent model</span>
                <input class="mp-oll-model mp-input" type="text" placeholder="gemma3:4b">
              </label>
              <label class="mp-field">
                <span class="mp-field-label">Moderator model</span>
                <input class="mp-oll-mod-model mp-input" type="text" placeholder="gemma3:4b">
              </label>
            </div>
          </div>

          <div class="mp-section">
            <span class="mp-label">DEFAULT PERMISSION MODE</span>
            <div class="mp-pmode-row">${pmodeBtns}</div>
            <span class="mp-hint">PLAN = plan only · EDIT = edits with approval · BYPASS = autonomous</span>
          </div>

          <div class="mp-section">
            <label class="mp-field">
              <span class="mp-label">MAX TOOL-USE TURNS</span>
              <input class="mp-max-turns mp-input mp-narrow" type="number" min="1" max="32" step="1">
            </label>
            <span class="mp-hint">Caps tool-use depth per agent call (1–32). Higher = more autonomous but costs more.</span>
          </div>

        </div>
        <footer class="mp-foot">
          <span class="mp-status"></span>
          <div class="mp-actions">
            <button class="mp-save" type="button">SAVE</button>
          </div>
        </footer>
      </div>
    `;

    // Provider tab clicks
    this.el.querySelectorAll<HTMLButtonElement>('.mp-provider-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.el.querySelectorAll('.mp-provider-btn').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
        this.showProviderSection(b.dataset.provider!);
      });
    });

    // Permission mode clicks
    this.el.querySelectorAll<HTMLButtonElement>('.mp-pmode-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.el.querySelectorAll('.mp-pmode-btn').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
      });
    });

    // Cancel
    this.el.querySelector('.mp-cancel-btn')!.addEventListener('click', () => this.cb.onCancel());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.cb.onCancel(); });

    // Save
    this.el.querySelector('.mp-save')!.addEventListener('click', () => {
      const maxTurnsRaw = parseInt(this.el.querySelector<HTMLInputElement>('.mp-max-turns')!.value, 10);
      const maxTurns = isNaN(maxTurnsRaw) || maxTurnsRaw < 1 ? 8 : Math.min(maxTurnsRaw, 32);

      const result: ModelPickerSettings = {
        provider: this.selectedProvider(),
        providers: {
          anthropic: {
            defaultModel:   this.el.querySelector<HTMLInputElement>('.mp-ant-model')!.value.trim() || 'claude-sonnet-4-6',
            moderatorModel: this.el.querySelector<HTMLInputElement>('.mp-ant-mod-model')!.value.trim() || 'claude-haiku-4-5-20251001',
          },
          ollama: {
            host:           this.el.querySelector<HTMLInputElement>('.mp-oll-host')!.value.trim() || 'http://localhost:11434',
            defaultModel:   this.el.querySelector<HTMLInputElement>('.mp-oll-model')!.value.trim() || 'gemma3:4b',
            moderatorModel: this.el.querySelector<HTMLInputElement>('.mp-oll-mod-model')!.value.trim() || 'gemma3:4b',
          },
          'claude-code': {
            defaultModel:   this.el.querySelector<HTMLInputElement>('.mp-cc-model')!.value.trim() || 'sonnet',
            moderatorModel: this.el.querySelector<HTMLInputElement>('.mp-cc-mod-model')!.value.trim() || 'haiku',
          },
        },
        defaultPermissionMode: this.selectedPermissionMode(),
        defaultMaxTurns: maxTurns,
      };
      this.cb.onSave(result);
    });
  }
}

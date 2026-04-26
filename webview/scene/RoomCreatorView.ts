/** Overlay form for creating/editing a custom room, including its agents. */
import type { AgentPublicInfo } from '@/messaging/protocol';

export interface RoomCreatorCallbacks {
  readonly onSave: (name: string, description: string, accentColor: string) => void;
  readonly onUpdate: (roomId: string, name: string, description: string, accentColor: string) => void;
  readonly onDelete: (roomId: string) => void;
  readonly onSaveAgent: (
    roomId: string,
    agentId: string | undefined,
    name: string,
    tag: string,
    systemPrompt: string,
    visualPreset: number,
  ) => void;
  readonly onDeleteAgent: (roomId: string, agentId: string) => void;
  readonly onCancel: () => void;
}

const PRESET_COLORS = [
  { label: 'cyan',    value: '#5ec8c0' },
  { label: 'orchid',  value: '#9de0f0' },
  { label: 'amber',   value: '#e8a04a' },
  { label: 'plum',    value: '#9d7cd8' },
  { label: 'rose',    value: '#e07a95' },
  { label: 'gold',    value: '#e4c056' },
  { label: 'scarlet', value: '#d66c6c' },
  { label: 'sage',    value: '#7ec8a0' },
];

// Matches AGENT_PALETTES in extension.ts
const PRESET_PALETTE_COLORS = [
  '#4a3f6e', '#2a5a4a', '#6e2a3f', '#2a3a6e',
  '#4e4020', '#1e4a3a', '#5a2a5a', '#3a3a1e',
];

export class RoomCreatorView {
  readonly el: HTMLDivElement;
  private editingRoomId: string | null = null;
  /** State for the inline agent form. null = list view, string = editing agentId, 'new' = creating. */
  private agentFormState: string | 'new' | null = null;
  private currentAgents: AgentPublicInfo[] = [];

  constructor(private readonly host: HTMLElement, private readonly cb: RoomCreatorCallbacks) {
    this.el = document.createElement('div');
    this.el.className = 'room-creator-view';
    this.el.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.el);
    this.buildDOM();
  }

  isVisible(): boolean {
    return this.el.classList.contains('open');
  }

  /** Open in "create new room" mode. */
  openNew(): void {
    this.editingRoomId = null;
    this.currentAgents = [];
    this.agentFormState = null;
    this.reset();
    this.el.querySelector<HTMLElement>('.rc-title')!.textContent = 'NEW ROOM';
    const deleteBtn = this.el.querySelector<HTMLButtonElement>('.rc-delete');
    if (deleteBtn) deleteBtn.hidden = true;
    const agentsSec = this.el.querySelector<HTMLElement>('.rc-agents-section');
    if (agentsSec) agentsSec.hidden = true;
    this.open();
  }

  /** Open in "edit existing room" mode. */
  openEdit(room: { id: string; name: string; description: string; accentColor: string; agents: AgentPublicInfo[] }): void {
    this.editingRoomId = room.id;
    this.currentAgents = room.agents;
    this.agentFormState = null;
    this.reset();
    this.el.querySelector<HTMLElement>('.rc-title')!.textContent = 'EDIT ROOM';
    (this.el.querySelector<HTMLInputElement>('.rc-name')!).value = room.name;
    (this.el.querySelector<HTMLTextAreaElement>('.rc-desc')!).value = room.description;
    this.selectColor(room.accentColor);
    const deleteBtn = this.el.querySelector<HTMLButtonElement>('.rc-delete');
    if (deleteBtn) deleteBtn.hidden = false;
    const agentsSec = this.el.querySelector<HTMLElement>('.rc-agents-section');
    if (agentsSec) agentsSec.hidden = false;
    this.renderAgentList();
    this.open();
  }

  /** Refresh agents list after a room_updated message. */
  updateAgents(agents: AgentPublicInfo[]): void {
    this.currentAgents = agents;
    if (this.isVisible() && this.editingRoomId && this.agentFormState === null) {
      this.renderAgentList();
    }
  }

  close(): void {
    this.el.classList.remove('open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private open(): void {
    this.el.classList.add('open');
    this.el.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      this.el.querySelector<HTMLInputElement>('.rc-name')?.focus();
    });
  }

  private reset(): void {
    (this.el.querySelector<HTMLInputElement>('.rc-name')!).value = '';
    (this.el.querySelector<HTMLTextAreaElement>('.rc-desc')!).value = '';
    this.selectColor(PRESET_COLORS[0]!.value);
    const status = this.el.querySelector<HTMLElement>('.rc-status');
    if (status) { status.textContent = ''; delete status.dataset.confirming; }
    this.hideAgentForm();
  }

  private selectColor(color: string): void {
    this.el.querySelectorAll<HTMLButtonElement>('.rc-color-swatch').forEach((s) => {
      s.classList.toggle('selected', s.dataset.color === color);
    });
    if (!this.el.querySelector('.rc-color-swatch.selected')) {
      this.el.querySelector<HTMLButtonElement>('.rc-color-swatch')?.classList.add('selected');
    }
  }

  private selectedColor(): string {
    return this.el.querySelector<HTMLButtonElement>('.rc-color-swatch.selected')?.dataset.color ?? PRESET_COLORS[0]!.value;
  }

  // ---- Agent list ----

  private renderAgentList(): void {
    const list = this.el.querySelector<HTMLElement>('.rc-agent-list')!;
    const form = this.el.querySelector<HTMLElement>('.rc-agent-form-wrap')!;
    list.hidden = false;
    form.hidden = true;

    list.innerHTML = '';
    for (const a of this.currentAgents) {
      const row = document.createElement('div');
      row.className = 'rc-agent-row';
      row.innerHTML = `
        <span class="rc-agent-dot" style="background:${PRESET_PALETTE_COLORS[a.visualPreset ?? 0]}"></span>
        <span class="rc-agent-name"></span>
        <span class="rc-agent-tag"></span>
        <button class="rc-agent-edit" type="button" aria-label="edit agent">✎</button>
      `;
      (row.querySelector('.rc-agent-name') as HTMLElement).textContent = a.name;
      (row.querySelector('.rc-agent-tag') as HTMLElement).textContent = a.tag;
      row.querySelector('.rc-agent-edit')!.addEventListener('click', () => this.showAgentForm(a));
      list.appendChild(row);
    }

    const addRow = document.createElement('div');
    addRow.className = 'rc-add-agent';
    addRow.innerHTML = `<button class="rc-add-agent-btn" type="button">+ ADD AGENT</button>`;
    addRow.querySelector('.rc-add-agent-btn')!.addEventListener('click', () => this.showAgentForm(null));
    list.appendChild(addRow);
  }

  private showAgentForm(agent: AgentPublicInfo | null): void {
    this.agentFormState = agent ? agent.id : 'new';
    const list = this.el.querySelector<HTMLElement>('.rc-agent-list')!;
    const form = this.el.querySelector<HTMLElement>('.rc-agent-form-wrap')!;
    list.hidden = true;
    form.hidden = false;

    // Populate form
    const nameIn = form.querySelector<HTMLInputElement>('.rca-name')!;
    const tagIn = form.querySelector<HTMLInputElement>('.rca-tag')!;
    const promptIn = form.querySelector<HTMLTextAreaElement>('.rca-prompt')!;
    const deleteBtn = form.querySelector<HTMLButtonElement>('.rca-delete')!;

    nameIn.value = agent?.name ?? '';
    tagIn.value = agent?.tag ?? '';
    promptIn.value = agent?.systemPrompt ?? '';
    deleteBtn.hidden = !agent;

    // Preset palette
    const paletteRow = form.querySelector<HTMLElement>('.rca-palette')!;
    const selectedPreset = agent?.visualPreset ?? 0;
    paletteRow.querySelectorAll<HTMLButtonElement>('.rca-palette-swatch').forEach((s, i) => {
      s.classList.toggle('selected', i === selectedPreset);
    });

    nameIn.focus();
  }

  private hideAgentForm(): void {
    this.agentFormState = null;
    const list = this.el.querySelector<HTMLElement>('.rc-agent-list');
    const form = this.el.querySelector<HTMLElement>('.rc-agent-form-wrap');
    if (list) list.hidden = false;
    if (form) form.hidden = true;
  }

  private buildDOM(): void {
    const colorSwatches = PRESET_COLORS.map((c) => `
      <button type="button" class="rc-color-swatch" data-color="${c.value}" style="background: ${c.value}" aria-label="${c.label}"></button>
    `).join('');

    const paletteSwatches = PRESET_PALETTE_COLORS.map((c, i) => `
      <button type="button" class="rca-palette-swatch" data-preset="${i}" style="background: ${c}" aria-label="palette ${i + 1}"></button>
    `).join('');

    this.el.innerHTML = `
      <div class="rc-panel">
        <header class="rc-head">
          <span class="rc-title">NEW ROOM</span>
          <button class="rc-cancel-btn" type="button" aria-label="cancel">✕</button>
        </header>
        <div class="rc-body">
          <label class="rc-field">
            <span class="rc-label">ROOM NAME</span>
            <input class="rc-name" type="text" maxlength="32" placeholder="e.g. Research, Data, DevOps">
          </label>
          <label class="rc-field">
            <span class="rc-label">DESCRIPTION</span>
            <textarea class="rc-desc" rows="2" maxlength="120" placeholder="What this room is for…"></textarea>
          </label>
          <div class="rc-field">
            <span class="rc-label">ACCENT COLOR</span>
            <div class="rc-color-row">${colorSwatches}</div>
          </div>
        </div>

        <div class="rc-agents-section" hidden>
          <div class="rc-agents-head">
            <span class="rc-label">AGENTS</span>
          </div>
          <div class="rc-agent-list"></div>
          <div class="rc-agent-form-wrap" hidden>
            <div class="rc-agent-form">
              <label class="rc-field">
                <span class="rc-label">AGENT NAME</span>
                <input class="rca-name" type="text" maxlength="24" placeholder="e.g. Aria">
              </label>
              <label class="rc-field">
                <span class="rc-label">TAG LINE</span>
                <input class="rca-tag" type="text" maxlength="24" placeholder="e.g. data analyst">
              </label>
              <label class="rc-field">
                <span class="rc-label">SYSTEM PROMPT</span>
                <textarea class="rca-prompt" rows="5" placeholder="Describe how this agent thinks and speaks…"></textarea>
              </label>
              <div class="rc-field">
                <span class="rc-label">APPEARANCE</span>
                <div class="rca-palette">${paletteSwatches}</div>
              </div>
              <div class="rc-agent-actions">
                <button class="rca-delete" type="button" hidden>DELETE AGENT</button>
                <button class="rca-cancel" type="button">BACK</button>
                <button class="rca-save" type="button">SAVE AGENT</button>
              </div>
            </div>
          </div>
        </div>

        <footer class="rc-foot">
          <span class="rc-status"></span>
          <div class="rc-actions">
            <button class="rc-delete" type="button" hidden>DELETE ROOM</button>
            <button class="rc-save" type="button">SAVE</button>
          </div>
        </footer>
      </div>
    `;

    // ---- room form events ----
    this.el.querySelector('.rc-cancel-btn')!.addEventListener('click', () => this.cb.onCancel());

    this.el.querySelectorAll<HTMLButtonElement>('.rc-color-swatch').forEach((s) => {
      s.addEventListener('click', () => {
        this.el.querySelectorAll('.rc-color-swatch').forEach((x) => x.classList.remove('selected'));
        s.classList.add('selected');
      });
    });
    this.el.querySelector<HTMLButtonElement>('.rc-color-swatch')?.classList.add('selected');

    this.el.querySelector('.rc-save')!.addEventListener('click', () => {
      const name = (this.el.querySelector<HTMLInputElement>('.rc-name')!.value).trim();
      if (!name) {
        const st = this.el.querySelector<HTMLElement>('.rc-status')!;
        st.textContent = 'room name is required';
        this.el.querySelector<HTMLInputElement>('.rc-name')?.focus();
        return;
      }
      const description = (this.el.querySelector<HTMLTextAreaElement>('.rc-desc')!.value).trim();
      const color = this.selectedColor();
      if (this.editingRoomId) {
        this.cb.onUpdate(this.editingRoomId, name, description, color);
      } else {
        this.cb.onSave(name, description, color);
      }
    });

    this.el.querySelector('.rc-delete')!.addEventListener('click', () => {
      if (!this.editingRoomId) return;
      const roomId = this.editingRoomId;
      const status = this.el.querySelector<HTMLElement>('.rc-status')!;
      if (status.dataset.confirming === 'true') {
        this.cb.onDelete(roomId);
      } else {
        status.textContent = 'click DELETE ROOM again to confirm';
        status.dataset.confirming = 'true';
        setTimeout(() => { status.textContent = ''; delete status.dataset.confirming; }, 4000);
      }
    });

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.cb.onCancel();
    });

    // ---- agent form events ----
    const form = this.el.querySelector<HTMLElement>('.rc-agent-form-wrap')!;

    this.el.querySelectorAll<HTMLButtonElement>('.rca-palette-swatch').forEach((s) => {
      s.addEventListener('click', () => {
        this.el.querySelectorAll('.rca-palette-swatch').forEach((x) => x.classList.remove('selected'));
        s.classList.add('selected');
      });
    });

    form.querySelector('.rca-cancel')!.addEventListener('click', () => {
      this.agentFormState = null;
      if (this.editingRoomId) this.renderAgentList();
      else this.hideAgentForm();
    });

    form.querySelector('.rca-save')!.addEventListener('click', () => {
      if (!this.editingRoomId) return;
      const name = (form.querySelector<HTMLInputElement>('.rca-name')!.value).trim();
      if (!name) {
        form.querySelector<HTMLInputElement>('.rca-name')?.focus();
        return;
      }
      const tag = (form.querySelector<HTMLInputElement>('.rca-tag')!.value).trim() || 'agent';
      const systemPrompt = (form.querySelector<HTMLTextAreaElement>('.rca-prompt')!.value).trim();
      const preset = parseInt(
        this.el.querySelector<HTMLButtonElement>('.rca-palette-swatch.selected')?.dataset.preset ?? '0',
        10,
      );
      const agentId = this.agentFormState === 'new' ? undefined : this.agentFormState ?? undefined;
      this.cb.onSaveAgent(this.editingRoomId, agentId, name, tag, systemPrompt, preset);
      // Will re-render when room_updated fires
    });

    form.querySelector('.rca-delete')!.addEventListener('click', () => {
      if (!this.editingRoomId || typeof this.agentFormState !== 'string' || this.agentFormState === 'new') return;
      this.cb.onDeleteAgent(this.editingRoomId, this.agentFormState);
    });
  }
}

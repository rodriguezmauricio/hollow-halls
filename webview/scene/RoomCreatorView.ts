/** Overlay form for creating or editing a custom room. */

export interface RoomCreatorCallbacks {
  readonly onSave: (name: string, description: string, accentColor: string) => void;
  readonly onUpdate: (roomId: string, name: string, description: string, accentColor: string) => void;
  readonly onDelete: (roomId: string) => void;
  readonly onCancel: () => void;
}

const PRESET_COLORS = [
  { label: 'cyan',   value: '#5ec8c0' },
  { label: 'orchid', value: '#9de0f0' },
  { label: 'amber',  value: '#e8a04a' },
  { label: 'plum',   value: '#9d7cd8' },
  { label: 'rose',   value: '#e07a95' },
  { label: 'gold',   value: '#e4c056' },
  { label: 'scarlet',value: '#d66c6c' },
  { label: 'sage',   value: '#7ec8a0' },
];

export class RoomCreatorView {
  readonly el: HTMLDivElement;
  private editingRoomId: string | null = null;

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
    this.reset();
    this.el.querySelector<HTMLElement>('.rc-title')!.textContent = 'NEW ROOM';
    const deleteBtn = this.el.querySelector<HTMLButtonElement>('.rc-delete');
    if (deleteBtn) deleteBtn.hidden = true;
    this.open();
  }

  /** Open in "edit existing room" mode. */
  openEdit(roomId: string, name: string, description: string, accentColor: string): void {
    this.editingRoomId = roomId;
    this.reset();
    this.el.querySelector<HTMLElement>('.rc-title')!.textContent = 'EDIT ROOM';
    const nameInput = this.el.querySelector<HTMLInputElement>('.rc-name')!;
    const descInput = this.el.querySelector<HTMLTextAreaElement>('.rc-desc')!;
    nameInput.value = name;
    descInput.value = description;
    this.selectColor(accentColor);
    const deleteBtn = this.el.querySelector<HTMLButtonElement>('.rc-delete');
    if (deleteBtn) deleteBtn.hidden = false;
    this.open();
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
    const nameInput = this.el.querySelector<HTMLInputElement>('.rc-name')!;
    const descInput = this.el.querySelector<HTMLTextAreaElement>('.rc-desc')!;
    nameInput.value = '';
    descInput.value = '';
    this.selectColor(PRESET_COLORS[0]!.value);
    const status = this.el.querySelector<HTMLElement>('.rc-status');
    if (status) status.textContent = '';
  }

  private selectColor(color: string): void {
    this.el.querySelectorAll<HTMLButtonElement>('.rc-color-swatch').forEach((s) => {
      s.classList.toggle('selected', s.dataset.color === color);
    });
    // If no preset matched, select the closest preset
    const found = this.el.querySelector<HTMLButtonElement>('.rc-color-swatch.selected');
    if (!found) {
      this.el.querySelector<HTMLButtonElement>('.rc-color-swatch')?.classList.add('selected');
    }
  }

  private selectedColor(): string {
    const selected = this.el.querySelector<HTMLButtonElement>('.rc-color-swatch.selected');
    return selected?.dataset.color ?? PRESET_COLORS[0]!.value;
  }

  private buildDOM(): void {
    const colorSwatches = PRESET_COLORS.map((c) => `
      <button type="button" class="rc-color-swatch" data-color="${c.value}" style="background: ${c.value}" aria-label="${c.label}"></button>
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
        <footer class="rc-foot">
          <span class="rc-status"></span>
          <div class="rc-actions">
            <button class="rc-delete" type="button" hidden>DELETE</button>
            <button class="rc-save" type="button">SAVE</button>
          </div>
        </footer>
      </div>
    `;

    this.el.querySelector('.rc-cancel-btn')!.addEventListener('click', () => this.cb.onCancel());

    this.el.querySelectorAll<HTMLButtonElement>('.rc-color-swatch').forEach((s) => {
      s.addEventListener('click', () => {
        this.el.querySelectorAll('.rc-color-swatch').forEach((x) => x.classList.remove('selected'));
        s.classList.add('selected');
      });
    });
    // Default select first
    this.el.querySelector<HTMLButtonElement>('.rc-color-swatch')?.classList.add('selected');

    this.el.querySelector('.rc-save')!.addEventListener('click', () => {
      const name = (this.el.querySelector<HTMLInputElement>('.rc-name')!.value).trim();
      if (!name) {
        const status = this.el.querySelector<HTMLElement>('.rc-status')!;
        status.textContent = 'room name is required';
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
      // Quick confirm via status line to avoid a separate modal
      const status = this.el.querySelector<HTMLElement>('.rc-status')!;
      if (status.dataset.confirming === 'true') {
        this.cb.onDelete(roomId);
      } else {
        status.textContent = 'click DELETE again to confirm';
        status.dataset.confirming = 'true';
        setTimeout(() => { status.textContent = ''; status.dataset.confirming = ''; }, 4000);
      }
    });

    // Close on backdrop click
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.cb.onCancel();
    });

    // Keyboard: Enter submits, Escape cancels
    this.el.querySelector<HTMLInputElement>('.rc-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.el.querySelector<HTMLButtonElement>('.rc-save')?.click(); }
      if (e.key === 'Escape') { e.preventDefault(); this.cb.onCancel(); }
    });
  }
}

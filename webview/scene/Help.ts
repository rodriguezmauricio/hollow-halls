/** Shared help-tooltip utility. One tooltip visible at a time.
 *  Click the trigger again to dismiss; click outside to dismiss. */

interface ActiveTip {
  el: HTMLElement;
  trigger: Element;
  dismiss: () => void;
}

let active: ActiveTip | null = null;

export function showHelp(trigger: HTMLElement, text: string): void {
  if (active?.trigger === trigger) {
    active.dismiss();
    return;
  }
  active?.dismiss();

  const el = document.createElement('div');
  el.className = 'help-tooltip';
  // Preserve newlines in help text as paragraph breaks.
  el.innerHTML = text
    .split('\n')
    .map((line) => `<span>${line}</span>`)
    .join('<br>');
  document.body.appendChild(el);

  const rect = trigger.getBoundingClientRect();
  const maxW = 280;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - maxW - 8));
  let top = rect.bottom + 8;
  if (top + 100 > window.innerHeight - 8) top = rect.top - 120;
  el.style.top = `${Math.max(8, top)}px`;
  el.style.left = `${left}px`;

  const onDoc = (e: MouseEvent) => {
    if (!el.contains(e.target as Node) && e.target !== trigger) dismiss();
  };

  const dismiss = () => {
    el.remove();
    document.removeEventListener('click', onDoc, true);
    if (active?.el === el) active = null;
  };

  active = { el, trigger, dismiss };
  setTimeout(() => document.addEventListener('click', onDoc, true));
}

export function makeHelpBtn(ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'help-btn';
  btn.textContent = '?';
  btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

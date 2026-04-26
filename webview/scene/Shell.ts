import { buildingSvg } from './Building';

export function mountShell(root: HTMLElement): void {
  root.innerHTML = `
    <div class="dust" id="dust" aria-hidden="true"></div>
    <div class="frame">
      <header class="site-header">
        <div class="brand">
          <div class="mark" aria-hidden="true"></div>
          <div>
            <h1>THE HOLLOW HALLS</h1>
            <div class="sub">a continuous office</div>
          </div>
        </div>
        <div class="meta">
          <div class="stat"><b id="stat-agents">—</b> agents vigilant</div>
          <div class="stat"><b id="stat-meetings">0</b> rites in progress</div>
        </div>
      </header>

      <div class="tagline">
        enter through the oracle
        <span class="pin">·</span> rooms attend their craft
        <span class="pin">·</span> the great hall convenes them all
        <span class="pin">·</span> the council advises
      </div>

      <div class="building-frame">${buildingSvg()}</div>

      <footer class="site-footer">
        <div>built on claude · your agents, your rooms</div>
        <div class="links">
          <span>DOCS</span><span>COMMUNITY</span><span>THEMES</span><span>GITHUB</span>
        </div>
      </footer>
    </div>
  `;

  scatterDust(root.querySelector<HTMLElement>('#dust'));
}

function scatterDust(container: HTMLElement | null): void {
  if (!container) return;
  const motes = 40;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < motes; i++) {
    const s = document.createElement('span');
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDuration = `${18 + Math.random() * 28}s`;
    s.style.animationDelay = `${-Math.random() * 20}s`;
    s.style.opacity = `${0.2 + Math.random() * 0.4}`;
    frag.appendChild(s);
  }
  container.appendChild(frag);
}

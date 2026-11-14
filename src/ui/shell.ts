/**
 * Nox assistant shell: one real 3D stage with optional drawing and advanced controls.
 * Presentation only. It rearranges existing controls (their IDs and handlers stay the same) and mirrors real
 * states that other modules already publish in the DOM: request pending, listening, preview open, running.
 * Animation here is CSS on the page clock and never touches the fixed-step physics clock.
 */
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const icon = (path: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const ICONS = {
  draw: icon('<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/>'),
  sketch: icon('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M6.5 15.5l3.5-4 3 3 2-2 2.5 3"/>'),
  library: icon('<path d="M5 4.5h4v15H5zM10.5 4.5h4v15h-4z"/><path d="M16 5.2l3.6-.9 3 14.6-3.6.8z" transform="translate(-2.4 0)"/>'),
  parts: icon('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  measure: icon('<path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/>'),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
};
/** Animated voice orb. Its state attribute is set only from real voice/request state. */
export const ORB = `<svg class="orb" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="orb-core" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e9fbff"/><stop offset=".35" stop-color="#7fd3e6"/><stop offset="1" stop-color="#0d3a4c" stop-opacity="0"/></radialGradient></defs>
  <circle class="orb-halo" cx="32" cy="32" r="30"/><g class="orb-ring r1"><ellipse cx="32" cy="32" rx="25" ry="10"/></g><g class="orb-ring r2"><ellipse cx="32" cy="32" rx="25" ry="10"/></g><g class="orb-ring r3"><ellipse cx="32" cy="32" rx="25" ry="10"/></g>
  <circle class="orb-arc" cx="32" cy="32" r="28" pathLength="100"/><circle class="orb-core" cx="32" cy="32" r="14" fill="url(#orb-core)"/></svg>`;

type Drawer = '' | 'library' | 'parts';

export function initShell(_host?: { openSource(): void }): void {
  const body = document.body, workspace = document.querySelector<HTMLElement>('.workspace')!, stage = document.querySelector<HTMLElement>('.stage')!;
  const wrap = document.querySelector<HTMLElement>('.viewport-wrap')!, inspector = document.querySelector<HTMLElement>('.inspector')!;
  const header = document.querySelector<HTMLElement>('.app-header')!, source = el<HTMLDialogElement>('source-dialog'), banner = el('preview-banner');
  body.classList.add('shell');

  // Header: brand, live status line, then file actions.
  header.querySelector('h1')!.innerHTML = `<span class="brand-orb" aria-hidden="true"></span>Nox`;
  const status = document.createElement('div'); status.className = 'hud-status';
  status.append(el('message'), el('error'), el('retry')); header.querySelector('.workspace-label')!.after(status);

  // Rail: the drawing surface, the source, drawers, measurements and the voice orb. Mobile shows it as a bottom bar.
  const rail = document.createElement('nav'); rail.id = 'hud-rail'; rail.setAttribute('aria-label', 'Nox tools');
  const tool = (button: HTMLElement, svg: string, label: string) => { button.classList.add('rail-button'); button.innerHTML = `${svg}<span>${label}</span>`; rail.append(button); return button; };
  tool(el('open-source'), ICONS.draw, 'Draw').classList.remove('primary');
  tool(el('view-source'), ICONS.sketch, 'Source');
  const drawerButton = (drawer: Drawer, svg: string, label: string, controls: string) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.drawer = drawer; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', controls);
    b.onclick = () => open(body.dataset.drawer === drawer ? '' : drawer); return tool(b, svg, label);
  };
  drawerButton('library', ICONS.library, 'Library', 'library-drawer');
  drawerButton('parts', ICONS.parts, 'Parts', 'parts-drawer');
  const measure = tool(el('show-analysis'), ICONS.measure, 'Measure');
  const voice = document.createElement('button'); voice.id = 'assistant-talk'; voice.type = 'button'; voice.classList.add('voice-button'); voice.innerHTML = `${ORB}<span>Talk</span>`; voice.setAttribute('aria-label', 'Talk to Nox'); rail.append(voice);
  voice.onclick = () => { if (source.open) source.close(); open(''); document.dispatchEvent(new CustomEvent('nox:talk')); };
  // Close the sketch before Measure's existing handler publishes its panel state.
  measure.addEventListener('click', () => { if (source.open) source.close(); }, { capture: true });
  workspace.prepend(rail);

  // Drawers: library (experiments, templates, replays) on the left, parts/inspector on the right.
  const library = document.createElement('aside'); library.id = 'library-drawer'; library.className = 'drawer drawer-left'; library.setAttribute('aria-label', 'Experiments and templates');
  library.innerHTML = `<div class="drawer-heading"><h2>Library</h2></div><p class="drawer-note">Your experiments, templates and labelled recorded experiments.</p>`;
  const motion = document.createElement('button'); motion.type = 'button'; motion.id = 'pause-motion';
  motion.textContent = 'Pause interface motion'; motion.setAttribute('aria-pressed', 'false');
  motion.onclick = () => { const paused = body.dataset.motion !== 'paused'; body.dataset.motion = paused ? 'paused' : ''; motion.setAttribute('aria-pressed', String(paused)); motion.textContent = paused ? 'Resume interface motion' : 'Pause interface motion'; };
  library.append(motion, document.querySelector('.experiment-bar')!); workspace.append(library);
  inspector.id = 'parts-drawer'; inspector.classList.add('drawer', 'drawer-right');
  for (const drawer of [library, inspector]) {
    const close = document.createElement('button'); close.type = 'button'; close.className = 'drawer-close'; close.innerHTML = ICONS.close; close.setAttribute('aria-label', 'Close panel');
    close.onclick = () => open(''); (drawer.querySelector('.drawer-heading, .inspector-heading') ?? drawer).append(close);
  }
  function open(drawer: Drawer): void {
    const previous = body.dataset.drawer;
    if (drawer && source.open) source.close();
    body.dataset.drawer = drawer;
    if (!drawer && previous && (previous === 'library' ? library : inspector).contains(document.activeElement)) rail.querySelector<HTMLElement>(`[data-drawer="${previous}"]`)?.focus();
    for (const b of rail.querySelectorAll<HTMLButtonElement>('[data-drawer]')) b.setAttribute('aria-expanded', String(b.dataset.drawer === drawer));
    // Move focus into the opened drawer; visibility switches with the attribute, and focus() applies styles first.
    if (drawer) (drawer === 'library' ? library : inspector).querySelector<HTMLElement>('select:not(:disabled), input:not(:disabled), button:not(:disabled):not(.drawer-close)')?.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !body.dataset.drawer || document.querySelector('dialog[open]:modal')) return;
    const from = body.dataset.drawer; open(''); rail.querySelector<HTMLElement>(`[data-drawer="${from}"]`)?.focus();
  });

  // Stage: the sketch, the review card and measurements all live over the same viewport.
  wrap.append(source); stage.append(banner);
  el('input-tools').hidden = true;

  // Real states → visual states.
  const state = () => {
    const thinking = !el('cancel-interpret').hidden, listening = el('hold-talk').getAttribute('aria-pressed') === 'true', processing = !el('cancel-command').hidden;
    source.dataset.state = thinking ? 'thinking' : '';
    el('scene').inert = source.open;
    if (source.open) {
      if (body.dataset.drawer) open('');
      el('analysis').hidden = true; el('show-analysis').setAttribute('aria-expanded', 'false');
    }
    const skip = document.querySelector<HTMLAnchorElement>('.skip')!;
    skip.href = source.open ? '#sketch' : '#scene'; skip.textContent = source.open ? 'Skip to drawing' : 'Skip to 3D experiment';
    const orb = listening ? 'listening' : processing ? 'processing' : el<HTMLDialogElement>('command-dialog').open ? 'open' : '';
    for (const o of document.querySelectorAll('#command-dialog .orb')) o.setAttribute('data-state', orb);
    stage.dataset.mode = source.open ? 'draw' : !banner.hidden ? 'review' : el('mode').textContent ?? '';
  };
  const watch = new MutationObserver(state);
  for (const id of ['cancel-interpret', 'cancel-command', 'hold-talk', 'preview-banner', 'command-dialog', 'source-dialog']) watch.observe(el(id), { attributes: true, attributeFilter: ['hidden', 'aria-pressed', 'open'] });
  watch.observe(el('mode'), { childList: true, characterData: true, subtree: true });

  // The command dialog carries the same orb, so listening/processing is visible where the user is speaking.
  el('command-title').insertAdjacentHTML('beforebegin', ORB);

  // Sketch → 3D: when an interpretation closes the sketch and opens the review, the drawing dissolves into the scene.
  source.addEventListener('close', () => {
    if (banner.hidden) return;
    const photo = el<HTMLImageElement>('photo-preview'), sketch = el<HTMLCanvasElement>('sketch');
    const ghost = document.createElement('canvas'); ghost.className = 'sketch-ghost'; ghost.width = 1600; ghost.height = 900; ghost.setAttribute('aria-hidden', 'true');
    const ctx = ghost.getContext('2d');
    if (ctx) { if (!el('photo-area').hidden && !photo.hidden && photo.complete && photo.naturalWidth) { const s = Math.min(1600 / photo.naturalWidth, 900 / photo.naturalHeight); ctx.drawImage(photo, (1600 - photo.naturalWidth * s) / 2, (900 - photo.naturalHeight * s) / 2, photo.naturalWidth * s, photo.naturalHeight * s); } else ctx.drawImage(sketch, 0, 0); }
    wrap.append(ghost); wrap.classList.remove('reveal'); void wrap.offsetWidth; wrap.classList.add('reveal');
    const done = () => { ghost.remove(); wrap.classList.remove('reveal'); };
    ghost.addEventListener('animationend', done, { once: true }); setTimeout(done, 1600);
  });

  // Selecting a part in the 3D view opens its numbers.
  let lastSelected = el<HTMLSelectElement>('objects').value;
  el('scene').addEventListener('pointerup', () => setTimeout(() => {
    const now = el<HTMLSelectElement>('objects').value;
    if (now && now !== lastSelected && !source.open) open('parts');
    lastSelected = now;
  }, 0));

  open(''); state();
  // Conversation starts over the real stage; Draw remains an optional tool.
}

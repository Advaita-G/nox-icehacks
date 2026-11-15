export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
export interface AssistantPanelHost {
  onStart(): void | Promise<void>;
  onStop(): void | Promise<void>;
  onSend(text: string): void | Promise<void>;
  isVoiceActive?(): boolean;
  onPhoto?(file: File): void | Promise<void>;
}

export function initAssistantPanel(host: AssistantPanelHost) {
  const stage = document.querySelector<HTMLElement>('.stage');
  if (!stage) throw new Error('The Nox stage is not ready.');
  const panel = document.createElement('section');
  panel.id = 'assistant-panel'; panel.className = 'assistant-panel';
  panel.setAttribute('aria-label', 'Nox voice assistant'); panel.dataset.state = 'idle';
  panel.innerHTML = [
    '<div class="assistant-presence"><button id="assistant-start" class="nox-presence" type="button" aria-label="Speak to Nox" aria-describedby="assistant-state"><span class="nox-figure"><span id="assistant-title" class="nox-wordmark">Nox</span><span class="nox-mark" aria-hidden="true"><span class="nox-incline"><span class="nox-ground"><span class="nox-trace"></span></span><span class="nox-ball"><i></i></span></span></span></span></button><span id="assistant-state" class="assistant-state" role="status" aria-live="polite">Click to speak</span><p class="assistant-hint">Say “make a ramp with a ball”, or show me a drawing.</p></div>',
    '<div class="assistant-conversation"><p id="assistant-caption" class="assistant-caption" aria-live="polite" hidden></p><p id="assistant-detail" class="assistant-detail" hidden></p></div>',
    '<div class="assistant-session"><div class="assistant-photo-actions"><label class="assistant-file assistant-camera" title="Take a picture of your drawing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l1.5-2h5L16 5h4v15H4V5z"/><circle cx="12" cy="12" r="4"/></svg><span>Camera</span><input id="assistant-camera" class="visually-hidden" type="file" accept="image/*" capture="environment"></label><label class="assistant-file" title="Add a drawing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>Add drawing</span><input id="assistant-upload" class="visually-hidden" type="file" accept="image/*"></label></div><button id="assistant-stop" type="button" aria-label="Stop listening"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg><span>Stop</span></button></div>',
    '<p id="assistant-photo-help" class="assistant-photo-help">You can also drop or paste your drawing.</p>',
    '<div class="assistant-options"><button id="assistant-keyboard" type="button" aria-label="Use keyboard" aria-controls="assistant-compose" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m3 0h1m3 0h1m3 0h0M6 13h1m3 0h1m3 0h1m3 0h0M7 16h10"/></svg><span class="visually-hidden">Use keyboard</span></button><details class="assistant-history"><summary aria-label="Conversation history">Conversation</summary><ol id="assistant-transcript" role="log" aria-label="Recent conversation" aria-live="off" tabindex="0"></ol></details></div>',
    '<form id="assistant-compose" class="assistant-compose" hidden><label for="assistant-text" class="visually-hidden">Talk to Nox by typing</label><input id="assistant-text" type="text" placeholder="Tell Nox what to build…" autocomplete="off" maxlength="4000"><button type="submit" aria-label="Send request">Send</button></form>'
  ].join('');
  stage.append(panel);
  const workspace = stage.closest<HTMLElement>('.workspace') ?? stage;
  const start = panel.querySelector<HTMLButtonElement>('#assistant-start')!, stop = panel.querySelector<HTMLButtonElement>('#assistant-stop')!;
  const status = panel.querySelector<HTMLElement>('#assistant-state')!, caption = panel.querySelector<HTMLElement>('#assistant-caption')!;
  const detail = panel.querySelector<HTMLElement>('#assistant-detail')!, transcript = panel.querySelector<HTMLOListElement>('#assistant-transcript')!;
  const form = panel.querySelector<HTMLFormElement>('form')!, input = panel.querySelector<HTMLInputElement>('#assistant-text')!;
  const keyboard = panel.querySelector<HTMLButtonElement>('#assistant-keyboard')!, source = document.querySelector<HTMLDialogElement>('#source-dialog');
  let state: AssistantState = 'idle', starting = false, photoSequence = 0, hasScene = false;
  const measure = () => workspace.style.setProperty('--assistant-height', Math.ceil(panel.getBoundingClientRect().height) + 'px');
  const size = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  const syncInert = () => { const canvas = document.querySelector<HTMLElement>('#scene'); if (canvas) canvas.inert = !!source?.open || document.body.dataset.room !== 'experiment'; };
  const sourceWatch = new MutationObserver(() => {
    syncInert();
    if (!source?.open && document.body.dataset.room === 'checking' && panel.dataset.photo !== 'checking') room(hasScene ? 'experiment' : 'conversation');
  });
  if (source) sourceWatch.observe(source, { attributes: true, attributeFilter: ['open'] });
  const back = source?.querySelector<HTMLButtonElement>('#close-source');
  if (back) { back.textContent = 'Back to Nox'; back.setAttribute('aria-label', 'Close drawing and return to Nox'); }
  function room(next: 'arrival' | 'conversation' | 'checking' | 'experiment'): void { document.body.dataset.room = next; syncInert(); measure(); }
  room('arrival'); size?.observe(panel);
  const labels: Record<AssistantState, string> = { idle: 'Click to speak', listening: 'Listening', thinking: 'Working on it', speaking: 'Nox is speaking', error: 'Let’s try that again' };
  let wordFallback: ReturnType<typeof setTimeout> | undefined;
  function setState(next: AssistantState, explanation = ''): void {
    state = next; panel.dataset.state = next;
    const active = host.isVoiceActive?.() ?? (next === 'listening' || next === 'speaking');
    status.textContent = next === 'thinking' && panel.dataset.photo === 'checking' ? 'Reading your drawing' : next === 'idle' && active ? 'In conversation' : labels[next];
    detail.textContent = explanation; detail.hidden = !explanation;
    start.disabled = starting || active;
    stop.hidden = !active && next !== 'thinking' && panel.dataset.photo !== 'checking';
    // Some voices never report word boundaries; then a plain speaking cadence marks the state, not individual words.
    if (next === 'speaking' && !wordFallback && !panel.dataset.cadence) wordFallback = setTimeout(() => { wordFallback = undefined; if (panel.dataset.state === 'speaking') panel.dataset.cadence = 'true'; }, 700);
    if (next !== 'speaking') { clearTimeout(wordFallback); wordFallback = undefined; delete panel.dataset.cadence; }
  }
  function open(): void { if (document.body.dataset.room === 'arrival') room('conversation'); }
  function append(role: 'user' | 'assistant', text: string, failed = false): void {
    if (!text.trim()) return;
    open();
    const item = document.createElement('li'), speaker = document.createElement('strong'), message = document.createElement('p');
    item.dataset.role = role; speaker.textContent = role === 'user' ? 'You' : 'Nox'; message.textContent = text;
    if (failed) item.className = 'assistant-failure';
    item.append(speaker, message); transcript.append(item); panel.dataset.conversation = 'active';
    caption.textContent = text; caption.hidden = false; caption.dataset.speaker = role; caption.classList.toggle('assistant-failure', failed);
    while (transcript.children.length > 30) transcript.firstElementChild!.remove();
    transcript.scrollTop = transcript.scrollHeight; measure();
  }
  function showKeyboard(show = true): void {
    form.hidden = !show; keyboard.setAttribute('aria-expanded', String(show));
    if (show) { open(); input.focus({ preventScroll: true }); }
    measure();
  }
  function error(text: string): void {
    setState('error'); append('assistant', text, true);
    if (!host.isVoiceActive?.() && /microphone|speech|voice is unavailable/i.test(text)) showKeyboard();
  }
  const failure = (cause: unknown) => error(cause instanceof Error ? cause.message : String(cause));
  async function receivePhoto(file: File): Promise<void> {
    if (!host.onPhoto) { error('Drawing input is unavailable in this session.'); return; }
    const sequence = ++photoSequence;
    panel.dataset.photo = 'checking'; room('checking');
    try { await host.onPhoto(file); }
    catch (cause) { if (sequence === photoSequence) failure(cause); }
    finally { if (sequence === photoSequence) {
      delete panel.dataset.photo;
      if (!source?.open) room(hasScene ? 'experiment' : 'conversation');
      setState(state, detail.textContent ?? '');
    } }
  }
  for (const picker of panel.querySelectorAll<HTMLInputElement>('.assistant-photo-actions input')) picker.onchange = () => {
    const file = picker.files?.[0]; picker.value = ''; if (file) void receivePhoto(file);
  };
  const imageTransfer = (transfer: DataTransfer | null) => [...(transfer?.files ?? [])].find(file => file.type.startsWith('image/'));
  const paste = (event: ClipboardEvent) => { const file = imageTransfer(event.clipboardData); if (file) { event.preventDefault(); void receivePhoto(file); } };
  const dragover = (event: DragEvent) => { if ([...(event.dataTransfer?.items ?? [])].some(item => item.kind === 'file' && item.type.startsWith('image/'))) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; } };
  const drop = (event: DragEvent) => { const file = imageTransfer(event.dataTransfer); if (file) { event.preventDefault(); void receivePhoto(file); } };
  document.addEventListener('paste', paste); stage.addEventListener('dragover', dragover); stage.addEventListener('drop', drop);
  start.onclick = async () => {
    if (starting || start.disabled) return;
    open(); starting = true; start.disabled = true;
    try { await host.onStart(); } catch (cause) { failure(cause); }
    finally { starting = false; setState(state, detail.textContent ?? ''); }
  };
  stop.onclick = async () => { try { await host.onStop(); } catch (cause) { failure(cause); } };
  keyboard.onclick = () => showKeyboard(!!form.hidden);
  form.onsubmit = async event => {
    event.preventDefault(); const text = input.value.trim(); if (!text) return; input.value = '';
    try { await host.onSend(text); } catch (cause) { if (!input.value) input.value = text; failure(cause); }
  };
  function setSceneAvailable(available: boolean): void {
    hasScene = available;
    if (panel.dataset.photo === 'checking' && source?.open) return;
    if (available) room('experiment');
    else if (document.body.dataset.room !== 'arrival' && !source?.open) room('conversation');
  }
  // Nox's period is a ball on a drawn line. It moves only from real signals: recognizer speech start/end (hearing),
  // spoken word boundaries (word), request/voice state (data-state) and an explicit stop (interrupt). No level is faked.
  const ball = panel.querySelector<HTMLElement>('.nox-ball i')!;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.dataset.motion === 'paused';
  function hearing(active: boolean): void { if (active) panel.dataset.hearing = 'true'; else delete panel.dataset.hearing; }
  function word(): void {
    clearTimeout(wordFallback); wordFallback = undefined; delete panel.dataset.cadence;
    if (still() || typeof ball.animate !== 'function') return;
    ball.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-0.11em)', offset: 0.4 }, { transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
  function interrupt(): void {
    delete panel.dataset.hearing; delete panel.dataset.cadence; clearTimeout(wordFallback); wordFallback = undefined;
    if (still() || typeof ball.animate !== 'function') return;
    ball.getAnimations().forEach(animation => animation.cancel());
    ball.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(0.14em)', opacity: 0.35, offset: 0.45 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
  // Arrival, once: the ground line draws in and the ball drops onto it as Nox's period. Nothing loops afterwards.
  function arrive(): void {
    if (still() || typeof ball.animate !== 'function') return;
    panel.querySelector<HTMLElement>('.nox-ground')!.animate([{ transform: 'scaleX(0)', transformOrigin: '0 50%' }, { transform: 'scaleX(1)', transformOrigin: '0 50%' }], { duration: 520, delay: 120, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
    ball.animate([
      { transform: 'translateY(-1.4em)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1, offset: 0.55, easing: 'cubic-bezier(0.33, 0, 0.67, 0)' },
      { transform: 'translateY(-0.18em)', offset: 0.74, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
      { transform: 'translateY(0)', offset: 0.88, easing: 'cubic-bezier(0.33, 0, 0.67, 0)' },
      { transform: 'translateY(-0.04em)', offset: 0.95 },
      { transform: 'translateY(0)' },
    ], { duration: 900, delay: 520, fill: 'backwards' });
  }
  if (document.body.dataset.ready === 'ready') arrive();
  else { const ready = new MutationObserver(() => { if (document.body.dataset.ready === 'ready') { ready.disconnect(); arrive(); } }); ready.observe(document.body, { attributes: true, attributeFilter: ['data-ready'] }); }
  setState('idle');
  return {
    setState, hearing, word, interrupt, setSceneAvailable, say: (text: string) => append('assistant', text), heard: (text: string) => append('user', text), error, open,
    destroy: () => { photoSequence++; clearTimeout(wordFallback); size?.disconnect(); sourceWatch.disconnect(); document.removeEventListener('paste', paste); stage.removeEventListener('dragover', dragover); stage.removeEventListener('drop', drop); panel.remove(); workspace.style.removeProperty('--assistant-height'); delete document.body.dataset.room; }
  };
}

import { ORB } from '../ui/shell.ts';

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
  panel.setAttribute('aria-labelledby', 'assistant-title'); panel.dataset.state = 'idle';
  panel.innerHTML = `
    <header class="assistant-heading"><div class="assistant-identity">${ORB.replace('id="orb-core"', 'id="assistant-orb-core"').replace('url(#orb-core)', 'url(#assistant-orb-core)')}<h2 id="assistant-title">Nox</h2><span id="assistant-state" role="status" aria-live="polite">Ready</span></div>
      <details class="assistant-help"><summary>Voice setup</summary><p>Choose Talk to Nox and allow your microphone once to start the conversation. Then speak naturally between replies. Your browser may ask again. Speech uses your browser’s service; support varies. You can always type instead. Stop listening ends voice input.</p></details>
    </header>
    <p class="assistant-guide">Start with a photo of your paper drawing. Nox checks it, builds the 3D experiment, then you can talk to change it.</p>
    <div class="assistant-photo-actions"><label class="assistant-file assistant-camera">Take a photo<input id="assistant-camera" class="visually-hidden" type="file" accept="image/*" capture="environment" aria-describedby="assistant-photo-help"></label><label class="assistant-file">Upload drawing<input id="assistant-upload" class="visually-hidden" type="file" accept="image/*" aria-describedby="assistant-photo-help"></label></div>
    <p id="assistant-photo-help" class="assistant-photo-help">JPG, PNG, WebP or AVIF. If your camera uses HEIC, choose or export a JPEG.</p>
    <p id="assistant-detail" class="assistant-detail" hidden></p>
    <div class="assistant-controls"><button id="assistant-start" class="primary" type="button" aria-describedby="assistant-permission">Talk to Nox</button><button id="assistant-stop" type="button">Stop listening</button></div>
    <p id="assistant-permission" class="assistant-permission">Start once and allow your microphone. Then speak naturally.</p>
    <ol id="assistant-transcript" class="assistant-transcript" role="log" aria-label="Recent conversation" aria-live="polite" aria-relevant="additions" tabindex="0" hidden></ol>
    <form class="assistant-compose"><label for="assistant-text" class="visually-hidden">Talk to Nox by typing</label><input id="assistant-text" type="text" placeholder="Or type a request…" autocomplete="off" maxlength="4000"><button type="submit">Send<span class="visually-hidden"> request</span></button></form>`;
  stage.append(panel);
  const workspace = stage.closest<HTMLElement>('.workspace') ?? stage;
  const measure = () => workspace.style.setProperty('--assistant-height', `${panel.offsetHeight}px`);
  const size = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
  size?.observe(panel); measure();
  const start = panel.querySelector<HTMLButtonElement>('#assistant-start')!;
  const stop = panel.querySelector<HTMLButtonElement>('#assistant-stop')!;
  const status = panel.querySelector<HTMLElement>('#assistant-state')!;
  const detail = panel.querySelector<HTMLElement>('#assistant-detail')!;
  const transcript = panel.querySelector<HTMLOListElement>('#assistant-transcript')!;
  const form = panel.querySelector<HTMLFormElement>('form')!;
  const input = panel.querySelector<HTMLInputElement>('#assistant-text')!;
  let state: AssistantState = 'idle', starting = false, photoSequence = 0;
  const labels: Record<AssistantState, string> = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', error: 'Needs attention' };
  function setState(next: AssistantState, explanation = ''): void {
    state = next; panel.dataset.state = next; status.textContent = next === 'thinking' && panel.dataset.photo === 'checking' ? 'Checking' : labels[next];
    detail.textContent = explanation; detail.hidden = !explanation;
    start.disabled = starting || (host.isVoiceActive?.() ?? (next === 'listening' || next === 'thinking' || next === 'speaking'));
    const orbState = next === 'thinking' ? 'processing' : next;
    for (const orb of panel.querySelectorAll('.orb')) orb.setAttribute('data-state', orbState);
    document.querySelector('#assistant-talk .orb')?.setAttribute('data-state', orbState);
  }
  function append(role: 'user' | 'assistant', text: string, failed = false): void {
    if (!text.trim()) return;
    const item = document.createElement('li'), speaker = document.createElement('strong'), message = document.createElement('p');
    item.dataset.role = role; speaker.textContent = role === 'user' ? 'You' : 'Nox'; message.textContent = text;
    if (failed) { item.className = 'assistant-failure'; item.setAttribute('role', 'alert'); }
    item.append(speaker, message); transcript.append(item); transcript.hidden = false; panel.dataset.conversation = 'active';
    while (transcript.children.length > 30) transcript.firstElementChild!.remove();
    transcript.scrollTop = transcript.scrollHeight;
  }
  function error(text: string): void { setState('error'); append('assistant', text, true); }
  const failure = (cause: unknown) => error(cause instanceof Error ? cause.message : String(cause));
  for (const picker of panel.querySelectorAll<HTMLInputElement>('.assistant-photo-actions input')) picker.onchange = async () => {
    const file = picker.files?.[0]; picker.value = '';
    if (!file) return;
    const sequence = ++photoSequence;
    if (!host.onPhoto) { error('Photo input is unavailable in this session. You can still type or talk to Nox.'); return; }
    panel.dataset.photo = 'checking';
    try { await host.onPhoto(file); }
    catch (cause) { if (sequence === photoSequence) failure(cause); }
    finally { if (sequence === photoSequence) { delete panel.dataset.photo; setState(state, detail.textContent ?? ''); } }
  };
  start.onclick = async () => {
    if (starting || start.disabled) return;
    starting = true; start.disabled = true;
    try { await host.onStart(); } catch (cause) { failure(cause); }
    finally { starting = false; setState(state, detail.textContent ?? ''); }
  };
  stop.onclick = async () => { try { await host.onStop(); } catch (cause) { failure(cause); } };
  form.onsubmit = async event => {
    event.preventDefault(); const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try { await host.onSend(text); }
    catch (cause) { if (!input.value) input.value = text; failure(cause); }
  };
  function open(): void { panel.hidden = false; }
  return { setState, say: (text: string) => append('assistant', text), heard: (text: string) => append('user', text), error, open, destroy: () => { photoSequence++; size?.disconnect(); panel.remove(); workspace.style.removeProperty('--assistant-height'); } };
}

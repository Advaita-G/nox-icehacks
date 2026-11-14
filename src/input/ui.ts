import { StrokeStore } from '../../packages/input/src/source/strokes.ts';
import type { Point } from '../../packages/input/src/source/strokes.ts';
import { drawStrokes, exportSketchPng } from '../../packages/input/src/ui/render.ts';
import { prepareImage } from '../../packages/input/src/source/image.ts';
import { RequestManager, sameTarget } from '../../packages/input/src/requests/manager.ts';
import type { TargetToken } from '../../packages/input/src/contract/types.ts';
import { postModel } from '../../packages/input/src/provider/client.ts';
import { PressToTalk, browserRecognitionFactory } from '../../packages/input/src/voice/pressToTalk.ts';
import { Workbench } from '../physics/experiments.ts';
import type { SourceAsset } from '../physics/experiments.ts';
import { Physics } from '../physics/engine.ts';
import { applyCommands, check } from '../physics/scene.ts';
import { mergeAnswers } from './answers.ts';
import { parseCommand, parseInterpretation, REQUEST_TIMEOUTS } from './contract.ts';
import type { Clarification, CommandProposal } from './contract.ts';
import { manualCommand } from './manual.ts';
import { describeChanges } from './changes.ts';
import { Preview } from './preview.ts';
import { isUndoStroke } from './shortcuts.ts';

interface Host {
  state(): { bench: Workbench; selectedId: string; dirty: boolean };
  show(bench: Workbench, dirty: boolean, selectedId: string): void;
  changed(): void;
  onPhotoReady?(): void | Promise<void>;
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const message = (id: string, value: unknown) => { el(id).textContent = value instanceof Error ? value.message : String(value); };
type Answer = { question: string; answer: string };
type WordsReply = { message: string; reviewRequired: boolean; changes: string[] };

export class InputUI {
  private strokes = new StrokeStore(crypto.randomUUID());
  private mode: 'canvas' | 'photo' = 'canvas';
  private photo?: { id: string; image: string; widthPx: number; heightPx: number };
  private revision = 0;
  private epoch = 0;
  private lastContext = '';
  private photoSequence = 0;
  private photoLoading = false;
  private requests = new RequestManager(() => this.target(), { timeouts: REQUEST_TIMEOUTS });
  private preview?: { draft: Preview; dirty: boolean; selected: string; sourceRevision: number };
  private proposal?: { value: CommandProposal; target: TargetToken; context: Workbench['commandContext'] };
  private sketchAnswers: Answer[] = [];
  private commandAnswers: Answer[] = [];
  private voice: PressToTalk;
  private wordsClosed: Promise<void> = Promise.resolve();
  private wordsRevision = 0;
  get active(): boolean { return !!this.preview; }

  constructor(private host: Host) {
    el('input-tools').innerHTML = `<div><strong>From an idea to an experiment</strong><p>Draw parts and connections, or describe a change.</p></div><div class="input-actions"><button id="open-source" class="primary">Draw or upload</button><button id="open-command">Change with words</button><button id="view-source" hidden>Original sketch</button></div>`;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="source-dialog" class="input-dialog sketch-stage" aria-labelledby="source-title"><div class="dialog-heading"><div><h2 id="source-title">Sketch a physical idea</h2><p>A rough drawing is enough. Add the size and what should move.</p></div><button id="close-source" aria-label="Close sketch and show the 3D scene">3D view</button></div>
      <div class="source-switch"><button id="use-canvas" aria-pressed="true">Draw</button><button id="use-photo" aria-pressed="false">Upload photo</button><button id="undo-stroke">Undo</button><button id="clear-strokes">Clear</button></div>
      <div class="sketch-surface"><canvas id="sketch" tabindex="0" width="1600" height="900" aria-label="Draw your physical sketch with a pointer. Photo upload is also available."></canvas>
      <div id="photo-area" hidden><label>Drawing or photo<input id="photo-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif"></label><img id="photo-preview" alt="Your normalized sketch" hidden></div><div class="scan" aria-hidden="true"></div></div>
      <div class="sketch-panel"><label>What should happen? Include dimensions you know.<textarea id="source-notes" maxlength="4000" rows="2" placeholder="A 1-meter fan blows toward a lightweight cart. The fan is powered; the cart is free to move."></textarea></label>
      <div id="sketch-questions" class="questions"></div><p id="source-status" role="status" aria-live="polite"></p><p id="provider-status"></p><div class="dialog-actions"><button id="interpret" class="primary">Build 3D preview</button><button id="cancel-interpret" hidden>Cancel request</button></div></div></dialog>
      <dialog id="command-dialog" class="input-dialog command-dialog" aria-labelledby="command-title"><div class="dialog-heading"><h2 id="command-title">Change your experiment</h2><button id="close-command">Close</button></div>
      <p id="command-selection"></p><label>Your command<textarea id="command-text" maxlength="4000" rows="3" placeholder="Make this part twice as heavy, or add a spring between the cart and support."></textarea></label>
      <div class="input-actions"><button id="hold-talk">Hold to speak</button><button id="review-command" class="primary">Review change</button><button id="cancel-command" hidden>Cancel request</button></div><p id="voice-status">Speech uses your browser’s speech service. Review the transcript before sending.</p>
      <div id="command-questions" class="questions"></div><p id="command-status" role="status" aria-live="polite"></p><ul id="command-changes"></ul><button id="apply-command" class="primary" disabled>Apply change</button><details><summary>Manual commands work offline</summary><p>Use the selected part: set this mass x2 · move this 3 2 · rotate this 30 · velocity this 2 0 · gravity -9.81 · reset. Move and velocity retain depth.</p></details></dialog>
      <dialog id="original-dialog" class="input-dialog" aria-labelledby="original-title"><div class="dialog-heading"><h2 id="original-title">Original sketch</h2><button id="close-original">Close</button></div><img id="original-image" alt="Original sketch used to create this experiment"><p id="original-notes"></p><ul id="original-explanations"></ul></dialog>`);
    this.voice = new PressToTalk(browserRecognitionFactory(), {
      onInterim: text => message('voice-status', text),
      onFinal: text => { el<HTMLTextAreaElement>('command-text').value = text; this.commandChanged(); message('voice-status', 'Transcript ready. Review it, then choose Review change.'); },
      onError: (_code, text) => message('voice-status', text),
      onStateChange: listening => { el('hold-talk').setAttribute('aria-pressed', String(listening)); if (listening) message('voice-status', 'Listening while held…'); },
    });
    el<HTMLButtonElement>('hold-talk').disabled = !this.voice.supported;
    if (!this.voice.supported) message('voice-status', 'Speech is unavailable in this browser. Type your command.');
    el('open-source').onclick = () => { this.pause(); this.openSource(); };
    el('close-source').onclick = () => el<HTMLDialogElement>('source-dialog').close();
    el<HTMLDialogElement>('source-dialog').onclose = () => { this.requests.cancel('sketch'); this.sync(); };
    el('use-canvas').onclick = () => this.switchSource('canvas'); el('use-photo').onclick = () => this.switchSource('photo');
    el('undo-stroke').onclick = () => { if (this.strokes.undo()) this.sourceChanged(); this.paint(); };
    el('source-dialog').addEventListener('keydown', event => {
      // The sketch opens in place over the 3D view (non-modal), so Escape is handled here rather than by the browser.
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); el<HTMLDialogElement>('source-dialog').close(); el('open-source').focus(); return; }
      const undo = el<HTMLButtonElement>('undo-stroke');
      if (undo.hidden || undo.disabled || !isUndoStroke(event, event.target)) return;
      event.preventDefault(); undo.click();
    });
    el('clear-strokes').onclick = () => { this.strokes.clear(); this.sourceChanged(); this.paint(); };
    el<HTMLTextAreaElement>('source-notes').oninput = () => this.sourceChanged();
    el<HTMLInputElement>('photo-file').onchange = () => { void this.loadPhoto().catch(error => message('source-status', error)); };
    el('interpret').onclick = () => void this.interpret(); el('cancel-interpret').onclick = () => this.requests.cancel('sketch');
    el('open-command').onclick = () => { this.pause(); const state = this.host.state(), part = state.bench.scene.objects.find(o => o.id === state.selectedId); message('command-selection', part ? `Selected: ${part.label} (${part.id})` : 'No part selected. Name the part in your command.'); this.commandChanged(); el<HTMLDialogElement>('command-dialog').showModal(); };
    el('close-command').onclick = () => el<HTMLDialogElement>('command-dialog').close();
    el<HTMLDialogElement>('command-dialog').onclose = () => { this.voice.cancel(); this.requests.cancel('command'); this.proposal = undefined; this.sync(); };
    el<HTMLTextAreaElement>('command-text').oninput = () => this.commandChanged();
    el('review-command').onclick = () => void this.command(); el('cancel-command').onclick = () => this.requests.cancel('command');
    el('apply-command').onclick = () => this.apply();
    const talk = el('hold-talk');
    talk.onpointerdown = event => { event.preventDefault(); talk.setPointerCapture(event.pointerId); this.voice.press(); };
    talk.onpointerup = talk.onpointercancel = talk.onlostpointercapture = () => this.voice.release();
    talk.onkeydown = event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); this.voice.press(); } };
    talk.onkeyup = event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); this.voice.release(); } };
    talk.onblur = () => this.voice.release();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.voice.cancel(); });
    el('confirm-preview').onclick = () => this.finishPreview(true); el('cancel-preview').onclick = () => this.finishPreview(false);
    el('view-source').onclick = () => { const source = this.host.state().bench.experiment.source; if (!source) return; el<HTMLImageElement>('original-image').src = source.image; message('original-notes', source.notes); this.list('original-explanations', source.explanations); el<HTMLDialogElement>('original-dialog').showModal(); };
    el('close-original').onclick = () => el<HTMLDialogElement>('original-dialog').close();
    this.bindCanvas(); this.paint(); this.sync();
  }
  /** Show the drawing surface in place over the 3D stage. Opening it alone does not change the experiment. */
  openSource(): void { el<HTMLDialogElement>('source-dialog').show(); this.paint(); void this.providerStatus(); }
  async receivePhoto(file: File): Promise<void> {
    check(file, 'Choose a photo file first.');
    await this.loadPhoto(file);
  }
  async reviewWords(text: string): Promise<WordsReply> {
    check(text.trim() && text.length <= 4000, 'Use a command of at most 4000 characters.');
    await this.wordsClosed;
    if ([...el('sketch-questions').querySelectorAll<HTMLInputElement>('input')].some(input => !input.value.trim())) return this.buildPreviewWords(text);
    check(!this.preview, 'Confirm or cancel the 3D preview before describing another change.');
    const revision = ++this.wordsRevision, dialog = el<HTMLDialogElement>('command-dialog');
    if (!dialog.open) dialog.show();
    const unanswered = [...el('command-questions').querySelectorAll<HTMLInputElement>('input')].filter(input => !input.value.trim());
    if (unanswered.length) {
      check(text.length <= 2000, 'Use an answer of at most 2000 characters.');
      unanswered[0]!.value = text.trim(); unanswered[0]!.dispatchEvent(new Event('input'));
      if (unanswered.length > 1) return { message: unanswered[1]!.dataset.question!, reviewRequired: false, changes: [] };
    } else { el<HTMLTextAreaElement>('command-text').value = text; this.commandChanged(); }
    await this.command();
    check(revision === this.wordsRevision, 'The request was cancelled. Nothing was applied.');
    const questions = [...el('command-questions').querySelectorAll<HTMLInputElement>('input')].filter(input => !input.value.trim()).map(input => input.dataset.question!);
    const changes = [...el('command-changes').querySelectorAll('li')].map(item => item.textContent ?? '');
    const status = el('command-status').textContent || 'No change was proposed.';
    check(this.proposal || questions.length, status);
    return { message: questions.length ? `${status} ${questions.join(' ')}` : status, reviewRequired: !!this.proposal, changes };
  }
  applyWords(): { message: string } {
    this.sync(); const dialog = el<HTMLDialogElement>('command-dialog');
    check(dialog.open && this.proposal, 'There is no current reviewed change. Review it again before applying.');
    const closed = new Promise<void>(resolve => dialog.addEventListener('close', () => resolve(), { once: true }));
    this.apply();
    check(!dialog.open && !this.proposal, el('command-status').textContent || 'The reviewed change could not be applied.');
    this.wordsClosed = closed;
    return { message: 'Applied the reviewed change.' };
  }
  async buildPreviewWords(answer?: string): Promise<WordsReply> {
    await this.wordsClosed;
    check(!this.preview, 'Confirm or cancel the current 3D preview first.');
    const revision = ++this.wordsRevision;
    const unanswered = [...el('sketch-questions').querySelectorAll<HTMLInputElement>('input')].filter(input => !input.value.trim());
    if (answer !== undefined) {
      check(unanswered.length && answer.trim() && answer.length <= 2000, 'Answer the current sketch question in at most 2000 characters.');
      unanswered[0]!.value = answer.trim(); unanswered[0]!.dispatchEvent(new Event('input'));
      if (unanswered.length > 1) return { message: unanswered[1]!.dataset.question!, reviewRequired: false, changes: [] };
    }
    const dialog = el<HTMLDialogElement>('source-dialog');
    if (!dialog.open) this.openSource();
    const closed = new Promise<void>(resolve => dialog.addEventListener('close', () => resolve(), { once: true }));
    await this.interpret();
    check(revision === this.wordsRevision, 'The request was cancelled. Nothing was applied.');
    const questions = [...el('sketch-questions').querySelectorAll<HTMLInputElement>('input')].filter(input => !input.value.trim()).map(input => input.dataset.question!);
    const status = el('source-status').textContent || 'No 3D preview was produced.';
    check(this.preview || questions.length, status);
    if (this.preview) { await closed; check(revision === this.wordsRevision && this.preview, 'The preview was cancelled. Nothing was confirmed.'); return { message: 'The 3D preview is ready. Review the parts and assumptions, then say yes to confirm.', reviewRequired: true, changes: [...el('preview-explanations').querySelectorAll('li')].map(item => item.textContent ?? '') }; }
    return { message: `${status} ${questions.join(' ')}`, reviewRequired: false, changes: [] };
  }
  confirmPreviewWords(): { message: string } {
    check(this.preview, 'There is no current 3D preview to confirm.');
    this.finishPreview(true);
    check(!this.preview, el('preview-status').textContent || 'The 3D preview could not be confirmed.');
    return { message: el('message').textContent || 'The reviewed 3D preview was confirmed.' };
  }
  cancelWords(): void {
    this.wordsRevision++; this.photoSequence++; this.photoLoading = false;
    this.requests.cancel('command'); this.requests.cancel('sketch'); this.voice.cancel();
    this.proposal = undefined; this.commandAnswers = []; this.sketchAnswers = [];
    this.questions('command-questions', []); this.questions('sketch-questions', []); this.list('command-changes', []);
    if (this.preview) this.finishPreview(false);
    const dialog = el<HTMLDialogElement>('command-dialog');
    if (dialog.open) { this.wordsClosed = new Promise<void>(resolve => dialog.addEventListener('close', () => resolve(), { once: true })); dialog.close(); }
    this.sync();
  }
  private pause(): void { const b = this.host.state().bench; b.pause(); b.capture(); this.host.changed(); }
  private target(): TargetToken {
    const { bench } = this.host.state(), context = `${bench.contextToken}:${bench.replayTime}:${bench.restartRequired}`;
    if (context !== this.lastContext) { this.lastContext = context; this.epoch++; }
    return { experimentId: bench.experiment.id, versionId: bench.selected.id, sceneRevision: bench.scene.revision, sourceId: this.mode === 'photo' ? this.photo?.id ?? 'no-photo' : this.strokes.sourceId, sourceRevision: this.revision, epoch: this.epoch * 10000 + bench.physics.ticks };
  }
  sync(): void {
    this.requests.invalidate('The source, physical state or selected version changed. Review again.');
    if (this.proposal && !sameTarget(this.proposal.target, this.target())) { this.proposal = undefined; message('command-status', 'The physical state or source changed. Review the command again.'); }
    el<HTMLButtonElement>('apply-command').disabled = !this.proposal;
    for (const kind of ['sketch', 'command'] as const) el(kind === 'sketch' ? 'cancel-interpret' : 'cancel-command').hidden = !this.requests.isPending(kind);
    el<HTMLButtonElement>('interpret').disabled = this.requests.isPending('sketch') || this.mode === 'photo' && this.photoLoading;
    el<HTMLButtonElement>('review-command').disabled = this.requests.isPending('command');
    el('view-source').hidden = !this.host.state().bench.experiment.source;
    el('preview-banner').hidden = !this.preview;
    el<HTMLButtonElement>('open-source').disabled = !!this.preview;
    el<HTMLButtonElement>('open-command').disabled = !!this.preview;
    if (this.preview) for (const id of ['save', 'export', 'import', 'new', 'examples', 'experiments', 'versions', 'experiment-name', 'play', 'pause', 'step', 'reset', 'replay', 'live', 'scrub', 'baseline', 'csv', 'export-scene']) (el(id) as HTMLButtonElement).disabled = true;
    else el<HTMLSelectElement>('examples').disabled = false;
  }
  private sourceChanged(): void {
    this.revision++; this.sketchAnswers = []; el('sketch-questions').replaceChildren(); message('source-status', 'Source updated. Build a new preview when ready.'); this.sync();
  }
  private switchSource(mode: 'canvas' | 'photo'): void {
    if (this.mode !== mode) { this.mode = mode; this.sourceChanged(); }
    el('sketch').hidden = mode !== 'canvas'; el('photo-area').hidden = mode !== 'photo';
    for (const id of ['undo-stroke', 'clear-strokes']) el(id).hidden = mode !== 'canvas';
    el('use-canvas').setAttribute('aria-pressed', String(mode === 'canvas')); el('use-photo').setAttribute('aria-pressed', String(mode === 'photo'));
  }
  private paint(points: Point[] = []): void { drawStrokes(el('sketch'), [...this.strokes.list(), ...(points.length ? [{ id: 'current', points }] : [])], new Set(), false); }
  private bindCanvas(): void {
    const canvas = el<HTMLCanvasElement>('sketch'); let points: Point[] | undefined;
    const point = (event: PointerEvent): Point => { const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) / rect.width * 1600, (event.clientY - rect.top) / rect.height * 900]; };
    canvas.onpointerdown = event => { if (!event.isPrimary || event.button !== 0) return; canvas.setPointerCapture(event.pointerId); this.sourceChanged(); points = [point(event)]; this.paint(points); };
    canvas.onpointermove = event => { if (points && points.length < 2000) { points.push(point(event)); this.paint(points); } };
    canvas.onpointerup = event => { if (!points) return; points.push(point(event)); const added = this.strokes.add(points); points = undefined; this.paint(); if (!added) message('source-status', 'Drawing limit reached. Undo or clear a stroke.'); };
    canvas.onpointercancel = canvas.onlostpointercapture = () => { points = undefined; this.paint(); };
  }
  private async loadPhoto(file: File | undefined = el<HTMLInputElement>('photo-file').files?.[0]): Promise<void> {
    if (!file) return;
    const sequence = ++this.photoSequence;
    this.photoLoading = true; this.sourceChanged(); message('source-status', 'Preparing image…');
    try {
      const prepared = await prepareImage(file); if (sequence !== this.photoSequence) return;
      check(prepared.ok, prepared.ok ? '' : prepared.reject.message);
      const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Reading the prepared image failed.')); reader.readAsDataURL(prepared.image.blob); });
      if (sequence !== this.photoSequence) return;
      this.photo = { id: prepared.image.sha256, image, widthPx: prepared.image.widthPx, heightPx: prepared.image.heightPx };
      this.switchSource('photo');
      el<HTMLImageElement>('photo-preview').src = image; el('photo-preview').hidden = false; this.sourceChanged(); message('source-status', 'Photo ready. Original metadata was removed.');
    } catch (error) { if (sequence !== this.photoSequence) return; message('source-status', error); throw error; }
    finally { if (sequence === this.photoSequence) { this.photoLoading = false; this.sync(); } }
    if (sequence === this.photoSequence) {
      const photo = this.photo;
      try { await this.host.onPhotoReady?.(); }
      catch (error) { if (this.photo !== photo || this.photoLoading) return; message('source-status', error); throw error; }
    }
  }
  private answers(id: string): Answer[] { return [...el(id).querySelectorAll<HTMLInputElement>('input')].filter(i => i.value.trim()).map(i => ({ question: i.dataset.question!, answer: i.value.trim() })); }
  private questions(id: string, questions: Clarification[]): void {
    el(id).replaceChildren();
    for (const question of questions) {
      const group = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input');
      label.textContent = question.prompt; input.maxLength = 2000; input.dataset.question = question.prompt; input.oninput = () => { this.revision++; this.proposal = undefined; this.sync(); }; label.append(input); group.append(label);
      for (const option of question.options) { const button = document.createElement('button'); button.textContent = option; button.onclick = () => { input.value = option; input.dispatchEvent(new Event('input')); }; group.append(button); }
      el(id).append(group);
    }
  }
  private list(id: string, lines: string[]): void { el(id).replaceChildren(...lines.map(line => { const li = document.createElement('li'); li.textContent = line; return li; })); }
  private async providerStatus(): Promise<void> {
    try {
      const response = await fetch('/api/status'); check(response.ok, 'Vision service unavailable.'); const status = await response.json();
      message('provider-status', status.accessRequired ? 'Vision runtime: private judge access is required. Local conversation controls remain available. ' : status.configured ? `Vision runtime: ${status.provider}. Photo uploads are checked automatically. For a canvas drawing, say interpret my sketch.` : 'Vision runtime is not configured. Your drawing stays here; local controls remain available.');
      if (status.accessRequired) {
        const link = document.createElement('a'); link.href = '/api/access'; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Unlock live AI (opens a new tab)'; el('provider-status').append(link);
      }
    }
    catch (error) { message('provider-status', error); }
  }
  private async interpret(): Promise<void> {
    try {
      check(!this.preview, 'Finish or cancel the current preview.'); this.pause();
      const source = this.mode === 'canvas' ? { id: this.strokes.sourceId, revision: this.revision, kind: this.mode, image: exportSketchPng(this.strokes.list()), ...this.strokes.toJSON() } : { ...this.photo, kind: this.mode, revision: this.revision };
      check(source.image && (this.mode === 'photo' || !this.strokes.isEmpty()), 'Draw something or upload a photo first.');
      this.sketchAnswers = mergeAnswers(this.sketchAnswers, this.answers('sketch-questions')); check(this.sketchAnswers.length <= 40, 'Start a new interpretation after 40 answers.');
      const notes = el<HTMLTextAreaElement>('source-notes').value, identity = { id: source.id!, revision: this.revision, kind: this.mode, strokeIds: [...this.strokes.ids()] };
      const pending = this.requests.start('sketch', async (signal, requestId, target) => parseInterpretation(await postModel('/api/interpret', { requestId, target, source, notes, answers: this.sketchAnswers }, signal), requestId, identity));
      message('source-status', 'Interpreting your sketch…'); this.sync(); const result = await pending;
      if (result.status !== 'accepted') { message('source-status', result.message); return; }
      check(el<HTMLDialogElement>('source-dialog').open, 'The source dialog was closed. Your previous experiment is retained.');
      const interpretation = result.value; this.questions('sketch-questions', interpretation.questions);
      if (interpretation.status !== 'ready') { message('source-status', interpretation.message || (interpretation.status === 'needs-clarification' ? 'Answer these questions, then build the preview again.' : 'The sketch could not be interpreted.')); return; }
      const explanations = [...interpretation.grounding.map(g => `${interpretation.scene!.objects.find(o => o.id === g.objectId)!.label}: ${g.origin === 'inferred' ? 'Assumed part. ' : ''}${g.note}`), ...interpretation.warnings, ...this.sketchAnswers.map(a => `${a.question}: ${a.answer}`)];
      const asset: SourceAsset = { id: identity.id, kind: identity.kind, revision: identity.revision, image: source.image!, widthPx: source.widthPx!, heightPx: source.heightPx!, notes, explanations };
      const state = this.host.state(), draft = new Preview(state.bench, interpretation.scene!, asset);
      this.preview = { draft, dirty: state.dirty, selected: state.selectedId, sourceRevision: this.revision };
      this.list('preview-explanations', [...explanations, ...interpretation.scene!.assumptions]);
      el<HTMLDialogElement>('source-dialog').close(); this.host.show(draft.scratch, false, ''); el('confirm-preview').focus();
    } catch (error) { message('source-status', error); } finally { this.sync(); }
  }
  private finishPreview(confirm: boolean): void {
    const preview = this.preview; if (!preview) return;
    try {
      if (confirm) { check(preview.sourceRevision === this.revision, 'The source changed. Cancel and interpret again.'); preview.draft.confirm(); }
      else preview.draft.cancel();
      this.preview = undefined; this.host.show(preview.draft.original, confirm || preview.dirty, confirm ? '' : preview.selected);
      message('message', confirm ? 'Sketch added as a new experiment. Run it, edit it, or Save to keep it in this browser.' : 'Preview cancelled. Your previous experiment is retained.');
    } catch (error) { message('preview-status', error); }
  }
  private commandChanged(): void { this.proposal = undefined; this.commandAnswers = []; this.questions('command-questions', []); this.list('command-changes', []); this.revision++; this.sync(); message('command-status', 'Review the command before applying it.'); }
  private async command(): Promise<void> {
    try {
      this.proposal = undefined; this.sync();
      this.pause(); const { bench, selectedId } = this.host.state();
      const transcript = el<HTMLTextAreaElement>('command-text').value.trim(); check(transcript, 'Type or dictate a command first.');
      this.commandAnswers = mergeAnswers(this.commandAnswers, this.answers('command-questions')); check(this.commandAnswers.length <= 40, 'Start a new command after 40 answers.');
      const scene = bench.physics.currentScene(), context = bench.commandContext, target = this.target(), manual = manualCommand(transcript, scene, selectedId, crypto.randomUUID());
      let value: CommandProposal;
      if (manual) { value = parseCommand(JSON.stringify(manual), manual.requestId, scene); message('command-status', 'Manual command — parsed locally. Review the exact changes.'); }
      else {
        const pending = this.requests.start('command', async (signal, requestId, captured) => parseCommand(await postModel('/api/command', { requestId, target: captured, transcript, scene, selection: selectedId ? [selectedId] : [], answers: this.commandAnswers }, signal), requestId, scene));
        message('command-status', 'Interpreting the change…'); this.sync(); const result = await pending;
        if (result.status !== 'accepted') { message('command-status', result.message); return; } value = result.value; message('command-status', value.message || 'Review the physical changes before applying.');
      }
      check(el<HTMLDialogElement>('command-dialog').open, 'The command dialog was closed. Review again before applying.');
      this.questions('command-questions', value.questions); this.list('command-changes', []);
      if (value.status !== 'proposed') { message('command-status', value.message || 'Answer the questions, then review again.'); return; }
      check(sameTarget(target, this.target()), 'The physical state changed. Review again.');
      if (value.operations.length) { check(!bench.restartRequired && bench.replayTime === null, 'Reset or resume live before editing physical values.'); const candidate = new Physics(applyCommands(scene, { baseSceneRevision: scene.revision, operations: value.operations })); candidate.free(); }
      this.list('command-changes', describeChanges(scene, value)); this.proposal = { value, target, context };
    } catch (error) { this.proposal = undefined; message('command-status', error); } finally { this.sync(); }
  }
  private apply(): void {
    try {
      const proposal = this.proposal; check(proposal && sameTarget(proposal.target, this.target()), 'The physical state changed. Review again.'); const b = this.host.state().bench, value = proposal.value;
      if (value.operations.length) b.edit({ ...proposal.context, operations: value.operations }, 'User-reviewed command');
      else if (value.lifecycle === 'run') b.play();
      else if (value.lifecycle === 'resume') { check(!b.restartRequired, 'Reset explicitly before restarting this saved setup.'); if (b.replayTime !== null) b.resumeLive(); b.play(); }
      else if (value.lifecycle === 'pause') { b.pause(); b.capture(); }
      else if (value.lifecycle === 'reset') { b.reset(); b.notice = 'Reset to the selected setup. Previous recorded version retained.'; }
      else if (value.lifecycle === 'replay') b.replay(0);
      this.proposal = undefined; this.host.changed(); el<HTMLDialogElement>('command-dialog').close();
    } catch (error) { message('command-status', error); }
  }
}

export { describeChanges } from './changes.ts';

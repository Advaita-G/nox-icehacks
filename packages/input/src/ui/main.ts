/**
 * NOX input lab: the independently usable T2/T3 workflow in a browser.
 * Physics is not connected (shared interface unpublished); AI is not connected (R-11).
 */
import { applyBatch } from '../commands/apply';
import { validateCommandIntent } from '../commands/intent';
import { needsConfirmation, resolveIntent, type Resolution } from '../commands/resolver';
import { parseTyped } from '../commands/typed';
import { DEFAULTS, DEFAULT_BODY_TYPE, UNITS } from '../contract/geometry';
import { parseInterpretation, toEditableState } from '../contract/interpretation';
import type { CommandBatch, CommandIntent, EditableState, InterpretationResult, ObjectKind, Question, SceneObject, SceneOp, TargetToken } from '../contract/types';
import { ProviderError, postModel } from '../provider/client';
import { batchTouchesQuestion } from '../editor/clarification';
import { RequestManager, sameTarget, type Outcome } from '../requests/manager';
import { prepareImage, type PreparedImage } from '../source/image';
import { CANVAS_SIZE, StrokeStore, type Point } from '../source/strokes';
import { PressToTalk, browserRecognitionFactory } from '../voice/pressToTalk';
import { drawScene, drawStrokes, exportSketchPng, hitTest } from './render';
import fixtureE01 from '../../../../docs/product/examples/interpretation-f1-ready.json';
import fixtureE02 from '../../../../docs/product/examples/interpretation-f5-clarification.json';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

/* ---------------- state ---------------- */

let experimentNo = 1;
let epoch = 0;
let mode: 'canvas' | 'photo' = 'canvas';
let strokes = new StrokeStore('src-canvas-1');
let photo: { sourceId: string; revision: number; image: PreparedImage; url: string } | null = null;
let photoRevision = 0;
let uploadSeq = 0;
let state: EditableState | null = null;
let interpretation: InterpretationResult | null = null;
let origin: 'ai' | 'fixture' | 'manual' | null = null;
let questions: Question[] = [];
let selected: string | null = null;
/** Pending user decisions are bound to the full target context they were made for (R4-01). */
let pendingConfirm: { batch: CommandBatch; label: string; context: TargetToken } | null = null;
let pendingCommandQuestion: { context: TargetToken } | null = null;
/** Interpretation questions belong to one experiment/version/epoch. */
let questionContext: Pick<TargetToken, 'experimentId' | 'versionId' | 'epoch'> | null = null;
/** Manual-correction mode for the current question (R4-03). */
let correcting: { questionId: string; touched: boolean } | null = null;
let fieldError = '';
let addCounter = 0;

function target(): TargetToken {
  return {
    experimentId: `exp-${experimentNo}`,
    versionId: 'v-1',
    sceneRevision: state?.scene.revision ?? 0,
    sourceId: mode === 'canvas' ? strokes.sourceId : (photo?.sourceId ?? 'none'),
    sourceRevision: mode === 'canvas' ? strokes.revision : photoRevision,
    epoch,
  };
}

const requests = new RequestManager(target);

/* ---------------- status ---------------- */

function setStatus(text: string, tone: 'info' | 'ok' | 'bad' = 'info'): void {
  const s = $('status');
  s.textContent = text;
  s.className = `status ${tone === 'info' ? '' : tone}`;
}

function invalidate(message: string): void {
  const aborted = requests.invalidate(message);
  if (aborted.length) setStatus(message, 'bad');
  clearStalePending();
  renderBusy();
}

/** Drop any pending confirmation/command question whose captured context no longer matches. */
function clearStalePending(): void {
  const now = target();
  if (pendingConfirm && !sameTarget(pendingConfirm.context, now)) {
    pendingConfirm = null;
    cancelConfirm = null;
    renderConfirm();
  }
  if (pendingCommandQuestion && !sameTarget(pendingCommandQuestion.context, now)) {
    pendingCommandQuestion = null;
    if (!pendingConfirm) {
      const box = $('confirm');
      box.hidden = true;
      box.replaceChildren();
    }
  }
}

function questionsCurrent(): boolean {
  const t = target();
  return questionContext !== null && questionContext.experimentId === t.experimentId && questionContext.versionId === t.versionId && questionContext.epoch === t.epoch;
}

/* ---------------- source: drawing ---------------- */

const sketch = $<HTMLCanvasElement>('sketch');
let drawing: Point[] | null = null;

function canvasPoint(canvas: HTMLCanvasElement, ev: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * CANVAS_SIZE.widthPx, ((ev.clientY - r.top) / r.height) * CANVAS_SIZE.heightPx];
}

sketch.addEventListener('pointerdown', (ev) => {
  sketch.setPointerCapture(ev.pointerId);
  drawing = [canvasPoint(sketch, ev)];
});
sketch.addEventListener('pointermove', (ev) => {
  if (!drawing) return;
  drawing.push(canvasPoint(sketch, ev));
  drawStrokes(sketch, [...strokes.list(), { id: 'live', points: drawing }], highlightStrokes());
});
const endStroke = () => {
  if (!drawing) return;
  const pts = drawing;
  drawing = null;
  if (strokes.add(pts)) {
    invalidate('Sketch changed, so the interpretation was cancelled.');
  }
  renderSource();
};
sketch.addEventListener('pointerup', endStroke);
sketch.addEventListener('pointercancel', endStroke);

$('undo').addEventListener('click', () => {
  if (strokes.undo()) invalidate('Sketch changed, so the interpretation was cancelled.');
  renderSource();
});
$('clear').addEventListener('click', () => {
  strokes.clear();
  invalidate('Sketch changed, so the interpretation was cancelled.');
  renderSource();
});

/* ---------------- source: tabs and photo ---------------- */

function selectTab(next: 'canvas' | 'photo'): void {
  mode = next;
  const draw = $('tab-draw');
  const ph = $('tab-photo');
  draw.setAttribute('aria-selected', String(next === 'canvas'));
  ph.setAttribute('aria-selected', String(next === 'photo'));
  draw.tabIndex = next === 'canvas' ? 0 : -1;
  ph.tabIndex = next === 'photo' ? 0 : -1;
  $('pane-draw').hidden = next !== 'canvas';
  $('pane-photo').hidden = next !== 'photo';
  invalidate('Source changed, so the interpretation was cancelled.');
}
$('tab-draw').addEventListener('click', () => selectTab('canvas'));
$('tab-photo').addEventListener('click', () => selectTab('photo'));
for (const id of ['tab-draw', 'tab-photo']) {
  $(id).addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    const next = mode === 'canvas' ? 'photo' : 'canvas';
    selectTab(next);
    $(next === 'canvas' ? 'tab-draw' : 'tab-photo').focus();
  });
}

$<HTMLInputElement>('photo').addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const seq = ++uploadSeq;
  setStatus('Checking photo…');
  const out = await prepareImage(file);
  input.value = '';
  if (seq !== uploadSeq) return; // a newer upload started; never let an older result replace it
  if (!out.ok) {
    setStatus(out.reject.message, 'bad');
    return; // current source and scene are kept
  }
  if (photo) URL.revokeObjectURL(photo.url);
  photoRevision++;
  photo = { sourceId: `src-photo-${out.image.sha256.slice(0, 8)}`, revision: photoRevision, image: out.image, url: URL.createObjectURL(out.image.blob) };
  invalidate('Source changed, so the interpretation was cancelled.');
  const img = $<HTMLImageElement>('photo-preview');
  img.src = photo.url;
  img.hidden = false;
  $('photo-meta').textContent = `Prepared ${out.image.widthPx}×${out.image.heightPx} JPEG, ${(out.image.bytes / 1024).toFixed(0)} KB, location data removed. Scale must be confirmed after interpretation.`;
  setStatus('Photo ready. Interpret it, or switch back to drawing.', 'ok');
});

/* ---------------- interpretation ---------------- */

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

function describeOutcome(o: Outcome<unknown>): string {
  if (o.status === 'failed') return o.error instanceof ProviderError ? o.error.message : `The request failed: ${o.message}`;
  return 'message' in o ? o.message : '';
}

$('interpret').addEventListener('click', async () => {
  if (mode === 'canvas' && strokes.isEmpty()) return setStatus('Draw something first.', 'bad');
  if (mode === 'photo' && !photo) return setStatus('Upload a photo first.', 'bad');
  setStatus('Interpreting… Cancel stops waiting; your sketch and scene stay as they are.');
  const promise = requests.start('sketch', async (signal, requestId, t) => {
    const source =
      mode === 'canvas'
        ? { id: strokes.sourceId, type: 'canvas', revision: strokes.revision, canvas: strokes.toJSON(), png: exportSketchPng(strokes.list()) }
        : { id: photo!.sourceId, type: 'photo', revision: photoRevision, photo: { mime: 'image/jpeg', widthPx: photo!.image.widthPx, heightPx: photo!.image.heightPx, bytes: photo!.image.bytes, sha256: photo!.image.sha256 }, jpeg: await blobToDataUrl(photo!.image.blob) };
    return postModel('/api/interpret', { requestId, target: t, source }, signal);
  });
  renderBusy();
  const sentId = requests.pendingId('sketch');
  const sent = target();
  const outcome = await promise;
  renderBusy();
  if (outcome.status !== 'accepted') {
    setStatus(describeOutcome(outcome), outcome.status === 'cancelled' ? 'info' : 'bad');
    return;
  }
  const parsed = parseInterpretation(outcome.value, { requestId: sentId, sourceId: sent.sourceId, sourceRevision: sent.sourceRevision, ...(mode === 'canvas' ? { strokeIds: strokes.ids() } : {}) });
  if (!parsed.ok) {
    setStatus(`${parsed.message} Your sketch and the previous scene are unchanged. Retry or place objects manually.`, 'bad');
    return;
  }
  acceptInterpretation(parsed.result, 'ai');
});

$('new-experiment').addEventListener('click', () => {
  experimentNo++;
  epoch++;
  state = null;
  interpretation = null;
  origin = null;
  questions = [];
  questionContext = null;
  correcting = null;
  selected = null;
  strokes = new StrokeStore(`src-canvas-${experimentNo}`);
  invalidate('New experiment started; pending work for the previous one was cancelled.');
  setStatus(`Started experiment ${experimentNo}. Draw, upload, load a fixture or add objects.`, 'ok');
  renderAll();
});

$('cancel').addEventListener('click', () => {
  requests.cancel('sketch');
  requests.cancel('command');
});

function acceptInterpretation(result: InterpretationResult, from: 'ai' | 'fixture'): void {
  if (result.status === 'rejected') {
    setStatus(`The model could not use this sketch: ${result.rejection?.message ?? 'no reason given'}`, 'bad');
    return;
  }
  const next = toEditableState(result);
  if (!next) return;
  interpretation = result;
  state = next;
  origin = from;
  questions = [...result.questions];
  selected = null;
  correcting = null;
  epoch++; // a new scene replaces the old target
  questionContext = { experimentId: target().experimentId, versionId: target().versionId, epoch };
  invalidate('Scene replaced.');
  setStatus(questions.length ? `Interpretation needs ${questions.length} answer${questions.length > 1 ? 's' : ''} before it can run.` : 'Interpretation ready. Check the objects and assumptions.', 'ok');
  renderAll();
}

$('fixture-load').addEventListener('click', () => {
  const which = $<HTMLSelectElement>('fixture-select').value;
  const raw = which === 'E-02' ? fixtureE02 : fixtureE01;
  const parsed = parseInterpretation(JSON.stringify(raw.result));
  if (!parsed.ok) return setStatus(`Fixture failed validation: ${parsed.message}`, 'bad');
  acceptInterpretation(parsed.result, 'fixture');
});

/* ---------------- edits ---------------- */

function commit(batch: CommandBatch): boolean {
  if (!state) return false;
  const r = applyBatch(state, batch);
  if (!r.ok) {
    fieldError = r.error.message;
    setStatus(`Not applied: ${r.error.message}`, 'bad');
    renderEditor();
    return false;
  }
  const before = state;
  state = r.state;
  fieldError = '';
  if (selected && !state.scene.objects.some((o) => o.id === selected)) selected = null;
  const q = questions[0];
  if (correcting && q && correcting.questionId === q.id && batchTouchesQuestion(batch.ops, q, before.relationships)) correcting.touched = true;
  invalidate('Scene changed, so the pending request was cancelled.');
  renderAll();
  return true;
}

function direct(ops: SceneOp[], summary: string): boolean {
  if (!state) return false;
  return commit({ batchId: `b-direct-${Date.now()}`, baseSceneRevision: state.scene.revision, origin: 'direct', ops, summary: [summary] });
}

type QuestionAction = { kind: 'option'; index: number } | { kind: 'manual' } | { kind: 'done' } | { kind: 'back' };

function answerQuestion(q: Question, action: QuestionAction): void {
  if (!state || questions[0] !== q || !questionsCurrent()) {
    setStatus('That question belongs to a scene that is no longer open. Nothing changed.', 'bad');
    renderAll();
    return;
  }
  if (action.kind === 'manual') {
    correcting = { questionId: q.id, touched: false };
    setStatus('Correct the highlighted objects in the editor, then choose Done. The question stays open until a valid change is made.', 'info');
    renderAll();
    return;
  }
  if (action.kind === 'back') {
    correcting = null;
    renderAll();
    return;
  }
  if (action.kind === 'done') {
    if (!correcting || correcting.questionId !== q.id || !correcting.touched) {
      setStatus('Make a valid change to the highlighted objects first.', 'bad');
      return;
    }
  } else {
    const opt = q.options[action.index];
    if (!opt) return;
    if (opt.ops.length) {
      const ok = commit({ batchId: `b-q-${q.id}`, baseSceneRevision: state.scene.revision, origin: 'clarification', ops: opt.ops, summary: [opt.label] });
      if (!ok) return;
    }
  }
  correcting = null;
  questions = questions.filter((x) => x.id !== q.id);
  setStatus(questions.length ? 'Answer recorded. Next question below.' : 'All questions answered.', 'ok');
  renderAll();
  if (questions.length) $('question').querySelector('button')?.focus();
}

$('add-object').addEventListener('click', () => {
  const kind = $<HTMLSelectElement>('add-kind').value as ObjectKind;
  if (!state) {
    state = { scene: { schemaVersion: 1, revision: 0, metersPerPx: DEFAULTS.metersPerPx, gravity: { ...DEFAULTS.gravity }, objects: [] }, relationships: [], assumptions: [{ id: 'as-scale', path: 'scene.metersPerPx', value: DEFAULTS.metersPerPx, unit: 'm/px', origin: 'default' }] };
    origin = 'manual';
    interpretation = null;
    questions = [];
  }
  const id = `${kind}-m${++addCounter}`;
  const dims: Record<ObjectKind, Record<string, number | string>> = {
    ball: { radius: 0.25 },
    block: { width: 0.6, height: 0.6 },
    domino: { width: 0.1, height: 0.5 },
    platform: { width: 4, height: 0.2 },
    ramp: { width: 3, height: 1.5, facing: 'right' },
    container: { innerWidth: 1, innerHeight: 0.8, wallThickness: 0.05 },
  };
  const bodyType = DEFAULT_BODY_TYPE[kind];
  const obj: SceneObject = { id, kind, bodyType, x: 8, y: 4.5, angle: 0, dims: dims[kind], friction: DEFAULTS.friction, restitution: DEFAULTS.restitution, sourceRefs: [] };
  if (bodyType === 'dynamic') {
    obj.mass = DEFAULTS.mass;
    obj.linearVelocity = { vx: 0, vy: 0 };
    obj.angularVelocity = 0;
  }
  if (direct([{ op: 'add-object', object: obj }], `add ${kind} ${id}`)) {
    state!.assumptions.push({ id: `as-${id}`, path: `objects.${id}.*`, value: 'size, friction, restitution' + (bodyType === 'dynamic' ? ', mass' : ''), unit: '', origin: 'default' });
    selected = id;
    renderAll();
  }
});

/* ---------------- commands ---------------- */

function showResolution(r: Resolution, label: string, context: TargetToken): void {
  if (!sameTarget(context, target())) {
    setStatus('The scene changed while this command was being prepared. Nothing changed; say it again.', 'bad');
    return;
  }
  switch (r.kind) {
    case 'batch': {
      // Validate before offering Apply, so an invalid change is never presented as applicable.
      const check = state ? applyBatch(state, r.batch) : null;
      if (check && !check.ok) {
        pendingConfirm = null;
        renderConfirm();
        setStatus(`Not applied: ${check.error.message}`, 'bad');
        return;
      }
      if (needsConfirmation(r.batch.origin)) {
        pendingCommandQuestion = null;
        pendingConfirm = { batch: r.batch, label, context };
        renderConfirm();
        $('confirm').querySelector<HTMLButtonElement>('button')?.focus();
      } else commit(r.batch);
      return;
    }
    case 'lifecycle':
      if (r.command.kind === 'reset') {
        epoch++;
        invalidate('Reset cancelled the pending request.');
        setStatus('Reset recorded. Restoring initial conditions needs the physics interface; the setup is unchanged.', 'info');
      } else {
        setStatus(`"${r.command.kind}" needs the shared physics interface, which is not connected yet.`, 'bad');
      }
      return;
    case 'question':
      setStatus(r.question.prompt, 'info');
      pendingConfirm = null;
      pendingCommandQuestion = { context };
      renderCommandQuestion(r.question.options, label, context);
      return;
    case 'unsupported':
      setStatus(`Not supported: ${r.reason} The scene is unchanged.`, 'bad');
      return;
    case 'error':
      setStatus(`Not applied: ${r.error.message}`, 'bad');
      return;
  }
}

async function handleCommandText(text: string, from: 'typed' | 'voice'): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  $('transcript').textContent = from === 'voice' ? `Heard: “${trimmed}”` : '';
  // 1) Explicit manual grammar works offline and is labelled as manual.
  const manual = parseTyped(trimmed, `typed-${Date.now()}`);
  if (manual.ok) {
    if (!state && !manual.intent.lifecycle) return setStatus('There is no scene yet.', 'bad');
    const r = resolveIntent(state ?? emptyState(), manual.intent, { origin: from });
    showResolution(r, 'Manual command parser (not AI)', target());
    return;
  }
  // 2) Natural language goes to the model route.
  if (!state) return setStatus('There is no scene yet.', 'bad');
  setStatus('Understanding the command…');
  const base = state;
  let sentContext: TargetToken = target();
  const promise = requests.start('command', (signal, requestId, t) => {
    sentContext = t;
    return postModel('/api/command', { requestId, target: t, transcript: trimmed, origin: from, baseSceneRevision: base.scene.revision, selection: selected ? [selected] : [], scene: base.scene }, signal);
  });
  renderBusy();
  const outcome = await promise;
  renderBusy();
  if (outcome.status !== 'accepted') {
    const hint = outcome.status === 'failed' && outcome.error instanceof ProviderError && outcome.error.code === 'PROVIDER_NOT_CONFIGURED' ? ` ${manual.message}` : '';
    setStatus(describeOutcome(outcome) + hint, 'bad');
    return;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(outcome.value);
  } catch {
    setStatus('The model returned an unreadable command. Nothing changed.', 'bad');
    return;
  }
  // Validate the untrusted payload before reading any field of it (R4-02).
  const checked = validateCommandIntent(raw);
  if (!checked.ok) return setStatus(`The model returned an unusable command (${checked.error.message}). Nothing changed.`, 'bad');
  if (checked.intent.requestId !== outcome.requestId) return setStatus('The model answered a different request. Nothing changed.', 'bad');
  if (!state) return;
  showResolution(resolveIntent(state, checked.intent, { origin: from }), 'AI command', sentContext);
}

function emptyState(): EditableState {
  return { scene: { schemaVersion: 1, revision: 0, metersPerPx: DEFAULTS.metersPerPx, gravity: { ...DEFAULTS.gravity }, objects: [] }, relationships: [], assumptions: [] };
}

$('cmd-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $<HTMLInputElement>('cmd');
  void handleCommandText(input.value, 'typed');
});

const talk = $<HTMLButtonElement>('talk');
const ptt = new PressToTalk(browserRecognitionFactory(), {
  onInterim: (t) => ($('transcript').textContent = `Listening: “${t}”`),
  onFinal: (t) => {
    $<HTMLInputElement>('cmd').value = t;
    void handleCommandText(t, 'voice');
  },
  onError: (_code, message) => {
    $('transcript').textContent = '';
    setStatus(message, 'bad');
  },
  onStateChange: (listening) => {
    talk.setAttribute('aria-pressed', String(listening));
    talk.textContent = listening ? 'Listening… release to send' : 'Hold to talk';
  },
});
if (!ptt.supported) {
  $('voice-note').textContent = 'This browser has no speech recognition. Type commands instead.';
}
talk.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  talk.setPointerCapture(ev.pointerId);
  ptt.press();
});
talk.addEventListener('pointerup', () => ptt.release());
talk.addEventListener('pointercancel', () => ptt.cancel());
talk.addEventListener('keydown', (ev) => {
  if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
    ev.preventDefault();
    ptt.press();
  } else if (ev.key === 'Escape') ptt.cancel();
});
talk.addEventListener('keyup', (ev) => {
  if (ev.key === ' ' || ev.key === 'Enter') {
    ev.preventDefault();
    ptt.release();
  }
});

/* ---------------- preview interaction ---------------- */

const preview = $<HTMLCanvasElement>('preview');
preview.addEventListener('click', (ev) => {
  const r = preview.getBoundingClientRect();
  const id = hitTest(preview, state, ((ev.clientX - r.left) / r.width) * preview.width, ((ev.clientY - r.top) / r.height) * preview.height);
  selected = id;
  renderAll();
});

/* ---------------- rendering ---------------- */

function highlightStrokes(): Set<string> {
  const ids = new Set<string>();
  const add = (refs: SceneObject['sourceRefs']) => refs.forEach((r) => r.kind === 'strokes' && r.strokeIds.forEach((s) => ids.add(s)));
  const obj = state?.scene.objects.find((o) => o.id === selected);
  if (obj) add(obj.sourceRefs);
  const q = questions[0];
  if (q) add(q.targetRefs.sourceRefs);
  return ids;
}

function renderSource(): void {
  drawStrokes(sketch, strokes.list(), highlightStrokes());
  $('stroke-meta').textContent = `${strokes.list().length} stroke${strokes.list().length === 1 ? '' : 's'} · revision ${strokes.revision}`;
}

function renderBusy(): void {
  const busy = requests.isPending('sketch') || requests.isPending('command');
  $<HTMLButtonElement>('cancel').disabled = !busy;
  $<HTMLButtonElement>('interpret').disabled = requests.isPending('sketch');
  renderToken();
}

function renderToken(): void {
  const t = target();
  $('token').textContent = `Target: ${t.experimentId} · ${t.versionId} · scene r${t.sceneRevision} · ${t.sourceId} r${t.sourceRevision} · epoch ${t.epoch}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('aria-') || k === 'role' || k === 'for') e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...children);
  return e;
}

function renderObjects(): void {
  const list = $('objects');
  list.replaceChildren();
  for (const o of state?.scene.objects ?? []) {
    const b = el('button', { type: 'button', className: 'item', 'aria-current': String(o.id === selected) }, `${o.id} · ${o.kind} · ${o.bodyType}`);
    b.addEventListener('click', () => {
      selected = o.id;
      renderAll();
      $('editor').querySelector<HTMLInputElement>('input')?.focus();
    });
    const rm = el('button', { type: 'button', 'aria-label': `Remove ${o.id}` }, 'Remove');
    rm.addEventListener('click', () => direct([{ op: 'remove-object', objectId: o.id }], `remove ${o.id}`));
    list.append(el('li', {}, b, rm));
  }
  if (!state?.scene.objects.length) list.append(el('li', { className: 'meta' }, 'No objects.'));
}

function numberField(label: string, value: number, unit: string, onChange: (v: number) => void, step = 'any'): Node[] {
  const id = `f-${label.replace(/\W+/g, '-')}`;
  const input = el('input', { id, type: 'number', step, value: String(Math.round(value * 1e6) / 1e6), inputMode: 'decimal' });
  input.addEventListener('change', () => {
    const v = input.value.trim() === '' ? NaN : Number(input.value);
    onChange(v);
  });
  return [el('label', { for: id }, `${label}${unit ? ` (${unit})` : ''}`), input];
}

function renderEditor(): void {
  const form = $('editor');
  form.replaceChildren();
  const o = state?.scene.objects.find((x) => x.id === selected);
  if (!o || !state) {
    form.append(el('p', { className: 'meta' }, 'Select an object.'));
    return;
  }
  const pose = (patch: Partial<{ x: number; y: number; angle: number }>) =>
    direct([{ op: 'set-pose', objectId: o.id, x: patch.x ?? o.x, y: patch.y ?? o.y, angle: patch.angle ?? o.angle }], `${o.id} pose`);
  form.append(
    ...numberField('x', o.x, 'm', (v) => pose({ x: v })),
    ...numberField('y', o.y, 'm', (v) => pose({ y: v })),
    ...numberField('angle', (o.angle * 180) / Math.PI, '°', (v) => pose({ angle: (v * Math.PI) / 180 })),
  );
  for (const [k, v] of Object.entries(o.dims)) {
    if (typeof v !== 'number') continue;
    form.append(...numberField(k, v, UNITS[k] ?? '', (nv) => direct([{ op: 'set-dimensions', objectId: o.id, dims: { [k]: nv } }], `${o.id} ${k}`)));
  }
  if (o.kind === 'ramp') {
    const sel = el('select', { id: 'f-facing' }, el('option', { value: 'right' }, 'slopes down to the right'), el('option', { value: 'left' }, 'slopes down to the left'));
    sel.value = String(o.dims.facing);
    sel.addEventListener('change', () => direct([{ op: 'set-dimensions', objectId: o.id, dims: { facing: sel.value } }], `${o.id} facing`));
    form.append(el('label', { for: 'f-facing' }, 'facing'), sel);
  }
  const bt = el('select', { id: 'f-body' }, el('option', { value: 'dynamic' }, 'moving (dynamic)'), el('option', { value: 'fixed' }, 'fixed'));
  bt.value = o.bodyType;
  bt.addEventListener('change', () => direct([{ op: 'set-body-type', objectId: o.id, bodyType: bt.value as 'fixed' | 'dynamic' }], `${o.id} body type`));
  form.append(el('label', { for: 'f-body' }, 'body'), bt);
  if (o.bodyType === 'dynamic') {
    form.append(...numberField('mass', o.mass ?? DEFAULTS.mass, 'kg', (v) => direct([{ op: 'set-property', objectId: o.id, property: 'mass', value: v }], `${o.id} mass`)));
    const lv = o.linearVelocity ?? { vx: 0, vy: 0 };
    form.append(
      ...numberField('vx', lv.vx, 'm/s', (v) => direct([{ op: 'set-velocity', objectId: o.id, vx: v, vy: lv.vy }], `${o.id} vx`)),
      ...numberField('vy', lv.vy, 'm/s', (v) => direct([{ op: 'set-velocity', objectId: o.id, vx: lv.vx, vy: v }], `${o.id} vy`)),
    );
  }
  form.append(
    ...numberField('friction', o.friction, '', (v) => direct([{ op: 'set-property', objectId: o.id, property: 'friction', value: v }], `${o.id} friction`)),
    ...numberField('restitution', o.restitution, '', (v) => direct([{ op: 'set-property', objectId: o.id, property: 'restitution', value: v }], `${o.id} restitution`)),
  );
  if (fieldError) form.append(el('p', { className: 'err', role: 'alert' }, fieldError));
}

function renderRelationships(): void {
  const list = $('relationships');
  list.replaceChildren();
  for (const r of state?.relationships ?? []) {
    const text = r.kind === 'velocity-of' ? `${r.subjectId} starts at (${r.value?.vx}, ${r.value?.vy}) m/s` : `${r.subjectId} ${r.kind} ${r.targetId}`;
    const rm = el('button', { type: 'button', 'aria-label': `Remove relationship ${r.id}` }, 'Remove');
    rm.addEventListener('click', () => direct([{ op: 'remove-relationship', id: r.id }], `remove relationship ${r.id}`));
    list.append(el('li', {}, el('span', {}, `${text} · ${r.origin}, ${r.status}`), rm));
  }
  if (!state?.relationships.length) list.append(el('li', { className: 'meta' }, 'No relationships.'));
}

function renderAssumptions(): void {
  const body = $('assumptions');
  body.replaceChildren();
  for (const a of state?.assumptions ?? []) {
    const v = typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value);
    body.append(el('tr', {}, el('td', {}, a.path), el('td', {}, `${v}${a.unit ? ` ${a.unit}` : ''}`), el('td', {}, el('span', { className: `origin-${a.origin}` }, a.origin))));
  }
  if (!state?.assumptions.length) body.append(el('tr', {}, el('td', { colSpan: 3, className: 'meta' }, 'None.')));
}

function renderQuestion(): void {
  const box = $('question');
  const q = questions[0];
  box.hidden = !q;
  box.replaceChildren();
  if (!q) return;
  box.append(el('p', {}, `Question ${interpretation ? interpretation.questions.length - questions.length + 1 : 1} of ${interpretation?.questions.length ?? questions.length}: ${q.prompt}`));
  const row = el('div', { className: 'row' });
  if (correcting?.questionId === q.id) {
    box.append(el('p', { className: 'meta' }, 'Correcting manually: change the highlighted objects in the editor, then choose Done. The question stays open until a valid change is made.'));
    const done = el('button', { type: 'button', className: 'primary', disabled: !correcting.touched }, 'Done — my correction answers this');
    done.addEventListener('click', () => answerQuestion(q, { kind: 'done' }));
    const back = el('button', { type: 'button' }, 'Back to the options');
    back.addEventListener('click', () => answerQuestion(q, { kind: 'back' }));
    row.append(done, back);
  } else {
    q.options.forEach((opt, i) => {
      const b = el('button', { type: 'button' }, opt.label);
      b.addEventListener('click', () => answerQuestion(q, { kind: 'option', index: i }));
      row.append(b);
    });
    const manual = el('button', { type: 'button' }, 'I’ll correct it manually');
    manual.addEventListener('click', () => answerQuestion(q, { kind: 'manual' }));
    row.append(manual);
  }
  box.append(row);
}

function renderCommandQuestion(options: { id: string; label: string; intentOps: CommandIntent['ops'] }[], label: string, context: TargetToken): void {
  const box = $('confirm');
  box.hidden = false;
  box.replaceChildren(el('p', {}, $('status').textContent ?? ''));
  const row = el('div', { className: 'row' });
  for (const opt of options) {
    const b = el('button', { type: 'button' }, opt.label);
    b.addEventListener('click', () => {
      // A stale option (scene replaced, reset, experiment switched) must not act on the new scene (R4-01).
      if (!state || pendingCommandQuestion?.context !== context || !sameTarget(context, target())) {
        setStatus('That question belongs to a scene that is no longer open. Nothing changed.', 'bad');
        return;
      }
      pendingCommandQuestion = null;
      box.hidden = true;
      showResolution(resolveIntent(state, { requestId: `q-${opt.id}`, status: 'proposed', targets: [], ops: opt.intentOps }, { origin: 'voice' }), label, context);
    });
    row.append(b);
  }
  const cancel = el('button', { type: 'button' }, 'Cancel');
  cancel.addEventListener('click', () => {
    pendingCommandQuestion = null;
    box.hidden = true;
  });
  row.append(cancel);
  box.append(row);
}

let cancelConfirm: (() => void) | null = null;
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && pendingConfirm && cancelConfirm) {
    ev.preventDefault();
    cancelConfirm();
  }
});

function renderConfirm(): void {
  const box = $('confirm');
  box.replaceChildren();
  box.hidden = !pendingConfirm;
  if (!pendingConfirm) return;
  const { batch, label, context } = pendingConfirm;
  const apply = el('button', { type: 'button', className: 'primary' }, 'Apply (Enter)');
  const cancel = el('button', { type: 'button' }, 'Cancel (Esc)');
  const done = (ok: boolean) => {
    if (pendingConfirm?.batch !== batch) return; // a stale button from a replaced confirmation
    pendingConfirm = null;
    renderConfirm();
    if (ok) {
      // Re-check the full context immediately before applying (R4-01).
      if (!sameTarget(context, target())) setStatus('The scene changed since this command was prepared. Nothing changed.', 'bad');
      else if (commit(batch)) setStatus(`Applied: ${batch.summary.join('; ')}`, 'ok');
    } else setStatus('Command cancelled. Nothing changed.');
    $<HTMLInputElement>('cmd').focus();
  };
  apply.addEventListener('click', () => done(true));
  cancel.addEventListener('click', () => done(false));
  cancelConfirm = () => done(false);
  box.append(el('p', {}, 'Apply this change?'), el('ul', {}, ...batch.summary.map((s) => el('li', {}, s))), el('p', { className: 'src' }, `${label} · based on scene revision ${batch.baseSceneRevision}`), el('div', { className: 'row' }, apply, cancel));
}

function renderRun(): void {
  const why = $('run-why');
  if (!state || state.scene.objects.length === 0) why.textContent = 'Nothing to run yet.';
  else if (questions.length) why.textContent = `Answer ${questions.length} question${questions.length > 1 ? 's' : ''} first.`;
  else why.textContent = 'Scene is confirmed. Running needs the shared physics interface (Advaita), which is not connected yet.';
}

function renderOrigin(): void {
  const b = $('origin-badge');
  b.hidden = !origin;
  b.textContent = origin === 'fixture' ? 'FIXTURE: hand-written example, not AI output' : origin === 'manual' ? 'Manual scene' : origin === 'ai' ? 'AI interpretation (check it)' : '';
}

function renderAll(): void {
  renderSource();
  drawScene(preview, state, selected, new Set(questions[0]?.targetRefs.objectIds ?? []));
  renderOrigin();
  renderObjects();
  renderEditor();
  renderRelationships();
  renderAssumptions();
  renderQuestion();
  renderRun();
  renderToken();
  const w = $('warnings');
  const warnings = interpretation?.warnings ?? [];
  w.hidden = warnings.length === 0;
  w.textContent = warnings.join(' ');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll);
renderAll();
renderBusy();

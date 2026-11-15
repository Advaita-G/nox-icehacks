import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantActions } from '../src/assistant/actions.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';
import { REQUEST_TIMEOUTS } from '../src/input/contract.ts';

let preparePhoto = async () => { throw new Error('No photo preparation stub was provided'); };
class PreparedReader {
  result = '';
  readAsDataURL(blob) { this.result = blob.dataUrl; queueMicrotask(() => this.onload()); }
}

const uiSource = readFileSync(new URL('../src/input/ui.ts', import.meta.url), 'utf8')
  .replace(/^import[^\n]*\n/gm, '').replace(/^export \{[^\n]*\n/gm, '').replace('export class InputUI', 'class InputUI');
const InputUI = runInNewContext(stripTypeScriptTypes(uiSource, { mode: 'transform' }) + '\nInputUI', {
  document: { getElementById: id => globalThis.document.getElementById(id) }, Event,
  prepareImage: file => preparePhoto(file), FileReader: PreparedReader,
  check: (condition, message) => { if (!condition) throw new Error(message); },
});

const proposal = { message: 'Review mass 1 → 2 kg.', reviewRequired: true, changes: ['Ball mass: 1 → 2 kg'] };
function fixture(overrides = {}) {
  const calls = [];
  const host = Object.fromEntries(['demo', 'run', 'pause', 'reset', 'baseline', 'compare', 'save', 'source', 'select', 'create', 'apply', 'cancel'].map(name => [name, (...args) => { calls.push([name, ...args]); return `${name} complete`; }]));
  host.review = async text => { calls.push(['review', text]); return proposal; };
  host.interpret = async () => { calls.push(['interpret']); return proposal; };
  Object.assign(host, overrides);
  return { actions: new AssistantActions(host), calls, host };
}

test('local controls and exact built-in requests avoid the model; custom parameters are preserved', async () => {
  const { actions, calls } = fixture();
  for (const words of ['Jarvis, show me what you can do', 'run it', 'pause', 'reset', 'keep baseline', 'show measurements', 'save my work', 'show my sketch', 'select the ball', 'create a spring', 'show me a fan']) await actions.handle(words);
  assert.deepEqual(calls, [['demo'], ['run'], ['pause'], ['reset'], ['baseline'], ['compare'], ['save'], ['source'], ['select', 'ball'], ['create', 'spring'], ['demo', 'show me a fan']]);
  await actions.handle('build a spring with 2kg mass');
  assert.deepEqual(calls.at(-1), ['review', 'build a spring with 2kg mass']);
});

test('ordinary build requests use the visible drawing and preserve intent before any preset or text-only command', async () => {
  for (const words of ['build the ramp with the ball shown like in the picture', 'Nox, can you build it into a 3D model, a physics model?', 'build a ramp', 'make a chair', 'turn this into a physics model', 'recreate the drawing']) {
    const { actions, calls } = fixture({ hasDrawing: () => true, interpret: async instruction => { calls.push(['drawing', instruction]); return proposal; } });
    const response = await actions.handle(words);
    assert.equal(response.reviewRequired, true);
    assert.deepEqual(calls, [['drawing', words]]);
    assert.ok(!calls.some(([name]) => name === 'create' || name === 'review'));
    await actions.handle('yes'); assert.deepEqual(calls.at(-1), ['apply']);
  }
  const { actions, calls } = fixture({ hasDrawing: () => false });
  await actions.handle('make a chair'); assert.deepEqual(calls, [['review', 'make a chair']]);
});

test('an ordinary voice check receives a conversational response without an AI call or physical questionnaire', async () => {
  const { actions, calls } = fixture({ hasDrawing: () => true });
  for (const words of ['hello', 'can you hear me', 'are you there', 'thank you']) assert.ok((await actions.handle(words)).message.length);
  assert.deepEqual(calls, []);
});

test('undo is a local conversation action rather than another inference request', async () => {
  const {actions,calls}=fixture({undo:()=>{calls.push(['undo']);return 'Previous version restored.';}});
  for(const words of ['undo','undo that','undo the last change'])assert.equal((await actions.handle(words)).message,'Previous version restored.');
  assert.deepEqual(calls,[['undo'],['undo'],['undo']]);
});

test('natural demo, save and confirmation aliases stay local and gated', async () => {
  const { actions, calls } = fixture();
  for (const words of ['start demo', 'run a demo', 'show me everything', 'take me through it']) await actions.handle(words);
  await actions.handle('save this experiment');
  assert.deepEqual(calls, [['demo'], ['demo'], ['demo'], ['demo'], ['save']]);
  await actions.handle('double its mass'); await actions.handle('yes, apply'); await actions.handle('yes apply');
  assert.equal(calls.filter(([name]) => name === 'apply').length, 1);
});

test('conversational bounded edits reuse the existing manual grammar and still require review', async () => {
  const { actions, calls } = fixture();
  for (const [words, expected] of [['double its mass', 'set this mass x2'], ['make it twice as heavy', 'set this mass x2'], ['halve its mass', 'set this mass x0.5'], ['set gravity to minus 4.9', 'gravity -4.9']]) {
    assert.equal((await actions.handle(words)).reviewRequired, true);
    assert.deepEqual(calls.at(-1), ['review', expected]);
  }
  assert.ok(!calls.some(([name]) => name === 'apply'));
  await actions.handle('move it right by two meters');
  assert.deepEqual(calls.at(-1), ['review', 'move it right by two meters']);
  await actions.handle('make the ball twice as heavy');
  assert.deepEqual(calls.at(-1), ['review', 'make the ball twice as heavy']);
});

test('confirmation applies only an already-returned review, once', async () => {
  const { actions, calls } = fixture();
  await actions.handle('yes');
  assert.deepEqual(calls, []);
  await actions.handle('make the ball heavier');
  await actions.handle('yes'); await actions.handle('apply');
  assert.equal(calls.filter(([name]) => name === 'apply').length, 1);
});

test('a speculative yes cannot approve an unseen model result', async () => {
  let finish;
  const { actions, calls } = fixture({ review: () => new Promise(resolve => { finish = resolve; }) });
  const review = actions.handle('make a new machine');
  const yes = actions.handle('yes');
  await Promise.resolve(); finish(proposal);
  await review; assert.equal((await yes).reviewRequired, false);
  assert.ok(!calls.some(([name]) => name === 'apply'));
  await actions.handle('yes'); assert.deepEqual(calls, [['apply']]);
});

test('cancel interrupts pending work and a late result cannot create a ghost Apply', async () => {
  let finish;
  const { actions, calls } = fixture({ review: () => new Promise(resolve => { finish = resolve; }) });
  const review = actions.handle('build a robot');
  await Promise.resolve();
  const earlyYes = actions.handle('yes'), queuedRun = actions.handle('run');
  assert.equal((await actions.handle('cancel')).message, 'cancel complete');
  finish(proposal); assert.match((await review).message, /cancelled/);
  await earlyYes; await queuedRun; await actions.handle('yes');
  assert.deepEqual(calls, [['cancel']]);
});

test('request cancellation phrases cancel a pending critical question instead of submitting an answer', async () => {
  for (const words of ['cancel the request', 'cancel checking', 'stop checking', 'stop the request', 'Jarvis, cancel the request.']) {
    const { actions, calls, host } = fixture();
    host.interpret = async () => { calls.push(['interpret']); return { message: 'Is this support fixed?', reviewRequired: false, changes: [] }; };
    await actions.handle('interpret my photo');
    await actions.handle(words); await actions.handle('yes');
    assert.deepEqual(calls, [['interpret'], ['cancel']], words);
  }
});

test('a local action cancels an earlier proposal and queued callbacks execute serially', async () => {
  let finish;
  const { actions, calls } = fixture({ demo: () => new Promise(resolve => { finish = resolve; }) });
  await actions.handle('change the spring');
  const demo = actions.handle('demo'), run = actions.handle('run');
  await Promise.resolve(); await Promise.resolve();
  assert.ok(!calls.some(([name]) => name === 'run'));
  finish('demonstration complete'); await demo; await run;
  await actions.handle('yes');
  assert.deepEqual(calls.map(([name]) => name), ['review', 'cancel', 'run']);
});

test('errors reject without applying and do not poison the queue', async () => {
  const { actions, calls, host } = fixture({ review: async () => { throw new Error('Access required'); } });
  await assert.rejects(actions.handle('build a machine'), /Access required/);
  await actions.handle('yes'); await actions.handle('run');
  assert.deepEqual(calls, [['run']]);
  host.review = async () => proposal;
  host.apply = () => { throw new Error('Stale context'); };
  await actions.handle('change its mass');
  await assert.rejects(actions.handle('yes'), /Stale context/);
  await actions.handle('yes');
  assert.deepEqual(calls.at(-1), ['cancel']);
});

test('preview interpretation and clarification answers remain reviewed', async () => {
  const { actions, calls, host } = fixture();
  await actions.handle('build 3D preview'); await actions.handle('yes');
  assert.deepEqual(calls, [['interpret'], ['apply']]);
  host.review = async text => { calls.push(['review', text]); return text.startsWith('yes') ? proposal : { message: 'Use one meter?', reviewRequired: false, changes: [] }; };
  await actions.handle('create a custom ramp');
  assert.equal((await actions.handle('yes, please')).reviewRequired, true);
  assert.equal(calls.filter(([name]) => name === 'apply').length, 1);
  await actions.handle('yes'); assert.equal(calls.filter(([name]) => name === 'apply').length, 2);
});

function bridge(t) {
  const previous = globalThis.document, nodes = new Map(), ui = Object.create(InputUI.prototype);
  class Node extends EventTarget {
    open = false; value = ''; textContent = ''; dataset = {}; inputs = []; items = [];
    show() { this.open = true; }
    showModal() { throw new Error('Voice must not make the assistant inert'); }
    close() { this.open = false; setTimeout(() => this.dispatchEvent(new Event('close')), 0); }
    querySelectorAll(selector) { return selector === 'input' ? this.inputs : this.items; }
    replaceChildren() { this.inputs = []; this.items = []; }
    setAttribute(name, value) { this[name] = value; }
  }
  globalThis.document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); } };
  t.after(() => { globalThis.document = previous; });
  const node = id => globalThis.document.getElementById(id);
  Object.assign(ui, { wordsClosed: Promise.resolve(), wordsRevision: 0, revision: 0, photoSequence: 0, photoLoading: false, mode: 'canvas', commandAnswers: [], sketchAnswers: [],
    sync() {}, requests: { cancel() {} }, voice: { cancel() {} },
    list(id, items) { node(id).items = items.map(textContent => ({ textContent })); },
    questions(id, questions) { node(id).inputs = questions.map(q => Object.assign(new Node(), { dataset: { question: q.prompt } })); },
    openSource() { node('source-dialog').show(); },
  });
  return { ui, node };
}

test('voice bridge uses a non-modal review and rejects swallowed model errors', async t => {
  const { ui, node } = bridge(t);
  ui.command = async () => { node('command-status').textContent = 'Unlock live AI from the Draw panel.'; };
  await assert.rejects(ui.reviewWords('create a new scene'), /Unlock live AI/);
  assert.equal(node('command-dialog').open, true);
  ui.command = async () => { ui.proposal = {}; ui.list('command-changes', ['Mass 1 → 2 kg']); };
  assert.equal((await ui.reviewWords('set this mass x2')).reviewRequired, true);
});

test('spoken clarification answers keep the original command and answer all known questions', async t => {
  const { ui, node } = bridge(t); let requests = 0;
  ui.command = async () => {
    requests++;
    if (requests === 1) { ui.questions('command-questions', [{ prompt: 'How heavy?' }, { prompt: 'How wide?' }]); node('command-status').textContent = 'Tell me the dimensions.'; }
    else { assert.equal(node('command-text').value, 'build a box'); assert.deepEqual(JSON.parse(JSON.stringify(ui.answers('command-questions'))), [{ question: 'How heavy?', answer: 'two kilograms' }, { question: 'How wide?', answer: 'one meter' }]); ui.questions('command-questions', []); ui.proposal = {}; }
  };
  assert.equal((await ui.reviewWords('build a box')).reviewRequired, false);
  assert.equal((await ui.reviewWords('two kilograms')).message, 'How wide?');
  assert.equal(requests, 1);
  assert.equal((await ui.reviewWords('one meter')).reviewRequired, true);
});

test('voice sketch clarification stays on the sketch path and preview confirmation is explicit', async t => {
  const { ui, node } = bridge(t); let requests = 0, confirms = 0;
  ui.interpret = async () => {
    requests++;
    if (requests === 1) { ui.questions('sketch-questions', [{ prompt: 'How tall?' }]); node('source-status').textContent = 'Choose a scale.'; }
    else { assert.deepEqual(JSON.parse(JSON.stringify(ui.answers('sketch-questions'))), [{ question: 'How tall?', answer: 'one meter' }]); ui.questions('sketch-questions', []); ui.preview = {}; node('source-dialog').close(); }
  };
  ui.command = async () => { throw new Error('Must not reinterpret a sketch answer as a command'); };
  ui.finishPreview = confirm => { assert.equal(confirm, true); confirms++; ui.preview = undefined; node('message').textContent = 'Confirmed preview'; };
  assert.equal((await ui.buildPreviewWords()).reviewRequired, false);
  assert.equal((await ui.reviewWords('one meter')).reviewRequired, true);
  assert.equal(confirms, 0); assert.equal(ui.confirmPreviewWords().message, 'Confirmed preview');
  assert.equal(confirms, 1); assert.throws(() => ui.confirmPreviewWords(), /no current 3D preview/);
});

test('natural drawing intent survives a clarification and remains separate from optional measurements', async t => {
  const { ui, node } = bridge(t);
  node('source-notes').value = '';
  let calls = 0;
  ui.interpret = async () => {
    calls++;
    assert.equal(ui.sketchIntent, 'Build this picture into a physics model');
    assert.equal(node('source-notes').value, '');
    if (calls === 1) { ui.questions('sketch-questions', [{ prompt: 'Should this hinge be free or powered?' }]); }
    else { assert.equal(ui.answers('sketch-questions')[0].answer, 'free'); ui.questions('sketch-questions', []); ui.preview = {}; node('source-dialog').close(); }
  };
  assert.equal((await ui.buildPreviewWords(undefined, 'Build this picture into a physics model')).reviewRequired, false);
  assert.equal((await ui.reviewWords('free')).reviewRequired, true);
  assert.equal(calls, 2);
});

test('an unbuilt image remains available to conversation after closing or cancelling, but a confirmed source is not a permanent attachment', t => {
  const { ui, node } = bridge(t);ui.mode='photo';ui.photo={id:'photo'};ui.sourcePending=true;
  assert.equal(node('source-dialog').open,false);assert.equal(ui.hasDrawing,true);
  ui.cancelWords();assert.equal(ui.hasDrawing,true);
  ui.sourcePending=false;assert.equal(ui.hasDrawing,false);
  node('source-dialog').show();assert.equal(ui.hasDrawing,true);
  ui.photoLoading=true;assert.equal(ui.hasDrawing,false);
});

test('a new voice review waits for the previous dialog close cleanup and stale Apply fails', async t => {
  const { ui, node } = bridge(t); let applied = 0;
  node('command-dialog').show(); ui.proposal = {};
  node('command-dialog').addEventListener('close', () => { ui.proposal = undefined; });
  ui.apply = () => { applied++; ui.proposal = undefined; node('command-dialog').close(); };
  assert.equal(ui.applyWords().message, 'Applied the reviewed change.');
  ui.command = async () => { ui.proposal = {}; };
  assert.equal((await ui.reviewWords('set this mass x2')).reviewRequired, true);
  ui.sync = () => { ui.proposal = undefined; };
  assert.throws(() => ui.applyWords(), /no current reviewed change/);
  assert.equal(applied, 1);
});

test('cancel clears both pending channels, proposal, clarification and draft preview', t => {
  const { ui, node } = bridge(t), cancelled = [];
  ui.requests.cancel = kind => cancelled.push(kind);
  ui.proposal = {}; ui.preview = {}; ui.questions('command-questions', [{ prompt: 'Which part?' }]);
  ui.finishPreview = confirm => { assert.equal(confirm, false); ui.preview = undefined; };
  ui.cancelWords();
  assert.deepEqual(cancelled, ['command', 'sketch']);
  assert.equal(ui.proposal, undefined); assert.equal(ui.active, false);
  assert.equal(node('command-questions').inputs.length, 0);
  assert.throws(() => ui.applyWords(), /no current reviewed change/);
});

const preparedPhoto = id => ({ ok: true, image: { sha256: id, blob: { dataUrl: `data:image/jpeg;base64,${id}` }, widthPx: 800, heightPx: 600 } });

test('receiving a normalized photo selects photo mode and signals readiness exactly once', async t => {
  const { ui, node } = bridge(t); const calls = [];
  preparePhoto = async file => { calls.push(file); return preparedPhoto('new-photo'); };
  ui.host = { onPhotoReady() { assert.equal(ui.photoLoading, false); assert.equal(ui.mode, 'photo'); calls.push('ready'); } };
  const file = { name: 'paper.jpg' };
  await ui.receivePhoto(file);
  assert.deepEqual(calls, [file, 'ready']);
  assert.equal(ui.photo.id, 'new-photo');
  assert.equal(node('photo-area').hidden, false); assert.equal(node('sketch').hidden, true);
  assert.equal(node('source-dialog').open, false, 'Panel upload works while the legacy source panel is closed');
  assert.match(node('source-status').textContent, /Photo ready/);
});

test('only the newest upload can publish its photo and start the automatic workflow', async t => {
  const { ui } = bridge(t), finished = new Map(), calls = [];
  preparePhoto = file => new Promise(resolve => finished.set(file.name, resolve));
  ui.host = { onPhotoReady() { calls.push(ui.photo.id); } };
  const old = ui.receivePhoto({ name: 'old' }), newest = ui.receivePhoto({ name: 'new' });
  finished.get('new')(preparedPhoto('new')); await newest;
  finished.get('old')(preparedPhoto('old')); await old;
  assert.equal(ui.photo.id, 'new'); assert.deepEqual(calls, ['new']); assert.equal(ui.photoLoading, false);
});

test('receivePhoto awaits the automatic pipeline after normalization and never retries a failed callback', async t => {
  const { ui } = bridge(t); let started, finish, callbacks = 0, settled = false;
  const ready = new Promise(resolve => { started = resolve; });
  const pipeline = new Promise(resolve => { finish = resolve; });
  preparePhoto = async () => preparedPhoto('awaited-photo');
  ui.host = { onPhotoReady() { callbacks++; assert.equal(ui.photoLoading, false); started(); return pipeline; } };
  const pending = ui.receivePhoto({ name: 'paper.jpg' }).then(() => { settled = true; });
  await ready; await Promise.resolve(); assert.equal(settled, false);
  finish(); await pending; assert.equal(settled, true); assert.equal(callbacks, 1);
  ui.host.onPhotoReady = async () => { callbacks++; throw new Error('Automatic pipeline failed.'); };
  await assert.rejects(ui.receivePhoto({ name: 'another.jpg' }), /Automatic pipeline failed/);
  assert.equal(callbacks, 2); assert.equal(ui.photoLoading, false); assert.equal(ui.photo.id, 'awaited-photo');
});

test('cancelling normalization suppresses its late automatic callback and retains the existing source', async t => {
  const { ui } = bridge(t); let finish, calls = 0;
  ui.photo = { id: 'retained' };
  preparePhoto = () => new Promise(resolve => { finish = resolve; });
  ui.host = { onPhotoReady() { calls++; } };
  const pending = ui.receivePhoto({ name: 'cancelled' });
  ui.cancelWords(); finish(preparedPhoto('cancelled')); await pending;
  assert.equal(calls, 0); assert.equal(ui.photo.id, 'retained'); assert.equal(ui.photoLoading, false);
});

test('a superseded automatic pipeline failure cannot overwrite the newest photo status', async t => {
  const { ui, node } = bridge(t); let started, rejectOld;
  const ready = new Promise(resolve => { started = resolve; });
  const oldPipeline = new Promise((_, reject) => { rejectOld = reject; });
  preparePhoto = async file => preparedPhoto(file.name);
  ui.host = { onPhotoReady() { if (ui.photo.id === 'old') { started(); return oldPipeline; } } };
  const old = ui.receivePhoto({ name: 'old' }); await ready;
  await ui.receivePhoto({ name: 'new' });
  rejectOld(new Error('Superseded pipeline failed.')); await old;
  assert.equal(ui.photo.id, 'new'); assert.match(node('source-status').textContent, /Photo ready/);
});

test('invalid new photos reject without a callback or automatic retry, and empty legacy selection is a no-op', async t => {
  const { ui, node } = bridge(t); let preparations = 0, calls = 0;
  ui.photo = { id: 'retained' };
  preparePhoto = async () => { preparations++; return { ok: false, reject: { message: 'Unsupported image type.' } }; };
  ui.host = { onPhotoReady() { calls++; } };
  await assert.rejects(ui.receivePhoto({ name: 'bad.pdf' }), /Unsupported image type/);
  assert.equal(preparations, 1); assert.equal(calls, 0); assert.equal(ui.photo.id, 'retained');
  assert.equal(ui.photoLoading, false); assert.match(node('source-status').textContent, /Unsupported image/);
  const sequence = ui.photoSequence;
  await ui.loadPhoto(); assert.equal(ui.photoSequence, sequence); assert.equal(preparations, 1);
});

test('photo prompts allow declared defaults while retaining unsupported-physics and custom-creation boundaries', () => {
  assert.match(INTERPRET_3D, /object vocabulary is open/);
  assert.match(INTERPRET_3D, /Missing scale, depth or material measurements alone must not block interpretation/);
  assert.match(INTERPRET_3D, /declare every default in scene.assumptions as estimated rather than measured/);
  assert.match(INTERPRET_3D, /Ask clarification only when critical structure or physical intent cannot reasonably be inferred/);
  assert.doesNotMatch(INTERPRET_3D, /Ask for a numerical dimension when scale is unknown/);
  assert.match(INTERPRET_3D, /must not be animated with invented power/);
  assert.match(COMMAND_3D, /propose a sole replace-scene\{scene\} operation/);
  assert.match(COMMAND_3D, /Do not combine replace-scene with other operations or lifecycle/);
  assert.match(COMMAND_3D, /Creation is still proposed for user review before Apply/);
  assert.equal(REQUEST_TIMEOUTS.sketch, 120_000); assert.equal(REQUEST_TIMEOUTS.command, 120_000);
});

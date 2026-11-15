import './style.css';
import './ui/shell.css';
import { initShell } from './ui/shell.ts';
import { InputUI } from './input/ui.ts';
import { VoiceSession } from './assistant/voice.ts';
import { AssistantActions, normalizeAssistantInput, isAssistantCancellation } from './assistant/actions.ts';
import type { AssistantReply } from './assistant/actions.ts';
import { initAssistantPanel } from './assistant/panel.ts';
import { demonstrate, warmupRendering } from './assistant/demo.ts';
import { unlockJudgeAccess, unlockJudgeLink } from './assistant/access.ts';
import { proposalMarks } from './assistant/proposal.ts';
import './assistant/panel.css';
import * as THREE from 'three';
import { Viewport } from './viewport.ts';
import { FixedClock, initPhysics, Physics } from './physics/engine.ts';
import type { BodySample, Run } from './physics/engine.ts';
import { BrowserStorage, validateLibrary, Workbench } from './physics/experiments.ts';
import { EXAMPLES, rampBall } from './physics/examples.ts';
import { check, emptyScene, newObject, validateScene, LIMITS } from './physics/scene.ts';
import type { Kind, Operation, Scene, SceneObject } from './physics/scene.ts';
import rampReplay from '../docs/evidence/f1-comparison-2026-11-10/Nox-ramp-and-cup.json?url';
import fanReplay from '../docs/evidence/fan-friction-comparison/Nox-fan-and-friction.json?url';
import cartReplay from '../docs/evidence/spring-cart-comparison/Nox-spring-cart.json?url';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('scene');
let viewport: Viewport;
let inputUI: InputUI | undefined;
const storage = new BrowserStorage(), clock = new FixedClock();
let bench: Workbench, selectedId = '', dirty = false, busy = false;
let openingReplay = false;
let lastFrame = 0, lastPanel = 0;
let sceneContext: Workbench['commandContext'] | undefined;
let assistant: ReturnType<typeof initAssistantPanel>, voice: VoiceSession, assistantActions: AssistantActions;
let demoController: AbortController | undefined;
let assistantTurn = 0;
let photoEpoch = 0, automaticPhotoEpoch = 0;
let checkingPhoto = false;
let judgeAccessReady: Promise<void> = Promise.resolve();
const propertyForm = el<HTMLFormElement>('properties'), worldForm = el<HTMLFormElement>('world');
const templates = el<HTMLSelectElement>('examples'), startButton = el<HTMLButtonElement>('new');
const replays = new Map([
  ['recorded-ramp', { url: rampReplay, objectId: 'ball' }],
  ['recorded-fan', { url: fanReplay, objectId: 'box' }],
  ['recorded-cart', { url: cartReplay, objectId: 'cart-body' }],
]);
function error(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e), editorOpen = el<HTMLDialogElement>('scene-editor').open;
  el('error').textContent = message;
  el('scene-error').textContent = editorOpen ? message : '';
  if (!editorOpen) el('error').scrollIntoView({ block: 'nearest' });
}
function act(action: () => void): void {
  try { el('error').textContent = ''; el('scene-error').textContent = ''; action(); dirty = true; clock.reset(); lastFrame = 0; refresh(); }
  catch (e) { error(e); el<HTMLSelectElement>('experiments').value = bench.experiment.id; el<HTMLSelectElement>('versions').value = bench.selected.id; draw(); }
}
async function asyncAct(action: () => Promise<void>): Promise<void> {
  if (busy) return; busy = true; el<HTMLButtonElement>('save').disabled = true;
  try { el('error').textContent = ''; await action(); refresh(); }
  catch (e) { error(e); } finally { busy = false; el<HTMLButtonElement>('save').disabled = !bench; inputUI?.sync(); }
}
function option(select: HTMLSelectElement, value: string, label: string): void { select.add(new Option(label, value)); }
function refreshStartButton(): void {
  startButton.textContent = openingReplay ? 'Opening replay…' : replays.has(templates.value) ? 'Open replay' : 'New experiment';
  startButton.disabled = !bench || openingReplay || !!inputUI?.active;
}
function selection(): SceneObject | undefined { const o = bench.scene.objects.find(o => o.id === selectedId), b = bench.sample.bodies.find(b => b.objectId === selectedId); return o && b ? { ...o, position: b.position, rotation: b.rotation, velocity: b.velocity, angularVelocity: b.angularVelocity } : undefined; }
function fillProperties(): void {
  const o = selection(); propertyForm.querySelector('fieldset')!.disabled = !o || bench.restartRequired || bench.replayTime !== null;
  const scope = el<HTMLSelectElement>('transform-scope'), previous = scope.value; scope.replaceChildren(new Option('Selected part', ''));
  bench.scene.assemblies.filter(a => a.bodies.includes(selectedId)).forEach(a => option(scope, a.id, a.label));
  scope.value = [...scope.options].some(o => o.value === previous) ? previous : ''; scope.disabled = !o; if (viewport) viewport.assemblyId = scope.value;
  el<HTMLButtonElement>('scale').disabled = !!scope.value; if (scope.value && viewport?.transform.getMode() === 'scale') transformMode('translate');
  if (!o) return;
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(o.rotation.x, o.rotation.y, o.rotation.z, o.rotation.w), 'XYZ');
  const values = { label: o.label, x: o.position.x, y: o.position.y, z: o.position.z, width: o.width, height: o.height, depth: o.depth,
    rx: rotation.x * 180 / Math.PI, ry: rotation.y * 180 / Math.PI, rz: rotation.z * 180 / Math.PI, mass: o.mass, vx: o.velocity.x, vy: o.velocity.y, vz: o.velocity.z,
    wx: o.angularVelocity.x, wy: o.angularVelocity.y, wz: o.angularVelocity.z, friction: o.friction, restitution: o.restitution, wall: o.wallThickness };
  for (const [key, value] of Object.entries(values)) (propertyForm.elements.namedItem(key) as HTMLInputElement).value = typeof value === 'number' ? String(Number(value.toFixed(7))) : value;
  (propertyForm.elements.namedItem('fixed') as HTMLInputElement).checked = o.fixed;
}
function refresh(): void {
  if (!bench) return;
  const e = bench.experiment;
  el('scene-title').textContent = e.name; el('object-count').textContent = String(bench.scene.objects.length);
  for (const id of ['save', 'export', 'import', 'add', 'fit', 'baseline', 'versions', 'experiments', 'experiment-name', 'translate', 'rotate', 'scale', 'front', 'focus', 'show-analysis', 'edit-scene', 'export-scene']) el<HTMLButtonElement>(id).disabled = false;
  refreshStartButton();
  const blocked = bench.restartRequired || bench.replayTime !== null;
  worldForm.querySelector('fieldset')!.disabled = blocked;
  el<HTMLButtonElement>('add').disabled = blocked; el<HTMLButtonElement>('edit-scene').disabled = blocked;
  const experiments = el<HTMLSelectElement>('experiments'); experiments.replaceChildren();
  bench.library.experiments.forEach(e => option(experiments, e.id, e.name)); experiments.value = e.id;
  const versions = el<HTMLSelectElement>('versions'); versions.replaceChildren();
  e.versions.forEach(v => option(versions, v.id, `${v.name} (${v.run.samples.at(-1)!.simulationTime.toFixed(2)} s)`)); versions.value = bench.selected.id;
  el<HTMLInputElement>('experiment-name').value = e.name;
  const objects = el<HTMLSelectElement>('objects'); objects.replaceChildren();
  if (!bench.scene.objects.some(o => o.id === selectedId)) selectedId = bench.scene.objects.find(o => !o.fixed)?.id ?? bench.scene.objects[0]?.id ?? '';
  bench.scene.objects.forEach(o => option(objects, o.id, `${o.label}${o.fixed ? ' (fixed)' : ''}`)); objects.value = selectedId; objects.disabled = !selectedId;
  el('empty').hidden = !!selectedId;
  for (const id of ['play', 'step', 'reset']) el<HTMLButtonElement>(id).disabled = !bench.scene.objects.length || (id !== 'reset' && (bench.restartRequired || bench.replayTime !== null || bench.physics.time >= LIMITS.seconds - 1e-8));
  el<HTMLButtonElement>('pause').disabled = !bench.running;
  el<HTMLButtonElement>('replay').disabled = bench.selected.run.samples.length < 2;
  el<HTMLButtonElement>('live').disabled = bench.replayTime === null;
  el<HTMLButtonElement>('csv').disabled = !selectedId;
  const scrub = el<HTMLInputElement>('scrub'); scrub.max = String(bench.selected.run.samples.at(-1)!.simulationTime); scrub.disabled = bench.selected.run.samples.length < 2;
  fillProperties();
  (worldForm.elements.namedItem('gx') as HTMLInputElement).value = String(bench.scene.gravity.x);
  (worldForm.elements.namedItem('gy') as HTMLInputElement).value = String(bench.scene.gravity.y);
  (worldForm.elements.namedItem('gz') as HTMLInputElement).value = String(bench.scene.gravity.z);
  (worldForm.elements.namedItem('scale') as HTMLInputElement).value = String(bench.scene.scale);
  el('assumptions').replaceChildren(...bench.scene.assumptions.map(a => { const li = document.createElement('li'); li.textContent = a; return li; }));
  const intervention = bench.selected.run.interventions.at(-1);
  el('intervention').textContent = intervention ? `${intervention.description} at ${intervention.previousTime.toFixed(3)} s in the previous version. This version starts at 0 s.` : 'Edits preserve the prior version and pause playback.';
  el('message').textContent = `${bench.notice || 'Physics workbench ready.'}${dirty ? ' Unsaved changes.' : ''}`;
  panels(); draw(); inputUI?.sync();
}
function fit(): void { draw(); viewport?.fit(bench.scene); }
function draw(): void {
  if (!bench || !viewport || viewport.transform.dragging) return;
  const baseline = bench.experiment.baseline;
  viewport.transform.enabled = document.body.dataset.tools === 'open' && !bench.restartRequired && bench.replayTime === null;
  viewport.update(bench.scene, bench.sample, selectedId, baseline ? { scene: baseline.scene, sample: baseline.run.samples.findLast(s => s.simulationTime <= bench.sample.simulationTime + 1e-8) ?? baseline.run.samples[0] } : undefined);
}
function svgNode(tag: string, attributes: Record<string, string>, textValue?: string): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); if (textValue !== undefined) node.textContent = textValue; return node;
}
function metricValue(b: BodySample): number {
  const metric = el<HTMLSelectElement>('metric').value; return metric === 'x' ? b.position.x : metric === 'y' ? b.position.y : metric === 'z' ? b.position.z : b.speed;
}
function graphSeries(run: Run): { t: number; v: number }[] {
  return run.samples.flatMap(s => { const b = s.bodies.find(b => b.objectId === selectedId); return b ? [{ t: s.simulationTime, v: metricValue(b) }] : []; });
}
function panels(): void {
  const sample = bench.sample, body = sample.bodies.find(b => b.objectId === selectedId);
  el('clock').textContent = `${sample.simulationTime.toFixed(3)} s`; el('mode').textContent = bench.replayTime !== null ? 'Recorded replay' : bench.running ? 'Running' : 'Paused';
  el<HTMLButtonElement>('pause').disabled = !bench.running;
  const run = bench.selected.run, scrub = el<HTMLInputElement>('scrub'); scrub.max = String(run.samples.at(-1)!.simulationTime); scrub.disabled = run.samples.length < 2;
  if (document.activeElement !== scrub) scrub.value = String(bench.replayTime ?? sample.simulationTime);
  el<HTMLButtonElement>('replay').disabled = run.samples.length < 2;
  el('readout').textContent = body ? `x ${body.position.x.toFixed(3)} m    y ${body.position.y.toFixed(3)} m    z ${body.position.z.toFixed(3)} m    speed ${body.speed.toFixed(3)} m/s    spin ${Math.hypot(body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z).toFixed(3)} rad/s` : 'No object selected. Add a body to start measuring.';
  el('mechanisms').textContent = sample.mechanisms ? [...sample.mechanisms.connections.filter(c => c.effort !== 0).map(c => `${c.id}: ${c.effort.toFixed(3)} ${bench.scene.constraints.find(j => j.id === c.id)?.type === 'hinge' ? 'N·m' : 'N'}, ${c.power.toFixed(3)} W`), ...sample.mechanisms.fans.map(f => `${f.id}: shaft ${f.angularVelocity.toFixed(2)} rad/s, thrust ${f.thrust.toFixed(3)} N, shaft load ${f.shaftPower.toFixed(3)} W, wake budget ${f.availablePower.toFixed(3)} W`)].join(' · ') : '';
  el('energy').textContent = `Kinetic ${sample.kineticEnergy.toFixed(3)} J (translation + rotation). Potential (gravity + spring) ${sample.potentialEnergy.toFixed(3)} J. Momentum (${sample.momentum.x.toFixed(3)}, ${sample.momentum.y.toFixed(3)}, ${sample.momentum.z.toFixed(3)}) kg·m/s. External forces may change these totals.`;
  const baseline = bench.experiment.baseline, a = graphSeries(run), b = baseline ? graphSeries(baseline.run) : [];
  const points = [...a, ...b], end = Math.max(1, ...points.map(p => p.t));
  let min = Math.min(0, ...points.map(p => p.v)), max = Math.max(1, ...points.map(p => p.v));
  const pad = (max - min) * .08; min -= pad; max += pad;
  const x = (t: number) => 62 + t / end * 575, y = (v: number) => 158 - (v - min) / (max - min) * 140;
  const graph = el('graph'); graph.replaceChildren();
  graph.append(svgNode('title', {}, `${el<HTMLSelectElement>('metric').selectedOptions[0].text} versus simulation time for ${selection()?.label ?? 'selected object'}`));
  for (let i = 0; i <= 4; i++) { const t = end * i / 4, value = min + (max - min) * i / 4;
    graph.append(svgNode('line', { x1: '62', x2: '637', y1: String(y(value)), y2: String(y(value)), class: 'graph-grid' }),
      svgNode('text', { x: '52', y: String(y(value) + 4), 'text-anchor': 'end' }, value.toFixed(2)),
      svgNode('text', { x: String(x(t)), y: '180', 'text-anchor': 'middle' }, t.toFixed(1)));
  }
  graph.append(svgNode('text', { x: '350', y: '198', 'text-anchor': 'middle' }, 'Simulation time (s)'));
  for (const [data, cls] of [[a, 'current-line'], [b, 'baseline-line']] as const) if (data.length) graph.append(svgNode('path', { d: data.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.v)}`).join(' '), class: cls }));
  el('comparison').textContent = baseline ? `Solid: current. Dashed: ${baseline.name}, retained baseline. Both start at 0 s; no extrapolation beyond recorded data.${!b.length ? ' Selected object is absent from the baseline.' : ''}` : 'Solid: current version. Keep a baseline before editing to compare measured outcomes.';
  const rows = run.samples.slice(-8).flatMap(s => { const b = s.bodies.find(b => b.objectId === selectedId); if (!b) return []; const tr = document.createElement('tr');
    [s.simulationTime, b.position.x, b.position.y, b.position.z, b.speed].forEach(v => { const td = document.createElement('td'); td.textContent = v.toFixed(4); tr.append(td); }); return [tr]; }); el('samples').replaceChildren(...rows); inputUI?.sync();
}
function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function rotationValue(x: number, y: number, z: number) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x * Math.PI / 180, y * Math.PI / 180, z * Math.PI / 180, 'XYZ')); return { x: q.x, y: q.y, z: q.z, w: q.w }; }
function edit(operations: Operation[], description: string): void { bench.edit({ ...bench.commandContext, operations }, description); }
el('play').onclick = () => act(() => bench.play());
el('pause').onclick = () => act(() => { bench.pause(); bench.capture(); });
el('step').onclick = () => act(() => { bench.pause(); bench.tick(); bench.capture(); });
el('reset').onclick = () => act(() => { bench.reset(); bench.notice = 'Reset to the selected setup. Previous recorded version retained.'; });
el('fit').onclick = () => { fit(); draw(); };
el('show-analysis').onclick = () => { const panel = el('analysis'); panel.hidden = !panel.hidden; el('show-analysis').setAttribute('aria-expanded', String(!panel.hidden)); panels(); };
function transformMode(mode: 'translate' | 'rotate' | 'scale'): void { viewport.transform.setMode(mode); for (const item of ['translate', 'rotate', 'scale']) el(item).setAttribute('aria-pressed', String(item === mode)); }
for (const mode of ['translate', 'rotate', 'scale'] as const) el(mode).onclick = () => transformMode(mode);
el<HTMLSelectElement>('transform-scope').onchange = () => { viewport.assemblyId = el<HTMLSelectElement>('transform-scope').value; if (viewport.assemblyId) transformMode('translate'); el<HTMLButtonElement>('scale').disabled = !!viewport.assemblyId; };
el('front').onclick = () => viewport.front();
el('focus').onclick = () => { const o = selection(); if (o) viewport.focus(o.position); };
el('baseline').onclick = () => act(() => bench.pinBaseline());
el('replay').onclick = () => act(() => bench.replay(0));
el('live').onclick = () => act(() => bench.resumeLive());
el<HTMLInputElement>('scrub').oninput = event => act(() => bench.replay(Number((event.target as HTMLInputElement).value)));
el<HTMLSelectElement>('objects').onchange = event => { selectedId = (event.target as HTMLSelectElement).value; fillProperties(); panels(); draw(); };
el<HTMLSelectElement>('metric').onchange = () => panels();
el<HTMLSelectElement>('versions').onchange = event => act(() => { bench.selectVersion((event.target as HTMLSelectElement).value); fit(); });
el<HTMLSelectElement>('experiments').onchange = event => act(() => { bench.selectExperiment((event.target as HTMLSelectElement).value); fit(); });
templates.onchange = refreshStartButton;
startButton.onclick = () => {
  const key = templates.value, replay = replays.get(key);
  if (replay) void openReplay(key, replay.url, replay.objectId);
  else act(() => { bench.newExperiment(key === 'blank' ? emptyScene() : EXAMPLES[key as keyof typeof EXAMPLES]()); fit(); });
};
async function openReplay(key: string, url: string, objectId: string): Promise<void> {
  const original = bench, context = bench.contextToken;
  openingReplay = true;
  refreshStartButton();
  el('error').textContent = '';
  try {
    const message = 'Could not load this replay. Choose Open replay to try again.';
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      .catch(cause => { throw new Error(message, { cause }); });
    check(response.ok, message);
    const library = validateLibrary(await response.json());
    check(bench === original && bench.contextToken === context && !inputUI?.active && templates.value === key,
      'The workbench changed while loading. Choose Open replay again.');
    act(() => {
      if (bench.library.experiments.some(e => e.id === library.selectedExperimentId)) {
        bench.selectExperiment(library.selectedExperimentId);
        bench.notice = 'Opened your existing experiment. Your versions and edits are retained.';
      } else bench.importLibrary(library);
      selectedId = objectId;
      el('analysis').hidden = false;
      el('show-analysis').setAttribute('aria-expanded', 'true');
      el<HTMLSelectElement>('metric').value = 'x';
      fit();
    });
  } catch (e) { error(e); }
  finally { openingReplay = false; refreshStartButton(); }
}

function assistantChanged(): void { dirty = true; clock.reset(); lastFrame = 0; assistant?.setSceneAvailable(bench.scene.objects.length > 0); refresh(); }
function assistantScene(scene: Scene): void {
  check(!inputUI?.active, 'Confirm or cancel the current preview first.');
  bench.newExperiment(scene); selectedId = scene.objects.find(object => !object.fixed)?.id ?? '';
  el<HTMLDialogElement>('source-dialog').close(); document.body.dataset.drawer = '';
  assistantChanged(); fit();
}
function assistantExample(name: string): Scene {
  const aliases: Record<string, keyof typeof EXAMPLES> = { spring: 'spring', oscillator: 'spring', pendulum: 'pendulum', collision: 'collision', momentum: 'collision', fan: 'fan', domino: 'dominoes', dominoes: 'dominoes', ramp: 'ramp', cup: 'ramp', bridge: 'composition', composition: 'composition' };
  const match = /\b(spring|oscillator|pendulum|collision|momentum|fan|dominoes|domino|ramp|cup|bridge|composition)\b/i.exec(name);
  const key = match && aliases[match[1]!.toLowerCase()]; check(key, 'I do not have that built-in example. Describe the custom system and I can request a reviewed AI proposal.');
  return EXAMPLES[key]();
}
async function assistantSay(text: string): Promise<void> {
  assistant.say(text);
  if (voice.isActive) await voice.speak(text);
}
/** Make the conversation spatial: a reviewed change appears as ghosts/arrows and a note until yes or cancel. */
let lastProposal: { id: string; text: string } | undefined, appliedNote: ReturnType<typeof setTimeout> | undefined;
function showProposal(response: AssistantReply): void {
  lastProposal = undefined;
  const operations = response.reviewRequired && !inputUI?.active ? inputUI?.proposedOperations ?? [] : [];
  if (!operations.length) return;
  const marks = proposalMarks(bench.physics.currentScene(), operations), text = response.changes.join(' · ') || response.message;
  viewport.showProposal(marks, text); if (marks[0]) lastProposal = { id: marks[0].id, text };
}
function clearConversationMarks(): void { clearTimeout(appliedNote); viewport?.clearProposal(); viewport?.clearNote(); viewport?.clearSourcePrint(); }
const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.dataset.motion === 'paused';
document.addEventListener('nox:source', event => { if (viewport && bench) viewport.showSourcePrint((event as CustomEvent<HTMLCanvasElement>).detail, bench.scene, stillMotion()); });
async function presentAssistantReply(response: AssistantReply, turn: number): Promise<void> {
  if (turn !== assistantTurn) return;
  showProposal(response);
  if (automaticPhotoEpoch && automaticPhotoEpoch === photoEpoch && inputUI?.active && response.reviewRequired) {
    assistant.say(`Your drawing has become a validated 3D scene. I am starting the experiment automatically.\n${response.changes.join('\n')}`);
    await assistantActions.handle('yes');
    if (turn !== assistantTurn) return;
    automaticPhotoEpoch = 0;
    await assistantActions.handle('run');
    if (turn === assistantTurn) await assistantSay('Your drawing is now a running 3D experiment. Tell me which part to move or what to change. I will explain edits and wait for your yes before applying them. You can also say pause or save.');
    return;
  }
  await assistantSay([response.message, ...response.changes].join('\n'));
}
async function receiveAssistantPhoto(file: File): Promise<void> {
  clearConversationMarks();
  const epoch = ++photoEpoch, turn = ++assistantTurn;
  automaticPhotoEpoch = 0; demoController?.abort(); await assistantActions.handle('cancel');
  if (epoch !== photoEpoch || turn !== assistantTurn) return;
  voice.setThinking(true); assistant.setState('thinking', 'Preparing your photo. It will be checked automatically.');
  void assistantSay('I am preparing the photo. Then I will check the drawing and build its physical scene.');
  try { await inputUI!.receivePhoto(file); }
  catch (cause) {
    if (epoch === photoEpoch && turn === assistantTurn) {
      const message = cause instanceof Error ? cause.message : String(cause); assistant.error(message);
      if (voice.isActive) await voice.speak(message); voice.setThinking(false);
    }
  }
}
async function checkUploadedPhoto(): Promise<void> {
  const epoch = ++photoEpoch, turn = ++assistantTurn;
  await assistantActions.handle('cancel');
  if (epoch !== photoEpoch || turn !== assistantTurn) return;
  automaticPhotoEpoch = epoch; voice.setThinking(true); assistant.setState('thinking', 'Checking your drawing and building a 3D model. Model requests are bounded to 120 seconds.');
  checkingPhoto = true;
  try {
    await judgeAccessReady;
    if (turn !== assistantTurn) return;
    const pending = assistantActions.handle('interpret my photo');
    voice.setThinking(false);
    const response = await pending; checkingPhoto = false;
    if (turn === assistantTurn) { voice.setThinking(true); await presentAssistantReply(response, turn); }
  }
  catch (cause) {
    if (epoch === photoEpoch && turn === assistantTurn) {
      automaticPhotoEpoch = 0; const message = cause instanceof Error ? cause.message : String(cause); assistant.error(message); if (voice.isActive) await voice.speak(message);
    }
  } finally { if (turn === assistantTurn) { checkingPhoto = false; voice.setThinking(false); if (!voice.isActive) assistant.setState('idle'); } }
}
function compareMeasurements(): string {
  bench.pause(); bench.capture(); const baseline = bench.experiment.baseline;
  check(baseline, 'I need an original measured run first. Ask me to keep a baseline before changing the experiment.');
  const time = Math.min(bench.sample.simulationTime, baseline.run.samples.at(-1)!.simulationTime);
  const before = baseline.run.samples.findLast(sample => sample.simulationTime <= time + 1e-8)?.bodies.find(body => body.objectId === selectedId);
  const after = bench.selected.run.samples.findLast(sample => sample.simulationTime <= time + 1e-8)?.bodies.find(body => body.objectId === selectedId);
  check(before && after, 'The selected part needs samples in both the original and edited runs. Ask me to select a shared part.');
  el('analysis').hidden = false; el('show-analysis').setAttribute('aria-expanded', 'true'); assistantChanged();
  return `At ${time.toFixed(2)} simulated seconds, ${selection()?.label ?? 'the selected part'} had speed ${before.speed.toFixed(3)} meters per second in the original and ${after.speed.toFixed(3)} in the current run. The plots show the measured baseline and current run.`;
}
async function saveAssistantExperiment(): Promise<void> {
  check(!inputUI?.active, 'Confirm or cancel the preview before saving.');
  dirty = !(await bench.save(storage)); clock.reset(); lastFrame = 0; refresh();
  check(!dirty, 'The experiment changed while saving. Please ask me to save again.');
}
async function runAssistantFor(seconds: number, signal: AbortSignal): Promise<void> {
  const current = bench, context = bench.contextToken, target = bench.physics.time + seconds, started = performance.now();
  bench.pause(); assistantChanged();
  await warmupRendering(draw, () => new Promise(resolve => requestAnimationFrame(resolve)), signal, () => !!document.querySelector('.viewport-wrap.reveal'));
  check(bench === current && bench.contextToken === context && !document.hidden, 'The experiment changed before the run began.');
  warmSolver(bench.physics.currentScene());
  bench.play(); assistantChanged();
  voice.setThinking(false);
  try {
    while (bench.physics.time < target - 1e-8) {
      check(!signal.aborted && !document.hidden, 'Demonstration stopped. Your experiments are retained.');
      check(bench === current && bench.contextToken === context, 'The active experiment changed. I stopped the demonstration.');
      check(bench.running, 'The solver paused before the measurement finished. Your samples are retained; ask me to run the demonstration again.');
      check(performance.now() - started < 30_000, 'The simulation took too long on this device. I stopped and retained its samples.');
      await new Promise<void>(resolve => setTimeout(resolve, 40));
    }
  } finally { voice.setThinking(true); if (bench === current) { current.pause(); current.capture(); assistantChanged(); } }
}
async function handleAssistant(text: string): Promise<void> {
  if (!text.trim()) return;
  const turn = ++assistantTurn;
  assistant.heard(text); clearConversationMarks();
  demoController?.abort();
  if (/^(stop listening|go to sleep|goodbye|mute)$/.test(normalizeAssistantInput(text))) {
    checkingPhoto = false; automaticPhotoEpoch = 0; photoEpoch++; voice.stop(); await assistantActions.handle('cancel'); el<HTMLDialogElement>('source-dialog').close(); bench.pause(); bench.capture(); assistantChanged(); assistant.say('Voice is off. Your experiment is retained. Enable voice whenever you want to continue.'); return;
  }
  voice.setThinking(true); assistant.setState('thinking');
  try {
    const response = await assistantActions.handle(text);
    if (isAssistantCancellation(text)) { el<HTMLDialogElement>('source-dialog').close(); assistantChanged(); }
    await presentAssistantReply(response, turn);
  } catch (cause) { if (turn === assistantTurn) { const message = cause instanceof Error ? cause.message : String(cause); assistant.error(message); if (voice.isActive) await voice.speak(message); } }
  finally { if (turn === assistantTurn) { voice.setThinking(false); if (!voice.isActive) assistant.setState('idle'); } }
}
/**
 * The first solver steps of a scene are several times slower (WebAssembly warm-up, first world snapshots); on Windows
 * Chrome that alone exceeded the 0.1 s delayed-frame guard. Warm a throwaway copy off the clock. The user's
 * experiment, history and the guard are untouched.
 */
function warmSolver(scene: Scene): void {
  let copy: Physics | undefined;
  try { copy = new Physics(scene); for (let i = 0; i < 24; i++) copy.step(); } catch { /* best effort only */ } finally { copy?.free(); }
}
async function runAssistantScene(): Promise<string> {
  check(!inputUI?.active, 'Confirm the preview before running.'); check(bench.scene.objects.length > 0, 'Tell me what to build first, or say show me what you can do.');
  bench.resumeLive(); el<HTMLDialogElement>('source-dialog').close(); assistantChanged();
  const context = bench.contextToken, turn = assistantTurn; await warmupRendering(draw, () => new Promise(resolve => requestAnimationFrame(resolve)), AbortSignal.timeout(9000), () => !!document.querySelector('.viewport-wrap.reveal'));
  check(turn === assistantTurn && bench.contextToken === context && !document.hidden, 'The request changed or was stopped before the run began.');
  warmSolver(bench.physics.currentScene());
  const started = performance.now(), initialTime = bench.physics.time; bench.play(); assistantChanged();
  while (bench.physics.time < initialTime + .15) {
    check(turn === assistantTurn && bench.contextToken === context && bench.running && !document.hidden, 'The solver paused before the run was established. Your experiment is retained.');
    check(performance.now() - started < 3000, 'The solver has not advanced on this device. Your experiment is retained.');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return 'The real simulation is running. Say pause, keep a baseline, or compare.';
}

function startAssistant(): void {
  let greeting = false;
  assistant = initAssistantPanel({
    onStart: () => { assistant.open(); greeting = true; voice.start(); },
    onStop: async () => { assistant.interrupt(); clearConversationMarks(); greeting = false; assistantTurn++; checkingPhoto = false; automaticPhotoEpoch = 0; photoEpoch++; voice.stop(); await assistantActions.handle('cancel'); el<HTMLDialogElement>('source-dialog').close(); bench.pause(); bench.capture(); assistantChanged(); assistant.setState('idle'); assistant.say('Stopped. Your work is retained.'); },
    isVoiceActive: () => voice?.isActive ?? false,
    onSend: text => handleAssistant(text),
    onPhoto: file => receiveAssistantPhoto(file),
    onUnlock: async code => { judgeAccessReady = unlockJudgeAccess(code); await judgeAccessReady; },
  });
  voice = new VoiceSession({
    onHearing: active => assistant.hearing(active),
    onWord: () => assistant.word(),
    onTranscript: text => {
      if (/^(stop listening|go to sleep|goodbye|mute)$/.test(normalizeAssistantInput(text))) { void handleAssistant(text); return; }
      if (checkingPhoto && !/^(?:cancel|stop|never mind)(?: (?:it|that|checking|the request))?$/.test(normalizeAssistantInput(text))) {
        void assistantSay('I am still checking the drawing. You can say cancel to stop the request. I will ask if I need a detail from you.').finally(() => voice.setThinking(false)); return;
      }
      if (checkingPhoto) { checkingPhoto = false; void handleAssistant('cancel'); }
      else void handleAssistant(text);
    },
    onState: state => {
      assistant.setState(state, checkingPhoto ? 'Checking the drawing. You can say cancel while it builds.' : '');
      if (state === 'listening' && greeting) {
        greeting = false;
        void assistantSay(checkingPhoto ? 'I am checking your drawing. You can say cancel while it builds.' : 'What are we building?').finally(() => voice.setThinking(false));
      }
    },
    onError: message => assistant.error(message),
  });
  assistantActions = new AssistantActions({
    demo: async topic => {
      demoController?.abort(); const controller = new AbortController(); demoController = controller;
      try {
        if (topic) {
          const scene = assistantExample(topic); assistantScene(scene);
          await assistantSay(`I created the built-in ${scene.name} example. I will run its real physics for three simulated seconds and retain the result.`);
          await runAssistantFor(3, controller.signal); check(!controller.signal.aborted, 'Demonstration stopped.');
          bench.pinBaseline(); await saveAssistantExperiment();
          return `I ran ${scene.name}, retained a measured baseline and saved it. ${el('readout').textContent} Tell me which part to select or what to change.`;
        }
        return await demonstrate({ current: () => bench, begin: assistantScene, changed: assistantChanged, say: assistantSay, runFor: runAssistantFor, compare: () => { compareMeasurements(); }, save: saveAssistantExperiment }, controller.signal);
      }
      finally { if (demoController === controller) demoController = undefined; }
    },
    create: async name => {
      const scene = name === 'ramp-ball' ? rampBall() : assistantExample(name);
      assistantScene(scene); await runAssistantScene();
      return 'I built ' + scene.name + ' locally with declared physical defaults. It is running. Tell me what to change.';
    },
    run: runAssistantScene,
    pause: () => { bench.pause(); bench.capture(); assistantChanged(); return `Paused at ${bench.sample.simulationTime.toFixed(2)} simulated seconds.`; },
    reset: () => { bench.reset(); assistantChanged(); return 'Reset to this version’s starting setup. Earlier versions and the baseline are retained.'; },
    baseline: () => { bench.pause(); bench.capture(); check(bench.selected.run.samples.length > 1, 'Run the experiment first so I can retain a measured baseline.'); bench.pinBaseline(); assistantChanged(); return `I kept the original run through ${bench.sample.simulationTime.toFixed(2)} simulated seconds as your baseline. Tell me what to change.`; },
    compare: compareMeasurements,
    save: async () => { await saveAssistantExperiment(); return 'Saved in this browser, including the experiment, versions, baseline and runtime checkpoint. It will reopen paused.'; },
    source: () => { const source = bench.experiment.source; return source ? `This experiment came from a ${source.kind === 'photo' ? 'paper photo' : 'drawing'}. ${source.notes}\n${source.explanations.join('\n')}` : `This experiment has no drawing source. ${bench.scene.assumptions.join(' ')}`; },
    select: name => {
      const query = name.toLowerCase().replace(/^(the|a|an)\s+/, '');
      let matches = bench.scene.objects.filter(object => object.id.toLowerCase() === query || object.label.toLowerCase() === query);
      if (!matches.length) matches = bench.scene.objects.filter(object => object.label.toLowerCase().includes(query) || object.kind.toLowerCase().includes(query));
      check(matches.length === 1, matches.length ? `Which part? I found ${matches.map(object => object.label).join(', ')}.` : `I could not find that part. The parts are ${bench.scene.objects.map(object => object.label).join(', ')}.`);
      selectedId = matches[0]!.id; refresh(); viewport.focus(matches[0]!.position); viewport.annotate(selectedId, matches[0]!.label); return `Selected ${matches[0]!.label}. Tell me what to change.`;
    },
    review: async text => { await judgeAccessReady.catch(() => undefined); return inputUI!.reviewWords(text); },
    apply: () => {
      const applied = lastProposal; lastProposal = undefined;
      const message = inputUI!.active ? inputUI!.confirmPreviewWords().message : inputUI!.applyWords().message;
      // The confirmed change lands on the part it touched, then the note leaves.
      if (applied) { draw(); viewport.annotate(applied.id, `Applied · ${applied.text}`); clearTimeout(appliedNote); appliedNote = setTimeout(() => viewport.clearNote(), 3200); }
      return message;
    },
    cancel: () => { lastProposal = undefined; assistant.interrupt(); clearConversationMarks(); checkingPhoto = false; automaticPhotoEpoch = 0; demoController?.abort(); inputUI!.cancelWords(); return 'Cancelled. Valid experiments and saved work are retained.'; },
    interpret: () => inputUI!.buildPreviewWords(),
  });
  document.addEventListener('nox:talk', () => { assistant.open(); greeting = !voice.isActive; if (!voice.isActive) voice.start(); });
  judgeAccessReady = unlockJudgeLink(new URL(location.href), url => history.replaceState(history.state, '', url));
  void judgeAccessReady.catch(cause => assistant.error(cause instanceof Error ? cause.message : 'Live judge access could not be unlocked.'));
  window.addEventListener('pagehide', () => { demoController?.abort(); voice.dispose(); }, { once: true });
}
el<HTMLInputElement>('experiment-name').onchange = event => act(() => { const name = (event.target as HTMLInputElement).value.trim(); check(name.length > 0, 'Enter an experiment name.'); bench.experiment.name = name; bench.scene.name = name; bench.physics.scene.name = name; });
el('add').onclick = () => act(() => { const o = newObject(el<HTMLSelectElement>('kind').value as Kind, crypto.randomUUID()); o.label = `${o.kind} ${bench.scene.objects.length + 1}`; o.position = { x: 0, y: 4, z: 0 }; edit([{ type: 'add', object: o }], 'Added object'); selectedId = o.id; });
el('remove').onclick = () => act(() => edit([{ type: 'remove', id: selectedId }], 'Removed object'));
propertyForm.onfocusin = () => { if (bench?.running) act(() => { bench.pause(); bench.capture(); }); };
propertyForm.onsubmit = event => { event.preventDefault(); act(() => {
  const data = new FormData(propertyForm), n = (key: string) => Number(data.get(key)), fixed = data.has('fixed'), id = selectedId;
  edit([{ type: 'move', id, position: { x: n('x'), y: n('y'), z: n('z') } }, { type: 'rotate', id, rotation: rotationValue(n('rx'), n('ry'), n('rz')) },
    { type: 'resize', id, width: n('width'), height: n('height'), depth: n('depth') },
    ...(['mass', 'friction', 'restitution'] as const).map(property => ({ type: 'set-property' as const, id, property, value: n(property) })),
    { type: 'set-property', id, property: 'label', value: String(data.get('label')) },
    { type: 'set-property', id, property: 'fixed', value: fixed }, { type: 'set-property', id, property: 'velocity', value: { x: fixed ? 0 : n('vx'), y: fixed ? 0 : n('vy'), z: fixed ? 0 : n('vz') } },
    { type: 'set-property', id, property: 'angularVelocity', value: { x: fixed ? 0 : n('wx'), y: fixed ? 0 : n('wy'), z: fixed ? 0 : n('wz') } }, { type: 'set-property', id, property: 'wallThickness', value: n('wall') }], 'Edited object');
}); };
worldForm.onsubmit = event => { event.preventDefault(); act(() => { const data = new FormData(worldForm); edit([{ type: 'set-gravity', gravity: { x: Number(data.get('gx')), y: Number(data.get('gy')), z: Number(data.get('gz')) } }, { type: 'set-scale', scale: Number(data.get('scale')) }], 'Edited world values'); }); };
el('save').onclick = () => void asyncAct(async () => { dirty = !(await bench.save(storage)); });
el('export').onclick = () => act(() => { bench.pause(); bench.capture(); download('nox-library.json', JSON.stringify(bench.library), 'application/json'); bench.notice = 'Library exported. Browser save is separate.'; });
el<HTMLInputElement>('import').onchange = () => void asyncAct(async () => {
  const input = el<HTMLInputElement>('import'), file = input.files?.[0]; if (!file) return;
  check(file.size <= 50_000_000, 'Library file exceeds 50 MB.');
  const originalBench = bench;
  const raw = JSON.parse(await file.text());
  check(bench === originalBench && !inputUI?.active, 'The workbench changed while the file was loading. Import again after finishing the preview.');
  if (raw?.schemaVersion === 2) { bench.newExperiment(validateScene(raw)); dirty = true; input.value = ''; fit(); return; }
  bench.importLibrary(raw); dirty = true; input.value = ''; fit();
});
el('edit-scene').onclick = () => { el('scene-error').textContent = ''; sceneContext = bench.commandContext; bench.pause(); bench.capture(); el<HTMLTextAreaElement>('scene-json').value = JSON.stringify(bench.physics.currentScene(), null, 2); el<HTMLDialogElement>('scene-editor').showModal(); };
el('apply-scene').onclick = () => act(() => { const scene = validateScene(JSON.parse(el<HTMLTextAreaElement>('scene-json').value)); check(sceneContext, 'Open the system editor before applying changes.'); bench.edit({ ...sceneContext, operations: [{ type: 'replace-scene', scene }] }, 'Edited physical system'); el<HTMLDialogElement>('scene-editor').close(); fit(); });
el('close-scene').onclick = () => el<HTMLDialogElement>('scene-editor').close();
el('export-scene').onclick = () => { bench.pause(); bench.capture(); download('nox-scene.json', JSON.stringify(bench.physics.currentScene(), null, 2), 'application/json'); };
el('csv').onclick = () => { const rows = bench.selected.run.samples.flatMap(s => { const b = s.bodies.find(b => b.objectId === selectedId); return b ? [[s.simulationTime, b.position.x, b.position.y, b.position.z, b.velocity.x, b.velocity.y, b.velocity.z, b.speed, b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w, b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z].join(',')] : []; }); download('nox-motion.csv', `time_s,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s,speed_m_s,qx,qy,qz,qw,wx_rad_s,wy_rad_s,wz_rad_s\n${rows.join('\n')}`, 'text/csv'); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { assistantTurn++; demoController?.abort(); if (assistantActions) void assistantActions.handle('cancel').catch(error); } if (bench?.running && document.hidden) act(() => { bench.pause(); bench.capture(); bench.notice = 'Paused because the tab was hidden.'; }); });
canvas.addEventListener('viewport-error', event => {
  if (bench) { bench.pause(); bench.capture(); dirty = true; clock.reset(); lastFrame = 0; panels(); }
  error((event as CustomEvent<string>).detail);
});
window.addEventListener('beforeunload', event => { if (dirty || inputUI?.active) event.preventDefault(); });
new ResizeObserver(() => draw()).observe(canvas);
new MutationObserver(() => draw()).observe(document.body, { attributes: true, attributeFilter: ['data-tools'] });
function frame(timestamp: number): void {
  if (bench?.running) {
    try { clock.advance(lastFrame ? (timestamp - lastFrame) / 1000 : 0, () => { if (bench.running) bench.tick(); }); dirty = true; }
    catch (e) { bench.pause(); bench.capture(); clock.reset(); lastFrame = 0; error(e); }
    if (!bench.running) refresh();
    else { draw(); if (timestamp - lastPanel > 100) { panels(); lastPanel = timestamp; } }
  }
  lastFrame = timestamp; requestAnimationFrame(frame);
}
async function start(): Promise<void> {
  try {
    await initPhysics(); bench = new Workbench(emptyScene('Talk to Nox'));
    let transformContext = bench.commandContext;
    viewport = new Viewport(canvas, id => { selectedId = id; el<HTMLSelectElement>('objects').value = id; fillProperties(); panels(); draw(); },
      () => { transformContext = bench.commandContext; bench.pause(); bench.capture(); clock.reset(); lastFrame = 0; dirty = true; panels(); },
      operations => act(() => bench.edit({ ...transformContext, operations }, '3D transform')));
    try { await bench.load(storage); } catch (e) { error(e); }
    inputUI = new InputUI({
      state: () => ({ bench, selectedId, dirty }),
      show: (next, nextDirty, nextSelected) => { bench = next; dirty = nextDirty; selectedId = nextSelected; clock.reset(); lastFrame = 0; assistant?.setSceneAvailable(bench.scene.objects.length > 0); fit(); refresh(); },
      changed: () => { dirty = true; clock.reset(); lastFrame = 0; assistant?.setSceneAvailable(bench.scene.objects.length > 0); refresh(); },
      onPhotoReady: () => checkUploadedPhoto(),
    });
    initShell({ openSource: () => inputUI?.openSource() });
    startAssistant();
    fit(); refresh(); document.body.dataset.ready = 'ready'; requestAnimationFrame(frame);
  } catch (e) {
    error(e); el('message').textContent = 'Nox could not start. Reload to retry; saved work is retained.';
    el('nox-loading-status').textContent = 'Nox could not start';
    el('nox-loading-error').textContent = e instanceof Error ? e.message : String(e); el('nox-loading-error').hidden = false;
    el('nox-loading-retry').hidden = false; el('nox-loading-retry').onclick = () => location.reload();
  }
}
void start();

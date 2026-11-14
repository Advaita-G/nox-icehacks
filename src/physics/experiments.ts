import { Physics, ENGINE, SAMPLE_EVERY, SETTINGS } from './engine.ts';
import type { Checkpoint, Run, Sample } from './engine.ts';
import { applyCommands, check, keys, LIMITS, number, record, text, quaternion, validateScene, vector } from './scene.ts';
import type { CommandBatch, Scene } from './scene.ts';

export interface Version { id: string; name: string; scene: Scene; run: Run; checkpoint?: Checkpoint }
export interface SourceAsset { id: string; kind: 'canvas' | 'photo'; revision: number; image: string; widthPx: number; heightPx: number; notes: string; explanations: string[] }
export interface Experiment { id: string; name: string; versions: Version[]; selectedVersionId: string; baseline?: Version; source?: SourceAsset }
export function validateSource(input: unknown): SourceAsset {
  record(input); keys(input, ['id', 'kind', 'revision', 'image', 'widthPx', 'heightPx', 'notes', 'explanations']); text(input.id, 128, 'Source ID'); check(input.kind === 'canvas' || input.kind === 'photo', 'Invalid source kind.');
  number(input.revision, 0, Number.MAX_SAFE_INTEGER, 'Source revision'); check(Number.isInteger(input.revision), 'Invalid source revision.');
  check(typeof input.image === 'string' && input.image.length <= 2_500_000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.image), 'Invalid saved source image.');
  for (const key of ['widthPx', 'heightPx']) { number(input[key], 1, 1600, key); check(Number.isInteger(input[key]), 'Invalid source dimensions.'); }
  check(typeof input.notes === 'string' && input.notes.length <= 4000, 'Invalid source notes.');
  check(Array.isArray(input.explanations) && input.explanations.length <= 200, 'Invalid source explanations.'); input.explanations.forEach(v => text(v, 3000, 'Source explanation'));
  return structuredClone(input) as unknown as SourceAsset;
}
export interface Library { schemaVersion: 1; selectedExperimentId: string; experiments: Experiment[] }
export interface Storage { read(): Promise<unknown>; write(library: Library): Promise<void> }
export interface WorkbenchCommand extends CommandBatch { contextToken: string }
function id(): string { return crypto.randomUUID(); }
function newRun(versionId: string, sample: Sample): Run {
  return { versionId, engine: ENGINE, settings: { ...SETTINGS }, samples: [sample], interventions: [] };
}
function version(scene: Scene, sample: Sample, name: string): Version {
  const versionId = id(); return { id: versionId, name, scene: structuredClone(scene), run: newRun(versionId, sample) };
}

export class Workbench {
  library: Library;
  physics: Physics;
  running = false;
  replayTime: number | null = null;
  notice = '';
  restartRequired = false;
  contextToken = id();
  get commandContext(): { baseSceneRevision: number; contextToken: string } { return { baseSceneRevision: this.scene.revision, contextToken: this.contextToken }; }
  constructor(scene: Scene) {
    this.physics = new Physics(scene);
    const first = version(this.physics.scene, this.physics.sample(), 'Initial setup'), experimentId = id();
    this.library = { schemaVersion: 1, selectedExperimentId: experimentId, experiments: [{ id: experimentId, name: scene.name, versions: [first], selectedVersionId: first.id }] };
  }
  get experiment(): Experiment { return this.library.experiments.find(e => e.id === this.library.selectedExperimentId)!; }
  get selected(): Version { return this.experiment.versions.find(v => v.id === this.experiment.selectedVersionId)!; }
  get scene(): Scene { return this.selected.scene; }
  get sample(): Sample {
    if (this.replayTime !== null) return sampleAt(this.selected.run, this.replayTime);
    return this.physics.sample();
  }
  pause(): void { this.running = false; }
  capture(): void {
    if (this.restartRequired) return;
    const sample = this.physics.sample(), samples = this.selected.run.samples;
    if (samples.at(-1)!.simulationTime < sample.simulationTime - 1e-8) samples.push(sample);
    this.selected.checkpoint = this.physics.checkpoint();
  }
  play(): void {
    check(!this.restartRequired, 'Reset explicitly to restart this saved setup; old history is retained.');
    check(this.replayTime === null, 'Exit replay with Resume live, or Reset to run from the setup.');
    check(this.physics.time < LIMITS.seconds - 1e-8, '30 s run complete. Reset or edit for a new run.');
    this.running = true;
  }
  tick(): void {
    check(!this.restartRequired, 'Reset explicitly before advancing an incompatible checkpoint.');
    check(this.replayTime === null, 'Exit replay before stepping the live solver.');
    const sample = this.physics.step();
    if (this.physics.ticks % SAMPLE_EVERY === 0 || this.physics.time >= LIMITS.seconds - 1e-8) this.selected.run.samples.push(sample);
    if (this.physics.time >= LIMITS.seconds - 1e-8) { this.pause(); this.capture(); }
  }
  edit(batch: unknown, description = 'Direct edit'): void {
    record(batch); check(batch.contextToken === this.contextToken, 'Stale experiment context. Refresh before applying this command.');
    check(!this.restartRequired, 'Reset explicitly before editing an incompatible checkpoint.');
    check(this.replayTime === null, 'Resume live before editing a recorded replay.');
    const scene = applyCommands(this.physics.currentScene(), batch), nextPhysics = new Physics(scene);
    const next = version(scene, nextPhysics.sample(), `Version ${this.experiment.versions.length + 1}`);
    next.run.interventions.push({ previousTime: this.physics.time, previousVersionId: this.selected.id, description });
    this.capture(); this.pause(); this.physics.free(); this.physics = nextPhysics;
    this.experiment.versions.push(next); this.experiment.selectedVersionId = next.id; this.contextToken = id(); this.notice = 'Edit paused playback. New version starts at 0 s from the visible state.';
  }
  reset(): void {
    const physics = new Physics(this.scene);
    if (this.physics.time > 0 || this.selected.run.samples.length > 1 || this.restartRequired) {
      this.capture();
      const next = version(this.scene, physics.sample(), `Reset ${this.experiment.versions.length + 1}`);
      this.experiment.versions.push(next); this.experiment.selectedVersionId = next.id;
    }
    this.pause(); this.replayTime = null; this.physics.free(); this.physics = physics;
    this.selected.run = { ...newRun(this.selected.id, physics.sample()), interventions: this.selected.run.interventions };
    delete this.selected.checkpoint;
    this.restartRequired = false; this.contextToken = id();
  }
  pinBaseline(): void { this.capture(); this.experiment.baseline = structuredClone(this.selected); this.notice = 'Baseline retained independently of future edits and resets.'; }
  replay(time = 0): void {
    number(time, 0, this.selected.run.samples.at(-1)!.simulationTime, 'Replay time');
    this.pause(); this.replayTime = time;
  }
  resumeLive(): void { this.replayTime = null; this.pause(); }
  selectVersion(versionId: string): void {
    const current = this.experiment;
    check(current.versions.some(v => v.id === versionId), 'Unknown version.');
    if (current.selectedVersionId === versionId) return;
    this.openSelected({ ...this.library, experiments: this.library.experiments.map(e => e === current ? { ...e, selectedVersionId: versionId } : e) }, true);
  }
  selectExperiment(experimentId: string): void {
    check(this.library.experiments.some(e => e.id === experimentId), 'Unknown experiment.');
    if (this.library.selectedExperimentId === experimentId) return;
    this.openSelected({ ...this.library, selectedExperimentId: experimentId }, true);
  }
  importLibrary(input: unknown): void {
    const data = validateLibrary(input), existing = new Set(this.library.experiments.map(e => e.id));
    check(data.experiments.every(e => !existing.has(e.id)), 'This library is already open. Existing experiments were retained.');
    check(this.library.experiments.length + data.experiments.length <= 10, 'Import would exceed 10 retained experiments.');
    this.openSelected({ ...this.library, experiments: [...this.library.experiments, ...data.experiments], selectedExperimentId: data.selectedExperimentId }, true);
  }
  newExperiment(scene: Scene): void {
    check(this.library.experiments.length < 10, '10 experiments retained. Export this library before starting another browser library.');
    const physics = new Physics(scene), first = version(physics.scene, physics.sample(), 'Initial setup'), experimentId = id();
    this.capture(); this.pause(); this.replayTime = null; this.physics.free(); this.physics = physics;
    this.restartRequired = false; this.contextToken = id();
    this.library.experiments.push({ id: experimentId, name: scene.name, versions: [first], selectedVersionId: first.id }); this.library.selectedExperimentId = experimentId;
  }
  openSelected(library = this.library, captureCurrent = false): void {
    const experiment = library.experiments.find(e => e.id === library.selectedExperimentId);
    check(experiment, 'Selected experiment is missing.');
    const selected = experiment.versions.find(v => v.id === experiment.selectedVersionId);
    check(selected, 'Selected version is missing.');
    const physics = new Physics(selected.scene); let notice = 'Saved setup opened paused.';
    let restartRequired = false;
    if (selected.checkpoint) {
      try { physics.restore(selected.checkpoint); notice = 'Runtime checkpoint restored paused. Resume live to continue.'; }
      catch (e) { restartRequired = true; notice = `${e instanceof Error ? e.message : String(e)} Setup and history retained; Reset explicitly to restart.`; }
    }
    if (!selected.checkpoint && selected.run.samples.length > 1) { restartRequired = true; notice = 'Runtime checkpoint missing. History retained; Reset explicitly to restart.'; }
    if (!restartRequired && Math.abs(physics.time - selected.run.samples.at(-1)!.simulationTime) > 1e-6) {
      restartRequired = true; notice = 'Checkpoint time differs from recorded run. History retained; Reset explicitly to restart.';
    }
    if (!restartRequired && (selected.run.engine !== ENGINE || JSON.stringify(selected.run.settings) !== JSON.stringify(SETTINGS)
      || JSON.stringify(physics.sample()) !== JSON.stringify(selected.run.samples.at(-1)))) {
      restartRequired = true; notice = 'Recorded endpoint or engine differs from this checkpoint. History retained; Reset explicitly to restart.';
    }
    if (captureCurrent) { try { this.capture(); } catch (e) { physics.free(); throw e; } }
    this.library = library;
    this.restartRequired = restartRequired; this.contextToken = id();
    this.pause(); this.replayTime = null; this.physics.free(); this.physics = physics; this.notice = notice;
  }
  async save(storage: Storage): Promise<boolean> {
    this.pause(); this.capture(); const saved = structuredClone(this.library);
    await storage.write(saved); this.capture();
    const unchanged = JSON.stringify(saved) === JSON.stringify(this.library);
    this.notice = unchanged ? 'Saved in this browser. Runtime will reopen paused.' : 'Earlier checkpoint saved; newer changes remain unsaved.';
    return unchanged;
  }
  async load(storage: Storage): Promise<boolean> {
    const data = await storage.read(); if (data === undefined) return false;
    const library = validateLibrary(data);
    this.openSelected(library);
    return true;
  }
}

export function sampleAt(run: Run, time: number): Sample {
  check(run.samples.length > 0, 'Run has no samples.');
  // shortcut: discrete 30 Hz replay, add interpolation only when sub-frame scrubbing is required.
  return run.samples.findLast(s => s.simulationTime <= time + 1e-8) ?? run.samples[0];
}

function validateVersion(input: unknown): Version {
  record(input); text(input.id, 64, 'Version ID'); text(input.name, 80, 'Version name');
  const scene = validateScene(input.scene); record(input.run);
  check(input.run.versionId === input.id, 'Run belongs to another version.'); text(input.run.engine, 80, 'Recorded engine'); record(input.run.settings);
  number(input.run.settings.timestep, .0001, .1, 'Recorded timestep'); number(input.run.settings.solverIterations, 1, 100, 'Recorded solver iterations');
  number(input.run.settings.ccdSubsteps, 1, 100, 'Recorded CCD substeps'); text(input.run.settings.frictionMix, 40, 'Recorded friction mixing'); text(input.run.settings.restitutionMix, 40, 'Recorded restitution mixing');
  check(Array.isArray(input.run.samples) && input.run.samples.length > 0 && input.run.samples.length <= 4000, 'Invalid run sample count.');
  let lastTime = -1;
  for (const sample of input.run.samples) {
    record(sample); number(sample.simulationTime, 0, LIMITS.seconds + 1e-6, 'Sample time');
    check(sample.simulationTime > lastTime && (lastTime >= 0 || sample.simulationTime === 0), 'Samples must begin at zero and increase.'); lastTime = sample.simulationTime;
    check(Array.isArray(sample.bodies) && sample.bodies.length === scene.objects.length, 'Sample body count differs from setup.');
    const ids = new Set();
    for (const b of sample.bodies) {
      record(b); check(scene.objects.some(o => o.id === b.objectId) && !ids.has(b.objectId), 'Invalid sampled object ID.'); ids.add(b.objectId);
      for (const key of ['position', 'centerOfMass']) { record(b[key]); number(b[key].x, -1120, 1120, key); number(b[key].y, -1120, 1120, key); number(b[key].z, -1120, 1120, key); }
      vector(b.velocity, LIMITS.speed + .001, 'Sample velocity'); number(b.speed, 0, LIMITS.speed + .001, 'Sample speed');
      check(Math.abs(b.speed - Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z)) < 1e-5, 'Sample speed differs from velocity.');
      quaternion(b.rotation); vector(b.angularVelocity, LIMITS.angularSpeed, 'Sample angular velocity');
      number(b.mass, 0, 101, 'Sample mass'); vector(b.inertia, 1e7, 'Sample inertia');
    }
    number(sample.kineticEnergy, 0, 1e12, 'Kinetic energy'); number(sample.potentialEnergy, -1e15, 1e15, 'Potential energy');
    vector(sample.momentum, 650000, 'Momentum');
    if (sample.mechanisms !== undefined) {
      record(sample.mechanisms); number(sample.mechanisms.springEnergy, 0, 1e15, 'Spring energy');
      const m = sample.mechanisms;
      check(Array.isArray(m.connections) && m.connections.length === scene.constraints.length, 'Connection sample count differs.');
      check(Array.isArray(m.fans) && m.fans.length === scene.fans.length, 'Fan sample count differs.');
      const unique = new Set();
      for (const c of m.connections) { record(c); check(scene.constraints.some(s => s.id === c.id) && !unique.has(c.id), 'Unknown/duplicate measured connection.'); unique.add(c.id); number(c.separation, 0, 4000, 'Connection separation'); number(c.relativeVelocity, -20000, 20000, 'Relative velocity'); number(c.effort, -1000, 1000, 'Motor effort'); number(c.power, -20000000, 20000000, 'Motor power'); }
      unique.clear();
      for (const f of m.fans) { record(f); check(scene.fans.some(s => s.id === f.id) && !unique.has(f.id), 'Unknown/duplicate measured fan.'); unique.add(f.id); number(f.angularVelocity, -160, 160, 'Fan spin'); for (const key of ['inducedSpeed', 'thrust', 'shaftPower', 'availablePower', 'targetPower']) number(f[key], 0, 1e18, key); vector(f.targetForce, 1e12, 'Fan target force'); vector(f.wakeForce, 1e12, 'Residual wake'); check((f.targetPower as number) <= (f.availablePower as number) + 1e-6 && (f.availablePower as number) <= (f.shaftPower as number) + 1e-6, 'Fan target power exceeds shaft power.'); }
    } else check(scene.constraints.length === 0 && scene.fans.length === 0, 'Mechanism samples missing.');
  }
  check(Array.isArray(input.run.interventions) && input.run.interventions.length <= 60, 'Invalid intervention count.');
  for (const item of input.run.interventions) { record(item); number(item.previousTime, 0, 30, 'Intervention time'); text(item.previousVersionId, 64, 'Previous version'); text(item.description, 240, 'Intervention description'); }
  // Binary checkpoint validity is checked by the engine after the readable setup/history is accepted.
  if (input.checkpoint !== undefined) check(JSON.stringify(input.checkpoint).length <= 12_000_000, 'Checkpoint too large.');
  return { ...structuredClone(input), scene } as unknown as Version;
}
export function validateLibrary(input: unknown): Library {
  check(JSON.stringify(input)?.length <= 50_000_000, 'Saved library exceeds 50 MB.'); record(input);
  check(input.schemaVersion === 1, 'Unsupported library schema; preserve the original export.');
  check(Array.isArray(input.experiments) && input.experiments.length > 0 && input.experiments.length <= 10, 'Invalid experiment count.');
  const experiments: Experiment[] = [], ids = new Set();
  for (const e of input.experiments) {
    record(e); text(e.id, 64, 'Experiment ID'); text(e.name, 80, 'Experiment name'); check(!ids.has(e.id), 'Duplicate experiment ID.'); ids.add(e.id);
    check(Array.isArray(e.versions) && e.versions.length > 0, 'Invalid version count.');
    const versions = e.versions.map(validateVersion); check(new Set(versions.map(v => v.id)).size === versions.length, 'Duplicate version ID.');
    check(versions.some(v => v.id === e.selectedVersionId), 'Selected version is missing.');
    experiments.push({ id: e.id, name: e.name, versions, selectedVersionId: e.selectedVersionId as string, ...(e.baseline ? { baseline: validateVersion(e.baseline) } : {}), ...(e.source !== undefined ? { source: validateSource(e.source) } : {}) });
  }
  check(experiments.some(e => e.id === input.selectedExperimentId), 'Selected experiment is missing.');
  return { schemaVersion: 1, experiments, selectedExperimentId: input.selectedExperimentId as string };
}

export class BrowserStorage implements Storage {
  async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('nox-physics-3d', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('library');
      request.onerror = () => reject(new Error(`Browser storage unavailable: ${request.error?.message}`));
      request.onblocked = () => reject(new Error('Close the other Nox tab to update browser storage.'));
      request.onsuccess = () => resolve(request.result);
    });
  }
  async read(): Promise<unknown> {
    const db = await this.database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('library', 'readonly'), request = tx.objectStore('library').get('current');
        tx.oncomplete = () => resolve(request.result); tx.onerror = tx.onabort = () => reject(new Error('Reading the saved library failed. Original data retained.'));
      });
    } finally { db.close(); }
  }
  async write(library: Library): Promise<void> {
    const valid = validateLibrary(library), db = await this.database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('library', 'readwrite'); tx.objectStore('library').put(valid, 'current');
        tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error(`Save failed (${tx.error?.name ?? 'storage error'}). Previous browser save retained. Export JSON to keep current work.`));
      });
    } finally { db.close(); }
  }
}

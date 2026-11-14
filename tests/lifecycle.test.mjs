import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Physics } from '../src/physics/engine.ts';
import { Workbench, sampleAt, validateLibrary } from '../src/physics/experiments.ts';
import { collision, dominoes, object } from '../src/physics/examples.ts';
import { emptyScene } from '../src/physics/scene.ts';
import { primitive } from '../src/physics/geometry.ts';
await initPhysics();
class MemoryStorage {
  saved; fail = false;
  async read() { return structuredClone(this.saved); }
  async write(value) { if (this.fail) throw Error('Quota exceeded'); this.saved = structuredClone(value); }
}
function advance(w, ticks) { for (let i = 0; i < ticks; i++) w.tick(); }

test('repeated resets and edits beyond twenty versions retain history and survive save/reload', async () => {
  const storage = new MemoryStorage(), w = new Workbench(collision()), restored = new Workbench(emptyScene());
  try {
    w.tick(); w.pinBaseline();
    const baseline = structuredClone(w.experiment.baseline);
    for (let i = 0; i < 30; i++) { w.tick(); w.reset(); }
    w.capture();
    const history = structuredClone(w.experiment.versions);
    w.edit({ ...w.commandContext, operations: [{ type: 'move', id: 'a', position: { x: 3, y: 4, z: 0 } }] });
    assert.equal(w.experiment.versions.length, 32);
    assert.deepEqual(w.experiment.versions.slice(0, -1), history);
    assert.deepEqual(w.experiment.baseline, baseline);
    assert.deepEqual(w.scene.objects.find(o => o.id === 'a').position, { x: 3, y: 4, z: 0 });
    assert.equal(await w.save(storage), true);
    await restored.load(storage);
    assert.deepEqual(restored.library, w.library);
    assert.deepEqual(restored.sample, w.sample);
    restored.reset();
    restored.edit({ ...restored.commandContext, operations: [{ type: 'set-property', id: 'a', property: 'mass', value: 5 }] });
    assert.equal(restored.scene.objects.find(o => o.id === 'a').mass, 5);
  } finally { w.physics.free(); restored.physics.free(); }
});

test('edits at t>0 pause, retain original run/baseline and create a measured variant at zero', () => {
  const w = new Workbench(collision()); w.play(); advance(w, 120); w.pinBaseline();
  const baseline = structuredClone(w.experiment.baseline), oldVersion = w.selected.id, visible = w.sample;
  w.edit({ ...w.commandContext, operations: [{ type: 'set-property', id: 'b', property: 'mass', value: 4 }] });
  assert.equal(w.running, false); assert.equal(w.physics.time, 0); assert.equal(w.scene.objects[1].mass, 4);
  assert.deepEqual(w.scene.objects[0].position, visible.bodies[0].position);
  assert.equal(w.selected.run.interventions[0].previousTime, 1); assert.equal(w.selected.run.interventions[0].previousVersionId, oldVersion);
  advance(w, 60); assert.deepEqual(w.experiment.baseline, baseline); assert.equal(w.experiment.versions.length, 2);
  assert.equal(w.experiment.versions[0].run.samples.at(-1).simulationTime, 1); w.physics.free();
});
test('invalid batch preserves live runtime, history and running state', () => {
  const w = new Workbench(collision()); w.play(); advance(w, 10); const before = w.sample, library = structuredClone(w.library);
  assert.throws(() => w.edit({ ...w.commandContext, operations: [{ type: 'remove', id: 'a' }, { type: 'remove', id: 'missing' }] }));
  assert.deepEqual(w.sample, before); assert.deepEqual(w.library, library); assert.equal(w.running, true); w.physics.free();
});
test('replay uses recorded orientation without advancing live state; reset retains the old run', () => {
  const w = new Workbench(dominoes()); advance(w, 120); w.capture(); const live = w.sample;
  w.replay(.5); assert.deepEqual(w.sample, sampleAt(w.selected.run, .5)); assert.equal(w.physics.time, 1);
  assert.throws(() => w.tick(), /replay/); w.resumeLive(); assert.deepEqual(w.sample, live);
  w.reset(); assert.equal(w.physics.time, 0); assert.equal(w.experiment.versions.length, 2);
  assert.equal(w.experiment.versions[0].run.samples.at(-1).simulationTime, 1);
  assert.equal(w.sample.bodies.find(b => b.objectId === 'd8').rotation.z, 0); w.physics.free();
});
test('save/reload retains named experiments, selected version, assumptions, baseline and exact paused checkpoint', async () => {
  const storage = new MemoryStorage(), w = new Workbench(collision()); advance(w, 101); w.pinBaseline();
  w.newExperiment(dominoes()); advance(w, 67);
  w.edit({ ...w.commandContext, operations: [{ type: 'set-gravity', gravity: { x: 0, y: -3, z: 0 } }] }); advance(w, 53);
  await w.save(storage); const before = w.sample;
  const restored = new Workbench(emptyScene()); await restored.load(storage);
  assert.deepEqual(restored.library, w.library); assert.deepEqual(restored.sample, before); assert.equal(restored.running, false);
  advance(restored, 30); advance(w, 30); assert.deepEqual(restored.sample, w.sample); w.physics.free(); restored.physics.free();
});
test('incompatible/corrupt checkpoints preserve readable history, require explicit reset and retain old version', async () => {
  for (const corrupt of [false, true]) {
    const storage = new MemoryStorage(), w = new Workbench(collision()); advance(w, 60); await w.save(storage);
    const version = storage.saved.experiments[0].versions[0], samples = structuredClone(version.run.samples);
    if (corrupt) version.checkpoint.snapshot = [1, 2, 3]; else { version.checkpoint.engine = 'old-engine'; version.run.engine = 'old-engine'; version.run.settings.solverIterations = 4; }
    const restored = new Workbench(emptyScene()); await restored.load(storage);
    assert.equal(restored.restartRequired, true); assert.throws(() => restored.play(), /Reset/);
    await restored.save(storage); assert.deepEqual(storage.saved.experiments[0].versions[0].run.samples, samples);
    restored.reset(); assert.equal(restored.restartRequired, false); assert.equal(restored.experiment.versions.length, 2);
    assert.deepEqual(restored.experiment.versions[0].run.samples, samples); restored.physics.free(); w.physics.free();
  }
});
test('failed write preserves prior saved library; invalid stored data preserves current work', async () => {
  const storage = new MemoryStorage(), w = new Workbench(collision()); await w.save(storage); const saved = structuredClone(storage.saved);
  advance(w, 30); storage.fail = true; await assert.rejects(w.save(storage), /Quota/); assert.deepEqual(storage.saved, saved);
  const current = structuredClone(w.library); storage.saved.experiments[0].versions[0].scene.objects[0].mass = -1;
  await assert.rejects(w.load(storage), /Mass/); assert.deepEqual(w.library, current);
  assert.throws(() => validateLibrary({ schemaVersion: 99 }), /Unsupported/); w.physics.free();
});
test('rejected solver tick restores the exact previous valid state', () => {
  const s = emptyScene(); s.gravity = { x: 0, y: 0, z: 0 };
  s.objects = [object('platform', 'wall', { position: { x: 0, y: 1, z: 0 }, width: .1, height: 4, restitution: 1, friction: 0 }),
    object('block', 'fast', { position: { x: -1, y: 1, z: 0 }, width: .1, height: .1, depth: .1, velocity: { x: 50, y: 0, z: 0 }, restitution: 1, friction: 0 })];
  const p = new Physics(s); p.step(); p.step(); const before = p.sample();
  assert.throws(() => p.step(), /angular velocity/); assert.deepEqual(p.sample(), before); p.free();
});

test('reset between sample ticks retains the actual advanced state', () => {
  const w = new Workbench(collision()); w.tick(); const time = w.physics.time; w.reset();
  assert.equal(w.experiment.versions.length, 2); assert.equal(w.experiment.versions[0].run.samples.at(-1).simulationTime, time); w.physics.free();
});
test('checkpoint from different mass/setup or altered snapshot cannot silently change physics', () => {
  const a = new Physics(collision(2)), b = new Physics(collision(4)), before = a.sample(), checkpoint = b.checkpoint();
  assert.throws(() => a.restore(checkpoint), /setup differs/);
  assert.throws(() => a.restore({ ...checkpoint, setup: JSON.stringify(a.scene) }), /deterministic physics/);
  assert.deepEqual(a.sample(), before); a.free(); b.free();
});
test('editing while a delayed save is pending leaves new work explicitly unsaved', async () => {
  const w = new Workbench(collision()), storage = new MemoryStorage(); let release;
  const delayed = { read: () => storage.read(), write: async value => { await new Promise(resolve => { release = resolve; }); await storage.write(value); } };
  const pending = w.save(delayed);
  w.edit({ ...w.commandContext, operations: [{ type: 'set-property', id: 'b', property: 'mass', value: 4 }] });
  release(); assert.equal(await pending, false); assert.match(w.notice, /newer changes remain unsaved/);
  assert.equal(storage.saved.experiments[0].versions.length, 1); assert.equal(w.experiment.versions.length, 2); w.physics.free();
});
test('delayed commands reject another experiment, another version and an away/back selection', () => {
  for (const change of ['experiment', 'version', 'away-back']) {
    const w = new Workbench(collision()), command = { ...w.commandContext, operations: [{ type: 'set-property', id: 'b', property: 'mass', value: 9 }] };
    if (change === 'experiment') w.newExperiment(collision(1));
    if (change === 'version') w.edit({ ...w.commandContext, operations: [{ type: 'set-property', id: 'b', property: 'mass', value: 3 }] });
    if (change === 'away-back') { const old = w.experiment.id; w.newExperiment(collision()); w.selectExperiment(old); }
    const before = structuredClone(w.library), sample = w.sample;
    assert.throws(() => w.edit(command), /Stale experiment context/); assert.deepEqual(w.library, before); assert.deepEqual(w.sample, sample); w.physics.free();
  }
});

test('physical compilation failure during import, experiment or version selection leaves the active state untouched', () => {
  const invalidVersion = (version) => {
    const bad = structuredClone(version); bad.id = crypto.randomUUID(); bad.run.versionId = bad.id;
    bad.scene.objects[0].width = bad.scene.objects[0].height = bad.scene.objects[0].depth = .1;
    bad.scene.objects[0].geometry = [primitive('box', { x: .001, y: .001, z: .001 })];
    return bad;
  };
  for (const operation of ['import', 'experiment', 'version']) {
    const w = new Workbench(collision()); w.play(); advance(w, 7);
    const bad = invalidVersion(w.selected), otherId = crypto.randomUUID();
    const experiment = { id: otherId, name: 'Invalid physical setup', versions: [bad], selectedVersionId: bad.id };
    if (operation === 'experiment') w.library.experiments.push(experiment);
    if (operation === 'version') w.experiment.versions.push(bad);
    const library = structuredClone(w.library), sample = w.sample, token = w.contextToken, checkpoint = w.physics.checkpoint();
    assert.throws(() => {
      if (operation === 'import') w.importLibrary({ schemaVersion: 1, experiments: [experiment], selectedExperimentId: otherId });
      if (operation === 'experiment') w.selectExperiment(otherId);
      if (operation === 'version') w.selectVersion(bad.id);
    }, /no usable volume/);
    assert.deepEqual(w.library, library); assert.deepEqual(w.sample, sample); assert.deepEqual(w.physics.checkpoint(), checkpoint);
    assert.equal(w.contextToken, token); assert.equal(w.running, true); w.physics.free();
  }
});

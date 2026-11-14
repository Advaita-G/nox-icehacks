import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics } from '../src/physics/engine.ts';
import { Workbench } from '../src/physics/experiments.ts';
import { spring } from '../src/physics/examples.ts';
import { demonstrate, measuredPeriod, warmupRendering } from '../src/assistant/demo.ts';

await initPhysics();

test('a cold render settles while physics is paused; unstable or cancelled rendering cannot start a run', async () => {
  const times = [0, 180, 210, 240, 270]; let renders = 0;
  await warmupRendering(() => renders++, async () => times.shift(), new AbortController().signal);
  assert.equal(renders, 4);
  let time = 0;
  await assert.rejects(warmupRendering(() => {}, async () => time += 150, new AbortController().signal), /not settled/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(warmupRendering(() => assert.fail('cancelled render'), async () => 0, controller.signal), /cancelled/);
});

test('photo reveal must finish before warm renders and the simulation clock can begin', async () => {
  let time = 0, revealed = false, renders = 0;
  await warmupRendering(() => { assert.equal(revealed, true); renders++; }, async () => { time += 40; revealed = time >= 1600; return time; }, new AbortController().signal, () => !revealed);
  assert.equal(renders, 3);
  assert.ok(time >= 1600);
  let stalledTime = 0;
  await assert.rejects(warmupRendering(() => assert.fail(), async () => stalledTime += 100, new AbortController().signal, () => true), /transition has not finished/);
});

test('spoken demonstration measures two real runs from the same setup and saves recoverable results', async () => {
  const bench = new Workbench(spring()), spoken = [];
  let saved, comparisons = 0;
  const host = {
    current: () => bench,
    begin: scene => bench.newExperiment(scene),
    changed() {},
    say: async text => { spoken.push(text); },
    runFor: async seconds => { const end = bench.physics.time + seconds; while (bench.physics.time < end - 1e-8) bench.tick(); bench.pause(); bench.capture(); },
    compare: () => { comparisons++; },
    save: async () => { assert.equal(await bench.save({ write: async value => { saved = value; } }), true); },
  };
  const result = await demonstrate(host, new AbortController().signal);
  assert.match(result, /saved/i); assert.equal(comparisons, 1);
  const original = measuredPeriod(bench.experiment.baseline.run, 'mass', 2), edited = measuredPeriod(bench.selected.run, 'mass', 2);
  assert.ok(Math.abs(original - Math.PI / 2) < .03);
  assert.ok(Math.abs(edited / original - Math.sqrt(2)) < .03);
  assert.equal(bench.experiment.baseline.scene.objects.find(o => o.id === 'mass').mass, 1);
  assert.equal(bench.scene.objects.find(o => o.id === 'mass').mass, 2);
  assert.equal(bench.selected.run.samples[0].bodies.find(o => o.objectId === 'mass').position.x, 3);
  assert.ok(spoken.every(text => typeof text === 'string' && text.length > 0));
  assert.match(spoken[0], /built-in demonstration/);
  const reopened = new Workbench(spring());
  assert.equal(await reopened.load({ read: async () => saved }), true);
  assert.deepEqual(reopened.experiment.baseline, bench.experiment.baseline);
  assert.deepEqual(reopened.sample, bench.sample);
  reopened.physics.free(); bench.physics.free();
});

test('stopping the demonstration cannot create a new experiment or save', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(demonstrate({ begin() { assert.fail('must not create'); }, save() { assert.fail('must not save'); } }, controller.signal), /stopped/);
});

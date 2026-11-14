import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantActions } from '../src/assistant/actions.ts';
import { rampBall } from '../src/physics/examples.ts';
import { initPhysics, DT } from '../src/physics/engine.ts';
import { LIMITS, validateScene } from '../src/physics/scene.ts';

await initPhysics();

test('natural ramp-and-ball creation questions use a fresh local scene without a model', async () => {
  const scenes = [];
  const actions = new AssistantActions({
    create: name => { assert.equal(name, 'ramp-ball'); scenes.push(rampBall()); return 'Created a fresh local ramp and ball using declared defaults. No AI call was used.'; },
    review: () => assert.fail('This bounded local request must not require a configured AI runtime'),
  });
  for (const phrase of ['Can you make a ramp with the ball?', 'Could you please build me a ramp and a ball?', 'Knox, can you create a ball on a ramp?', 'make a ball rolling down the ramp', 'build a ramp', 'Would you make a ramp with a ball, please?']) {
    const result = await actions.handle(phrase);
    assert.equal(result.reviewRequired, false); assert.match(result.message, /fresh local/); assert.match(result.message, /No AI call/);
  }
  assert.equal(scenes.length, 6);
  scenes[0].objects.find(body => body.id === 'ball').mass = 3;
  assert.equal(scenes[1].objects.find(body => body.id === 'ball').mass, 1, 'Each request creates independent scene data');
});

test('natural questions for other supported examples stay local; custom requirements are never dropped', async () => {
  const created = [], reviewed = [];
  const actions = new AssistantActions({ create: name => { created.push(name); return 'Created locally.'; }, review: async text => { reviewed.push(text); return { message: 'Needs a custom proposal.', reviewRequired: false, changes: [] }; } });
  for (const phrase of ['Can you make a spring?', 'Would you create a pendulum?', 'Could you build a fan?']) await actions.handle(phrase);
  assert.deepEqual(created, ['spring', 'pendulum', 'fan']);
  for (const phrase of ['Can you make a ramp with a 2 kg ball?', 'make a ramp with the ball at 30 degrees', 'build a ramp with a ball and a cup', 'make a spring with 2kg mass']) {
    await actions.handle(phrase); assert.equal(reviewed.at(-1), phrase);
  }
  assert.deepEqual(created, ['spring', 'pendulum', 'fan']);
});

test('the fresh ramp is grounded, the sphere contacts its real sloped face, and defaults satisfy bounds', () => {
  const scene = rampBall(); validateScene(scene);
  assert.deepEqual(scene.objects.map(body => body.id), ['floor', 'ramp', 'ball']);
  const ground = scene.objects[0], ramp = scene.objects[1], ball = scene.objects[2];
  assert.equal(ground.fixed, true); assert.equal(ramp.fixed, true); assert.equal(ball.fixed, false);
  assert.equal(ramp.position.y - ramp.height / 2, ground.position.y + ground.height / 2);
  const slope = ramp.height / ramp.width, radius = ball.width / 2;
  const normalDistance = (ball.position.y - ramp.position.y + (ball.position.x - ramp.position.x) * slope) / Math.hypot(slope, 1);
  assert.ok(Math.abs(normalDistance - radius) < 1e-10, 'Sphere rests on the collider face, rather than floating or starting embedded');
  assert.ok(ball.position.x > ramp.position.x - ramp.width / 2 + radius);
  assert.equal(ball.width, ball.height); assert.equal(ball.width, ball.depth);
  assert.ok(ball.mass >= LIMITS.massMin && ball.mass <= LIMITS.massMax);
  assert.match(scene.assumptions.join(' '), /assumed dimensions/);
  assert.match(scene.assumptions.join(' '), /No image measurements or recorded motion/);
});

test('the real solver rolls the fresh sphere downhill and preserves a measured baseline after a mass edit', async () => {
  const { Workbench } = await import('../src/physics/experiments.ts');
  const bench = new Workbench(rampBall()), initial = bench.sample.bodies.find(body => body.objectId === 'ball');
  try {
    for (let tick = 0; tick < Math.round(2 / DT); tick++) bench.tick();
    bench.pause(); bench.capture();
    const moved = bench.sample.bodies.find(body => body.objectId === 'ball');
    assert.ok(moved.position.x > initial.position.x + 2); assert.ok(moved.position.y < initial.position.y - .5);
    assert.ok(moved.speed > .5); assert.ok(Math.abs(moved.angularVelocity.z) > .5);
    bench.pinBaseline(); const baseline = structuredClone(bench.experiment.baseline);
    bench.reset(); bench.edit({ ...bench.commandContext, operations: [{ type: 'set-property', id: 'ball', property: 'mass', value: 2 }] }, 'Local test mass comparison');
    for (let tick = 0; tick < Math.round(2 / DT); tick++) bench.tick();
    bench.pause(); bench.capture();
    assert.deepEqual(bench.experiment.baseline, baseline);
    assert.equal(bench.experiment.baseline.scene.objects.find(body => body.id === 'ball').mass, 1);
    assert.equal(bench.scene.objects.find(body => body.id === 'ball').mass, 2);
    assert.ok(bench.selected.run.samples.length > 1); assert.ok(bench.sample.simulationTime >= 2);
    assert.ok(Number.isFinite(bench.sample.kineticEnergy)); assert.ok(Number.isFinite(bench.sample.potentialEnergy));
    assert.notEqual(bench.sample.kineticEnergy, baseline.run.samples.at(-1).kineticEnergy);
  } finally { bench.physics.free(); }
});

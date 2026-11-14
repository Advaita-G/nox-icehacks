import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics, initPhysics, applyCommands } from '../src/physics/index.ts';

await initPhysics();

test('joint frames survive JSON checkpoint storage when their computed rotation contains negative zero', () => {
  const recorded = new URL('../docs/evidence/live-momen-2026-11-10-spring-cart/', import.meta.url);
  const read = name => JSON.parse(readFileSync(new URL(name, recorded), 'utf8'));
  const original = read('conv-35-response.json').scene;
  const scene = applyCommands(original, { baseSceneRevision: original.revision, operations: read('conv-39-response.json').operations });
  assert.ok(Object.is(scene.constraints[0].frameA.y, -0), 'Fixture must exercise the signed-zero joint frame.');
  const physics = new Physics(scene);
  let restored;
  try {
    for (let tick = 0; tick < 120; tick++) physics.step();
    const checkpoint = JSON.parse(JSON.stringify(physics.checkpoint()));
    restored = new Physics(JSON.parse(JSON.stringify(physics.scene)));
    restored.restore(checkpoint);
    assert.deepEqual(restored.sample(), physics.sample());
    for (let tick = 0; tick < 30; tick++) { physics.step(); restored.step(); }
    assert.deepEqual(restored.sample(), physics.sample());
  } finally { physics.free(); restored?.free(); }
});

// Live #22 seesaw (Momen #90): every body omitted wallThickness and the app said only "Wall thickness must be ...".
// The error must name the part, the prompt must require the field, and the verbatim mechanism must otherwise compile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics, initPhysics, validateScene } from '../src/physics/index.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';

const reply = JSON.parse(readFileSync(new URL('../docs/evidence/live-22-seesaw-2026-11-12/attempt-2/conv-90-response.json', import.meta.url), 'utf8'));

test('a missing wallThickness names the part', () => {
  assert.throws(() => validateScene(structuredClone(reply.scene)), /^Error: floor: Wall thickness must be finite/);
});

test('mass, friction and restitution errors also name the part', () => {
  for (const [key, label] of [['mass', 'Mass'], ['friction', 'Friction'], ['restitution', 'Restitution']]) {
    const scene = structuredClone(reply.scene);
    for (const o of scene.objects) o.wallThickness = 0.1;
    scene.objects.find(o => o.id === 'plank')[key] = -1;
    assert.throws(() => validateScene(scene), new RegExp(`plank: ${label} must be finite`), key);
  }
});

test('both prompts require wallThickness on every body and bounded dimension options', () => {
  for (const prompt of [INTERPRET_3D, COMMAND_3D]) {
    assert.match(prompt, /Every object needs every required schema field, including wallThickness/);
    assert.match(prompt, /never offer a dimension below dimensionMin/);
  }
});

test('diagnostic: with only wallThickness supplied, the verbatim seesaw compiles and the heavy right side tips down', async () => {
  const scene = structuredClone(reply.scene);
  for (const o of scene.objects) o.wallThickness = 0.1;
  await initPhysics();
  const physics = new Physics(validateScene(scene));
  try {
    const start = physics.sample().bodies.find(b => b.objectId === 'right-box').position.y;
    let s; for (let i = 0; i < 120; i++) s = physics.step();
    const right = s.bodies.find(b => b.objectId === 'right-box').position.y, left = s.bodies.find(b => b.objectId === 'left-box').position.y;
    assert.ok(right < start - 0.05, `right box fell from ${start} to ${right}`);
    assert.ok(left > right, `left ${left} above right ${right}`);
  } finally { physics.free(); }
});

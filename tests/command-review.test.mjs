import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyScene, newObject, applyCommands } from '../src/physics/scene.ts';
import { describeChanges } from '../src/input/changes.ts';

const recorded = new URL('../docs/evidence/live-momen-2026-11-10-spring-cart/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, recorded), 'utf8'));
function cart() {
  const original = read('conv-35-response.json').scene;
  return applyCommands(original, { baseSceneRevision: original.revision, operations: read('conv-39-response.json').operations });
}
const proposed = operations => ({ requestId: 'review', status: 'proposed', operations, summary: [], questions: [], message: '' });

test('a recorded ordinary-language spring edit reviews only the changed connection property', () => {
  const scene = cart(), before = JSON.stringify(scene);
  const lines = describeChanges(scene, read('conv-36-response.json'));
  assert.equal(lines.length, 1);
  assert.ok(lines[0].length < 160, 'A stiffness edit must not dump unchanged connections.');
  assert.equal(lines[0], 'Connection return-spring · stiffness: 20 → 40 N/m');
  assert.equal(JSON.stringify(scene), before);
});

test('removing aerodynamic drag is disclosed rather than described as no physical change', () => {
  const scene = cart(), body = scene.objects.find(o => o.id === 'cart-body');
  body.aerodynamics = { coefficient: 1, area: .2 };
  const lines = describeChanges(scene, proposed([{ type: 'set-aerodynamics', id: body.id, aerodynamics: null }]));
  assert.ok(lines.some(line => line.includes('aerodynamics') && line.includes('→ none')));
  assert.deepEqual(body.aerodynamics, { coefficient: 1, area: .2 });
});

test('3D movement reviews x/y/z with units', () => {
  const scene = emptyScene(), ball = newObject('ball', 'ball');
  ball.position = { x: 0, y: 1, z: 2 }; ball.label = 'Ball'; scene.objects.push(ball);
  assert.deepEqual(describeChanges(scene, proposed([{ type: 'move', id: 'ball', position: { x: 1, y: 3, z: 4 } }])), [
    'Ball · position x/y/z: (0, 1, 2) → (1, 3, 4) m',
  ]);
});

test('force vectors, removed application points and component removal stay visible', () => {
  const scene = cart();
  const force = { id: 'push', body: 'cart-body', vector: { x: 1, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 }, point: { x: 0, y: 0, z: 0 }, frame: 'world' };
  scene.forces = [force];
  const { point, ...centered } = force;
  const lines = describeChanges(scene, proposed([{ type: 'upsert-force', force: { ...centered, vector: { x: 2, y: 0, z: 0 } } }]));
  assert.equal(lines.length, 2);
  assert.ok(lines.some(line => line.includes('(1, 0, 0) → (2, 0, 0) N')));
  assert.ok(lines.some(line => line.includes('point') && line.includes('→ none')));
  assert.deepEqual(describeChanges(scene, proposed([{ type: 'remove-component', collection: 'forces', id: 'push' }])), ['Remove Force push.']);
});

test('removing a motor and adding a force disclose their physical fields', () => {
  const scene = cart(), joint = scene.constraints.find(c => c.type === 'slider');
  joint.motor = { targetVelocity: .5, gain: 10, maxEffort: 1 };
  const { motor, ...passive } = joint;
  assert.ok(describeChanges(scene, proposed([{ type: 'upsert-constraint', constraint: passive }])).some(line => line.includes('motor') && line.includes('→ none')));
  const force = { id: 'new-push', body: 'cart-body', vector: { x: 3, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 }, frame: 'local' };
  const lines = describeChanges(scene, proposed([{ type: 'upsert-force', force }]));
  assert.ok(lines.includes('Add Force new-push.'));
  assert.ok(lines.some(line => line.includes('vector') && line.includes('(3, 0, 0) N')));
  assert.ok(lines.some(line => line.includes('frame') && line.includes('local')));
});

test('invalid batches still reject without changing the original scene', () => {
  const scene = cart(), before = JSON.stringify(scene);
  assert.throws(() => describeChanges(scene, proposed([
    { type: 'set-property', id: 'cart-body', property: 'mass', value: 2 },
    { type: 'set-property', id: 'cart-body', property: 'mass', value: -1 },
  ])));
  assert.equal(JSON.stringify(scene), before);
});

test('new bodies disclose initial motion, friction and drag as well as size and mass', () => {
  const ball = newObject('ball', 'launched');
  ball.velocity = { x: 3, y: 0, z: 1 }; ball.friction = .4;
  ball.aerodynamics = { coefficient: 1, area: .2 };
  const lines = describeChanges(emptyScene(), proposed([{ type: 'add', object: ball }]));
  assert.ok(lines.some(line => line.includes('velocity x/y/z') && line.includes('(3, 0, 1) m/s')));
  assert.ok(lines.some(line => line.includes('friction') && line.includes('0.4')));
  assert.ok(lines.some(line => line.includes('aerodynamics') && line.includes('coefficient')));
});

test('fixing a moving body discloses the velocity changes made with it', () => {
  const scene = emptyScene(), ball = newObject('ball', 'ball');
  ball.velocity = { x: 3, y: 0, z: 1 }; ball.angularVelocity = { x: 0, y: 0, z: 5 }; scene.objects.push(ball);
  const lines = describeChanges(scene, proposed([{ type: 'set-property', id: 'ball', property: 'fixed', value: true }]));
  assert.equal(lines.length, 3);
  assert.ok(lines.some(line => line.includes('fixed') && line.includes('true')));
  assert.ok(lines.some(line => line.includes('velocity x/y/z') && line.includes('(3, 0, 1) → (0, 0, 0) m/s')));
  assert.ok(lines.some(line => line.includes('angularVelocity x/y/z') && line.includes('(0, 0, 5) → (0, 0, 0) rad/s')));
});

test('vector values read as at most four decimals, with solver noise shown as 0', () => {
  const scene = emptyScene(), ball = newObject('ball', 'ball');
  ball.position = { x: -4.855656623840332, y: 1.9511557817459106, z: 1.8959870294859432e-13 }; ball.label = 'Ball'; scene.objects.push(ball);
  assert.deepEqual(describeChanges(scene, proposed([{ type: 'move', id: 'ball', position: { x: 3, y: 2, z: 1.8959870294859432e-13 } }])), [
    'Ball · position x/y/z: (-4.8557, 1.9512, 0) → (3, 2, 0) m',
  ]);
});

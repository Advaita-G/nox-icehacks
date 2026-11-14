import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyScene, newObject, validateScene, rotateZ } from '../src/physics/scene.ts';
import { parseCommand } from '../src/input/contract.ts';

function setup() {
  const scene = emptyScene(), support = newObject('block', 'support'), load = newObject('block', 'load');
  support.fixed = true; support.position = { x: 0, y: 0, z: 0 }; load.position = { x: 0, y: 1, z: 0 };
  scene.objects = [support, load];
  return scene;
}
const joint = type => ({ id: 'attach', type, bodyA: 'support', bodyB: 'load', anchorA: { x: 0, y: 0, z: 0 }, anchorB: { x: 0, y: 0, z: 0 }, ...(['hinge', 'slider'].includes(type) ? { axisA: { x: 1, y: 0, z: 0 }, axisB: { x: 1, y: 0, z: 0 } } : {}) });
const command = operations => JSON.stringify({ requestId: 'joint', status: 'proposed', operations, summary: ['Connect the parts'], questions: [], message: '' });

for (const type of ['hinge', 'fixed', 'spherical', 'slider']) {
  test(`a newly proposed ${type} rejects a hidden one-metre anchor snap atomically`, () => {
    const scene = setup(), before = JSON.stringify(scene);
    assert.throws(() => parseCommand(command([{ type: 'upsert-constraint', constraint: joint(type) }]), 'joint', scene), /attach.*(1\.0000 m|off the rail)/);
    assert.equal(JSON.stringify(scene), before);
  });
}

test('alignment is checked on the final atomic batch, including rotated local anchors', () => {
  const scene = setup(); scene.objects[0].rotation = rotateZ(Math.PI / 2);
  const hinge = { ...joint('hinge'), anchorA: { x: 1, y: 0, z: 0 }, axisB: { x: 0, y: 1, z: 0 } };
  assert.doesNotThrow(() => parseCommand(command([{ type: 'upsert-constraint', constraint: hinge }]), 'joint', scene));
  assert.doesNotThrow(() => parseCommand(command([
    { type: 'upsert-constraint', constraint: joint('fixed') },
    { type: 'move', id: 'load', position: { x: 0, y: 0, z: 0 } },
  ]), 'joint', scene));
});

test('replacing a system cannot bypass new connection alignment', () => {
  const scene = setup(), replacement = structuredClone(scene); replacement.constraints = [joint('hinge')];
  assert.throws(() => parseCommand(command([{ type: 'replace-scene', scene: replacement }]), 'joint', scene), /Hinge attach/);
  assert.equal(scene.constraints.length, 0);
});

test('old scenes remain readable and unrelated edits do not impose new-connection checks', () => {
  const scene = setup(); scene.constraints = [joint('hinge')];
  assert.doesNotThrow(() => validateScene(scene));
  assert.doesNotThrow(() => parseCommand(command([{ type: 'set-property', id: 'load', property: 'mass', value: 2 }]), 'joint', scene));
});

test('springs can keep their intended separated anchors', () => {
  const scene = setup(), spring = { ...joint('spring'), length: 1, stiffness: 20, damping: 0 };
  assert.doesNotThrow(() => parseCommand(command([{ type: 'upsert-constraint', constraint: spring }]), 'joint', scene));
});

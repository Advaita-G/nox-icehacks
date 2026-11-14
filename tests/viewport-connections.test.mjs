import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ConnectionLines, Viewport } from '../src/viewport.ts';
import { emptyScene, newObject } from '../src/physics/scene.ts';

const rotation = { x: 0, y: 0, z: 0, w: 1 };
function fixture() {
  const scene = emptyScene('Connection rendering');
  scene.objects = [newObject('block', 'a'), newObject('ball', 'b')];
  scene.constraints = [{ id: 'link', type: 'spring', bodyA: 'a', bodyB: 'b', anchorA: { x: 0, y: 0, z: 0 }, anchorB: { x: 0, y: 0, z: 0 }, length: 2, stiffness: 16, damping: 0 }];
  const sample = { bodies: [{ objectId: 'a', position: { x: 0, y: 0, z: 0 }, rotation }, { objectId: 'b', position: { x: 3, y: 0, z: 0 }, rotation }] };
  return { scene, sample };
}

test('moving connections retain geometry, material and GPU attribute storage across frames', () => {
  const { scene, sample } = fixture(), lines = new ConnectionLines();
  lines.update(scene, sample, '#7fd3e6');
  const line = lines.children[0], geometry = line.geometry, material = line.material;
  const positions = geometry.getAttribute('position'), distances = geometry.getAttribute('lineDistance');
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++); material.addEventListener('dispose', () => disposed++);
  for (let frame = 0; frame < 120; frame++) {
    sample.bodies[1].position.x = 3 + frame / 120;
    lines.update(scene, sample, '#7fd3e6');
    assert.equal(lines.children[0], line); assert.equal(line.geometry, geometry); assert.equal(line.material, material);
    assert.equal(geometry.getAttribute('position'), positions); assert.equal(geometry.getAttribute('lineDistance'), distances);
  }
  assert.equal(disposed, 0);
  assert.ok(Math.abs(positions.getX(1) - (3 + 119 / 120)) < 1e-6);
  assert.ok(Math.abs(distances.getX(1) - positions.getX(1)) < 1e-6);
  assert.ok(geometry.boundingSphere.radius > 1.9);
  lines.dispose(); assert.equal(disposed, 2);
});

test('rotated anchors, changed anchors and dashed distances update without recreating resources', () => {
  const { scene, sample } = fixture(), lines = new ConnectionLines();
  sample.bodies[0].position = { x: 1, y: 2, z: 3 };
  sample.bodies[0].rotation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
  sample.bodies[1].position = { x: 4, y: 2, z: 3 };
  scene.constraints[0].anchorA.x = 1;
  lines.update(scene, sample, '#7fd3e6');
  const line = lines.children[0], positions = line.geometry.getAttribute('position');
  assert.deepEqual([...positions.array], [1, 3, 3, 4, 2, 3]);
  assert.ok(Math.abs(line.geometry.getAttribute('lineDistance').getX(1) - Math.sqrt(10)) < 1e-6);
  scene.constraints[0].anchorA.x = 2; lines.update(scene, sample, '#7fd3e6');
  assert.equal(lines.children[0], line); assert.equal(positions.getY(0), 4);
  lines.dispose();
});

test('topology, removal and style changes release obsolete resources once', () => {
  const { scene, sample } = fixture(), lines = new ConnectionLines();
  scene.constraints.push({ ...scene.constraints[0], id: 'second' });
  lines.update(scene, sample, '#7fd3e6');
  let geometryDisposals = 0, materialDisposals = 0;
  const old = [...lines.children], material = old[0].material;
  old.forEach(line => line.geometry.addEventListener('dispose', () => geometryDisposals++));
  material.addEventListener('dispose', () => materialDisposals++);
  assert.equal(old[1].material, material);
  scene.constraints.pop(); lines.update(scene, sample, '#7fd3e6');
  assert.equal(geometryDisposals, 2); assert.equal(materialDisposals, 1); assert.equal(lines.children.length, 1);
  const current = lines.children[0]; lines.update(scene, sample, '#ffffff');
  assert.notEqual(lines.children[0].geometry, current.geometry); assert.notEqual(lines.children[0].material, current.material);
  scene.constraints = []; lines.update(scene, sample, '#ffffff'); assert.equal(lines.children.length, 0);
  lines.dispose(); assert.equal(materialDisposals, 1);
});

test('Viewport releases connection resources when replacement geometry rebuilds the scene', () => {
  const { scene, sample } = fixture(), viewport = Object.create(Viewport.prototype);
  const priorDocument = globalThis.document, priorStyle = globalThis.getComputedStyle;
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#7fd3e6' });
  Object.assign(viewport, { objects: new THREE.Group(), ghosts: new THREE.Group(), links: new ConnectionLines(), meshes: new Map(), signature: '', selected: '', transform: { dragging: false, enabled: false, detach() {}, getHelper: () => ({}) }, render() {} });
  try {
    viewport.update(scene, sample, '');
    let disposed = 0;
    const previous = viewport.links.children[0];
    previous.geometry.addEventListener('dispose', () => disposed++); previous.material.addEventListener('dispose', () => disposed++);
    scene.objects[0].width = 2; viewport.update(scene, sample, '');
    assert.equal(disposed, 2); assert.notEqual(viewport.links.children[0], previous);
    viewport.links.dispose();
  } finally { globalThis.document = priorDocument; globalThis.getComputedStyle = priorStyle; }
});

test('disabled manual controls detach the selected gizmo and reattach only when enabled', () => {
  const { scene, sample } = fixture(), viewport = Object.create(Viewport.prototype), helper = {};
  const priorDocument = globalThis.document, priorStyle = globalThis.getComputedStyle;
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#7fd3e6' });
  let attached = 0;
  const transform = { dragging: false, enabled: false, object: undefined,
    attach(object) { this.object = object; attached++; }, detach() { this.object = undefined; }, getHelper: () => helper };
  Object.assign(viewport, { objects: new THREE.Group(), ghosts: new THREE.Group(), links: new ConnectionLines(), meshes: new Map(), signature: '', selected: '', transform, render() {} });
  try {
    viewport.update(scene, sample, 'b');
    assert.equal(attached, 0); assert.equal(transform.object, undefined); assert.equal(helper.visible, false);
    const ball = viewport.meshes.get('b');
    transform.enabled = true; viewport.update(scene, sample, 'b'); viewport.update(scene, sample, 'b');
    assert.equal(attached, 1); assert.equal(transform.object, ball); assert.equal(helper.visible, true);
    transform.enabled = false; viewport.update(scene, sample, 'b');
    assert.equal(transform.object, undefined); assert.equal(helper.visible, false); assert.equal(viewport.meshes.get('b'), ball);
    transform.enabled = true; viewport.update(scene, sample, 'a');
    assert.equal(attached, 2); assert.equal(transform.object, viewport.meshes.get('a'));
  } finally { viewport.clear(viewport.objects); viewport.links.dispose(); globalThis.document = priorDocument; globalThis.getComputedStyle = priorStyle; }
});

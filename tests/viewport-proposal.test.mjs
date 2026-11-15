import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Viewport } from '../src/viewport.ts';
import { newObject } from '../src/physics/scene.ts';

test('proposal ghosts reuse their created material and release it exactly once', () => {
  const priorDocument = globalThis.document, priorStyle = globalThis.getComputedStyle;
  globalThis.document = { documentElement: {} }; globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#eeeeee' });
  const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true }), geometry = new THREE.BoxGeometry(1, 1, 1);
  let materialsFreed = 0, geometryFreed = 0;
  material.addEventListener('dispose', () => materialsFreed++); geometry.addEventListener('dispose', () => geometryFreed++);
  const viewport = Object.create(Viewport.prototype);
  Object.assign(viewport, { proposal: new THREE.Group(), meshes: new Map(), render() {}, mesh() { const g = new THREE.Group(); g.add(new THREE.Mesh(geometry, material)); return g; } });
  try {
    viewport.showProposal([{ kind: 'ghost', id: 'b', object: newObject('block', 'b') }], 'Proposed move');
    assert.equal(viewport.proposal.children[0].children[0].material, material); assert.equal(materialsFreed, 0);
    viewport.clearProposal(); assert.equal(materialsFreed, 1); assert.equal(geometryFreed, 1);
  } finally { globalThis.document = priorDocument; globalThis.getComputedStyle = priorStyle; }
});

test('source-print cleanup cancels only its own scheduling API and frees its resources', () => {
  const oldRAF = globalThis.cancelAnimationFrame, oldTimeout = globalThis.clearTimeout, cancelledFrames = [], cancelledTimers = [];
  globalThis.cancelAnimationFrame = id => cancelledFrames.push(id); globalThis.clearTimeout = id => cancelledTimers.push(id);
  const viewport = Object.create(Viewport.prototype); Object.assign(viewport, { scene: new THREE.Scene(), render() {} });
  try {
    for (const schedule of [{ frame: 7 }, { timer: 8 }]) {
      const texture = new THREE.Texture(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()); let freed = 0;
      texture.addEventListener('dispose', () => freed++); mesh.geometry.addEventListener('dispose', () => freed++); mesh.material.addEventListener('dispose', () => freed++);
      viewport.scene.add(mesh); viewport.print = { mesh, texture, started: 0, ...schedule };
      viewport.clearSourcePrint(); assert.equal(viewport.print, undefined); assert.equal(freed, 3);
    }
    assert.deepEqual(cancelledFrames, [7]); assert.deepEqual(cancelledTimers, [8]);
  } finally { globalThis.cancelAnimationFrame = oldRAF; globalThis.clearTimeout = oldTimeout; }
});

test('long offscreen annotations remain fully within the viewport', () => {
  const viewport = Object.create(Viewport.prototype), camera = new THREE.PerspectiveCamera(38, .5, .05, 5000);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const element = { offsetWidth: 192, offsetHeight: 104, style: {}, toggleAttribute() {} };
  Object.assign(viewport, { camera, meshes: new Map([['far', mesh]]), note: { id: 'far', element } });
  try {
    for (const position of [[1000,1000,0],[-1000,-1000,0],[1000,-1000,20]]) {
      mesh.position.set(...position); viewport.placeNote(320, 640);
      const [x,y] = [...element.style.transform.matchAll(/(-?\d+)px/g)].map(m => Number(m[1]));
      assert.ok(x - 12 >= 8 && x - 12 + element.offsetWidth <= 312);
      assert.ok(y - 52 >= 12 && y - 52 + element.offsetHeight <= 624);
    }
  } finally { mesh.geometry.dispose(); mesh.material.dispose(); }
});

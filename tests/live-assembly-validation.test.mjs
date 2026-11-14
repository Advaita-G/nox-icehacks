import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyCommands, initPhysics, Physics, rotateZ, validateScene } from '../src/physics/index.ts';
import { parseCommand, parseInterpretation } from '../src/input/contract.ts';
import { product, rotate } from '../src/physics/math.ts';
import { geometryParts, primitive } from '../src/physics/geometry.ts';

const read = path => JSON.parse(readFileSync(new URL('../docs/evidence/' + path, import.meta.url), 'utf8'));
const cartRequest = read('live-momen-2026-11-10-spring-cart/conv-35-request.json');
const cartReply = read('live-momen-2026-11-10-spring-cart/conv-35-response.json');
const voiceRequest = read('live-voice-2026-11-10/command-request.json');
const voiceReply = read('live-voice-2026-11-10/command-response.json');
const source = { ...cartRequest.source, strokeIds: cartRequest.source.strokes.map(stroke => stroke.id) };
const interpretCart = scene => parseInterpretation(JSON.stringify({ ...cartReply, scene }), cartRequest.requestId, source);

test('recorded thin wheels get a part-specific error and compile at their actual dimensions in a body frame', async () => {
  const reply = read('live-momen-2026-11-10-spring-cart-rerun/conv-44-response.json');
  assert.throws(() => validateScene(reply.scene), /left-wheel: Height must be finite and between 0.1 and 30/);
  const scene = structuredClone(reply.scene);
  for (const id of ['left-wheel', 'right-wheel']) {
    const wheel = scene.objects.find(o => o.id === id);
    const height = wheel.height;
    wheel.height = .1;
    wheel.geometry = [primitive('cylinder', { x: 1, y: height / wheel.height, z: 1 })];
    assert.ok(Math.abs(geometryParts(wheel)[0].size.y - .035) < 1e-12);
  }
  await initPhysics();
  const physics = new Physics(validateScene(scene));
  physics.free();
});

test('new slider interpretation rejects the recorded transverse error while saved-scene validation remains compatible', () => {
  assert.doesNotThrow(() => validateScene(cartReply.scene));
  assert.throws(() => interpretCart(cartReply.scene), /cart-track-slider.*0\.0400 m off the rail/);
  const corrected = structuredClone(cartReply.scene);
  corrected.constraints.find(c => c.id === 'cart-track-slider').anchorA.y = .12;
  assert.equal(interpretCart(corrected).status, 'ready');
  corrected.constraints.find(c => c.id === 'cart-track-slider').anchorA.x += .2;
  assert.equal(interpretCart(corrected).status, 'ready', 'axial displacement is allowed');
  const rotation = rotateZ(.5);
  for (const body of corrected.objects) {
    body.position = rotate(rotation, body.position);
    body.rotation = product(rotation, body.rotation);
  }
  assert.equal(interpretCart(corrected).status, 'ready', 'alignment is checked in world space');
  corrected.constraints.find(c => c.id === 'cart-track-slider').anchorA.y += .004;
  assert.throws(() => interpretCart(corrected), /off the rail/);
});

test('recorded spoken clarification normalizes labels into the existing string choices', () => {
  const parsed = parseCommand(JSON.stringify(voiceReply), voiceRequest.requestId, voiceRequest.scene);
  assert.equal(parsed.status, 'needs-clarification');
  assert.deepEqual(parsed.questions[0].options, voiceReply.questions[0].options.map(option => option.label));
  assert.deepEqual(parsed.operations, []);
  assert.equal(typeof voiceReply.questions[0].options[0], 'object');
  for (const option of [null, true, { label: 1, value: 'x' }, { label: 'x', value: '' }, { label: 'x'.repeat(501), value: 'x' }, { label: 'x', value: 'x', extra: 'x' }]) {
    const bad = structuredClone(voiceReply);
    bad.questions[0].options = [option];
    assert.throws(() => parseCommand(JSON.stringify(bad), voiceRequest.requestId, voiceRequest.scene));
  }
});

test('recorded spoken mass change reaches the solver with exactly the selected mass changed', async () => {
  const request = read('live-voice-2026-11-10/command2-request.json');
  const response = read('live-voice-2026-11-10/command2-response.json');
  const command = parseCommand(JSON.stringify(response), request.requestId, request.scene);
  assert.equal(command.operations.length, 1);
  const scene = applyCommands(request.scene, { baseSceneRevision: request.scene.revision, operations: command.operations });
  const id = command.operations[0].id;
  assert.equal(request.scene.objects.find(o => o.id === id).mass, 1);
  assert.equal(scene.objects.find(o => o.id === id).mass, 2);
  assert.deepEqual(scene.objects.filter(o => o.id !== id), request.scene.objects.filter(o => o.id !== id));
  await initPhysics();
  const physics = new Physics(scene);
  try { assert.equal(physics.sample().bodies.find(o => o.objectId === id).mass, 2); }
  finally { physics.free(); }
});

test('recorded spoken floor extension preserves its left edge and changes the supported motion', async () => {
  const request = read('live-a4-2026-11-10/conv-50-request.json');
  const response = read('live-a4-2026-11-10/conv-50-response.json');
  const original = parseInterpretation(JSON.stringify(response), request.requestId,
    { ...request.source, strokeIds: request.source.strokes.map(stroke => stroke.id) }).scene;
  const commandRequest = read('live-a4-2026-11-10/conv-52-request.json');
  const command = parseCommand(JSON.stringify(read('live-a4-2026-11-10/conv-52-response.json')), commandRequest.requestId, original);
  const changed = applyCommands(original, { baseSceneRevision: original.revision, operations: command.operations });
  const before = original.objects.find(o => o.id === 'floor'), after = changed.objects.find(o => o.id === 'floor');
  assert.ok(Math.abs(after.width - before.width - 3) < 1e-9);
  assert.ok(Math.abs((after.position.x - after.width / 2) - (before.position.x - before.width / 2)) < 1e-9);
  assert.deepEqual(changed.objects.filter(o => o.id !== 'floor'), original.objects.filter(o => o.id !== 'floor'));
  await initPhysics();
  const heights = [original, changed].map(scene => {
    const physics = new Physics(scene);
    try {
      for (let i = 0; i < 180; i++) physics.step();
      return physics.sample().bodies.find(b => b.objectId === 'ball').position.y;
    } finally { physics.free(); }
  });
  assert.ok(heights[0] < -2);
  assert.ok(Math.abs(heights[1] - .26) < .01);
});

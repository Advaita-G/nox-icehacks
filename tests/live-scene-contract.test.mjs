import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { CAPABILITIES, initPhysics, Physics, Workbench, rotateZ, validateScene } from '../src/physics/index.ts';
import { rotate } from '../src/physics/math.ts';
import { parseInterpretation, REQUEST_TIMEOUTS } from '../src/input/contract.ts';
import { INTERPRET_3D } from '../src/input/prompt.ts';
import { apiMiddleware } from '../server/middleware.ts';

await initPhysics();
const target = { experimentId: 'e', versionId: 'v', sourceId: 's', sourceRevision: 1, sceneRevision: 0, epoch: 0 };
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('root middleware retains measured sketch and command delays and aborts at the bounded deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const body = { requestId: 'r', target, source: { id: 's', revision: 1, kind: 'photo', image, widthPx: 1, heightPx: 1 }, notes: '', answers: [] };
  let signal, complete;
  const provider = { complete: async (input) => {
    signal = input.signal;
    return new Promise((resolve, reject) => {
      complete = resolve;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  } };
  const middleware = apiMiddleware({ NOX_MODEL_PROVIDER: 'fixture' }, { fixture: provider });
  const call = (url = '/api/interpret', requestBody = body) => {
    const req = Readable.from([Buffer.from(JSON.stringify(requestBody))]);
    Object.assign(req, { method: 'POST', url, headers: { host: 'localhost:5193' } });
    const res = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false, status: 0, value: null,
      writeHead(status) { this.status = status; },
      end(text) { this.value = JSON.parse(text); this.writableEnded = true; },
    });
    return { res, done: middleware(req, res, () => assert.fail('API route should be handled')) };
  };
  const first = call();
  await new Promise(setImmediate);
  assert.ok(signal);
  t.mock.timers.tick(98_600);
  assert.equal(signal.aborted, false);
  complete('{"scene":"controlled test response"}');
  await first.done;
  assert.equal(first.res.status, 200);
  const second = call();
  await new Promise(setImmediate);
  t.mock.timers.tick(120_000);
  assert.equal(signal.aborted, true);
  await second.done;
  assert.notEqual(second.res.status, 200);
  const commandBody = JSON.parse(readFileSync(new URL('../docs/evidence/live-voice-2026-11-10/command-request.json', import.meta.url), 'utf8'));
  const command = call('/api/command', commandBody);
  await new Promise(setImmediate);
  t.mock.timers.tick(18_600);
  assert.equal(signal.aborted, false, 'the recorded spoken clarification arrived after the old 15 s cutoff');
  complete(readFileSync(new URL('../docs/evidence/live-voice-2026-11-10/command-response.json', import.meta.url), 'utf8'));
  await command.done;
  assert.equal(command.res.status, 200);
  const expired = call('/api/command', commandBody);
  await new Promise(setImmediate);
  t.mock.timers.tick(120_000);
  assert.equal(signal.aborted, true);
  await expired.done;
  assert.notEqual(expired.res.status, 200);
  assert.deepEqual(REQUEST_TIMEOUTS, { sketch: 120_000, command: 120_000 });
});

test('model instructions publish enforced object bounds, kinds and a compilable custom geometry example', () => {
  assert.equal(CAPABILITIES.limits.massMin, .05);
  assert.equal(CAPABILITIES.limits.massMax, 100);
  assert.deepEqual(CAPABILITIES.limits.scale, [5, 500]);
  assert.deepEqual(CAPABILITIES.limits.motor.targetVelocity, [-80, 80]);
  assert.ok(CAPABILITIES.builtInKinds.includes('ball'));
  assert.ok(!CAPABILITIES.builtInKinds.includes('sphere'));
  assert.ok(INTERPRET_3D.includes(JSON.stringify(CAPABILITIES)));
  const example = JSON.parse(INTERPRET_3D.split('Scene schema example (structure only, not an interpretation template): ')[1].split('\n')[0]);
  const checked = validateScene(example);
  assert.ok(checked.objects.some((o) => o.geometry?.length));
  const bench = new Workbench(checked);
  bench.physics.free();
  for (const mass of [.049, 100.001]) {
    const invalid = structuredClone(example); invalid.objects[0].mass = mass;
    assert.throws(() => validateScene(invalid), /Mass/);
  }
});

test('verbatim live scene remains rejected; explicit scratch corrections compile without aliases', () => {
  const live = JSON.parse(readFileSync(new URL('../docs/evidence/live-momen-2026-11-10-scene/model-response.json', import.meta.url), 'utf8'));
  const source = { id: live.sourceId, revision: live.sourceRevision, kind: 'canvas', strokeIds: Array.from({ length: 10 }, (_, i) => `s${i + 1}`) };
  assert.throws(() => parseInterpretation(JSON.stringify(live), live.requestId, source), /Mass/);
  const scratch = structuredClone(live);
  scratch.scene.objects.find((o) => o.id === 'ramp-wedge').mass = 20;
  assert.throws(() => parseInterpretation(JSON.stringify(scratch), live.requestId, source), /Custom named parts/);
  scratch.scene.objects.find((o) => o.id === 'ball').geometry = [{ shape: 'sphere', size: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }];
  const checked = parseInterpretation(JSON.stringify(scratch), live.requestId, source);
  const bench = new Workbench(checked.scene);
  assert.equal(checked.scene.objects.find((o) => o.id === 'ball').kind, 'sphere');
  bench.physics.free();
  assert.equal(live.scene.objects.find((o) => o.id === 'ramp-wedge').mass, 300);
});

test('live fan replies reject unsupported values and rounded shapes; an explicitly corrected scene produces measured wake force', () => {
  function recordedFan(call) {
    const read = (part) => JSON.parse(readFileSync(new URL(`../docs/evidence/live-momen-2026-11-10-fan/conv-${call}-${part}.json`, import.meta.url), 'utf8'));
    const request = read('request'), reply = read('response');
    const source = { ...request.source, strokeIds: request.source.strokes.map(stroke => stroke.id) };
    return { reply, parse: () => parseInterpretation(JSON.stringify(reply), request.requestId, source) };
  }
  assert.throws(recordedFan(26).parse, /Motor target velocity.*-80 and 80/);
  const { reply, parse } = recordedFan(29);
  assert.throws(parse, /Drawing pixels per meter.*5 and 500/);
  reply.scene.scale = 70;
  assert.throws(parse, /fan-stand: curved parts.*0\.080010000 m vs 0\.080000000 m/);
  const stand = reply.scene.objects.find(o => o.id === 'fan-stand');
  const sphere = stand.geometry.find(part => part.shape === 'sphere');
  sphere.size = { x: .08 / stand.width, y: .08 / stand.height, z: .08 / stand.depth };
  assert.throws(parse, /Rotation must be a unit quaternion/);
  const rotor = reply.scene.objects.find(o => o.id === 'fan-rotor');
  for (const part of rotor.geometry) {
    if (Math.abs(part.rotation.x) === .866) part.rotation.x = Math.sign(part.rotation.x) * Math.sqrt(3) / 2;
  }
  const originalAim = parse().scene;
  const aimed = structuredClone(originalAim);
  const tilt = rotateZ(-Math.atan2(.5, 1));
  aimed.objects.find(o => o.id === 'fan-rotor').rotation = tilt;
  aimed.constraints[0].axisA = rotate(tilt, { x: 1, y: 0, z: 0 });
  aimed.fans[0].position = { x: 0, y: 0, z: 0 };
  const stopped = structuredClone(aimed);
  stopped.constraints[0].motor.targetVelocity = 0;
  function run(scene) {
    const physics = new Physics(scene);
    try {
      for (let tick = 0; tick < 360; tick++) physics.step();
      return physics.sample();
    } finally {
      physics.free();
    }
  }
  assert.equal(run(originalAim).mechanisms.fans[0].targetForce.x, 0);
  const powered = run(aimed);
  assert.ok(powered.mechanisms.fans[0].thrust > .1);
  assert.ok(powered.mechanisms.fans[0].targetForce.x > .009);
  assert.ok(powered.bodies.find(body => body.objectId === 'box').speed < .001);
  assert.equal(run(stopped).mechanisms.fans[0].targetForce.x, 0);
});

test('recorded late scenes compile with their complete assumptions and oversized text still rejects', () => {
  for (const id of [59, 62, 63]) {
    const directory = '../docs/evidence/live-a4-2026-11-10/after-floor-edit/';
    const request = JSON.parse(readFileSync(new URL(directory + `conv-${id}-request.json`, import.meta.url), 'utf8'));
    const raw = readFileSync(new URL(directory + `conv-${id}-response.json`, import.meta.url), 'utf8');
    const source = { ...request.source, strokeIds: request.source.strokes.map(stroke => stroke.id) };
    const result = parseInterpretation(raw, request.requestId, source);
    const bench = new Workbench(result.scene);
    bench.physics.free();
    assert.deepEqual(result.scene.assumptions, JSON.parse(raw).scene.assumptions);
    const invalid = structuredClone(result.scene);
    invalid.assumptions = ['x'.repeat(CAPABILITIES.limits.assumptions.length + 1)];
    assert.throws(() => validateScene(invalid), /Assumption must contain/);
  }
});

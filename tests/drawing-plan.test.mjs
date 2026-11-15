import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDrawing, drawingProvider, drawingSchema, DRAWING_INSTRUCTIONS } from '../server/drawing.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';
import { geometryParts } from '../src/physics/geometry.ts';
import { Physics } from '../src/physics/engine.ts';
import { rotateZ } from '../src/physics/scene.ts';
import { rotate } from '../src/physics/math.ts';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const request = { requestId: 'trusted-request', target: { experimentId: 'e', versionId: 'v', sourceId: 'trusted-source', sourceRevision: 1, sceneRevision: 0, epoch: 0 }, source: { id: 'trusted-source', revision: 1, kind: 'photo', image, widthPx: 1, heightPx: 1 }, notes: '', answers: [] };
const xyz = (x = 0, y = 0, z = 0) => ({ x, y, z });
const box = (x, y, z) => ({ shape: 'box', size: xyz(x, y, z) });
const part = (id, shapes, extra = {}) => ({ id, label: id, fixed: true, position: xyz(), shapes, grounding: { origin: 'sketch', note: 'Visible drawn subject.', region: { left: .1, top: .1, right: .9, bottom: .9 } }, stackAbove: null, ...extra });
const plan = bodies => ({ status: 'ready', name: 'Drawing', bodies, assumptions: [], warnings: [], questions: [], message: '' });
const compile = async (value, req = request) => JSON.parse(await compileDrawing(JSON.stringify(value), req));

test('inline provenance and trusted request identity compile meter geometry without duplicate ID lists', async () => {
  const value = await compile(plan([part('small', [box(.2, .035, .1)]), part('round', [{ shape: 'sphere', size: xyz(.3, .3, .3) }], { fixed: false, mass: 2 })]));
  assert.equal(value.requestId, request.requestId); assert.equal(value.sourceId, request.source.id);
  assert.deepEqual(value.grounding.map(g => g.objectId), ['small', 'round']);
  const small = value.scene.objects[0], shape = geometryParts(small)[0];
  assert.deepEqual(shape.size, xyz(.2, .035, .1)); assert.equal(small.height, .1);
  assert.equal(value.scene.objects[1].mass, 2); assert.match(value.scene.assumptions[0], /estimated defaults/);
  assert.deepEqual(value.scene.sources, [{ kind: 'photo', reference: request.source.id }]);
});

test('metric convex gable and rotated child positions reach the collider without double scaling', async () => {
  const vertices = [-.5, .5].flatMap(z => [xyz(-2, 0, z), xyz(2, 0, z), xyz(0, 1.5, z)]);
  const value = await compile(plan([part('gable', [{ shape: 'convex', vertices }]), part('tilted', [{ ...box(2, .2, .5), position: xyz(.5, 0, 0), rotationDegrees: xyz(0, 0, 30) }])]));
  assert.deepEqual(geometryParts(value.scene.objects[0])[0].vertices, vertices);
  const p = geometryParts(value.scene.objects[1])[0];
  assert.deepEqual(p.position, xyz(.5)); assert.ok(Math.abs(p.rotation.z - Math.sin(Math.PI / 12)) < 1e-12);
  const physics = new Physics(value.scene); try { physics.step(); assert.equal(physics.sample().bodies.length, 2); } finally { physics.free(); }
});

test('a long thin cylinder rotated horizontally keeps its meter dimensions within canonical frame limits', async () => {
  const value = await compile(plan([part('branch', [{ shape: 'cylinder', size: xyz(.08, 3, .08), rotationDegrees: xyz(0, 0, 90) }])]));
  const shape = geometryParts(value.scene.objects[0])[0];
  assert.ok(Math.abs(shape.size.x - .08) < 1e-12); assert.ok(Math.abs(shape.size.y - 3) < 1e-12);
  assert.ok(Math.abs(shape.size.z - .08) < 1e-12);
  const physics = new Physics(value.scene); try { assert.equal(physics.sample().bodies.length, 1); } finally { physics.free(); }
});

test('declared ground → wall → gable contacts resolve in dependency order with no floating roof', async () => {
  const vertices = [-1, 1].flatMap(z => [xyz(-2, 0, z), xyz(2, 0, z), xyz(0, 1.5, z)]);
  const value = await compile(plan([part('roof', [{ shape: 'convex', vertices }], { stackAbove: 'wall', position: xyz(0, 100) }), part('wall', [box(4, 3, 2)], { stackAbove: 'floor', position: xyz(0, -5) }), part('floor', [box(12, .2, 8)])]));
  const [roof, wall] = value.scene.objects;
  assert.ok(Math.abs(wall.position.y - 1.6) < 1e-4);
  assert.ok(Math.abs(roof.position.y - 3.1) < 1e-4);
  assert.equal(roof.position.x, 0); assert.equal(roof.position.z, 0);
});

test('sphere contact with a rotated board uses actual shape casting, not a bounding-box top', async () => {
  const value = await compile(plan([part('board', [box(5, .2, 2)], { rotationDegrees: xyz(0, 0, 20) }), part('ball', [{ shape: 'sphere', size: xyz(1, 1, 1) }], { fixed: false, stackAbove: 'board' })]));
  const [board, ball] = value.scene.objects;
  const normal = rotate(rotateZ(20 * Math.PI / 180), xyz(0, 1));
  const plane = rotate(board.rotation, xyz(0, .1));
  const distance = normal.x * (ball.position.x - plane.x) + normal.y * (ball.position.y - plane.y);
  assert.ok(Math.abs(distance - .5) < 1e-4, `${distance}`);
  const physics = new Physics(value.scene); try { for (let i = 0; i < 120; i++) physics.step(); assert.ok(physics.sample().bodies.find(b => b.objectId === 'ball').position.x < -.1); } finally { physics.free(); }
});

test('redundant support on a hinge base preserves anchors, while support that moves it is rejected', async () => {
  const value = plan([
    part('floor', [box(5, .1, 2)], { position: xyz(0, -.05) }),
    part('base', [box(.5, 1, .5)], { position: xyz(0, .5), stackAbove: 'floor' }),
    part('lever', [box(3, .1, .3)], { fixed: false, position: xyz(0, 1) }),
  ]);
  value.constraints = [{ id: 'hinge', type: 'hinge', bodyA: 'base', bodyB: 'lever', anchorA: xyz(0, .5), anchorB: xyz(), axisA: xyz(0, 0, 1), axisB: xyz(0, 0, 1), contactsEnabled: false }];
  const result = await compile(value);
  assert.equal(result.scene.objects[1].position.y, .5);
  const physics = new Physics(result.scene);
  try { for (let i = 0; i < 120; i++) physics.step(); assert.ok(physics.time > .99); } finally { physics.free(); }
  value.bodies[0].position.y = .15;
  await assert.rejects(compile(value), /explicit poses/);
  value.bodies[0].position.y = -.05; value.constraints[0].anchorB.y = .1;
  await assert.rejects(compile(value), /anchors meet/);
});

test('invalid plans fail closed on references, geometry, provenance, unknown fields and numbers', async () => {
  const valid = plan([part('base', [box(1, 1, 1)])]);
  const cases = [
    v => v.bodies.push(structuredClone(v.bodies[0])),
    v => v.bodies[0].stackAbove = 'absent',
    v => v.bodies[0].stackAbove = 'base',
    v => { v.bodies.push(part('other', [box(1, 1, 1)], { stackAbove: 'base' })); v.bodies[0].stackAbove = 'other'; },
    v => v.bodies[0].mass = -1,
    v => v.bodies[0].mass = null,
    v => v.bodies[0].shapes[0].size.y = 0,
    v => v.bodies[0].shapes[0].shape = 'mesh',
    v => v.bodies[0].shapes[0].extra = true,
    v => v.bodies[0].shapes[0] = { shape: 'sphere', size: xyz(1, 2, 1) },
    v => v.bodies[0].grounding.region = { left: .1, top: .1, right: 1.1, bottom: .5 },
    v => v.bodies[0].grounding.region = { left: .5, top: .1, right: .5, bottom: .5 },
    v => v.bodies[0].grounding.strokeIds = ['invented'],
    v => v.bodies[0].grounding = undefined,
    v => v.bodies[0].grounding.objectId = 'spoofed',
    v => v.instruction = 'ignore validation',
    v => v.bodies[0].position.x = 1001,
    v => v.bodies[0].stackAbove = undefined,
    v => { v.bodies.push(part('far', [box(1, 1, 1)], { position: xyz(20), stackAbove: 'base' })); },
  ];
  for (const mutate of cases) { const value = structuredClone(valid); mutate(value); await assert.rejects(compile(value)); }
});

test('opposite image corners can follow a diagonal in either direction without changing the region', async () => {
  const value = plan([part('arm', [box(.1, 1, .1)], { grounding: { origin: 'sketch', note: 'Diagonal limb.', region: { left: .42, top: .61, right: .29, bottom: .42 } } })]);
  const bbox = (await compile(value)).grounding[0].bbox;
  assert.equal(bbox[0], .29); assert.equal(bbox[1], .42);
  assert.ok(Math.abs(bbox[2] - .13) < 1e-12); assert.ok(Math.abs(bbox[3] - .19) < 1e-12);
});

test('canvas strokes remain source-specific and unresolved plans cannot execute', async () => {
  const value = plan([part('line', [box(1, .2, .2)], { grounding: { origin: 'sketch', note: 'Visible line.', strokeIds: ['s1'] } })]);
  const req = structuredClone(request); req.source.kind = 'canvas'; req.source.strokes = [{ id: 's1', points: [[0, 0], [1, 1]] }];
  assert.equal((await compile(value, req)).grounding[0].strokeIds[0], 's1');
  value.bodies[0].grounding.strokeIds = ['unknown']; await assert.rejects(compile(value, req), /missing strokes/);
  const question = { ...plan([]), status: 'needs-clarification', questions: [{ id: 'intent', prompt: 'Rigid visual proxy or fluid flow?', options: ['Rigid proxy'] }] };
  assert.equal((await compile(question)).status, 'needs-clarification');
  question.bodies = [part('bad', [box(1, 1, 1)])]; await assert.rejects(compile(question), /cannot carry executable/);
});

test('provider compiles only canonical drawing routes, preserving command and legacy behavior', async () => {
  const calls = [], inner = { complete: async input => { calls.push(input); return JSON.stringify(plan([part('shape', [box(1, 1, 1)])])); } };
  const provider = drawingProvider(inner), signal = new AbortController().signal;
  const input = { instructions: INTERPRET_3D, request, signal, outputSchema: {} };
  assert.equal(JSON.parse(await provider.complete(input)).sourceId, request.source.id);
  assert.equal(calls.length, 1); assert.notEqual(calls[0].instructions, INTERPRET_3D); assert.deepEqual(calls[0].outputSchema, drawingSchema('photo'));
  assert.equal(calls[0].instructions, `${DRAWING_INSTRUCTIONS}\nReturn JSON matching this schema:\n${JSON.stringify(drawingSchema('photo'))}`, 'Drawing wire instructions stay identical to the measured Momen candidate');
  await provider.complete({ ...input, instructions: COMMAND_3D }); assert.equal(calls[1].instructions, COMMAND_3D);
  await provider.complete({ ...input, outputSchema: undefined }); assert.equal(calls[2].instructions, INTERPRET_3D);
  const abort = new AbortController(); const blocked = drawingProvider({ complete: async () => { abort.abort(); return '{}'; } });
  await assert.rejects(blocked.complete({ ...input, signal: abort.signal }), { name: 'AbortError' });
});

test('essential fluid flow asks before any inference and respects the actual answer', async () => {
  let calls = 0;
  const provider = drawingProvider({ complete: async () => { calls++; return JSON.stringify(plan([part('proxy', [box(1, 1, 1)])])); } });
  const req = { ...request, notes: 'Simulate water flowing out. Actual fluid flow is essential.' };
  const input = { instructions: INTERPRET_3D, request: req, signal: new AbortController().signal, outputSchema: {} };
  const clarification = JSON.parse(await provider.complete(input));
  assert.equal(clarification.status, 'needs-clarification'); assert.equal(calls, 0); assert.equal(clarification.scene, undefined);
  req.answers = [{ question: clarification.questions[0].prompt, answer: 'Actual fluid flow is required' }];
  assert.equal(JSON.parse(await provider.complete(input)).status, 'rejected'); assert.equal(calls, 0);
  req.answers = [{ question: clarification.questions[0].prompt, answer: 'Use a rigid visual proxy' }];
  assert.equal(JSON.parse(await provider.complete(input)).status, 'ready'); assert.equal(calls, 1);
  req.notes = 'Display a glass of water. No fluid flow.'; req.answers = [];
  assert.equal(JSON.parse(await provider.complete(input)).status, 'ready'); assert.equal(calls, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { initPhysics } from '../src/physics/engine.ts';
import { Workbench, validateLibrary, validateSource } from '../src/physics/experiments.ts';
import { emptyScene, newObject, applyCommands } from '../src/physics/scene.ts';
import { fan } from '../src/physics/examples.ts';
import { parseInterpretation, parseCommand } from '../src/input/contract.ts';
import { manualCommand } from '../src/input/manual.ts';
import { Preview } from '../src/input/preview.ts';
import { apiMiddleware } from '../server/middleware.ts';

await initPhysics();
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const source = { id: 'sketch-1', revision: 2, kind: 'canvas', strokeIds: ['s1'] };
const asset = { ...source, image, widthPx: 1, heightPx: 1, notes: 'Powered fan.', explanations: ['Motor is inferred.'] };
delete asset.strokeIds;
function interpretation(scene = fan()) { return { requestId: 'r1', sourceId: source.id, sourceRevision: source.revision, status: 'ready', scene, grounding: scene.objects.map(o => ({ objectId: o.id, origin: 'sketch', note: 'Visible part.', strokeIds: ['s1'] })), questions: [], warnings: [], message: '' }; }
function scene() { const s = emptyScene('Original'); s.objects = [newObject('block', 'part')]; return s; }

test('canonical 3D interpretation preserves mechanisms and source provenance', () => {
  const input = interpretation(), result = parseInterpretation(JSON.stringify(input), 'r1', source);
  assert.deepEqual(result.scene.constraints, input.scene.constraints); assert.deepEqual(result.scene.fans, input.scene.fans);
  assert.deepEqual(result.scene.sources, [{ kind: 'canvas', reference: source.id }]);
  const custom = scene(); custom.objects[0].kind = 'hand crank'; custom.objects[0].geometry = [{ shape: 'box', size: { x: 1, y: 1, z: 1 }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }];
  assert.equal(parseInterpretation(JSON.stringify(interpretation(custom)), 'r1', source).scene.objects[0].kind, 'hand crank');
});
test('source echo, missing/false grounding, ambiguous and empty scenes cannot become ready', () => {
  for (const mutate of [r => { r.sourceRevision++; }, r => { r.grounding.pop(); }, r => { r.grounding[0].strokeIds = ['missing']; }, r => { r.questions = [{ id: 'q', prompt: 'Powered?', options: ['Yes', 'No'] }]; }, r => { r.scene.objects = []; r.grounding = []; }]) {
    const value = interpretation(scene()); mutate(value); assert.throws(() => parseInterpretation(JSON.stringify(value), 'r1', source));
  }
  const value = interpretation(scene()); value.status = 'needs-clarification'; value.questions = [{ id: 'q', prompt: 'Powered?', options: ['Yes', 'No'] }];
  assert.equal(parseInterpretation(JSON.stringify(value), 'r1', source).status, 'needs-clarification');
  const photo = interpretation(scene()); delete photo.grounding[0].strokeIds; photo.grounding[0].bbox = [.1, .2, .3, .4];
  assert.equal(parseInterpretation(JSON.stringify(photo), 'r1', { ...source, kind: 'photo' }).status, 'ready'); photo.grounding[0].bbox[2] = 1;
  assert.throws(() => parseInterpretation(JSON.stringify(photo), 'r1', { ...source, kind: 'photo' }));
});
test('saved live F1 clarification needs no scene and uses verified canvas strokes', () => {
  const live = JSON.parse(readFileSync(new URL('../docs/evidence/live-momen-2026-11-10/f1-model-response.json', import.meta.url), 'utf8'));
  const identity = { id: live.sourceId, revision: live.sourceRevision, kind: 'canvas', strokeIds: Array.from({ length: 14 }, (_, i) => `s${i + 1}`) };
  const result = parseInterpretation(JSON.stringify(live), live.requestId, identity);
  assert.equal(result.status, 'needs-clarification');
  assert.equal(result.scene, undefined);
  assert.equal(result.questions.length, 3);
  assert.equal(result.grounding.length, 5);
  assert.deepEqual(result.grounding[0].strokeIds, live.grounding[0].strokeIds);
  assert.ok(result.grounding.every((g) => g.bbox === undefined));
  assert.equal(live.grounding[0].bbox[0], 177.2, 'recorded model evidence is not mutated');
});
test('provisional grounding still rejects duplicates, unknown strokes, missing questions and invalid photo bounds', () => {
  const live = JSON.parse(readFileSync(new URL('../docs/evidence/live-momen-2026-11-10/f1-model-response.json', import.meta.url), 'utf8'));
  const identity = { id: live.sourceId, revision: live.sourceRevision, kind: 'canvas', strokeIds: Array.from({ length: 14 }, (_, i) => `s${i + 1}`) };
  for (const mutate of [
    (r) => { r.grounding[0].strokeIds = ['unknown']; },
    (r) => { r.grounding[1].objectId = r.grounding[0].objectId; },
    (r) => { r.grounding[0].objectId = ''; },
    (r) => { r.scene = scene(); },
    (r) => { r.questions = []; },
  ]) {
    const changed = structuredClone(live); mutate(changed);
    assert.throws(() => parseInterpretation(JSON.stringify(changed), changed.requestId, identity));
  }
  const photo = structuredClone(live);
  photo.grounding.forEach((g) => { delete g.strokeIds; });
  assert.throws(() => parseInterpretation(JSON.stringify(photo), photo.requestId, { ...identity, kind: 'photo' }), /Normalized source region/);
});
test('manual commands retain depth and resolve factors at the paused visible state', () => {
  const s = scene(); s.objects[0].position.z = 3; s.objects[0].mass = 4;
  const result = manualCommand('set this mass x2', s, 'part', 'r1');
  assert.equal(parseCommand(JSON.stringify(result), 'r1', s).operations[0].value, 8);
  const moved = manualCommand('move this -2 5', s, 'part', 'r1');
  assert.equal(applyCommands(s, { baseSceneRevision: s.revision, operations: moved.operations }).objects[0].position.z, 3);
  assert.equal(manualCommand('put a spring between these parts', s, 'part', 'r1'), undefined);
});
test('command validation is atomic and unresolved output carries no operations', () => {
  const s = scene(), proposal = manualCommand('set this mass 2', s, 'part', 'r1');
  proposal.operations.push({ type: 'set-property', id: 'part', property: 'mass', value: -1 });
  assert.throws(() => parseCommand(JSON.stringify(proposal), 'r1', s)); assert.equal(s.objects[0].mass, 1);
  proposal.status = 'unsupported'; assert.throws(() => parseCommand(JSON.stringify(proposal), 'r1', s));
  const replacement = scene(); replacement.sources = [{ kind: 'photo', reference: 'invented' }];
  const command = { requestId: 'r1', status: 'proposed', operations: [{ type: 'replace-scene', scene: replacement }], summary: ['Replace setup'], questions: [] };
  assert.deepEqual(parseCommand(JSON.stringify(command), 'r1', s).operations[0].scene.sources, s.sources);
});
test('preview corrections and cancellation leave the original library and runtime untouched', () => {
  const original = new Workbench(scene()); original.tick(); original.capture(); const before = JSON.stringify(original.library), token = original.contextToken, ticks = original.physics.ticks;
  const preview = new Preview(original, fan(), asset);
  preview.scratch.edit({ ...preview.scratch.commandContext, operations: [{ type: 'set-gravity', gravity: { x: 0, y: -2, z: 0 } }] });
  assert.equal(JSON.stringify(original.library), before); preview.cancel();
  assert.equal(JSON.stringify(original.library), before); assert.equal(original.contextToken, token); assert.equal(original.physics.ticks, ticks);
  original.play(); const capture = original.capture; original.capture = () => { throw new Error('checkpoint failed'); };
  assert.throws(() => new Preview(original, fan(), asset), /checkpoint failed/); assert.equal(original.running, true); original.capture = capture; original.physics.free();
});
test('confirm imports corrected source-bearing experiment; stale original rejects without mutation', () => {
  const original = new Workbench(scene()), preview = new Preview(original, fan(), asset);
  preview.scratch.edit({ ...preview.scratch.commandContext, operations: [{ type: 'set-gravity', gravity: { x: 0, y: -2, z: 0 } }] }); preview.confirm();
  assert.equal(original.library.experiments.length, 2); assert.equal(original.scene.gravity.y, -2);
  assert.deepEqual(validateLibrary(original.library).experiments[1].source, asset);
  const stale = new Preview(original, scene(), asset); original.reset(); const before = JSON.stringify(original.library);
  assert.throws(() => stale.confirm(), /original experiment changed/); assert.equal(JSON.stringify(original.library), before); stale.cancel(); original.physics.free();
});
test('saved source remains optional for older libraries and rejects unsafe image types', () => {
  const original = new Workbench(scene()); assert.equal(validateLibrary(original.library).experiments[0].source, undefined);
  assert.throws(() => validateSource({ ...asset, image: 'data:image/svg+xml;base64,PHN2Zz4=' }));
  assert.throws(() => validateSource({ ...asset, widthPx: Infinity }));
  original.experiment.source = false; assert.throws(() => validateLibrary(original.library)); original.physics.free();
});
test('local API validates before inference, isolates server prompts, and reports missing runtime', async () => {
  let calls = 0, instructions = '';
  const provider = { complete: async input => { calls++; instructions = input.instructions; return '{"fixture":true}'; } };
  const middleware = apiMiddleware({ NOX_MODEL_PROVIDER: 'fixture' }, { fixture: provider });
  const server = createServer((req, res) => void middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const url = `http://127.0.0.1:${server.address().port}`;
  const body = { requestId: 'r1', target: { experimentId: 'e', versionId: 'v', sceneRevision: 0, sourceId: source.id, sourceRevision: 2, epoch: 1 }, source: { id: source.id, revision: 2, kind: 'canvas', image, widthPx: 1, heightPx: 1, strokes: [{ id: 's1', points: [[0, 0], [1, 1]] }] }, notes: '', answers: [] };
  const post = (value, headers = {}) => fetch(`${url}/api/interpret`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) });
  try {
    assert.equal((await post(body)).status, 200); assert.equal(calls, 1); assert.match(instructions, /canonical schema2/);
    assert.equal((await post({ ...body, source: { ...body.source, image: 'data:image/png;base64,YWJj' } })).status, 400); assert.equal(calls, 1);
    assert.equal((await post(body, { Origin: 'https://untrusted.example' })).status, 403); assert.equal(calls, 1);
    assert.equal((await post({ ...body, notes: 'x'.repeat(4_000_000) })).status, 413); assert.equal(calls, 1);
    assert.deepEqual(await (await fetch(`${url}/api/status`)).json(), { configured: true, provider: 'fixture' });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  const absent = apiMiddleware({}), missing = createServer((req, res) => void absent(req, res, () => res.end()));
  await new Promise(resolve => missing.listen(0, '127.0.0.1', resolve));
  try { assert.equal((await fetch(`http://127.0.0.1:${missing.address().port}/api/interpret`, { method: 'POST', body: JSON.stringify(body) })).status, 503); }
  finally { missing.closeAllConnections(); await new Promise(resolve => missing.close(resolve)); }
});

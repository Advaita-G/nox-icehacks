// Shared API compatibility/schema dispatch using local fixtures only; no inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { handleApi } from '../packages/input/server/api.ts';
import { apiMiddleware } from '../server/middleware.ts';
import { INTERPRET_3D_SCHEMA, COMMAND_3D_SCHEMA } from '../src/input/schema.ts';
import { emptyScene } from '../src/physics/scene.ts';

test('canonical schemas avoid XGrammar string/union combinations that lose or reject constraints', () => {
  for (const [name, schema] of [['interpretation', INTERPRET_3D_SCHEMA], ['command', COMMAND_3D_SCHEMA]]) {
    const visit = (node, path) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.pattern === 'string') assert.ok(!Object.hasOwn(node, 'minLength') && !Object.hasOwn(node, 'maxLength'), `${path}: pattern cannot accompany string length keywords`);
      if (Array.isArray(node.anyOf)) assert.ok(!Object.hasOwn(node, 'properties') && !Object.hasOwn(node, 'required'), `${path}: object constraints belong inside each complete union branch`);
      for (const [key, value] of Object.entries(node)) visit(value, `${path}/${key}`);
    };
    visit(schema, name);
  }
});

test('shared legacy API omits outputSchema unless the server supplies a selected-route map', async () => {
  const calls = [], providers = { fixture: { complete: async input => { calls.push(input); return '{}'; } } };
  const base = { method: 'POST', url: '/api/interpret?test=1', body: '{"requestId":"legacy"}', env: { NOX_MODEL_PROVIDER: 'fixture' }, providers, signal: new AbortController().signal };
  assert.equal((await handleApi(base)).status, 200);
  assert.equal(Object.hasOwn(calls[0], 'outputSchema'), false);
  const selected = { type: 'object' }, other = { type: 'string' };
  await handleApi({ ...base, outputSchemas: { '/api/interpret': selected, '/api/command': other } });
  assert.equal(calls[1].outputSchema, selected);
});

test('development routes send the real canonical 3D schema selected for interpretation or command', async () => {
  const calls = [], middleware = apiMiddleware({ NOX_MODEL_PROVIDER: 'fixture' }, { fixture: { complete: async input => { calls.push(input); return '{}'; } } });
  const target = { experimentId: 'e', versionId: 'v', sourceId: 's', sceneRevision: 0, sourceRevision: 1, epoch: 0 };
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const photo = { requestId: 'p', target, source: { id: 's', revision: 1, kind: 'photo', image, widthPx: 1, heightPx: 1 }, notes: '', answers: [] };
  const command = { requestId: 'c', target, transcript: 'run', scene: emptyScene(), selection: [], answers: [] };
  for (const [url, body] of [['/api/interpret', photo], ['/api/command', command]]) {
    const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: 'POST', url, headers: { host: 'localhost:5193' } });
    const response = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false, status: 0, writeHead(status) { this.status = status; }, end() { this.writableEnded = true; } });
    await middleware(request, response, () => assert.fail('Canonical API request should be handled'));
    assert.equal(response.status, 200);
  }
  assert.equal(calls[0].outputSchema, INTERPRET_3D_SCHEMA);
  assert.equal(calls[1].outputSchema, COMMAND_3D_SCHEMA);
});

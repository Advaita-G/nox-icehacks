import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionApi } from '../server/vercel.ts';
import { emptyScene, newObject } from '../src/physics/scene.ts';
import { INTERPRET_3D_SCHEMA, INTERPRET_CANVAS_3D_SCHEMA, COMMAND_3D_SCHEMA } from '../src/input/schema.ts';
import { CLOUDFLARE_MODEL } from '../server/cloudflare.ts';

const origin = 'https://nox.example', code = 'private-test-code-with-at-least-32-characters';
const env = { NOX_DEMO_ACCESS_CODE: code, NOX_MODEL_PROVIDER: 'fixture' };
const request = (path, body, cookie, extra = {}) => new Request(origin + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra.headers },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  ...(extra.signal ? { signal: extra.signal } : {}),
});
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const target = { experimentId: 'e', versionId: 'v', sourceId: 'photo', sceneRevision: 0, sourceRevision: 1, epoch: 0 };
const photo = { requestId: 'r1', target, source: { id: 'photo', revision: 1, kind: 'photo', image, widthPx: 1, heightPx: 1 }, notes: '', answers: [] };
async function unlock(value = code, environment = env) {
  return productionApi(request('/api/access', new URLSearchParams({ code: value }).toString(), '', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), '/api/access', environment);
}
async function cookie() { return (await unlock()).headers.get('set-cookie').split(';')[0]; }

test('judge access is closed by default, rejects wrong codes, and issues a secure expiring cookie', async () => {
  assert.equal((await unlock(code, {})).status, 503);
  assert.equal((await unlock('')).status, 403);
  const denied = await unlock('wrong');
  assert.equal(denied.status, 403);
  const deniedHtml = await denied.text();
  assert.match(deniedHtml, /role="alert"/); assert.match(deniedHtml, /<form method="post"/);
  assert.match(deniedHtml, /aria-describedby="access-error"/); assert.ok(!deniedHtml.includes(code));
  const response = await unlock();
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
  const header = response.headers.get('set-cookie');
  for (const part of ['__Host-nox-access=', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=28800']) assert.ok(header.includes(part));
  assert.ok(!header.includes(code));
  const form = await productionApi(request('/api/access'), '/api/access', env);
  assert.equal(form.status, 200);
  const html = await form.text(), style = /<style>(.*?)<\/style>/.exec(html)[1];
  assert.match(html, /type="password"/); assert.match(html, /name="viewport"/);
  assert.ok(form.headers.get('content-security-policy').includes(`style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'`));
  assert.equal(form.headers.get('cache-control'), 'no-store');
});

test('missing, forged, expired and revoked cookies never authorize inference', async t => {
  let calls = 0;
  const providers = { fixture: { complete: async () => { calls++; return '{}'; } } };
  const valid = await cookie();
  for (const token of [undefined, valid + 'bad', valid.replace(/.$/, valid.endsWith('a') ? 'b' : 'a')]) {
    assert.equal((await productionApi(request('/api/interpret', photo, token), '/api/interpret', env, providers)).status, 401);
  }
  assert.equal((await productionApi(request('/api/interpret', photo, valid), '/api/interpret', { ...env, NOX_DEMO_ACCESS_CODE: 'rotated-private-code-with-32-characters' }, providers)).status, 401);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  t.mock.timers.tick(8 * 60 * 60 * 1000 + 1000);
  assert.equal((await productionApi(request('/api/interpret', photo, valid), '/api/interpret', env, providers)).status, 401);
  assert.equal(calls, 0);
});

test('status reveals no credentials and distinguishes locked, unlocked and unavailable runtime', async () => {
  const providers = { fixture: { complete: async () => '{}' } };
  assert.deepEqual(await (await productionApi(request('/api/status'), '/api/status', env, providers)).json(), { configured: false, provider: null, accessRequired: true });
  const token = await cookie();
  assert.deepEqual(await (await productionApi(request('/api/status', undefined, token), '/api/status', env, providers)).json(), { configured: true, provider: 'fixture', accessRequired: false });
  assert.deepEqual(await (await productionApi(request('/api/status', undefined, token), '/api/status', env, {})).json(), { configured: false, provider: null, accessRequired: false });
  assert.equal((await productionApi(request('/api/interpret', photo, token), '/api/interpret', env, {})).status, 503);
});

test('only authorized configured Cloudflare status reveals selected model and optional region', async () => {
  const environment = { ...env, NOX_MODEL_PROVIDER: 'cloudflare', NOX_CLOUDFLARE_MODEL: ' @cf/google/gemma-4-26b-a4b-it ', VERCEL_REGION: 'sfo1', NOX_CLOUDFLARE_ACCOUNT_ID: 'PRIVATE_ACCOUNT_SENTINEL', NOX_CLOUDFLARE_API_TOKEN: 'PRIVATE_TOKEN_SENTINEL' };
  const providers = { cloudflare: { complete: async () => assert.fail('Status cannot call a model') } };
  const status = async (cookie, values = environment, registered = providers) => (await productionApi(request('/api/status', undefined, cookie), '/api/status', values, registered)).json();
  assert.deepEqual(await status(), { configured: false, provider: null, accessRequired: true });
  const token = await cookie();
  const configured = await status(token);
  assert.deepEqual(configured, { configured: true, provider: 'cloudflare', accessRequired: false, model: '@cf/google/gemma-4-26b-a4b-it', region: 'sfo1' });
  assert.doesNotMatch(JSON.stringify(configured), /PRIVATE|ACCOUNT|TOKEN/);
  assert.deepEqual(await status(token, { ...environment, NOX_CLOUDFLARE_MODEL: ' ', VERCEL_REGION: undefined }), { configured: true, provider: 'cloudflare', accessRequired: false, model: CLOUDFLARE_MODEL });
  assert.deepEqual(await status(token, environment, {}), { configured: false, provider: null, accessRequired: false });
  assert.deepEqual(await status(token, { ...environment, NOX_MODEL_PROVIDER: 'fixture' }, { fixture: providers.cloudflare }), { configured: true, provider: 'fixture', accessRequired: false });
});

test('origin, method, JSON size and canonical request validation precede provider calls', async () => {
  let calls = 0;
  const providers = { fixture: { complete: async () => { calls++; return '{}'; } } }, token = await cookie();
  assert.equal((await productionApi(request('/api/interpret', photo, token, { headers: { Origin: 'https://evil.example' } }), '/api/interpret', env, providers)).status, 403);
  assert.equal((await productionApi(request('/api/access', 'code=' + code, '', { headers: { Origin: '', 'Content-Type': 'application/x-www-form-urlencoded' } }), '/api/access', env)).status, 403);
  assert.equal((await productionApi(request('/api/interpret'), '/api/interpret', env, providers)).status, 405);
  assert.equal((await productionApi(request('/api/interpret', '{bad', token), '/api/interpret', env, providers)).status, 400);
  assert.equal((await productionApi(request('/api/interpret', { ...photo, source: { ...photo.source, image: 'data:image/png;base64,YWJj' } }, token), '/api/interpret', env, providers)).status, 400);
  assert.equal((await productionApi(request('/api/interpret', { ...photo, source: { ...photo.source, kind: 'unsupported' } }, token), '/api/interpret', env, providers)).status, 400);
  assert.equal((await productionApi(request('/api/interpret', { ...photo, notes: 'x'.repeat(3 * 1024 * 1024) }, token), '/api/interpret', env, providers)).status, 413);
  assert.equal(calls, 0);
});

test('photo/canvas select matching schemas and command preserves the canonical prompt/identity', async () => {
  const calls = [], providers = { fixture: { complete: async input => { calls.push(input); return '{"fixture":true}'; } } }, token = await cookie();
  const scene = emptyScene('Deployed request'); scene.objects = [newObject('ball', 'ball')];
  const command = { requestId: 'r2', target, transcript: 'make the ball heavier', scene, selection: ['ball'], answers: [] };
  const canvas = { ...photo, requestId: 'r-canvas', source: { ...photo.source, kind: 'canvas', strokes: [{ id: 'line', points: [[0, 0], [1, 1]] }] } };
  for (const [path, body] of [['/api/interpret', photo], ['/api/interpret', canvas], ['/api/command', command]]) {
    const response = await productionApi(request(path, body, token), path, env, providers);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { requestId: body.requestId, raw: '{"fixture":true}' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.match(calls[0].instructions, /actual attached rough drawing\/photo/);
  assert.match(calls[2].instructions, /canonical atomic operations/);
  assert.deepEqual(calls.map(c => c.request.requestId), ['r1', 'r-canvas', 'r2']);
  assert.equal(calls[0].outputSchema, INTERPRET_3D_SCHEMA);
  assert.equal(calls[1].outputSchema, INTERPRET_CANVAS_3D_SCHEMA);
  assert.equal(calls[2].outputSchema, COMMAND_3D_SCHEMA);
});

test('provider failures and oversized replies stay bounded and do not expose raw errors', async () => {
  const token = await cookie();
  const failed = await productionApi(request('/api/interpret', photo, token), '/api/interpret', env, { fixture: { complete: async () => { throw new Error('PRIVATE CREDENTIAL SENTINEL'); } } });
  assert.equal(failed.status, 502); assert.doesNotMatch(await failed.text(), /PRIVATE CREDENTIAL/);
  const large = await productionApi(request('/api/interpret', photo, token), '/api/interpret', env, { fixture: { complete: async () => 'x'.repeat(2_000_001) } });
  assert.equal(large.status, 502);
});

test('120-second deadline aborts a provider even when it ignores cancellation', async t => {
  const token = await cookie();
  let start, signal;
  const started = new Promise(resolve => { start = resolve; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = productionApi(request('/api/interpret', photo, token), '/api/interpret', env, { fixture: { complete: input => { signal = input.signal; start(); return new Promise(() => {}); } } });
  await started; t.mock.timers.tick(120_000);
  assert.equal((await result).status, 504); assert.equal(signal.aborted, true);
});

test('client cancellation aborts provider work without a retry', async () => {
  const token = await cookie(), controller = new AbortController();
  let start, signal, calls = 0;
  const started = new Promise(resolve => { start = resolve; });
  const result = productionApi(request('/api/command', { requestId: 'r2', target, transcript: 'run', scene: emptyScene('Empty'), selection: [], answers: [] }, token, { signal: controller.signal }), '/api/command', env, { fixture: { complete: input => { signal = input.signal; calls++; start(); return new Promise(() => {}); } } });
  await started; controller.abort();
  assert.equal((await result).status, 499); assert.equal(signal.aborted, true); assert.equal(calls, 1);
});

test('all production entrypoints and free-hosting deadline settings are present', async () => {
  for (const route of ['status', 'interpret', 'command', 'access']) assert.equal(typeof (await import(`../api/${route}.ts`)).default.fetch, 'function');
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.equal(config.fluid, true);
  assert.ok(config.functions['api/*.ts'].maxDuration > 120 && config.functions['api/*.ts'].maxDuration <= 300);
  assert.equal(config.functions['api/*.ts'].supportsCancellation, true);
});

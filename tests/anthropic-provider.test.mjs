// Anthropic adapter tests with an injected fake transport. No network, no key, no paid call.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createAnthropicProvider, buildContent, ANTHROPIC_VERSION } from '../server/anthropic.ts';
import { buildProviders } from '../server/providers.ts';
import { apiMiddleware } from '../server/middleware.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';

const KEY = 'test-key-not-real-0000';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const PNG_B64 = PNG.slice(PNG.indexOf(',') + 1);

const interpretRequest = () => ({
  requestId: 'r1',
  target: { experimentId: 'exp-1', versionId: 'v-1', sourceId: 'sketch-1', sceneRevision: 0, sourceRevision: 2, epoch: 0 },
  source: { id: 'sketch-1', revision: 2, kind: 'canvas', image: PNG, widthPx: 1, heightPx: 1, strokes: [{ id: 's1', points: [[0, 0]] }] },
  notes: 'A powered fan blowing on a light box.',
  answers: [],
});

function reply(text, stop_reason = 'end_turn', extra = {}) {
  return JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }, ...extra });
}

function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return responder(url, init, calls.length);
  };
  fn.calls = calls;
  return fn;
}
const ok = (text) => ({ ok: true, status: 200, text: async () => text });

test('sketch payload: real image block, metadata as text without the data URL, headers and config', async () => {
  const f = fakeFetch(() => ok(reply('{"status":"ready"}')));
  const p = createAnthropicProvider({ apiKey: KEY, fetch: f });
  const out = await p.complete({ instructions: INTERPRET_3D, request: interpretRequest(), signal: new AbortController().signal });
  assert.equal(out, '{"status":"ready"}');
  assert.equal(f.calls.length, 1);
  const { url, init, body } = f.calls[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], KEY);
  assert.equal(init.headers['anthropic-version'], ANTHROPIC_VERSION);
  assert.equal(init.headers['anthropic-beta'], undefined);
  assert.equal(init.redirect, 'error');
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.system, INTERPRET_3D);
  assert.deepEqual(body.output_config, { effort: 'medium' });
  assert.equal(body.fallbacks, undefined);
  assert.equal(body.thinking, undefined); // Opus 5.5 runs adaptive; disabling is a 400
  assert.equal(body.temperature, undefined);
  const [image, text] = body.messages[0].content;
  assert.deepEqual(image, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG_B64 } });
  assert.equal(text.type, 'text');
  assert.ok(!text.text.includes(PNG_B64), 'image bytes must not be duplicated in the text block');
  assert.ok(text.text.includes('[attached image block]'));
  assert.ok(text.text.includes('A powered fan blowing on a light box.'));
  assert.ok(text.text.includes('"strokes"'));
});

test('command payload: text only, configurable model/effort/max tokens', async () => {
  const f = fakeFetch(() => ok(reply('{"status":"proposed"}')));
  const p = createAnthropicProvider({ apiKey: KEY, fetch: f, model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 4000 });
  const req = { requestId: 'c1', target: {}, transcript: 'make the ball twice as heavy', selection: ['ball'], scene: { objects: [] }, answers: [] };
  await p.complete({ instructions: COMMAND_3D, request: req, signal: new AbortController().signal });
  const { init, body } = f.calls[0];
  assert.equal(body.model, 'claude-sonnet-5-5');
  assert.equal(body.max_tokens, 4000);
  assert.deepEqual(body.output_config, { effort: 'low' });
  assert.equal(body.fallbacks, undefined);
  assert.equal(init.headers['anthropic-beta'], undefined);
  assert.deepEqual(body.messages[0].content.map((b) => b.type), ['text']);
  assert.ok(body.messages[0].content[0].text.includes('twice as heavy'));
});

test('caller abort reaches the transport and is not retried', async () => {
  const controller = new AbortController();
  const f = fakeFetch((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const p = createAnthropicProvider({ apiKey: KEY, fetch: f });
  const pending = p.complete({ instructions: 'x', request: { requestId: 'a' }, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.calls.length, 1);
});

test('provider HTTP errors: one call, safe message, never the key or the response body', async () => {
  for (const [status, expected] of [[500, /error \(500\)/], [529, /error \(529\)/], [429, /rate-limited/], [401, /credentials/]]) {
    const f = fakeFetch(() => ({ ok: false, status, text: async () => `{"error":{"message":"secret detail ${KEY}"}}` }));
    const p = createAnthropicProvider({ apiKey: KEY, fetch: f });
    const err = await p.complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal }).catch((e) => e);
    assert.match(err.safeMessage, expected);
    assert.ok(!String(err.message).includes(KEY) && !String(err.message).includes('secret detail'));
    assert.equal(f.calls.length, 1, `no retry on ${status}`);
  }
});

test('network failure is reported safely', async () => {
  const f = fakeFetch(() => Promise.reject(new TypeError(`connect failed with ${KEY}`)));
  const p = createAnthropicProvider({ apiKey: KEY, fetch: f });
  const err = await p.complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal }).catch((e) => e);
  assert.equal(err.kind, 'network');
  assert.ok(!err.message.includes(KEY));
});

test('invalid, refused, truncated, empty and oversized responses are rejected', async () => {
  const cases = [
    ['not json', 'invalid'],
    [JSON.stringify({ type: 'message' }), 'invalid'],
    [reply('{}', 'refusal', { stop_details: { type: 'refusal', category: 'cyber' } }), 'refusal'],
    [reply('{"status":"rea', 'max_tokens'), 'truncated'],
    [reply('{}', 'pause_turn'), 'invalid'],
    [JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }] }), 'invalid'],
    [reply('x'.repeat(2_000_001)), 'invalid'],
  ];
  for (const [raw, kind] of cases) {
    const p = createAnthropicProvider({ apiKey: KEY, fetch: fakeFetch(() => ok(raw)) });
    const err = await p.complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal }).catch((e) => e);
    assert.equal(err.kind, kind, raw.slice(0, 40));
  }
});

test('a malformed source image is refused before any call', async () => {
  assert.throws(() => buildContent({ source: { image: 'data:image/gif;base64,R0lGOD' } }), { kind: 'invalid' });
  const f = fakeFetch(() => ok(reply('{}')));
  const p = createAnthropicProvider({ apiKey: KEY, fetch: f });
  await assert.rejects(p.complete({ instructions: 'x', request: { requestId: 'a', source: { image: 'nope' } }, signal: new AbortController().signal }));
  assert.equal(f.calls.length, 0);
});

test('construction rejects missing keys and bad options', () => {
  assert.throws(() => createAnthropicProvider({ apiKey: '' }));
  assert.throws(() => createAnthropicProvider({ apiKey: KEY, effort: 'extreme' }));
  assert.throws(() => createAnthropicProvider({ apiKey: KEY, maxTokens: 0 }));
});

test('registration requires provider name, key and explicit live-call opt-in', () => {
  assert.deepEqual(Object.keys(buildProviders({})), []);
  assert.deepEqual(Object.keys(buildProviders({ NOX_MODEL_PROVIDER: 'anthropic', NOX_ANTHROPIC_API_KEY: KEY })), []);
  assert.deepEqual(Object.keys(buildProviders({ NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'enabled' })), []);
  assert.deepEqual(Object.keys(buildProviders({ NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'yes', NOX_ANTHROPIC_API_KEY: KEY })), []);
  assert.deepEqual(Object.keys(buildProviders({ NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'enabled', NOX_ANTHROPIC_API_KEY: KEY })), ['anthropic']);
});

async function withServer(env, providers, fn) {
  const mw = apiMiddleware(env, providers);
  const server = createServer((req, res) => mw(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { return await fn(server.address().port); } finally { await new Promise((r) => server.close(r)); }
}
function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
      let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t) }));
    });
    req.on('error', reject); req.end(data);
  });
}

test('root middleware: registered adapter serves /api/interpret with the 3D instructions and an image block', async () => {
  const env = { NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'enabled', NOX_ANTHROPIC_API_KEY: KEY };
  const f = fakeFetch(() => ok(reply('{"requestId":"r1"}')));
  await withServer(env, buildProviders(env, f), async (port) => {
    const r = await post(port, '/api/interpret', interpretRequest());
    assert.deepEqual(r, { status: 200, json: { requestId: 'r1', raw: '{"requestId":"r1"}' } });
    assert.equal(f.calls[0].body.system, INTERPRET_3D);
    assert.equal(f.calls[0].body.messages[0].content[0].type, 'image');
  });
});

test('root middleware: provider refusal becomes a safe 502 without secrets; unconfigured stays 503', async () => {
  const env = { NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'enabled', NOX_ANTHROPIC_API_KEY: KEY };
  const f = fakeFetch(() => ok(reply('{}', 'refusal')));
  await withServer(env, buildProviders(env, f), async (port) => {
    const r = await post(port, '/api/interpret', interpretRequest());
    assert.equal(r.status, 502);
    assert.match(r.json.message, /declined/);
    assert.ok(!JSON.stringify(r.json).includes(KEY));
  });
  await withServer({}, buildProviders({}), async (port) => {
    const r = await post(port, '/api/interpret', interpretRequest());
    assert.equal(r.status, 503);
    assert.equal(r.json.code, 'PROVIDER_NOT_CONFIGURED');
  });
});

// N7-01 regression: a redirect must never carry the key to another server (real node:http, real fetch).
test('N7-01: redirects are refused and the redirect target never receives the key', async () => {
  let targetHits = 0; let targetSawKey = false;
  const target = createServer((req, res) => { targetHits++; if (req.headers['x-api-key']) targetSawKey = true; res.writeHead(200, { 'content-type': 'application/json' }); res.end(reply('{}')); });
  await new Promise((r) => target.listen(0, '127.0.0.1', r));
  const tport = target.address().port;
  const origin = createServer((req, res) => { req.resume(); res.writeHead(307, { location: `http://127.0.0.1:${tport}/v1/messages` }); res.end(); });
  await new Promise((r) => origin.listen(0, '127.0.0.1', r));
  try {
    const p = createAnthropicProvider({ apiKey: KEY, endpoint: `http://127.0.0.1:${origin.address().port}/v1/messages` });
    const err = await p.complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal }).catch((e) => e);
    assert.ok(err instanceof Error, 'must fail');
    assert.equal(typeof err.safeMessage, 'string');
    assert.ok(!err.safeMessage.includes(KEY));
    assert.equal(targetSawKey, false, 'redirect target received the API key');
    assert.equal(targetHits, 0, 'redirect was followed');
  } finally {
    await new Promise((r) => origin.close(r)); await new Promise((r) => target.close(r));
  }
});

// N7-02 regression: no server-side fallback (another billed attempt) unless separately authorized.
test('N7-02: no automatic server-side fallback in body or headers by default', async () => {
  const f = fakeFetch(() => ok(reply('{}')));
  await createAnthropicProvider({ apiKey: KEY, fetch: f }).complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal });
  assert.equal(f.calls[0].body.fallbacks, undefined);
  assert.equal(f.calls[0].init.headers['anthropic-beta'], undefined);
  assert.equal(f.calls[0].init.redirect, 'error');
  const g = fakeFetch(() => ok(reply('{}')));
  const env = { NOX_MODEL_PROVIDER: 'anthropic', NOX_LIVE_CALLS: 'enabled', NOX_ANTHROPIC_API_KEY: KEY, NOX_ANTHROPIC_FALLBACKS: 'on' };
  await buildProviders(env, g).anthropic.complete({ instructions: 'x', request: { requestId: 'a' }, signal: new AbortController().signal });
  assert.equal(g.calls[0].body.fallbacks, undefined, 'env must not enable an unauthorized fallback');
});

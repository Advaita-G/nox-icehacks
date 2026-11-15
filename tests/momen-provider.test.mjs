// Momen adapter tests with an injected fake GraphQL/upload transport. No network, no token, no credit used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { createMomenProvider } from '../server/momen.ts';
import { buildProviders } from '../server/providers.ts';
import { apiMiddleware } from '../server/middleware.ts';
import { INTERPRET_3D } from '../src/input/prompt.ts';

const TOKEN = 'momen-admin-token-not-real';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const PNG_BYTES = Buffer.from(PNG.slice(PNG.indexOf(',') + 1), 'base64');
const KEYS = { instructions: 'a1', request: 'a2', image: 'a3' };
const opts = (fetch, extra = {}) => ({ projectExId: 'projX', adminToken: TOKEN, agentId: 'agent-9', argKeys: KEYS, fetch, pollIntervalMs: 0, sleep: async () => {}, ...extra });
const interpretRequest = () => ({
  requestId: 'r1',
  target: { experimentId: 'exp-1', versionId: 'v-1', sourceId: 'sketch-1', sceneRevision: 0, sourceRevision: 2, epoch: 0 },
  source: { id: 'sketch-1', revision: 2, kind: 'canvas', image: PNG, widthPx: 1, heightPx: 1, strokes: [{ id: 's1', points: [[0, 0]] }] },
  notes: 'A fan', answers: [],
});

/** Fake Momen: answers by GraphQL operationName; records every call. */
function fakeMomen({ statuses = ['IN_PROGRESS', 'COMPLETED'], data = '{"status":"ready"}', overrides = {} } = {}) {
  const calls = []; let poll = 0;
  const json = (obj, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(obj) });
  const fn = async (url, init) => {
    const call = { url, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body };
    calls.push(call);
    if (init.method === 'PUT') return overrides.upload ?? { ok: true, status: 200, text: async () => '' };
    const op = call.body.operationName;
    if (overrides[op]) return overrides[op](call);
    if (op === 'NoxImageUpload') return json({ data: { imagePresignedUrlV2: { imageId: 777, uploadUrl: 'https://upload.example/abc', uploadHeaders: { 'Content-Type': 'image/png' } } } });
    if (op === 'NoxCreateConversation') return json({ data: { fz_zai_create_conversation: 4242 } });
    if (op === 'NoxResult') { const s = statuses[Math.min(poll++, statuses.length - 1)]; return json({ data: { fz_zai_conversation_result: { conversationId: 4242, status: s, data: s === 'COMPLETED' ? data : null } } }); }
    if (op === 'NoxStop') return json({ data: { fz_zai_stop_responding: true } });
    return json({ errors: [{ message: 'unknown op' }] });
  };
  fn.calls = calls;
  return fn;
}
const run = (p, request = interpretRequest(), signal = new AbortController().signal) => p.complete({ instructions: INTERPRET_3D, request, signal });

test('sketch: uploads the real image bytes, starts the agent with argKeys, polls to COMPLETED, returns data text', async () => {
  const f = fakeMomen();
  const out = await run(createMomenProvider(opts(f)));
  assert.equal(out, '{"status":"ready"}');
  const ops = f.calls.map((c) => c.init.method === 'PUT' ? 'PUT' : c.body.operationName);
  assert.deepEqual(ops, ['NoxImageUpload', 'PUT', 'NoxCreateConversation', 'NoxResult', 'NoxResult']);
  const [presign, put, create] = f.calls;
  assert.equal(presign.url, 'https://villa.momen.app/zero/projX/api/graphql-v2');
  assert.equal(presign.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(presign.body.variables.md5, createHash('md5').update(PNG_BYTES).digest('base64'));
  assert.equal(presign.body.variables.suffix, 'PNG');
  assert.equal(put.url, 'https://upload.example/abc');
  assert.equal(put.init.headers.authorization, undefined, 'presigned upload must not receive the admin token');
  assert.deepEqual(Buffer.from(put.init.body), PNG_BYTES);
  assert.equal(create.body.variables.agentId, 'agent-9');
  const args = create.body.variables.inputArgs;
  assert.equal(args.a1, INTERPRET_3D);
  assert.equal(args.a3, 777, 'preserve the numeric asset ID returned by Momen');
  assert.ok(args.a2.includes('[attached image input]') && !args.a2.includes(PNG.slice(30, 60)), 'image bytes must not be duplicated as text');
  for (const c of f.calls) assert.equal(c.init.redirect, 'error');
});

test('only a complete enclosing JSON fence is removed before unchanged JSON validation', async () => {
  for (const data of ['```json\n{"status":"ready"}\n```', ' \n```json\r\n{"status":"ready"}\r\n```\n ']) {
    const out = await run(createMomenProvider(opts(fakeMomen({ data }))));
    assert.deepEqual(JSON.parse(out), { status: 'ready' });
  }
  for (const data of ['preface\n```json\n{"status":"ready"}\n```', '```json\n{"status":"ready"}\n```\ncommentary', '```json\n{"status":"ready"}', '```javascript\n{"status":"ready"}\n```']) {
    const out = await run(createMomenProvider(opts(fakeMomen({ data }))));
    assert.equal(out, data);
    assert.throws(() => JSON.parse(out));
  }
});

test('command: text only, no upload', async () => {
  const f = fakeMomen({ data: '{"status":"proposed"}' });
  await run(createMomenProvider(opts(f)), { requestId: 'c1', transcript: 'make it heavier', selection: [], scene: {}, answers: [] });
  assert.ok(!f.calls.some((c) => c.init.method === 'PUT' || c.body?.operationName === 'NoxImageUpload'));
  assert.equal(f.calls.find((c) => c.body?.operationName === 'NoxCreateConversation').body.variables.inputArgs.a3, undefined);
});

test('structured (object) data is returned as JSON text', async () => {
  const out = await run(createMomenProvider(opts(fakeMomen({ data: { status: 'ready', scene: { schemaVersion: 2 } } }))));
  assert.deepEqual(JSON.parse(out), { status: 'ready', scene: { schemaVersion: 2 } });
});

test('FAILED / CANCELED / empty / oversized agent results are rejected safely', async () => {
  for (const [statuses, data, kind] of [[['FAILED'], null, 'invalid'], [['CANCELED'], null, 'invalid'], [['COMPLETED'], '', 'invalid'], [['COMPLETED'], 'x'.repeat(2_000_001), 'invalid']]) {
    const f = fakeMomen({ statuses, data });
    const err = await run(createMomenProvider(opts(f))).catch((e) => e);
    assert.equal(err.kind, kind);
    assert.ok(!err.message.includes(TOKEN));
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxStop').length, 0, 'terminal conversations need no cleanup');
  }
});

test('bounded polling: never-finishing agent stops after maxPolls and asks Momen to stop', async () => {
  const f = fakeMomen({ statuses: ['IN_PROGRESS'] });
  const err = await run(createMomenProvider(opts(f, { maxPolls: 3 }))).catch((e) => e);
  assert.equal(err.kind, 'truncated');
  assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxResult').length, 3);
  await new Promise((r) => setImmediate(r));
  assert.ok(f.calls.some((c) => c.body?.operationName === 'NoxStop'));
});

test('caller abort stops polling and asks Momen to stop; no retry', async () => {
  const controller = new AbortController();
  const f = fakeMomen({ statuses: ['IN_PROGRESS'] });
  const sleep = async (_ms, signal) => { controller.abort(); if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); };
  const err = await run(createMomenProvider(opts(f, { sleep })), interpretRequest(), controller.signal).catch((e) => e);
  assert.equal(err.name, 'AbortError');
  await new Promise((r) => setImmediate(r));
  assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxCreateConversation').length, 1);
  assert.ok(f.calls.some((c) => c.body?.operationName === 'NoxStop'));
});

test('HTTP 429 / 401 / 500, GraphQL errors and unusable upload slots fail with safe messages', async () => {
  const bad = (status) => () => ({ ok: false, status, text: async () => `{"secret":"${TOKEN}"}` });
  const cases = [
    [{ NoxCreateConversation: bad(429) }, /one AI request at a time/],
    [{ NoxImageUpload: bad(401) }, /credentials/],
    [{ NoxCreateConversation: bad(500) }, /error \(500\)/],
    [{ NoxCreateConversation: () => ({ ok: true, status: 200, text: async () => JSON.stringify({ errors: [{ message: `bad ${TOKEN}` }] }) }) }, /reported an error/],
    [{ NoxImageUpload: () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: { imagePresignedUrlV2: { imageId: 1, uploadUrl: 'http://insecure.example/' } } }) }) }, /usable upload slot/],
    [{ upload: { ok: false, status: 403, text: async () => '' } }, /upload to Momen failed \(403\)/],
  ];
  for (const [overrides, expected] of cases) {
    const f = fakeMomen({ overrides });
    const err = await run(createMomenProvider(opts(f))).catch((e) => e);
    assert.match(err.safeMessage ?? '', expected);
    assert.ok(!err.safeMessage.includes(TOKEN));
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxCreateConversation').length <= 1, true, 'no retry');
  }
});

test('configuration is validated', () => {
  const f = fakeMomen();
  assert.throws(() => createMomenProvider(opts(f, { adminToken: '' })));
  assert.throws(() => createMomenProvider(opts(f, { projectExId: '../x' })));
  assert.throws(() => createMomenProvider(opts(f, { argKeys: { instructions: 'a', request: 'b' } })));
});

const MOMEN_ENV = { NOX_MODEL_PROVIDER: 'momen', NOX_LIVE_CALLS: 'enabled', NOX_MOMEN_PROJECT_EX_ID: 'projX', NOX_MOMEN_ADMIN_TOKEN: TOKEN, NOX_MOMEN_AGENT_ID: 'agent-9', NOX_MOMEN_ARG_INSTRUCTIONS: 'a1', NOX_MOMEN_ARG_REQUEST: 'a2', NOX_MOMEN_ARG_IMAGE: 'a3' };

test('registration needs momen, every setting and the live-call opt-in', () => {
  assert.deepEqual(Object.keys(buildProviders(MOMEN_ENV)), ['momen']);
  assert.deepEqual(Object.keys(buildProviders({ ...MOMEN_ENV, NOX_LIVE_CALLS: 'disabled' })), []);
  for (const k of Object.keys(MOMEN_ENV).filter((k) => k.startsWith('NOX_MOMEN_'))) {
    assert.deepEqual(Object.keys(buildProviders({ ...MOMEN_ENV, [k]: '' })), [], k);
  }
});

test('poll failures stop an existing conversation without retrying it', async () => {
  const failures = [
    async () => { throw new Error('simulated disconnect'); },
    async () => ({ ok: false, status: 500 }),
    async () => ({ ok: true, status: 200, text: async () => '{"errors":[{"message":"private detail"}]}' }),
    async () => ({ ok: true, status: 200, text: async () => '{"data":{}}' }),
  ];
  for (const fail of failures) {
    const f = fakeMomen({ overrides: { NoxResult: fail } });
    await assert.rejects(run(createMomenProvider(opts(f))));
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxCreateConversation').length, 1);
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxResult').length, 1);
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxStop').length, 1);
  }
});

test('real polling sleep releases its abort listener on success, timeout and abort', async () => {
  for (const statuses of [['IN_PROGRESS', 'COMPLETED'], ['IN_PROGRESS']]) {
    const controller = new AbortController();
    const f = fakeMomen({ statuses });
    await run(createMomenProvider(opts(f, { sleep: undefined, pollIntervalMs: 0, maxPolls: 3 })), interpretRequest(), controller.signal).catch((error) => {
      assert.equal(error.kind, 'truncated');
    });
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
  const controller = new AbortController();
  const f = fakeMomen({ statuses: ['IN_PROGRESS'] });
  const pending = run(createMomenProvider(opts(f, { sleep: undefined, pollIntervalMs: 500 })), interpretRequest(), controller.signal);
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('stop cleanup has a deadline and reports failure without leaking credentials or masking the original error', async (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  const f = fakeMomen({ statuses: ['IN_PROGRESS'], overrides: {
    NoxStop: ({ init }) => {
      assert.ok(init.signal, 'stop requires its own timeout signal');
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error(TOKEN)), { once: true }));
    },
  } });
  const keepAlive = setTimeout(() => {}, 3000);
  try {
    await assert.rejects(run(createMomenProvider(opts(f, { maxPolls: 1 }))), { kind: 'truncated' });
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxStop').length, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /stop could not be confirmed/i);
    assert.ok(!warnings[0].includes(TOKEN));
  } finally {
    clearTimeout(keepAlive);
  }
});

test('false or missing stop confirmation warns without masking the original error', async (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(message));
  for (const confirmed of [false, null, undefined]) {
    const f = fakeMomen({ statuses: ['IN_PROGRESS'], overrides: {
      NoxStop: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: { fz_zai_stop_responding: confirmed } }) }),
    } });
    await assert.rejects(run(createMomenProvider(opts(f, { maxPolls: 1 }))), { kind: 'truncated' });
    assert.equal(f.calls.filter((c) => c.body?.operationName === 'NoxStop').length, 1);
  }
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((message) => /stop could not be confirmed/i.test(message) && !message.includes(TOKEN)));
});

test('root middleware serves /api/interpret through the Momen adapter', async () => {
  const f = fakeMomen({ data: '{"requestId":"r1"}' });
  const mw = apiMiddleware(MOMEN_ENV, buildProviders(MOMEN_ENV, f));
  const server = createServer((req, res) => mw(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const body = JSON.stringify(interpretRequest());
    const r = await new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.address().port, path: '/api/interpret', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
        let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t) }));
      });
      req.on('error', reject); req.end(body);
    });
    assert.deepEqual(r, { status: 200, json: { requestId: 'r1', raw: '{"requestId":"r1"}' } });
  } finally { await new Promise((r) => server.close(r)); }
});

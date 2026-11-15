// Injected transport only. No real account, credential, inference or external request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareProvider, buildContent, extractText, CLOUDFLARE_MODEL } from '../server/cloudflare.ts';
import { buildProviders } from '../server/providers.ts';
import { productionApi } from '../server/vercel.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';
import { INTERPRET_3D_SCHEMA } from '../src/input/schema.ts';
import { DRAWING_INSTRUCTIONS, drawingSchema } from '../server/drawing.ts';

const ACCOUNT = 'a'.repeat(32), TOKEN = 'cloudflare-token-not-real';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const request = () => ({ requestId: 'r1', target: { experimentId: 'e1', versionId: 'v1', sourceId: 's1', sceneRevision: 0, sourceRevision: 1, epoch: 0 }, source: { id: 's1', revision: 1, kind: 'photo', image: PNG, widthPx: 1, heightPx: 1 }, notes: 'A ball on a plank.', answers: [] });
const reply = (content = '{"status":"ready"}', finish_reason = 'stop', message = {}) => JSON.stringify({ choices: [{ message: { role: 'assistant', content, refusal: null, ...message }, finish_reason }] });
const ok = raw => ({ ok: true, status: 200, text: async () => raw });
function transport(responder = () => ok(reply())) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return responder(url, init); };
  fetch.calls = calls; return fetch;
}
const options = fetch => ({ accountId: ACCOUNT, apiToken: TOKEN, fetch });
const run = (provider, value = request(), signal = new AbortController().signal) => provider.complete({ instructions: INTERPRET_3D, request: value, signal });

test('direct vision payload sends actual image once, isolated from JSON text, with documented bounded JSON options', async () => {
  const f = transport(), input = request(), provider = createCloudflareProvider(options(f));
  assert.equal(await run(provider, input), '{"status":"ready"}');
  assert.equal(f.calls.length, 1);
  const { url, init, body } = f.calls[0];
  assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`);
  assert.equal(init.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(init.redirect, 'error');
  assert.equal(body.model, CLOUDFLARE_MODEL);
  assert.equal(body.messages[0].content, INTERPRET_3D);
  assert.deepEqual(body.messages[1].content[0], { type: 'image_url', image_url: { url: PNG } });
  assert.ok(body.messages[1].content[1].text.includes('[attached image input]'));
  assert.ok(!body.messages[1].content[1].text.includes(PNG.split(',')[1]));
  assert.equal(input.source.image, PNG, 'request is not mutated');
  assert.equal(body.max_completion_tokens, 16384);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.stream, false); assert.equal(body.n, 1);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.reasoning_effort, undefined); assert.equal(body.tools, undefined); assert.equal(body.fallbacks, undefined);
});

test('explicit Gemma configuration sends the same documented vision/JSON payload with its bounded output cap', async () => {
  const f = transport(), model = '@cf/google/gemma-4-26b-a4b-it';
  const env = { NOX_MODEL_PROVIDER: 'cloudflare', NOX_LIVE_CALLS: 'enabled', NOX_CLOUDFLARE_ACCOUNT_ID: ACCOUNT, NOX_CLOUDFLARE_API_TOKEN: TOKEN, NOX_CLOUDFLARE_MODEL: model, NOX_CLOUDFLARE_MAX_TOKENS: '8192' };
  await run(buildProviders(env, f).cloudflare);
  const body = f.calls[0].body;
  assert.equal(body.model, model); assert.equal(body.max_completion_tokens, 8192);
  assert.equal(body.messages[1].content[0].image_url.url, PNG);
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.reasoning_effort, undefined); assert.equal(body.fallbacks, undefined); assert.equal(f.calls.length, 1);
});

test('text-only command uses the same direct provider without an image or fallback', async () => {
  const f = transport(() => ok(reply('{"status":"proposed"}')));
  await createCloudflareProvider({ ...options(f), maxTokens: 4000 }).complete({ instructions: COMMAND_3D, request: { requestId: 'c1', transcript: 'move the ball', scene: {}, selection: [], answers: [] }, signal: new AbortController().signal });
  assert.deepEqual(f.calls[0].body.messages[1].content.map(p => p.type), ['text']);
  assert.equal(f.calls[0].body.max_completion_tokens, 4000);
  assert.equal(f.calls[0].body.messages[0].content, COMMAND_3D);
  assert.equal(f.calls.length, 1);
});

test('trusted output schema enables documented strict structured output without changing the image request', async () => {
  const f = transport(), outputSchema = { type: 'object', properties: { accepted: { type: 'boolean' } }, required: ['accepted'], additionalProperties: false };
  await createCloudflareProvider(options(f)).complete({ instructions: INTERPRET_3D, request: request(), signal: new AbortController().signal, outputSchema });
  assert.deepEqual(f.calls[0].body.response_format, { type: 'json_schema', json_schema: { name: 'nox_response', strict: true, schema: outputSchema } });
  assert.equal(f.calls[0].body.messages[1].content[0].image_url.url, PNG);
  assert.equal(f.calls.length, 1);
});

test('image input is rejected before transport when not a normalized PNG/JPEG data URL', async () => {
  for (const image of ['https://untrusted.example/image', 'data:image/gif;base64,R0lGOD', 'not-an-image', 42]) {
    const f = transport(); await assert.rejects(run(createCloudflareProvider(options(f)), { source: { image } }), { kind: 'invalid' }); assert.equal(f.calls.length, 0);
  }
  assert.deepEqual(buildContent({ requestId: 'c1' }).map(p => p.type), ['text']);
});

test('account, credential, model and application token bounds fail closed without echoing values', () => {
  for (const extra of [{ accountId: '' }, { accountId: '../../evil' }, { apiToken: '' }, { model: '@cf/unverified/model' }, { maxTokens: 0 }, { maxTokens: 16385 }, { maxTokens: 1.5 }, { maxTokens: NaN }]) {
    assert.throws(() => createCloudflareProvider({ ...options(transport()), ...extra }));
  }
});

test('caller abort is respected before and during transport, with no retry', async () => {
  const before = new AbortController(); before.abort(); const unused = transport();
  await assert.rejects(run(createCloudflareProvider(options(unused)), request(), before.signal), { name: 'AbortError' }); assert.equal(unused.calls.length, 0);
  const active = new AbortController();
  const f = transport((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })));
  const pending = run(createCloudflareProvider(options(f)), request(), active.signal); active.abort();
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(f.calls.length, 1);
});

test('HTTP credential/quota/server errors are safe, do not read error bodies, and never retry', async () => {
  for (const status of [401, 403, 429, 500]) {
    let bodyRead = false;
    const f = transport(() => ({ ok: false, status, text: async () => { bodyRead = true; return TOKEN; } }));
    const error = await run(createCloudflareProvider(options(f))).catch(e => e);
    assert.equal(error.kind, 'http'); assert.ok(!error.message.includes(TOKEN)); assert.equal(bodyRead, false); assert.equal(f.calls.length, 1);
    if (status === 429) assert.match(error.safeMessage, /quota|rate-limited/);
  }
});

test('network and response-read failures never expose raw errors or credentials', async () => {
  for (const responder of [() => { throw new Error(TOKEN); }, () => ({ ok: true, status: 200, text: async () => { throw new Error(TOKEN); } })]) {
    const f = transport(responder); const error = await run(createCloudflareProvider(options(f))).catch(e => e);
    assert.equal(error.kind, 'network'); assert.ok(!error.message.includes(TOKEN)); assert.equal(f.calls.length, 1);
  }
});

test('refusal, truncation, tool routes, empty/malformed/multichoice and oversized text are rejected', () => {
  for (const [raw, kind] of [
    [reply(null, 'content_filter'), 'refusal'], [reply('{}', 'stop', { refusal: 'Declined' }), 'refusal'],
    [reply('{', 'length'), 'truncated'], [reply('{}', 'tool_calls'), 'invalid'], [reply('{}', 'function_call'), 'invalid'],
    [reply('{}', 'stop', { tool_calls: [{ type: 'function' }] }), 'invalid'], [reply('', 'stop'), 'invalid'],
    [reply(null), 'invalid'], [reply('{}', 'unknown'), 'invalid'], ['not JSON', 'invalid'], ['{}', 'invalid'],
    [JSON.stringify({ choices: [] }), 'invalid'], [JSON.stringify({ choices: [JSON.parse(reply()).choices[0], JSON.parse(reply()).choices[0]] }), 'invalid'],
    [reply('😀'.repeat(500001)), 'invalid'],
  ]) assert.throws(() => extractText(raw), { kind });
  assert.equal(extractText(reply('{}', 'stop', { tool_calls: [] })), '{}');
  assert.equal(extractText(reply('```json\n{}\n```')), '```json\n{}\n```', 'strict application parsing is not bypassed');
});

test('oversized vendor envelope is rejected even when its assistant text is small', async () => {
  const raw = JSON.stringify({ ...JSON.parse(reply('{}')), padding: 'x'.repeat(8_000_001) });
  await assert.rejects(run(createCloudflareProvider(options(transport(() => ok(raw))))), { kind: 'invalid' });
});

test('registration requires explicit provider, complete credentials and live-call opt-in', () => {
  const env = { NOX_MODEL_PROVIDER: 'cloudflare', NOX_LIVE_CALLS: 'enabled', NOX_CLOUDFLARE_ACCOUNT_ID: ACCOUNT, NOX_CLOUDFLARE_API_TOKEN: TOKEN };
  assert.deepEqual(Object.keys(buildProviders(env, transport())), ['cloudflare']);
  for (const key of ['NOX_MODEL_PROVIDER', 'NOX_LIVE_CALLS', 'NOX_CLOUDFLARE_ACCOUNT_ID', 'NOX_CLOUDFLARE_API_TOKEN']) {
    const missing = { ...env }; delete missing[key]; assert.deepEqual(Object.keys(buildProviders(missing, transport())), []);
  }
  assert.deepEqual(Object.keys(buildProviders({ ...env, NOX_LIVE_CALLS: 'yes' }, transport())), []);
});

test('production API judge gate dispatches one actual-shaped interpretation to the injected Cloudflare transport', async () => {
  const drawing = { status: 'ready', name: 'Actual drawing', assumptions: [], warnings: [], questions: [], message: '', bodies: [{ id: 'part', label: 'Visible part', fixed: true, position: { x: 0, y: 0, z: 0 }, stackAbove: null, shapes: [{ shape: 'box', size: { x: 1, y: 1, z: 1 } }], grounding: { origin: 'sketch', note: 'Visible shape.', region: { left: 0, top: 0, right: 1, bottom: 1 } } }] };
  const origin = 'https://nox-test.invalid', code = 'test-private-code-'.repeat(3), f = transport(() => ok(reply(JSON.stringify(drawing))));
  const env = { NOX_DEMO_ACCESS_CODE: code, NOX_MODEL_PROVIDER: 'cloudflare', NOX_LIVE_CALLS: 'enabled', NOX_CLOUDFLARE_ACCOUNT_ID: ACCOUNT, NOX_CLOUDFLARE_API_TOKEN: TOKEN };
  const providers = buildProviders(env, f);
  const auth = await productionApi(new Request(`${origin}/api/access`, { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code }) }), '/api/access', env, providers);
  assert.equal(auth.status, 303); const cookie = auth.headers.get('set-cookie').split(';')[0];
  const response = await productionApi(new Request(`${origin}/api/interpret`, { method: 'POST', headers: { origin, cookie, 'content-type': 'application/json' }, body: JSON.stringify(request()) }), '/api/interpret', env, providers);
  assert.equal(response.status, 200);
  const envelope = await response.json(), compiled = JSON.parse(envelope.raw);
  assert.equal(envelope.requestId, 'r1'); assert.equal(compiled.status, 'ready');
  assert.equal(compiled.sourceId, 's1'); assert.equal(compiled.scene.objects[0].id, compiled.grounding[0].objectId);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].body.messages[0].content, DRAWING_INSTRUCTIONS);
  assert.deepEqual(f.calls[0].body.response_format, { type: 'json_schema', json_schema: { name: 'nox_response', strict: true, schema: drawingSchema('photo') } });
});

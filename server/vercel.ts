import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { handleApi, MAX_BODY_BYTES } from '../packages/input/server/api.ts';
import type { ModelProvider } from '../packages/input/server/api.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';
import { interpretationSchemaForSource, COMMAND_3D_SCHEMA } from '../src/input/schema.ts';
import { REQUEST_TIMEOUTS } from '../src/input/contract.ts';
import { validateRequest } from './request.ts';
import { buildProviders } from './providers.ts';
import { CLOUDFLARE_MODEL } from './cloudflare.ts';

type Environment = Record<string, string | undefined>;
const COOKIE = '__Host-nox-access', SESSION_SECONDS = 8 * 60 * 60;
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown) => Response.json(body, { status, headers: HEADERS });
const signature = (expires: string, code: string) => createHmac('sha256', code).update(`nox-access:${expires}`).digest('hex');
const accessCode = (env: Environment) => (env.NOX_DEMO_ACCESS_CODE?.trim().length ?? 0) >= 32 ? env.NOX_DEMO_ACCESS_CODE!.trim() : '';

function authorized(request: Request, code: string): boolean {
  if (!code) return false;
  const token = /(?:^|;\s*)__Host-nox-access=(\d{10})\.([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') ?? '');
  return !!token && Number(token[1]) > Date.now() / 1000
    && timingSafeEqual(Buffer.from(token[2], 'hex'), Buffer.from(signature(token[1]!, code), 'hex'));
}

async function readBody(request: Request, limit: number, signal?: AbortSignal): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel(); };
  signal?.addEventListener('abort', cancel, { once: true });
  let bytes = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new Error('Request cancelled.');
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new RangeError('Request body exceeds its size limit.'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { signal?.removeEventListener('abort', cancel); reader.releaseLock(); }
}

const ACCESS_STYLE = `:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0f1117;color:#edf2fb}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;line-height:1.55}main{width:min(100%,28rem);padding:clamp(20px,5vw,32px);border:1px solid #44516a;border-radius:16px;background:#171b25}h1{margin:0;font-size:1.65rem;line-height:1.2}p{color:#b9c6dc;margin:16px 0}form,label{display:grid;gap:10px}form{margin-top:24px;gap:18px}label{font-size:.95rem;font-weight:600}input,button{min-width:0;width:100%;min-height:44px;font:inherit;border-radius:8px;padding:10px 12px}input{background:#0b0d12;border:1px solid #71829e;color:#edf2fb}button{background:#83b7ff;border:1px solid #83b7ff;color:#07111f;font-weight:700;cursor:pointer}a{color:#a9ccff;text-underline-offset:3px}:focus-visible{outline:2px solid #a9ccff;outline-offset:3px}.error{padding:12px;border:1px solid #a76174;border-radius:8px;background:#341d27;color:#ffc9c9}small{display:block;color:#a7b7cf;margin-top:10px}`;
function accessForm(failed = false): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nox judge access</title><style>${ACCESS_STYLE}</style></head><body><main><h1>Unlock live Nox</h1><p>Enter the private judge access code to turn your sketches into experiments.</p>${failed ? '<p id="access-error" class="error" role="alert">That code was not accepted. Check the private judge instructions and try again.</p>' : ''}<form method="post" action="/api/access"><label>Judge access code<input name="code" type="password" required maxlength="256" autocomplete="off"${failed ? ' autofocus aria-invalid="true" aria-describedby="access-error"' : ''}></label><button>Unlock live runtime</button></form><small>Access lasts eight hours in this browser.</small><p><a href="/">Return to Nox and public replays</a></p></main></body></html>`;
  return new Response(html, { status: failed ? 403 : 200, headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; style-src 'sha256-${createHash('sha256').update(ACCESS_STYLE).digest('base64')}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`, 'Referrer-Policy': 'no-referrer' } });
}

async function access(request: Request, code: string): Promise<Response> {
  if (!code) return json(503, { code: 'ACCESS_NOT_CONFIGURED', message: 'Live judge access has not been configured. Public replays remain available.' });
  if (request.method === 'GET') return accessForm();
  if (request.method !== 'POST') return json(405, { message: 'Use GET or POST.' });
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return json(415, { message: 'Use the judge access form.' });
  const submitted = new URLSearchParams(await readBody(request, 4096)).get('code') ?? '';
  if (!timingSafeEqual(createHash('sha256').update(submitted).digest(), createHash('sha256').update(code).digest())) return accessForm(true);
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: '/', 'Set-Cookie': `${COOKIE}=${expires}.${signature(expires, code)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}` } });
}

/** Public free AI is an explicit owner opt-in; other deployments retain the private gate. */
export async function productionApi(request: Request, path: '/api/status' | '/api/interpret' | '/api/command' | '/api/access', env: Environment = process.env, providers?: Record<string, ModelProvider>): Promise<Response> {
  const code = accessCode(env);
  const publicAI = env.NOX_PUBLIC_AI === 'enabled' && env.NOX_MODEL_PROVIDER === 'openrouter';
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) return json(403, { code: 'BAD_ORIGIN', message: 'Use the Nox page on this site.' });
  if (path === '/api/access') {
    if (publicAI && (request.method === 'GET' || request.method === 'POST')) return new Response(null, { status: 303, headers: { ...HEADERS, Location: '/' } });
    try { return await access(request, code); }
    catch (error) { return json(error instanceof RangeError ? 413 : 400, { message: 'The access form could not be read.' }); }
  }
  const unlocked = publicAI || authorized(request, code);
  if (path === '/api/status') {
    if (request.method !== 'GET') return json(405, { message: 'Use GET.' });
    try {
      const registered = providers ?? buildProviders(env), name = env.NOX_MODEL_PROVIDER;
      const configured = !!(unlocked && name && registered[name]);
      const diagnostics = configured && name === 'cloudflare' ? {
        model: env.NOX_CLOUDFLARE_MODEL?.trim() || CLOUDFLARE_MODEL,
        ...(env.VERCEL_REGION?.trim() ? { region: env.VERCEL_REGION.trim() } : {}),
      } : {};
      return json(200, { configured, provider: configured ? name : null, accessRequired: !unlocked, ...diagnostics });
    } catch { return json(503, { configured: false, provider: null, message: 'The server runtime configuration needs attention.' }); }
  }
  if (request.method !== 'POST') return json(405, { message: 'Use POST.' });
  if (!unlocked) return json(401, { code: 'ACCESS_REQUIRED', message: 'Unlock live judge access at /api/access. Your source is retained.' });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { message: 'Send JSON.' });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, path === '/api/interpret' ? REQUEST_TIMEOUTS.sketch : REQUEST_TIMEOUTS.command);
  const cancel = () => controller.abort();
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Request cancelled.')), { once: true }));
  aborted.catch(() => undefined);
  try {
    const body = await readBody(request, MAX_BODY_BYTES, controller.signal);
    if (controller.signal.aborted) throw new Error('Request cancelled.');
    let parsed: { source?: { kind?: unknown } };
    try { parsed = JSON.parse(body); validateRequest(path, parsed); }
    catch (error) { return json(400, { code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Invalid request.' }); }
    let registered: Record<string, ModelProvider>;
    try { registered = providers ?? buildProviders(env); }
    catch { return json(503, { code: 'PROVIDER_NOT_CONFIGURED', message: 'The server runtime configuration needs attention.' }); }
    const outputSchemas: Record<string, Record<string, unknown>> = path === '/api/interpret' ? { '/api/interpret': interpretationSchemaForSource(parsed.source?.kind) } : { '/api/command': COMMAND_3D_SCHEMA };
    const result = await Promise.race([handleApi({ method: 'POST', url: path, body, env, providers: registered, signal: controller.signal, instructions: { '/api/interpret': INTERPRET_3D, '/api/command': COMMAND_3D }, outputSchemas }), aborted]);
    if (controller.signal.aborted) throw new Error('Request cancelled.');
    if (result.status === 200 && (typeof result.body.raw !== 'string' || Buffer.byteLength(result.body.raw) > 2_000_000)) return json(502, { code: 'PROVIDER_ERROR', message: 'The model response was invalid or too large.' });
    return json(result.status, result.body);
  } catch (error) {
    let status = error instanceof RangeError ? 413 : 400, message = 'The request could not be read.';
    if (controller.signal.aborted) {
      status = timedOut ? 504 : 499;
      message = timedOut ? 'The model request timed out. Your source is retained.' : 'The request was cancelled.';
    }
    return json(status, { code: 'REQUEST_FAILED', message });
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
}

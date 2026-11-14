import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi, isApiPath, MAX_BODY_BYTES } from '../packages/input/server/api.ts';
import type { ModelProvider } from '../packages/input/server/api.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';
import { validateRequest } from './request.ts';
import { REQUEST_TIMEOUTS } from '../src/input/contract.ts';

export function apiMiddleware(env: Record<string, string | undefined>, providers: Record<string, ModelProvider> = {}) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const path = (req.url ?? '').split('?')[0];
    if (path !== '/api/status' && !isApiPath(path)) { next(); return; }
    const send = (status: number, body: unknown) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body));
    };
    const host = req.headers.host ?? '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || req.headers.origin && req.headers.origin !== `http://${host}`) { send(403, { code: 'BAD_ORIGIN', message: 'Use the local Nox page to access this service.' }); return; }
    if (path === '/api/status') {
      if (req.method !== 'GET') { send(405, { message: 'Use GET.' }); return; }
      const provider = env.NOX_MODEL_PROVIDER; send(200, { configured: !!(provider && providers[provider]), provider: provider && providers[provider] ? provider : null }); return;
    }
    if (req.method !== 'POST') { send(405, { message: 'Use POST.' }); return; }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), path === '/api/interpret' ? REQUEST_TIMEOUTS.sketch : REQUEST_TIMEOUTS.command);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    let bytes = 0; const chunks: Buffer[] = [];
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) { send(413, { code: 'REQUEST_TOO_LARGE', message: 'Request body exceeds 3 MB.' }); return; }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      try { validateRequest(path, JSON.parse(body)); }
      catch (error) { send(400, { code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Invalid request.' }); return; }
      const output = await handleApi({ method: req.method, url: path, body, env, providers, signal: controller.signal, instructions: { '/api/interpret': INTERPRET_3D, '/api/command': COMMAND_3D } });
      if (output.status === 200 && (typeof output.body.raw !== 'string' || Buffer.byteLength(output.body.raw) > 2_000_000)) { send(502, { code: 'PROVIDER_ERROR', message: 'The model response was invalid or too large.' }); return; }
      send(output.status, output.body);
    } catch (error) {
      if (!res.destroyed) send(controller.signal.aborted ? 504 : 400, { code: 'REQUEST_FAILED', message: controller.signal.aborted ? 'The request timed out or was cancelled.' : error instanceof Error ? error.message : 'Reading the request failed.' });
    } finally { clearTimeout(timer); }
  };
}

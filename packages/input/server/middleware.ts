/**
 * Connect-style middleware for /api/interpret and /api/command, shared by the Vite dev server
 * and the HTTP tests (R4-08).
 *
 * Oversized bodies: stop buffering at the limit, keep draining (discarding) the rest so the client
 * can finish sending, then answer with a structured 413. The socket is only destroyed if a client
 * keeps streaming past a hard cap.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_BODY_BYTES, handleApi, isApiPath, type ModelProvider } from './api.ts';

const HARD_DRAIN_CAP = 64 * 1024 * 1024;

type Next = () => void;

function send(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function createApiMiddleware(providers: Record<string, ModelProvider>, env: Record<string, string | undefined>) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    if (!req.url || !isApiPath(req.url)) return next();
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const declared = Number(req.headers['content-length']);
    let size = 0;
    let tooLarge = Number.isFinite(declared) && declared > MAX_BODY_BYTES;
    const chunks: Buffer[] = [];

    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      if (tooLarge) {
        chunks.length = 0; // stop buffering; keep draining
        if (size > HARD_DRAIN_CAP) req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('error', () => send(res, 400, { code: 'BAD_REQUEST', message: 'The request could not be read.' }));
    req.on('end', () => {
      if (tooLarge) {
        send(res, 413, { code: 'REQUEST_TOO_LARGE', message: `Request body over ${MAX_BODY_BYTES / (1024 * 1024)} MB.` });
        return;
      }
      handleApi({ method: req.method ?? 'GET', url: req.url ?? '', body: Buffer.concat(chunks).toString('utf8'), env, providers, signal: controller.signal })
        .then((out) => send(res, out.status, out.body))
        .catch(() => send(res, 500, { code: 'PROVIDER_ERROR', message: 'Server error.' }));
    });
  };
}

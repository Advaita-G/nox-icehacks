/**
 * R4-08: real HTTP through the same middleware the Vite dev server uses.
 */
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES } from '../server/api';
import { createApiMiddleware } from '../server/middleware';

let server: Server;
let port = 0;

beforeAll(async () => {
  const mw = createApiMiddleware({}, {});
  server = createServer((req, res) => mw(req, res, () => {
    res.statusCode = 404;
    res.end('next');
  }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

function post(path: string, body: string | Buffer): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 0, json: text ? JSON.parse(text) : null });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

describe('R4-08: bounded dev-server route over real HTTP', () => {
  it('returns the documented 503 for a normal request without a provider', async () => {
    const r = await post('/api/interpret', JSON.stringify({ requestId: 'req-1' }));
    expect(r).toMatchObject({ status: 503, json: { code: 'PROVIDER_NOT_CONFIGURED' } });
  });

  it('returns a structured 413 (not a disconnect) for a body over the limit', async () => {
    const r = await post('/api/interpret', Buffer.alloc(MAX_BODY_BYTES + 100, 0x61));
    expect(r).toMatchObject({ status: 413, json: { code: 'REQUEST_TOO_LARGE' } });
  });

  it('still serves the next request after an oversized one', async () => {
    await post('/api/command', Buffer.alloc(MAX_BODY_BYTES + 1, 0x61));
    const r = await post('/api/command', JSON.stringify({ requestId: 'req-2' }));
    expect(r.status).toBe(503);
  });

  it('passes other paths to the next handler', async () => {
    const r = await new Promise<number>((resolve) => {
      request({ host: '127.0.0.1', port, path: '/index.html', method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }).end();
    });
    expect(r).toBe(404);
  });
});

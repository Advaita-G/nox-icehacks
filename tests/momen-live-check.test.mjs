// Offline checks for the low-level live probe: invalid input never reaches the provider; failures exit nonzero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRequest, imageSize, runProbe } from '../scripts/momen-live-check.mjs';

const F1 = fileURLToPath(new URL('../docs/evidence/live-momen-2026-11-10/f1-canvas-source.png', import.meta.url));
const fakeProvider = (impl) => { const calls = []; return { calls, complete: async (input) => { calls.push(input); return impl(input); } }; };

test('reads real dimensions and builds a request that passes the root validator', () => {
  const size = imageSize(readFileSync(F1));
  assert.deepEqual(size, { type: 'image/png', width: 1600, height: 900 });
  const { request } = buildRequest('sketch', F1, 'notes');
  assert.equal(request.source.widthPx, 1600);
  assert.equal(request.source.heightPx, 900);
});

test('invalid inputs return code 2 and never call the provider', async () => {
  const p = fakeProvider(() => 'x');
  const cases = [
    { mode: 'bogus' },
    { mode: 'sketch' },
    { mode: 'sketch', file: 'x.txt', readFile: () => Buffer.from('hello, not an image') },
    { mode: 'sketch', file: 'tiny.png', readFile: () => { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.writeUInt32BE(100, 16); b.writeUInt32BE(80, 20); return b; } },
    { mode: 'sketch', file: 'huge.png', readFile: () => { const b = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(b); b.writeUInt32BE(4000, 16); b.writeUInt32BE(3000, 20); return b; } },
  ];
  for (const c of cases) {
    const r = await runProbe({ ...c, provider: p });
    assert.equal(r.code, 2, JSON.stringify(c.mode + ' ' + (c.file ?? '')));
    assert.match(r.lines[0], /no model call made/);
  }
  assert.equal(p.calls.length, 0);
});

test('missing provider returns code 2 without a call', async () => {
  const r = await runProbe({ mode: 'ping' });
  assert.equal(r.code, 2);
});

test('provider failure returns code 1 with the safe message only', async () => {
  const p = fakeProvider(() => { const e = new Error('raw secret-ish detail'); e.safeMessage = 'The Momen agent failed.'; throw e; });
  const r = await runProbe({ mode: 'ping', provider: p });
  assert.equal(r.code, 1);
  assert.match(r.lines[0], /FAILED .*The Momen agent failed\./);
  assert.ok(!r.lines.join(' ').includes('secret-ish'));
});

test('success returns code 0', async () => {
  const r = await runProbe({ mode: 'ping', provider: fakeProvider(() => '{"pong":true}') });
  assert.equal(r.code, 0);
});

test('CLI exits nonzero when the input is invalid (real process, no call)', () => {
  const script = fileURLToPath(new URL('../scripts/momen-live-check.mjs', import.meta.url));
  const res = spawnSync(process.execPath, [script, 'bogus'], { encoding: 'utf8' });
  assert.equal(res.status, 2);
  assert.match(res.stdout, /no model call made/);
});

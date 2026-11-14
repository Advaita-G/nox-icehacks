// LOW-LEVEL PROVIDER PROBE (issue #5). Not the product path: the root app's Draw/Upload flow is.
// Sends at most ONE bounded call through the real provider adapter, using the git-ignored .env and the
// participant Momen credit. Never prints secrets. Exit code 0 only on a successful model reply.
//
// Usage: node scripts/momen-live-check.mjs ping
//        node scripts/momen-live-check.mjs sketch <png-or-jpeg-file> [notes]
// Sketch input must already be a normalized PNG/JPEG (long edge <= 1600 px), like the root app sends.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkDecodedSize, checkFileBytes, sniffImageType } from '../packages/input/src/source/image.ts';
import { validateRequest } from '../server/request.ts';
import { buildProviders } from '../server/providers.ts';
import { INTERPRET_3D } from '../src/input/prompt.ts';

/** Width/height from a PNG IHDR or JPEG SOF header; null if not found. */
export function imageSize(bytes) {
  const type = sniffImageType(bytes);
  if (type === 'image/png' && bytes.length >= 24) return { type, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (type === 'image/jpeg') {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type, height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** Build and validate the request offline. Throws a plain Error with a safe message; makes no call. */
export function buildRequest(mode, file, notes, readFile = readFileSync) {
  if (mode === 'ping') {
    return {
      instructions: 'Reply with only this JSON object and nothing else: {"pong":true,"requestId":"<copy the requestId value from the request>","sawNote":"<copy the note value from the request>"}',
      request: { requestId: 'ping-1', note: 'argkeys-ok-7341' },
    };
  }
  if (mode !== 'sketch') throw new Error('Mode must be "ping" or "sketch".');
  if (!file) throw new Error('Sketch mode needs an image file path.');
  const bytes = readFile(file);
  const rejectBytes = checkFileBytes(bytes);
  if (rejectBytes) throw new Error(rejectBytes.message);
  const size = imageSize(bytes);
  if (!size) throw new Error('Could not read the image dimensions.');
  const rejectSize = checkDecodedSize(size.width, size.height);
  if (rejectSize) throw new Error(rejectSize.message);
  if (size.width > 1600 || size.height > 1600) throw new Error('Normalize the image first: the long edge must be 1600 px or less, as the root app sends.');
  const request = {
    requestId: 'probe-1',
    target: { experimentId: 'probe', versionId: 'v-1', sourceId: 'sketch-probe', sceneRevision: 0, sourceRevision: 1, epoch: 0 },
    source: { id: 'sketch-probe', revision: 1, kind: 'photo', image: `data:${size.type};base64,${bytes.toString('base64')}`, widthPx: size.width, heightPx: size.height },
    notes: String(notes ?? ''),
    answers: [],
  };
  validateRequest('/api/interpret', request); // same validator the root server applies
  return { instructions: INTERPRET_3D, request };
}

/** Run the probe. Returns { code, lines }; never throws. `provider` may be injected for offline tests. */
export async function runProbe({ mode, file, notes, provider, readFile = readFileSync, timeoutMs = 120_000 }) {
  let built;
  try {
    built = buildRequest(mode, file, notes, readFile);
  } catch (e) {
    return { code: 2, lines: [`INVALID INPUT (no model call made): ${e instanceof Error ? e.message : 'invalid input'}`] };
  }
  if (!provider) return { code: 2, lines: ['Provider is not configured or live calls are not enabled in .env (no model call made).'] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const text = await provider.complete({ instructions: built.instructions, request: built.request, signal: controller.signal });
    return { code: 0, lines: [`OK in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${text.length} chars`, text.slice(0, 4000)] };
  } catch (e) {
    return { code: 1, lines: [`FAILED in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${e?.safeMessage ?? (e?.name === 'AbortError' ? 'timed out' : 'provider error')}`] };
  } finally {
    clearTimeout(timer);
  }
}

function loadEnv(path) {
  try {
    return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
  } catch {
    return {};
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, file, notes] = process.argv.slice(2);
  const provider = buildProviders(loadEnv(fileURLToPath(new URL('../.env', import.meta.url)))).momen;
  const { code, lines } = await runProbe({ mode, file, notes, provider });
  for (const l of lines) console.log(l);
  process.exitCode = code;
}

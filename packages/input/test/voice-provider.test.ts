import { describe, expect, it } from 'vitest';
import { handleApi, type ModelProvider } from '../server/api';
import { ProviderError, postModel, type FetchLike } from '../src/provider/client';
import { StrokeStore } from '../src/source/strokes';
import { PressToTalk, type RecognitionLike, type VoiceErrorCode } from '../src/voice/pressToTalk';

class FakeRecognition implements RecognitionLike {
  lang = '';
  interimResults = false;
  continuous = false;
  maxAlternatives = 1;
  onresult: RecognitionLike['onresult'] = null;
  onerror: RecognitionLike['onerror'] = null;
  onend: RecognitionLike['onend'] = null;
  started = false;
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onerror?.({ error: 'aborted' });
    this.onend?.();
  }
  say(text: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

function talk() {
  const recs: FakeRecognition[] = [];
  const events: { final: string[]; errors: VoiceErrorCode[]; interim: string[] } = { final: [], errors: [], interim: [] };
  const ptt = new PressToTalk(
    () => {
      const r = new FakeRecognition();
      recs.push(r);
      return r;
    },
    { onFinal: (t) => events.final.push(t), onError: (c) => events.errors.push(c), onInterim: (t) => events.interim.push(t) },
  );
  return { ptt, recs, events };
}

describe('press-to-talk', () => {
  it('listens only while held and delivers the transcript on release', () => {
    const { ptt, recs, events } = talk();
    ptt.press();
    expect(ptt.listening).toBe(true);
    recs[0]!.say('make this ball', false);
    recs[0]!.say('make this ball twice as heavy', true);
    ptt.release();
    expect(ptt.listening).toBe(false);
    expect(events.interim).toContain('make this ball');
    expect(events.final).toEqual(['make this ball twice as heavy']);
  });

  it('keeps word boundaries across cumulative final and interim speech segments', () => {
    const { ptt, recs, events } = talk();
    const result = (transcript: string, isFinal: boolean) => Object.assign([{ transcript }], { isFinal });
    ptt.press();
    const first = result('make the ball', true);
    recs[0]!.onresult?.({ resultIndex: 0, results: [first] });
    recs[0]!.onresult?.({ resultIndex: 1, results: [first, result('twice as heavy', false)] });
    expect(events.interim.at(-1)).toBe('make the ball twice as heavy');
    recs[0]!.onresult?.({ resultIndex: 1, results: [first, result('twice as heavy', true)] });
    ptt.release();
    expect(events.final).toEqual(['make the ball twice as heavy']);
  });

  it('maps microphone denial to MIC_DENIED and delivers nothing', () => {
    const { ptt, recs, events } = talk();
    ptt.press();
    recs[0]!.onerror?.({ error: 'not-allowed' });
    recs[0]!.onend?.();
    expect(events.errors).toEqual(['MIC_DENIED']);
    expect(events.final).toEqual([]);
  });

  it('Esc cancel discards the transcript', () => {
    const { ptt, recs, events } = talk();
    ptt.press();
    recs[0]!.say('remove the ramp', true);
    ptt.cancel();
    expect(events.final).toEqual([]);
  });

  it('release with no speech reports NO_SPEECH', () => {
    const { ptt, events } = talk();
    ptt.press();
    ptt.release();
    expect(events.errors).toEqual(['NO_SPEECH']);
  });

  it('reports UNSUPPORTED when the browser has no recognition', () => {
    const errors: VoiceErrorCode[] = [];
    const ptt = new PressToTalk(null, { onFinal: () => undefined, onError: (c) => errors.push(c) });
    expect(ptt.supported).toBe(false);
    ptt.press();
    expect(errors).toEqual(['UNSUPPORTED']);
  });
});

describe('server route', () => {
  const base = { method: 'POST', url: '/api/interpret', env: {}, providers: {}, signal: new AbortController().signal };
  const body = JSON.stringify({ requestId: 'req-1' });

  it('returns PROVIDER_NOT_CONFIGURED while no provider is chosen (R-11)', async () => {
    expect(await handleApi({ ...base, body })).toMatchObject({ status: 503, body: { code: 'PROVIDER_NOT_CONFIGURED' } });
  });

  it('rejects wrong method, bad JSON, missing requestId, oversize bodies and unknown routes', async () => {
    expect((await handleApi({ ...base, method: 'GET', body })).status).toBe(405);
    expect((await handleApi({ ...base, body: '{' })).status).toBe(400);
    expect((await handleApi({ ...base, body: '{}' })).status).toBe(400);
    expect((await handleApi({ ...base, body: 'x'.repeat(3 * 1024 * 1024 + 1) })).status).toBe(413);
    expect((await handleApi({ ...base, url: '/api/other', body })).status).toBe(404);
  });

  it('passes the instructions and request to a registered provider and returns raw text', async () => {
    let seen: unknown;
    const provider: ModelProvider = {
      async complete(input) {
        seen = input;
        return '{"ok":true}';
      },
    };
    const out = await handleApi({ ...base, body, env: { NOX_MODEL_PROVIDER: 'test' }, providers: { test: provider } });
    expect(out).toEqual({ status: 200, body: { requestId: 'req-1', raw: '{"ok":true}' } });
    expect((seen as { instructions: string }).instructions).toMatch(/rough hand-drawn 2D mechanics sketch/);
  });

  it('maps a failing provider to 502 without leaking details', async () => {
    const provider: ModelProvider = { complete: async () => Promise.reject(new Error('secret-key-xyz invalid')) };
    const out = await handleApi({ ...base, body, env: { NOX_MODEL_PROVIDER: 'p' }, providers: { p: provider } });
    expect(out.status).toBe(502);
    expect(JSON.stringify(out.body)).not.toContain('secret');
  });
});

describe('provider client', () => {
  const ok = (status: number, json: unknown): FetchLike => async () => ({ ok: status < 300, status, json: async () => json });
  const signal = new AbortController().signal;

  it('returns raw text on success', async () => {
    expect(await postModel('/api/interpret', {}, signal, ok(200, { raw: 'x' }))).toBe('x');
  });

  it('maps not-configured, network and other failures', async () => {
    await expect(postModel('/api/interpret', {}, signal, ok(503, { code: 'PROVIDER_NOT_CONFIGURED' }))).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    await expect(postModel('/api/interpret', {}, signal, ok(401, { code: 'ACCESS_REQUIRED', message: 'untrusted server detail' }))).rejects.toMatchObject({ code: 'ACCESS_REQUIRED', message: 'This session needs live AI access. Open the judge link supplied by the project owner, then retry. Your sketch and experiment are retained.' });
    await expect(postModel('/api/interpret', {}, signal, async () => Promise.reject(new TypeError('fetch failed')))).rejects.toBeInstanceOf(ProviderError);
    await expect(postModel('/api/interpret', {}, signal, ok(500, null))).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });
});

describe('stroke store', () => {
  it('bumps revision on add, undo and clear, and clamps to the canvas', () => {
    const s = new StrokeStore('src-1');
    const a = s.add([
      [-5, 10],
      [2000, 950],
    ]);
    expect(a?.points).toEqual([
      [0, 10],
      [1600, 900],
    ]);
    expect(s.revision).toBe(1);
    s.add([[5, 5]]);
    s.undo();
    expect(s.revision).toBe(3);
    s.clear();
    expect(s.revision).toBe(4);
    s.clear();
    expect(s.revision).toBe(4);
    expect(s.add([])).toBeNull();
  });
});

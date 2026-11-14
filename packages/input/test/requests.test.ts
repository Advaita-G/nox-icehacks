import { describe, expect, it } from 'vitest';
import type { TargetToken } from '../src/contract/types';
import { RequestManager } from '../src/requests/manager';
import { example } from './helpers';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Manual timers so timeout tests are deterministic. */
function fakeTimers() {
  const timers: { fn: () => void; at: number; id: number; cleared: boolean }[] = [];
  let now = 0;
  let id = 0;
  return {
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, at: now + ms, id: ++id, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h: unknown) => {
      (h as { cleared: boolean }).cleared = true;
    },
    advance(ms: number) {
      now += ms;
      for (const t of timers) if (!t.cleared && t.at <= now) {
        t.cleared = true;
        t.fn();
      }
    },
  };
}

function setup() {
  const e07 = example('requests-stale-cancel.json');
  const target: TargetToken = { ...e07.initialState };
  const timers = fakeTimers();
  let n = 0;
  const ids = ['req-A', 'req-B', 'req-C', 'req-D', 'req-E', 'req-F', 'req-G', 'cmd-1', 'cmd-2'];
  const mgr = new RequestManager(() => target, { newId: () => ids[n++] ?? `req-${n}`, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  return { target, mgr, timers };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('E-07 request identity and stale results', () => {
  it('E-07a–c: a stroke while waiting aborts the request; a racing late response is discarded', async () => {
    const { target, mgr } = setup();
    const d = deferred<string>();
    let sent: TargetToken | undefined;
    const p = mgr.start('sketch', (_s, id, t) => {
      expect(id).toBe('req-A');
      sent = t;
      return d.promise;
    });
    expect(sent).toMatchObject({ sourceRevision: 10, sceneRevision: 6, epoch: 3 });
    target.sourceRevision = 11;
    expect(mgr.invalidate('Sketch changed, so the interpretation was cancelled.')).toEqual(['sketch']);
    d.resolve('late result');
    const out = await p;
    expect(out).toMatchObject({ status: 'stale', requestId: 'req-A', message: 'Sketch changed, so the interpretation was cancelled.' });
  });

  it('E-07d–f: a newer request supersedes; Cancel aborts with a billing note', async () => {
    const { mgr } = setup();
    mgr.start('sketch', () => new Promise(() => undefined)); // req-A, never resolves
    const b = mgr.start('sketch', () => new Promise(() => undefined)); // req-B
    const c = mgr.start('sketch', () => new Promise(() => undefined)); // req-C supersedes B
    expect(await b).toMatchObject({ status: 'superseded', requestId: 'req-B' });
    expect(mgr.pendingId('sketch')).toBe('req-C');
    expect(mgr.cancel('sketch')).toBe(true);
    expect(await c).toMatchObject({ status: 'cancelled', message: 'Cancelled. The provider may still charge for this request.' });
    expect(mgr.isPending('sketch')).toBe(false);
  });

  it('E-07g: a provider that never answers times out after 30 s, with no retry', async () => {
    const { mgr, timers } = setup();
    let calls = 0;
    const p = mgr.start('sketch', () => {
      calls++;
      return new Promise(() => undefined);
    });
    timers.advance(29_999);
    await tick();
    expect(mgr.isPending('sketch')).toBe(true);
    timers.advance(1);
    expect(await p).toMatchObject({ status: 'timeout', message: 'The model did not respond in 30 s.' });
    expect(calls).toBe(1);
  });

  it('E-07h: a manual edit (scene revision only) discards an interpretation started before it', async () => {
    const { target, mgr } = setup();
    const d = deferred<string>();
    const p = mgr.start('sketch', () => d.promise);
    target.sceneRevision = 7; // drag in the preview; source unchanged
    // Even without an explicit invalidate() call, the accept check compares every token field.
    d.resolve('result for scene revision 6');
    expect(await p).toMatchObject({ status: 'stale', message: 'A result for an older version was discarded.' });
  });

  it('E-07i: Reset bumps epoch and discards even with equal revisions', async () => {
    const { target, mgr } = setup();
    const d = deferred<string>();
    const p = mgr.start('sketch', () => d.promise);
    target.epoch = 4;
    mgr.invalidate('Reset cancelled the interpretation.');
    d.resolve('late');
    expect((await p).status).toBe('stale');
  });

  it('E-07j: switching experiment with matching revision numbers still discards', async () => {
    const { target, mgr } = setup();
    const d = deferred<string>();
    const p = mgr.start('sketch', () => d.promise);
    target.experimentId = 'exp-2';
    target.epoch = 4; // same revisions as before
    d.resolve('late');
    expect((await p).status).toBe('stale');
  });

  it('E-07k: reopening another version discards a pending command', async () => {
    const { target, mgr } = setup();
    const d = deferred<string>();
    const p = mgr.start('command', () => d.promise);
    target.versionId = 'v-2';
    target.epoch = 4;
    mgr.invalidate('Version changed.');
    d.resolve('late intent');
    expect((await p).status).toBe('stale');
  });

  it('accepts a response when nothing changed, and reports provider failures', async () => {
    const { mgr } = setup();
    expect(await mgr.start('sketch', async () => 'ok')).toMatchObject({ status: 'accepted', value: 'ok' });
    expect(await mgr.start('command', async () => Promise.reject(new Error('boom')))).toMatchObject({ status: 'failed', message: 'boom' });
  });

  it('sketch and command requests are independent', async () => {
    const { mgr } = setup();
    const s = deferred<string>();
    const ps = mgr.start('sketch', () => s.promise);
    const pc = mgr.start('command', async () => 'intent');
    expect((await pc).status).toBe('accepted');
    s.resolve('scene');
    expect((await ps).status).toBe('accepted');
  });
});

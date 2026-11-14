import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceSession } from '../src/assistant/voice.ts';

function fixture(overrides = {}) {
  const recognizers = [], states = [], errors = [], transcripts = [], spoken = [], timers = new Map(), visibilityListeners = new Set();
  let timerId = 0, cancellations = 0;
  const visibility = { hidden: false, addEventListener: (_, fn) => visibilityListeners.add(fn), removeEventListener: (_, fn) => visibilityListeners.delete(fn) };
  const options = {
    recognitionFactory: () => {
      const rec = { aborts: 0, start() { this.onstart?.(); }, stop() {}, abort() { this.aborts++; }, onresult: null, onerror: null, onend: null, onstart: null };
      recognizers.push(rec); return rec;
    },
    synthesis: { speak: utterance => spoken.push(utterance), cancel: () => { cancellations++; } },
    createUtterance: text => ({ text, onend: null, onerror: null }),
    visibility,
    setTimer: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimer: id => timers.delete(id),
    onState: state => states.push(state), onError: error => errors.push(error), onTranscript: text => transcripts.push(text),
    ...overrides,
  };
  const session = new VoiceSession(options);
  return { session, recognizers, states, errors, transcripts, spoken, timers, visibility, visibilityListeners,
    get cancellations() { return cancellations; },
    tick(ms) { for (const [id, item] of [...timers]) if (item.ms <= ms) { timers.delete(id); item.fn(); } },
    final(text) { const result = [{ transcript: text }]; result.isFinal = true; recognizers.at(-1).onresult?.({ resultIndex: 0, results: [result] }); },
  };
}

test('voice requires opt-in and emits one transcript only after suspending recognition', () => {
  let f;
  f = fixture({ onTranscript: text => { assert.equal(f.recognizers[0].aborts, 1); assert.equal(f.states.at(-1), 'thinking'); f.transcripts.push(text); } });
  assert.equal(f.session.supported, true); assert.equal(f.session.isActive, false); assert.equal(f.recognizers.length, 0);
  f.session.start(); f.session.start(); assert.equal(f.recognizers.length, 1); assert.equal(f.states.at(-1), 'listening');
  const late = f.recognizers[0].onresult;
  f.final('  Build a ramp  '); assert.deepEqual(f.transcripts, ['Build a ramp']);
  late({ resultIndex: 0, results: [Object.assign([{ transcript: 'duplicate' }], { isFinal: true })] });
  f.tick(5000); assert.equal(f.recognizers.length, 1); assert.deepEqual(f.transcripts, ['Build a ramp']);
  f.session.setThinking(false); f.tick(700); assert.equal(f.recognizers.length, 2);
  f.session.dispose();
});

test('recognition stays suspended through speech and resumes only after action release', async () => {
  const f = fixture(); f.session.start(); f.final('What happened?');
  const reply = f.session.speak('The ball reached the cup.');
  assert.equal(f.states.at(-1), 'speaking'); assert.equal(f.recognizers[0].aborts, 1);
  f.tick(1000); assert.equal(f.recognizers.length, 1);
  f.spoken[0].onend(); await reply; assert.equal(f.states.at(-1), 'thinking');
  f.tick(1000); assert.equal(f.recognizers.length, 1);
  f.session.setThinking(false); f.tick(700); assert.equal(f.recognizers.length, 2);
  f.session.dispose();
});

test('speech alone pauses listening, replaces prior speech, and automatically resumes afterward', async () => {
  const f = fixture(); f.session.start();
  const first = f.session.speak('First'), oldEnd = f.spoken[0].onend;
  const second = f.session.speak('Second'); await first;
  assert.equal(f.cancellations, 1); oldEnd(); assert.equal(f.states.at(-1), 'speaking');
  f.spoken[1].onend(); await second; f.tick(700); assert.equal(f.recognizers.length, 2);
  f.session.dispose();
});

test('explicit stop cancels speech, settles its promise, drops late events and never restarts', async () => {
  const f = fixture(); f.session.start(); const lateResult = f.recognizers[0].onresult;
  const reply = f.session.speak('A response'); f.session.stop(); await reply;
  lateResult({ results: [Object.assign([{ transcript: 'echo' }], { isFinal: true })] });
  f.tick(999999); f.session.setThinking(false);
  assert.equal(f.session.isActive, false); assert.equal(f.states.at(-1), 'idle'); assert.equal(f.cancellations, 1);
  assert.equal(f.recognizers.length, 1); assert.equal(f.transcripts.length, 0); assert.equal(f.timers.size, 0);
});

test('permission, microphone and service errors stop truthfully with no automatic retry', () => {
  for (const error of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported', 'aborted']) {
    const f = fixture(); f.session.start(); f.recognizers[0].onerror({ error }); f.tick(999999);
    assert.equal(f.session.isActive, false, error); assert.equal(f.states.at(-1), 'error'); assert.equal(f.errors.length, 1);
    assert.equal(f.recognizers.length, 1); assert.equal(f.timers.size, 0);
  }
});

test('normal silence keeps hands-free mode enabled with capped restart backoff', () => {
  const f = fixture(); f.session.start();
  f.recognizers[0].onerror({ error: 'no-speech' }); f.recognizers[0].onend();
  assert.equal(f.recognizers.length, 1); f.tick(700); assert.equal(f.recognizers.length, 2);
  f.recognizers[1].onend(); f.tick(700); assert.equal(f.recognizers.length, 2);
  f.tick(1400); assert.equal(f.recognizers.length, 3); f.recognizers[2].onend(); f.tick(2100);
  assert.equal(f.session.isActive, true); assert.equal(f.errors.length, 0); assert.equal(f.recognizers.length, 4);
  for (let i = 0; i < 10; i++) { f.recognizers.at(-1).onend(); assert.ok([...f.timers.values()].every(timer => timer.ms <= 5000)); f.tick(5000); }
  f.session.dispose();
});

test('hidden page stops; visibility restoration does not silently re-enable the mic; disposal removes listener', () => {
  const f = fixture(); f.session.start(); f.visibility.hidden = true; for (const fn of f.visibilityListeners) fn();
  assert.equal(f.session.isActive, false); assert.equal(f.recognizers[0].aborts, 1);
  f.visibility.hidden = false; for (const fn of f.visibilityListeners) fn(); f.tick(999999); assert.equal(f.recognizers.length, 1);
  f.session.dispose(); assert.equal(f.visibilityListeners.size, 0); f.session.start(); assert.equal(f.recognizers.length, 1);
});

test('missing browser support and recognition start failure retain the typed fallback', () => {
  const unsupported = fixture({ recognitionFactory: null }); unsupported.session.start();
  assert.equal(unsupported.session.supported, false); assert.equal(unsupported.session.isActive, false); assert.match(unsupported.errors[0], /Type your request/);
  const failed = fixture({ recognitionFactory: () => ({ start() { throw new Error('not ready'); }, abort() {} }) });
  failed.session.start(); failed.tick(999999); assert.equal(failed.session.isActive, false); assert.equal(failed.errors.length, 1);
});

test('speech error and missing completion settle callers and stop the session', async () => {
  const failed = fixture(); failed.session.start(); const reply = failed.session.speak('Hello'); failed.spoken[0].onerror(); await reply;
  assert.equal(failed.session.isActive, false); assert.equal(failed.errors.length, 1);
  const hung = fixture(); hung.session.start(); const pending = hung.session.speak('Hello'); hung.tick(120000); await pending;
  assert.equal(hung.session.isActive, false); assert.match(hung.errors[0], /did not finish/); assert.equal(hung.timers.size, 0);
});

test('an asynchronous action failure after stop cannot interrupt a later opt-in session', async () => {
  let reject;
  const f = fixture({ onTranscript: () => new Promise((_, fail) => { reject = fail; }) });
  f.session.start(); f.final('Old action'); f.session.stop(); f.session.start(); reject(new Error('late'));
  await Promise.resolve(); assert.equal(f.session.isActive, true); assert.equal(f.states.at(-1), 'listening'); assert.equal(f.errors.length, 0);
  f.session.dispose();
});

test('permission-pending recognition is not reported as listening and has a bounded start wait', () => {
  let rec;
  const f = fixture({ recognitionFactory: () => (rec = { start() {}, abort() {} }) });
  f.session.start(); assert.equal(f.states.includes('listening'), false);
  const lateStart = rec.onstart; f.tick(30000); lateStart();
  assert.equal(f.session.isActive, false); assert.equal(f.states.at(-1), 'error');
  assert.match(f.errors[0], /did not start/); assert.equal(f.timers.size, 0);
});

test('speech preparation/start failures settle and synchronous cancel callbacks cannot recurse', async () => {
  const preparation = fixture({ createUtterance: () => { throw new Error('unavailable'); } });
  preparation.session.start(); await preparation.session.speak('Reply'); assert.equal(preparation.session.isActive, false);
  const start = fixture({ synthesis: { speak() { throw new Error('blocked'); }, cancel() {} } });
  start.session.start(); await start.session.speak('Reply'); assert.equal(start.session.isActive, false);
  const spoken = [];
  const cancel = fixture({ synthesis: { speak: utterance => spoken.push(utterance), cancel: () => spoken.at(-1).onerror?.() } });
  cancel.session.start(); const pending = cancel.session.speak('Reply'); cancel.session.stop(); await pending;
  assert.equal(cancel.errors.length, 0); assert.equal(cancel.session.isActive, false);
});

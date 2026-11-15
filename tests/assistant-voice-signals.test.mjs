// Nox's presence animates only from real browser signals: recognition speech start/end and spoken word boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceSession } from '../src/assistant/voice.ts';

function fixture(overrides = {}) {
  const recognizers = [], spoken = [], heard = [], words = [], timers = new Map();
  let timerId = 0;
  const session = new VoiceSession({
    recognitionFactory: () => { const rec = { aborts: 0, start() { this.onstart?.(); }, stop() {}, abort() { this.aborts++; } }; recognizers.push(rec); return rec; },
    synthesis: { speak: u => spoken.push(u), cancel() {} },
    createUtterance: text => ({ text, onend: null, onerror: null, onboundary: null }),
    visibility: { hidden: false, addEventListener() {}, removeEventListener() {} },
    setTimer: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimer: id => timers.delete(id),
    onState() {}, onError() {}, onTranscript() {},
    onHearing: active => heard.push(active), onWord: () => words.push(1),
    ...overrides,
  });
  return { session, recognizers, spoken, heard, words };
}

test('speech start/end on the recognizer report hearing; stopping ends it', () => {
  const f = fixture(); f.session.start();
  f.recognizers[0].onspeechstart(); f.recognizers[0].onspeechend();
  f.recognizers[0].onspeechstart(); f.session.stop();
  assert.deepEqual(f.heard, [true, false, true, false]);
});

test('a superseded recognizer cannot report hearing', () => {
  const f = fixture(); f.session.start();
  const old = f.recognizers[0]; f.session.stop(); f.session.start();
  old.onspeechstart?.();
  assert.deepEqual(f.heard.filter(Boolean), []);
});

test('only word boundaries of the current reply are reported', async () => {
  const f = fixture(); f.session.start();
  const reply = f.session.speak('The ball hops.');
  const u = f.spoken[0];
  u.onboundary({ name: 'word' }); u.onboundary({ name: 'sentence' }); u.onboundary({ name: 'word' });
  u.onend(); await reply; u.onboundary?.({ name: 'word' });
  assert.equal(f.words.length, 2);
});

test('a recognizer that ends naturally stops hearing', () => {
  const f = fixture(); f.session.start();
  f.recognizers[0].onspeechstart(); f.recognizers[0].onend();
  assert.deepEqual(f.heard, [true, false]);
});

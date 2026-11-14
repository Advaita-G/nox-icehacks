// Live #81/#88: the model answered a seesaw clarification with plain text ("I'm sorry, but I cannot assist with that
// request.") instead of JSON. The user must see a readable reason and the reply text, never a raw JSON parser error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, parseInterpretation } from '../src/input/contract.ts';
import { EXAMPLES } from '../src/physics/index.ts';

const refusal = "I'm sorry, but I cannot assist with that request.";
const readable = /The AI replied with text instead of a structured answer: "I'm sorry, but I cannot assist with that request\."/;

test('a plain-text model reply to a sketch is reported readably, without a JSON parser message', () => {
  assert.throws(() => parseInterpretation(refusal, 'req-1', { id: 'src-1', revision: 1 }), error => {
    assert.match(error.message, readable);
    assert.doesNotMatch(error.message, /Unexpected token|is not valid JSON/);
    return true;
  });
});

test('a plain-text model reply to a command is reported readably', () => {
  assert.throws(() => parseCommand(refusal, 'req-2', EXAMPLES.fan()), readable);
});

test('a long plain-text reply is shortened in the message', () => {
  assert.throws(() => parseCommand('x'.repeat(5000), 'req-3', EXAMPLES.fan()), error => {
    assert.ok(error.message.length < 400, `message length ${error.message.length}`);
    return true;
  });
});

test('live #109: a structured answer that turns into a refusal partway is reported as a refusal, quoting the refusal', async () => {
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(new URL('../docs/evidence/live-22-seesaw-2026-11-12/recheck/conv-109-response.txt', import.meta.url), 'utf8');
  assert.throws(() => parseInterpretation(raw, 'req-0f50ca68', { id: 'src', revision: 11, kind: 'canvas', strokeIds: [] }), error => {
    assert.match(error.message, /The AI stopped partway and refused: "I'm sorry, but I cannot assist with that request\."/);
    assert.doesNotMatch(error.message, /requestId|Unexpected token/);
    return true;
  });
});

test('a structured answer that is simply cut off is reported as incomplete', () => {
  assert.throws(() => parseCommand('{"requestId":"req-5","status":"proposed","operations":[{"type":"move"', 'req-5', EXAMPLES.fan()),
    /The AI's structured answer was cut off after 69 characters\. Nothing was changed; try again\./);
});

test('valid JSON that is not an object still fails with the existing shape error', () => {
  assert.throws(() => parseCommand('42', 'req-4', EXAMPLES.fan()), error => {
    assert.doesNotMatch(error.message, /replied with text/);
    return true;
  });
});

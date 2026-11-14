// Regression for the live fan case: re-answering a question must replace the earlier answer, not add a conflicting one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAnswers } from '../src/input/answers.ts';

const q = 'What fan speed should the motor use?';

test('a newer answer to the same question replaces the older one', () => {
  const merged = mergeAnswers([{ question: q, answer: 'Moderate household setting: 900 rpm' }], [{ question: q, answer: 'Slow: 600 rpm' }]);
  assert.deepEqual(merged, [{ question: q, answer: 'Slow: 600 rpm' }]);
});

test('answers to different questions accumulate in order', () => {
  const merged = mergeAnswers([{ question: 'A?', answer: '1' }], [{ question: 'B?', answer: '2' }]);
  assert.deepEqual(merged, [{ question: 'A?', answer: '1' }, { question: 'B?', answer: '2' }]);
});

test('re-sending the same answer does not duplicate it', () => {
  const a = [{ question: q, answer: 'Slow: 600 rpm' }];
  assert.deepEqual(mergeAnswers(a, a), a);
});

test('whitespace-only differences in the question still match', () => {
  const merged = mergeAnswers([{ question: `  ${q} `, answer: 'x' }], [{ question: q, answer: 'y' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].answer, 'y');
});

test('does not mutate its inputs', () => {
  const prev = [{ question: q, answer: 'x' }];
  const next = [{ question: q, answer: 'y' }];
  mergeAnswers(prev, next);
  assert.deepEqual(prev, [{ question: q, answer: 'x' }]);
});

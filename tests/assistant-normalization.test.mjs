import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantActions, normalizeAssistantInput, isAssistantCancellation } from '../src/assistant/actions.ts';

test('Nox, Knox and Jarvis share normalization for named stop and cancellation', () => {
  for (const [input, expected] of [
    ['Nox, stop listening.', 'stop listening'],
    ['Knox, cancel the request!', 'cancel the request'],
    ['Hey Knox, pause please.', 'pause'],
    ['Jarvis: mute', 'mute'],
    ['  HEY  NOX,  stop checking please!  ', 'stop checking'],
    ['Knoxville pause', 'knoxville pause'],
  ]) assert.equal(normalizeAssistantInput(input), expected, input);
  assert.equal(isAssistantCancellation('Knox, cancel the request!'), true);
  assert.equal(isAssistantCancellation('Nox, move the ball'), false);
});

test('named pause remains local and never requests model review', async () => {
  let pauses = 0;
  const actions = new AssistantActions({ pause: () => { pauses++; return 'Paused locally.'; }, review: () => assert.fail('Local pause must not request the model') });
  for (const input of ['Knox, pause.', 'Nox, pause', 'Hey Jarvis, pause please']) assert.equal((await actions.handle(input)).message, 'Paused locally.');
  assert.equal(pauses, 3);
});

test('Knox cancellation interrupts a pending request and cannot leave a late Apply', async () => {
  let finish, cancellations = 0, applies = 0;
  const actions = new AssistantActions({
    review: () => new Promise(resolve => { finish = resolve; }),
    cancel: () => { cancellations++; return 'Cancelled.'; },
    apply: () => { applies++; return 'Applied.'; },
  });
  const pending = actions.handle('make a custom mechanism'); await Promise.resolve();
  await actions.handle('Knox, cancel the request.');
  finish({ message: 'Review before applying.', reviewRequired: true, changes: ['Mass 1 → 2 kg'] });
  assert.match((await pending).message, /cancelled/);
  await actions.handle('Knox, yes');
  assert.equal(cancellations, 1); assert.equal(applies, 0);
});

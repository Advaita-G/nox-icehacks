// Proposal marks come only from the reviewed operations and never mutate the current experiment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalMarks } from '../src/assistant/proposal.ts';
import { newObject, emptyScene } from '../src/physics/scene.ts';

const scene = () => { const s = emptyScene(); const ball = newObject('ball', 'ball'); ball.position = { x: 0, y: 1, z: 0 }; const box = newObject('block', 'box'); s.objects.push(ball, box); return s; };

test('a move becomes a ghost at the proposed position; the scene is untouched', () => {
  const s = scene(), before = JSON.stringify(s);
  const [mark] = proposalMarks(s, [{ type: 'move', id: 'ball', position: { x: 2, y: 1, z: 0 } }]);
  assert.equal(mark.kind, 'ghost'); assert.deepEqual(mark.object.position, { x: 2, y: 1, z: 0 });
  assert.equal(JSON.stringify(s), before);
});

test('move and resize on one part combine into one ghost', () => {
  const marks = proposalMarks(scene(), [{ type: 'move', id: 'box', position: { x: 1, y: 0, z: 0 } }, { type: 'resize', id: 'box', width: 2, height: 1, depth: 1 }]);
  assert.equal(marks.length, 1); assert.equal(marks[0].object.width, 2); assert.equal(marks[0].object.position.x, 1);
});

test('a velocity becomes an arrow; mass becomes a note; unknown parts are ignored', () => {
  const marks = proposalMarks(scene(), [
    { type: 'set-property', id: 'ball', property: 'velocity', value: { x: 2, y: 0, z: 0 } },
    { type: 'set-property', id: 'box', property: 'mass', value: 4 },
    { type: 'set-property', id: 'ghost-part', property: 'mass', value: 1 },
  ]);
  assert.deepEqual(marks.map(m => [m.kind, m.id]), [['arrow', 'ball'], ['note', 'box']]);
});

test('a zero velocity is a note, not an arrow', () => {
  assert.deepEqual(proposalMarks(scene(), [{ type: 'set-property', id: 'ball', property: 'velocity', value: { x: 0, y: 0, z: 0 } }]).map(m => m.kind), ['note']);
});

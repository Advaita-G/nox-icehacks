// Juwon's request: Ctrl+Z (Cmd+Z on macOS) undoes the last sketch stroke, but never steals undo from text fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isUndoStroke, isTextEditing } from '../src/input/shortcuts.ts';

const key = (over = {}) => ({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });
const canvas = { tagName: 'CANVAS' }, button = { tagName: 'BUTTON' };

test('Ctrl+Z and Cmd+Z on the canvas or a button undo a stroke', () => {
  assert.equal(isUndoStroke(key({ ctrlKey: true }), canvas), true);
  assert.equal(isUndoStroke(key({ metaKey: true }), button), true);
  assert.equal(isUndoStroke(key({ ctrlKey: true, key: 'Z' }), canvas), true, 'Caps Lock');
  assert.equal(isUndoStroke(key({ ctrlKey: true }), null), true, 'no focused element');
});

test('plain z, redo (Shift) and Alt combinations do not undo', () => {
  assert.equal(isUndoStroke(key(), canvas), false);
  assert.equal(isUndoStroke(key({ ctrlKey: true, shiftKey: true }), canvas), false);
  assert.equal(isUndoStroke(key({ ctrlKey: true, altKey: true }), canvas), false);
  assert.equal(isUndoStroke(key({ ctrlKey: true, key: 'y' }), canvas), false);
});

test('text fields keep their native undo', () => {
  for (const t of [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT', type: 'text' }, { tagName: 'input', type: '' }, { tagName: 'INPUT', type: 'number' }, { tagName: 'DIV', isContentEditable: true }]) {
    assert.equal(isTextEditing(t), true, JSON.stringify(t));
    assert.equal(isUndoStroke(key({ ctrlKey: true }), t), false, JSON.stringify(t));
  }
  for (const t of [{ tagName: 'INPUT', type: 'file' }, { tagName: 'INPUT', type: 'checkbox' }]) assert.equal(isTextEditing(t), false, JSON.stringify(t));
});

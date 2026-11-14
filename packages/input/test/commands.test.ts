import { describe, expect, it } from 'vitest';
import { applyBatch } from '../src/commands/apply';
import { needsConfirmation, resolveIntent } from '../src/commands/resolver';
import { parseTyped } from '../src/commands/typed';
import type { EditableState, SceneObject } from '../src/contract/types';
import { example } from './helpers';

function ball(id: string, extra: Partial<SceneObject> = {}): SceneObject {
  return { id, kind: 'ball', bodyType: 'dynamic', x: 2, y: 3, angle: 0, dims: { radius: 0.2 }, mass: 1.5, linearVelocity: { vx: 0, vy: 0 }, angularVelocity: 0, friction: 0.3, restitution: 0.2, sourceRefs: [], ...extra };
}
function domino(id: string, x: number): SceneObject {
  return { id, kind: 'domino', bodyType: 'dynamic', x, y: 1.25, angle: 0, dims: { width: 0.1, height: 0.5 }, mass: 1, friction: 0.3, restitution: 0.2, sourceRefs: [] };
}
function stateWith(objects: SceneObject[], revision: number): EditableState {
  return { scene: { schemaVersion: 1, revision, metersPerPx: 0.01, gravity: { gx: 0, gy: -9.81 }, objects }, relationships: [], assumptions: [] };
}

describe('E-04 relative voice command', () => {
  const e = example('command-heavier-ball.json');
  it('resolves factor 2 to an absolute value and summary, needing confirmation', () => {
    const state = stateWith([ball('ball-1')], 5);
    const r = resolveIntent(state, e.intent, { origin: 'voice', batchId: e.resolvedBatch.batchId });
    expect(r.kind).toBe('batch');
    if (r.kind !== 'batch') return;
    expect(r.batch).toEqual(e.resolvedBatch);
    expect(needsConfirmation(r.batch.origin)).toBe(true);
    expect(state.scene.objects[0]!.mass).toBe(1.5); // nothing applied before Apply
    const applied = applyBatch(state, r.batch);
    expect(applied.ok && applied.state.scene.revision).toBe(6);
    expect(applied.ok && applied.state.scene.objects[0]!.mass).toBe(3);
  });
});

describe('E-05 multi-target structural command', () => {
  const e = example('command-dominoes-apart.json');
  it('asks for the amount, then expands space-evenly to absolute set-pose ops', () => {
    const state = stateWith([domino('dom-1', 4.0), domino('dom-2', 4.4), domino('dom-3', 4.8)], 8);
    const q = resolveIntent(state, e.intent, { origin: 'voice' });
    expect(q.kind).toBe('question');
    if (q.kind !== 'question') return;
    const chosen = q.question.options.find((o) => o.id === e.afterChoosing)!;
    const r = resolveIntent(state, { requestId: 'cmd-02', status: 'proposed', targets: e.intent.targets, ops: chosen.intentOps }, { origin: 'voice', batchId: 'b-40' });
    expect(r.kind === 'batch' && r.batch).toEqual(e.resolvedBatch);
  });
});

describe('E-06 rejected commands apply nothing', () => {
  const e = example('command-rejections.json');
  const base = () => {
    const s = stateWith([ball('ball-1'), ball('ball-2', { x: 5 })], 6);
    return s;
  };
  for (const c of e.cases.filter((c: any) => c.batch)) {
    it(`${c.id}: ${c.expected.error.code}`, () => {
      const state = base();
      const before = structuredClone(state);
      const r = applyBatch(state, c.batch);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toMatchObject(c.expected.error);
      expect(state).toEqual(before);
    });
  }

  it('E-06f: no selection and an unclear target becomes a question', () => {
    const c = e.cases.find((c: any) => c.id === 'E-06f');
    expect(resolveIntent(base(), c.intent, { origin: 'voice' }).kind).toBe('question');
  });

  it('E-06g: unsupported request is explained, not applied', () => {
    const c = e.cases.find((c: any) => c.id === 'E-06g');
    const r = resolveIntent(base(), c.intent, { origin: 'voice' });
    expect(r).toEqual({ kind: 'unsupported', reason: 'Magnets are outside supported mechanics.' });
  });
});

describe('applyBatch semantics', () => {
  it('removing an object removes its relationships', () => {
    const s = stateWith([ball('ball-1'), { ...domino('p', 2), kind: 'platform', bodyType: 'fixed' }], 1);
    s.relationships.push({ id: 'r', kind: 'rests-on', subjectId: 'ball-1', targetId: 'p', origin: 'model', status: 'proposed', sourceRefs: [] });
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'remove-object', objectId: 'p' }], summary: [] });
    expect(r.ok && r.state.relationships).toEqual([]);
  });

  it('a fixed object has no mass to edit', () => {
    const s = stateWith([{ ...domino('p', 2), kind: 'platform', bodyType: 'fixed' }], 1);
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'set-property', objectId: 'p', property: 'mass', value: 2 }], summary: [] });
    expect(r.ok).toBe(false);
  });

  it('user edits update the matching assumption origin to "user"', () => {
    const s = stateWith([ball('ball-1')], 1);
    s.assumptions.push({ id: 'a', path: 'objects.ball-1.mass', value: 1.5, unit: 'kg', origin: 'default' });
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'set-property', objectId: 'ball-1', property: 'mass', value: 2 }], summary: [] });
    expect(r.ok && r.state.assumptions[0]).toMatchObject({ value: 2, origin: 'user' });
  });

  it('inside needs a container target', () => {
    const s = stateWith([ball('ball-1'), ball('ball-2')], 1);
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'add-relationship', relationship: { id: 'r', kind: 'inside', subjectId: 'ball-1', targetId: 'ball-2', origin: 'user', status: 'confirmed', sourceRefs: [] } }], summary: [] });
    expect(r.ok).toBe(false);
  });

  it('an empty batch is rejected', () => {
    expect(applyBatch(stateWith([], 1), { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [], summary: [] }).ok).toBe(false);
  });
});

describe('typed fallback parser', () => {
  it('parses lifecycle words as lifecycle commands', () => {
    const p = parseTyped('Reset', 'r1');
    expect(p.ok && p.intent.lifecycle).toBe('reset');
    const r = p.ok ? resolveIntent(stateWith([], 1), p.intent, { origin: 'typed' }) : null;
    expect(r).toEqual({ kind: 'lifecycle', command: { kind: 'reset', origin: 'typed' } });
  });

  it('parses factor and absolute property values', () => {
    const s = stateWith([ball('ball-1')], 3);
    for (const [text, expected] of [
      ['set ball-1 mass x2', 3],
      ['set ball-1 mass 4', 4],
      ['set ball-1 friction +0.1', 0.4],
    ] as const) {
      const p = parseTyped(text, 'r');
      expect(p.ok).toBe(true);
      if (!p.ok) continue;
      const r = resolveIntent(s, p.intent, { origin: 'typed' });
      expect(r.kind === 'batch' && (r.batch.ops[0] as any).value).toBeCloseTo(expected);
    }
  });

  it('rotate takes degrees and keeps position', () => {
    const s = stateWith([ball('ball-1')], 1);
    const p = parseTyped('rotate ball-1 90', 'r');
    const r = p.ok ? resolveIntent(s, p.intent, { origin: 'typed' }) : null;
    expect(r?.kind === 'batch' && r.batch.ops[0]).toMatchObject({ op: 'set-pose', x: 2, y: 3, angle: Math.PI / 2 });
  });

  it('accepts dictated sentence punctuation and capitalisation (live: "Gravity -4.9." fell through to the model)', () => {
    for (const [text, op] of [
      ['Gravity -4.9.', { op: 'set-gravity', gy: -4.9 }],
      ['Set this mass x2.', { op: 'set-property', objectId: 'this', property: 'mass', value: { factor: 2 } }],
      ['Move this 3 2!', { op: 'set-pose', objectId: 'this', x: 3, y: 2 }],
      ['Velocity this 2 0.', { op: 'set-velocity', objectId: 'this', vx: 2, vy: 0 }],
      ['Reset.', undefined],
    ] as const) {
      const p = parseTyped(text, 'r');
      expect(p.ok, text).toBe(true);
      if (!p.ok) continue;
      if (op) expect(p.intent.ops[0]).toMatchObject(op);
      else expect(p.intent.lifecycle).toBe('reset');
    }
  });

  it('accepts separated numeric signs from speech without changing part IDs or accepting extra commands', () => {
    for (const [text, op] of [
      ['gravity - 4.9', { op: 'set-gravity', gy: -4.9 }],
      ['Move this - 2 + 3.', { op: 'set-pose', objectId: 'this', x: -2, y: 3 }],
      ['velocity this + .5 - 0.2', { op: 'set-velocity', objectId: 'this', vx: .5, vy: -.2 }],
      ['set this mass + 0.5', { op: 'set-property', value: { delta: .5 } }],
      ['move part- 2 3', { op: 'set-pose', objectId: 'part-', x: 2, y: 3 }],
      ['move - 2 3', { op: 'set-pose', objectId: '-', x: 2, y: 3 }],
    ] as const) {
      const parsed = parseTyped(text, 'r');
      expect(parsed.ok, text).toBe(true);
      if (parsed.ok) expect(parsed.intent.ops[0]).toMatchObject(op);
    }
    for (const text of ['gravity - NaN', 'gravity - Infinity', 'gravity -- 4.9', 'gravity - 4.9; reset', 'move - 2 3 4']) {
      expect(parseTyped(text, 'r').ok, text).toBe(false);
    }
  });

  it('accepts spoken "minus"/"negative" and the Unicode minus in value positions only (R16-1)', () => {
    for (const [text, op] of [
      ['gravity minus 4.9', { op: 'set-gravity', gy: -4.9 }],
      ['Gravity minus 4.9.', { op: 'set-gravity', gy: -4.9 }],
      ['gravity negative 4.9', { op: 'set-gravity', gy: -4.9 }],
      ['gravity −4.9', { op: 'set-gravity', gy: -4.9 }],
      ['gravity − 4.9', { op: 'set-gravity', gy: -4.9 }],
      ['velocity this 2 minus 1', { op: 'set-velocity', objectId: 'this', vx: 2, vy: -1 }],
      ['set this mass minus 0.5', { op: 'set-property', value: { delta: -.5 } }],
      ['move minus 2 3', { op: 'set-pose', objectId: 'minus', x: 2, y: 3 }],
    ] as const) {
      const parsed = parseTyped(text, 'r');
      expect(parsed.ok, text).toBe(true);
      if (parsed.ok) expect(parsed.intent.ops[0]).toMatchObject(op);
    }
    for (const text of ['gravity minus', 'gravity minus minus 4.9', 'gravity minus NaN', 'gravity −−4.9']) {
      expect(parseTyped(text, 'r').ok, text).toBe(false);
    }
  });

  it('rejects malformed commands with help', () => {
    for (const t of ['', 'set ball-1 colour red', 'move ball-1 3', 'fly away', 'set ball-1 mass abc']) {
      const p = parseTyped(t, 'r');
      expect(p.ok).toBe(false);
    }
  });

  it('unknown targets are reported by the resolver', () => {
    const p = parseTyped('set ghost mass 2', 'r');
    const r = p.ok ? resolveIntent(stateWith([ball('ball-1')], 1), p.intent, { origin: 'typed' }) : null;
    expect(r?.kind === 'error' && r.error.code).toBe('UNKNOWN_TARGET');
  });
});

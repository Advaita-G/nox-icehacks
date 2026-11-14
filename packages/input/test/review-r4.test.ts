/**
 * Regressions for Advaita's PR #4 review (R4-02, R4-04, R4-05, R4-06, R4-07).
 * Each case reproduces the reviewer's failing input; keep them in the normal suite.
 */
import { describe, expect, it } from 'vitest';
import { applyBatch } from '../src/commands/apply';
import { validateCommandIntent } from '../src/commands/intent';
import { resolveIntent } from '../src/commands/resolver';
import { validateInterpretation } from '../src/contract/interpretation';
import type { EditableState, SceneObject } from '../src/contract/types';
import { example } from './helpers';

const e01 = example('interpretation-f1-ready.json').result;

function domino(id: string, x: number): SceneObject {
  return { id, kind: 'domino', bodyType: 'dynamic', x, y: 1.25, angle: 0, dims: { width: 0.1, height: 0.5 }, mass: 1, friction: 0.3, restitution: 0.2, sourceRefs: [] };
}
function ball(id: string, extra: Partial<SceneObject> = {}): SceneObject {
  return { id, kind: 'ball', bodyType: 'dynamic', x: 2, y: 3, angle: 0, dims: { radius: 0.2 }, mass: 1, linearVelocity: { vx: 0, vy: 0 }, angularVelocity: 0, friction: 0.3, restitution: 0.2, sourceRefs: [], ...extra };
}
function stateWith(objects: SceneObject[], revision = 1): EditableState {
  return { scene: { schemaVersion: 1, revision, metersPerPx: 0.01, gravity: { gx: 0, gy: -9.81 }, objects }, relationships: [], assumptions: [] };
}

describe('R4-02: model command payloads are validated at the trust boundary', () => {
  const state = stateWith([ball('ball-1'), domino('dom-1', 4), domino('dom-2', 4.4)]);
  const base = { requestId: 'cmd-1', status: 'proposed', targets: ['ball-1'] };
  const malformed: [string, unknown][] = [
    ['JSON null', null],
    ['targets as object', { ...base, targets: {}, ops: [] }],
    ['null op', { ...base, ops: [null] }],
    ['set-dimensions with null dims', { ...base, ops: [{ op: 'set-dimensions', objectId: 'ball-1', dims: null }] }],
    ['space-evenly with null objectIds', { ...base, ops: [{ op: 'space-evenly', objectIds: null, spacing: { factor: 2 } }] }],
    ['unknown lifecycle', { ...base, ops: [], lifecycle: 'explode' }],
    ['question options not a list', { ...base, status: 'needs-clarification', ops: [], question: { id: 'q', kind: 'amount', prompt: 'How far?', options: 'a', allowManual: true } }],
    ['question option with bad intentOps', { ...base, status: 'needs-clarification', ops: [], question: { id: 'q', kind: 'amount', prompt: 'How far?', options: [{ id: 'a', label: 'x', intentOps: [null] }], allowManual: true } }],
    ['unknown question kind', { ...base, status: 'needs-clarification', ops: [], question: { id: 'q', kind: 'guess', prompt: '?', options: [], allowManual: true } }],
    ['factor that is a string', { ...base, ops: [{ op: 'set-property', objectId: 'ball-1', property: 'mass', value: { factor: '2' } }] }],
    ['number spec with two keys', { ...base, ops: [{ op: 'set-property', objectId: 'ball-1', property: 'mass', value: { factor: 2, delta: 1 } }] }],
    ['unknown property', { ...base, ops: [{ op: 'set-property', objectId: 'ball-1', property: 'colour', value: 2 }] }],
    ['status missing', { requestId: 'x', targets: [], ops: [] }],
  ];
  for (const [name, payload] of malformed) {
    it(`rejects ${name} with a structured error and no exception`, () => {
      const v = validateCommandIntent(payload);
      expect(v.ok).toBe(false);
      // resolveIntent must also never throw on unknown data.
      const before = structuredClone(state);
      expect(() => resolveIntent(state, payload, { origin: 'voice' })).not.toThrow();
      const r = resolveIntent(state, payload, { origin: 'voice' });
      expect(r.kind).toBe('error');
      expect(state).toEqual(before);
    });
  }

  it('accepts the documented E-04/E-05 intents', () => {
    expect(validateCommandIntent(example('command-heavier-ball.json').intent).ok).toBe(true);
    expect(validateCommandIntent(example('command-dominoes-apart.json').intent).ok).toBe(true);
  });
});

describe('R4-04: blocking questions are queued, never dropped', () => {
  const q = (n: number) => ({ id: `q${n}`, kind: 'confirm-scale', prompt: `Scale ${n}?`, targetRefs: { objectIds: [], relationshipIds: [], sourceRefs: [] }, options: [{ id: 'a', label: 'Keep', ops: [] }], allowManual: true });
  it('keeps all four valid questions', () => {
    const d = structuredClone(e01);
    d.questions = [1, 2, 3, 4].map(q);
    const out = validateInterpretation(d);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.questions.map((x) => x.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
      expect(out.result.status).toBe('needs-clarification');
    }
  });
  it('rejects an unbounded number of questions as a whole instead of truncating', () => {
    const d = structuredClone(e01);
    d.questions = Array.from({ length: 11 }, (_, i) => q(i));
    expect(validateInterpretation(d)).toMatchObject({ ok: false, path: 'questions' });
  });
});

describe('R4-05: angular velocity is a finite, bounded number', () => {
  it('repairs a non-numeric angular velocity in model output with a warning', () => {
    const d = structuredClone(e01);
    d.scene.objects[2].angularVelocity = 'not-a-number';
    const out = validateInterpretation(d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.scene?.objects[2]?.angularVelocity).toBe(0);
    expect(out.repairs).toContainEqual({ path: 'objects.ball-1.angularVelocity', from: 'not-a-number', to: 0 });
    expect(out.result.warnings.join(' ')).toMatch(/angular velocity/i);
  });
  it('rejects add-object with a bad or excessive angular velocity', () => {
    const s = stateWith([]);
    for (const omega of ['not-a-number', Number.POSITIVE_INFINITY, 1e6] as unknown[]) {
      const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'add-object', object: ball('b2', { angularVelocity: omega as number }) }], summary: [] });
      expect(r.ok).toBe(false);
    }
    expect(applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'add-object', object: ball('b2', { angularVelocity: 3 }) }], summary: [] }).ok).toBe(true);
  });
});

describe('R4-06: group spacing uses geometric endpoints, not input order', () => {
  for (const order of [
    ['dom-2', 'dom-1', 'dom-3'],
    ['dom-3', 'dom-2', 'dom-1'],
    ['dom-1', 'dom-3', 'dom-2'],
  ]) {
    it(`factor 1.5 grows 0.4 m gaps to 0.6 m for order ${order.join(',')}`, () => {
      const s = stateWith([domino('dom-1', 4.0), domino('dom-2', 4.4), domino('dom-3', 4.8)]);
      const r = resolveIntent(s, { requestId: 'c', status: 'proposed', targets: order, ops: [{ op: 'space-evenly', objectIds: order, spacing: { factor: 1.5 } }] }, { origin: 'voice' });
      expect(r.kind).toBe('batch');
      if (r.kind !== 'batch') return;
      const applied = applyBatch(s, r.batch);
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;
      const xs = Object.fromEntries(applied.state.scene.objects.map((o) => [o.id, o.x]));
      expect(xs['dom-1']).toBeCloseTo(4.0);
      expect(xs['dom-2']).toBeCloseTo(4.6);
      expect(xs['dom-3']).toBeCloseTo(5.2);
    });
  }
});

describe('R4-07: velocity relationships and the executable velocity agree', () => {
  const rel = (value: { vx: number; vy: number }) => ({ id: 'rel-v', kind: 'velocity-of' as const, subjectId: 'ball-1', value, origin: 'user' as const, status: 'confirmed' as const, sourceRefs: [] });

  it('adding a velocity-of relationship sets the object velocity in the same batch', () => {
    const s = stateWith([ball('ball-1')]);
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'clarification', ops: [{ op: 'add-relationship', relationship: rel({ vx: 2, vy: 0 }) }], summary: [] });
    expect(r.ok && r.state.scene.objects[0]?.linearVelocity).toEqual({ vx: 2, vy: 0 });
  });

  it('updating the relationship value updates the object', () => {
    const s = stateWith([ball('ball-1', { linearVelocity: { vx: 2, vy: 0 } })]);
    s.relationships.push(rel({ vx: 2, vy: 0 }));
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'update-relationship', id: 'rel-v', changes: { value: { vx: -1, vy: 1 } } }], summary: [] });
    expect(r.ok && r.state.scene.objects[0]?.linearVelocity).toEqual({ vx: -1, vy: 1 });
  });

  it('a direct velocity edit updates the relationship value (single source of truth)', () => {
    const s = stateWith([ball('ball-1', { linearVelocity: { vx: 2, vy: 0 } })]);
    s.relationships.push(rel({ vx: 2, vy: 0 }));
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'set-velocity', objectId: 'ball-1', vx: 3, vy: 0 }], summary: [] });
    expect(r.ok && r.state.relationships[0]?.value).toEqual({ vx: 3, vy: 0 });
  });

  it('removing the arrow relationship resets the velocity it set', () => {
    const s = stateWith([ball('ball-1', { linearVelocity: { vx: 2, vy: 0 } })]);
    s.relationships.push(rel({ vx: 2, vy: 0 }));
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'remove-relationship', id: 'rel-v' }], summary: [] });
    expect(r.ok && r.state.scene.objects[0]?.linearVelocity).toEqual({ vx: 0, vy: 0 });
  });

  it('an invalid velocity relationship changes nothing', () => {
    const s = stateWith([ball('ball-1')]);
    const before = structuredClone(s);
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'add-relationship', relationship: rel({ vx: 999, vy: 0 }) }], summary: [] });
    expect(r.ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('a velocity-of relationship on a fixed object is rejected', () => {
    const s = stateWith([{ ...domino('p', 2), id: 'ball-1', kind: 'platform', bodyType: 'fixed' }]);
    const r = applyBatch(s, { batchId: 'b', baseSceneRevision: 1, origin: 'direct', ops: [{ op: 'add-relationship', relationship: rel({ vx: 1, vy: 0 }) }], summary: [] });
    expect(r.ok).toBe(false);
  });

  it('model output whose arrow value contradicts the object velocity is rejected', () => {
    const d = structuredClone(e01);
    d.relationships.push({ id: 'rel-v', kind: 'velocity-of', subjectId: 'ball-1', value: { vx: 2, vy: 0 }, origin: 'model', status: 'proposed', sourceRefs: [] });
    expect(validateInterpretation(d)).toMatchObject({ ok: false });
  });

  it('the resolved summary shows the velocity change a relationship edit causes', () => {
    const s = stateWith([ball('ball-1')]);
    const r = resolveIntent(s, { requestId: 'c', status: 'proposed', targets: ['ball-1'], ops: [{ op: 'set-velocity', objectId: 'ball-1', vx: 2 }] }, { origin: 'voice' });
    expect(r.kind === 'batch' && r.batch.summary).toEqual(['ball-1 vx: 0.0 → 2.0 m/s']);
  });
});

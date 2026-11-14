import { describe, expect, it } from 'vitest';
import { applyBatch } from '../src/commands/apply';
import { parseInterpretation, toEditableState, validateInterpretation } from '../src/contract/interpretation';
import { example } from './helpers';

const e01 = example('interpretation-f1-ready.json').result;
const e02 = example('interpretation-f5-clarification.json').result;
const e03 = example('interpretation-rejections.json').cases as any[];

describe('E-01 ready interpretation', () => {
  it('is accepted unchanged with every object, relationship and default visible', () => {
    const out = parseInterpretation(JSON.stringify(e01), { requestId: 'req-7f3a', sourceId: 'src-1', sourceRevision: 14, strokeIds: new Set(['s1', 's2', 's3', 's4', 's5']) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.status).toBe('ready');
    expect(out.result.scene?.objects.map((o) => o.id)).toEqual(['floor-1', 'ramp-1', 'ball-1', 'cup-1']);
    expect(out.result.relationships).toHaveLength(3);
    expect(out.repairs).toEqual([]);
    const paths = out.result.assumptions.map((a) => a.path);
    expect(paths).toContain('scene.metersPerPx');
    expect(paths).toContain('objects.ball-1.mass');
  });

  it('rejects a response for a different request or sketch revision (R-06)', () => {
    expect(parseInterpretation(JSON.stringify(e01), { requestId: 'req-other' })).toMatchObject({ ok: false, path: 'requestId' });
    expect(parseInterpretation(JSON.stringify(e01), { sourceRevision: 15 })).toMatchObject({ ok: false, path: 'sourceRevision' });
  });

  it('rejects references to strokes that do not exist', () => {
    const out = parseInterpretation(JSON.stringify(e01), { strokeIds: new Set(['s1']) });
    expect(out.ok).toBe(false);
  });

  it('rejects a source reference to another source', () => {
    const bad = structuredClone(e01);
    bad.scene.objects[0].sourceRefs[0].sourceId = 'src-9';
    expect(validateInterpretation(bad).ok).toBe(false);
  });

  it('rejects duplicate object ids', () => {
    const bad = structuredClone(e01);
    bad.scene.objects[1].id = 'floor-1';
    expect(validateInterpretation(bad)).toMatchObject({ ok: false, path: 'scene.objects[1].id' });
  });

  it('turns "ready" with questions into needs-clarification', () => {
    const d = structuredClone(e01);
    d.questions = structuredClone(e02.questions).map((q: any) => ({ ...q, targetRefs: { ...q.targetRefs, objectIds: ['ball-1'], sourceRefs: [] } }));
    // options in e02 refer to platform-1; replace with harmless no-op options
    d.questions.forEach((q: any) => (q.options = [{ id: 'o', label: 'ok', ops: [] }]));
    const out = validateInterpretation(d);
    expect(out.ok && out.result.status).toBe('needs-clarification');
  });

  it('keeps every blocking question in order (replaces the old truncation behaviour, R4-04)', () => {
    const d = structuredClone(e01);
    d.questions = [1, 2, 3, 4].map((n) => ({ id: `q${n}`, kind: 'confirm-contact', prompt: 'Touching?', targetRefs: { objectIds: ['ball-1'], relationshipIds: [], sourceRefs: [] }, options: [{ id: 'a', label: 'Yes', ops: [] }], allowManual: true }));
    const out = validateInterpretation(d);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('rejects needs-clarification without a question', () => {
    const d = { ...structuredClone(e01), status: 'needs-clarification' };
    expect(validateInterpretation(d)).toMatchObject({ ok: false, path: 'questions' });
  });
});

describe('E-02 clarification', () => {
  it('is accepted with two blocking questions, and an answer applies as one batch', () => {
    const out = validateInterpretation(e02, { sourceId: 'src-2' });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.status).toBe('needs-clarification');
    expect(out.result.questions.map((q) => q.kind)).toEqual(['confirm-contact', 'choose-arrow-target']);
    const state = toEditableState(out.result)!;
    const option = out.result.questions[0]!.options[0]!;
    const applied = applyBatch(state, { batchId: 'b1', baseSceneRevision: 1, origin: 'clarification', ops: option.ops, summary: [] });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.state.scene.revision).toBe(2);
      expect(applied.state.relationships.map((r) => r.kind)).toEqual(['rests-on']);
    }
    const arrow = out.result.questions[1]!.options[0]!;
    const applied2 = applyBatch(state, { batchId: 'b2', baseSceneRevision: 1, origin: 'clarification', ops: arrow.ops, summary: [] });
    expect(applied2.ok && applied2.state.scene.objects[0]!.linearVelocity).toEqual({ vx: 2, vy: 0 });
  });

  it('rejects a question whose option is not a valid change', () => {
    const bad = structuredClone(e02);
    bad.questions[0].options[0].ops[0].relationship.targetId = 'ghost';
    expect(validateInterpretation(bad).ok).toBe(false);
  });

  it('rejects unknown question kinds', () => {
    const bad = structuredClone(e02);
    bad.questions[0].kind = 'guess-anything';
    expect(validateInterpretation(bad)).toMatchObject({ ok: false, path: 'questions[0].kind' });
  });
});

describe('E-03 rejected and repaired model output', () => {
  const byId = (id: string) => e03.find((c) => c.id === id);

  it('E-03a: unreadable text is rejected as a whole', () => {
    const c = byId('E-03a');
    const out = parseInterpretation(c.modelOutputRaw);
    expect(out).toMatchObject({ ok: false, code: c.expected.code });
    if (!out.ok) expect(out.message).toBe('Interpretation failed: the model returned an unreadable result.');
  });

  it('E-03b: unknown object kind is rejected, not substituted', () => {
    const c = byId('E-03b');
    expect(validateInterpretation(c.modelOutput)).toMatchObject({ ok: false, code: 'MODEL_OUTPUT_INVALID', path: c.expected.path });
  });

  it('E-03c: one invalid mass is repaired with an assumption and a warning', () => {
    const c = byId('E-03c');
    const out = validateInterpretation(c.modelOutput);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.repairs).toEqual(c.expected.repaired);
    expect(out.result.scene?.objects[0]?.mass).toBe(1);
    expect(out.result.assumptions).toContainEqual(expect.objectContaining(c.expected.addedAssumption));
    expect(out.result.warnings).toContain(c.expected.warning);
  });

  it('E-03d: a dangling relationship reference rejects the whole response', () => {
    const c = byId('E-03d');
    expect(validateInterpretation(c.modelOutput)).toMatchObject({ ok: false, path: c.expected.path });
  });
});

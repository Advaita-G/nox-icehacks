/**
 * Deterministic intent → absolute batch resolver (R-04).
 * The model never does arithmetic on scene values; this module does.
 * Untrusted intents are runtime-validated first (R4-02). The summary shown to the user is the
 * diff between the current state and the dry-run result, so it always matches the scene that
 * Apply would produce (R4-07).
 */
import { UNITS } from '../contract/geometry';
import type {
  CommandBatch,
  CommandError,
  CommandQuestion,
  EditableState,
  IntentNumber,
  IntentOp,
  LifecycleCommand,
  Relationship,
  SceneObject,
  SceneOp,
} from '../contract/types';
import { applyBatch } from './apply';
import { validateCommandIntent } from './intent';

export type Resolution =
  | { kind: 'batch'; batch: CommandBatch }
  | { kind: 'lifecycle'; command: LifecycleCommand }
  | { kind: 'question'; question: CommandQuestion }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'error'; error: CommandError };

export interface ResolveOptions {
  origin: CommandBatch['origin'];
  batchId?: string;
  baseSceneRevision?: number;
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

export function formatNumber(v: number): string {
  const r = round(v);
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}

function resolveNumber(spec: IntentNumber | undefined, current: number, path: string): number | CommandError | undefined {
  if (spec === undefined) return undefined;
  if (typeof spec === 'number') return spec;
  if ('absolute' in spec) return spec.absolute;
  if (!Number.isFinite(current)) return { code: 'SCHEMA', path, message: `${path} has no current value to change.` };
  if ('factor' in spec) return round(current * spec.factor);
  return round(current + spec.delta);
}

const isErr = (v: unknown): v is CommandError => typeof v === 'object' && v !== null && 'code' in v;

function newBatchId(): string {
  return `b-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

/* ---------------- summary = actual diff ---------------- */

function line(who: string, field: string, from: unknown, to: unknown, unitKey = field): string {
  const u = UNITS[unitKey] ?? '';
  const f = (v: unknown) => (typeof v === 'number' ? formatNumber(v) : v === undefined ? '—' : String(v));
  return `${who} ${field}: ${f(from)} → ${f(to)}${u ? ` ${u}` : ''}`;
}

const differs = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? round(a) !== round(b) : JSON.stringify(a) !== JSON.stringify(b);

function relText(r: Relationship): string {
  return r.kind === 'velocity-of' ? `${r.subjectId} velocity-of (${formatNumber(r.value?.vx ?? 0)}, ${formatNumber(r.value?.vy ?? 0)}) m/s` : `${r.subjectId} ${r.kind} ${r.targetId}`;
}

/** Human-readable list of every change from `before` to `after`. */
export function diffSummary(before: EditableState, after: EditableState): string[] {
  const out: string[] = [];
  const prev = new Map(before.scene.objects.map((o) => [o.id, o]));
  const next = new Map(after.scene.objects.map((o) => [o.id, o]));
  for (const o of before.scene.objects) if (!next.has(o.id)) out.push(`remove ${o.kind} ${o.id}`);
  for (const o of after.scene.objects) {
    const p = prev.get(o.id);
    if (!p) {
      out.push(`add ${o.kind} ${o.id}`);
      continue;
    }
    for (const k of ['x', 'y', 'angle'] as const) if (differs(p[k], o[k])) out.push(line(o.id, k, p[k], o[k]));
    const dimKeys = new Set([...Object.keys(p.dims), ...Object.keys(o.dims)]);
    for (const k of dimKeys) if (differs(p.dims[k], o.dims[k])) out.push(line(o.id, k, p.dims[k], o.dims[k]));
    if (p.bodyType !== o.bodyType) out.push(line(o.id, 'body type', p.bodyType, o.bodyType, ''));
    if (differs(p.mass, o.mass)) out.push(line(o.id, 'mass', p.mass, o.mass));
    const pv = p.linearVelocity ?? { vx: 0, vy: 0 };
    const ov = o.linearVelocity ?? { vx: 0, vy: 0 };
    if (differs(pv.vx, ov.vx)) out.push(line(o.id, 'vx', pv.vx, ov.vx));
    if (differs(pv.vy, ov.vy)) out.push(line(o.id, 'vy', pv.vy, ov.vy));
    if (differs(p.angularVelocity ?? 0, o.angularVelocity ?? 0)) out.push(line(o.id, 'omega', p.angularVelocity ?? 0, o.angularVelocity ?? 0));
    if (differs(p.friction, o.friction)) out.push(line(o.id, 'friction', p.friction, o.friction));
    if (differs(p.restitution, o.restitution)) out.push(line(o.id, 'restitution', p.restitution, o.restitution));
  }
  const prevRel = new Map(before.relationships.map((r) => [r.id, r]));
  const nextRel = new Map(after.relationships.map((r) => [r.id, r]));
  for (const r of before.relationships) if (!nextRel.has(r.id)) out.push(`remove relationship: ${relText(r)}`);
  for (const r of after.relationships) {
    const p = prevRel.get(r.id);
    if (!p) out.push(`add relationship: ${relText(r)}`);
    else if (differs(p, r)) out.push(`change relationship: ${relText(p)} → ${relText(r)}`);
  }
  const g0 = before.scene.gravity;
  const g1 = after.scene.gravity;
  if (differs(g0.gx, g1.gx) || differs(g0.gy, g1.gy)) out.push(line('scene', 'gravity', `(${formatNumber(g0.gx)}, ${formatNumber(g0.gy)})`, `(${formatNumber(g1.gx)}, ${formatNumber(g1.gy)})`, 'gy'));
  if (differs(before.scene.metersPerPx, after.scene.metersPerPx)) out.push(line('scene', 'scale', before.scene.metersPerPx, after.scene.metersPerPx, 'metersPerPx'));
  return out;
}

/* ---------------- op resolution ---------------- */

/** Row direction from the two objects farthest apart, oriented left→right (then bottom→top). */
function rowAxis(list: SceneObject[]): { ux: number; uy: number; span: number } | null {
  let best: { a: SceneObject; b: SceneObject; d: number } | null = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i] as SceneObject;
      const b = list[j] as SceneObject;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || d > best.d) best = { a, b, d };
    }
  }
  if (!best || best.d === 0) return null;
  let ux = (best.b.x - best.a.x) / best.d;
  let uy = (best.b.y - best.a.y) / best.d;
  if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) {
    ux = -ux;
    uy = -uy;
  }
  return { ux, uy, span: best.d };
}

function resolveSpaceEvenly(state: EditableState, op: Extract<IntentOp, { op: 'space-evenly' }>): SceneOp[] | CommandError {
  const objs = op.objectIds.map((id) => state.scene.objects.find((o) => o.id === id));
  const missing = op.objectIds.find((_, i) => !objs[i]);
  if (missing) return { code: 'UNKNOWN_TARGET', path: 'objectIds', message: `No object "${missing}" in this scene.` };
  const list = objs as SceneObject[];
  const axis = rowAxis(list);
  if (!axis) return { code: 'AMBIGUOUS_TARGET', path: 'objectIds', message: 'These objects are on top of each other; the row direction is unclear.' };
  const { ux, uy, span } = axis;
  // Order geometrically along the row; the anchor is the first object along it (left, or bottom).
  const proj = (o: SceneObject) => o.x * ux + o.y * uy;
  const sorted = [...list].sort((a, b) => proj(a) - proj(b));
  const anchor = sorted[0] as SceneObject;
  const currentSpacing = span / (sorted.length - 1);
  const spacing = resolveNumber(op.spacing, currentSpacing, 'spacing');
  if (spacing === undefined || isErr(spacing)) return spacing ?? { code: 'SCHEMA', path: 'spacing', message: 'spacing is required.' };
  if (!(spacing > 0)) return { code: 'OUT_OF_RANGE', path: 'spacing', message: 'Spacing must be positive.' };
  const out: SceneOp[] = [];
  sorted.forEach((o, i) => {
    const x = round(anchor.x + ux * spacing * i);
    const y = round(anchor.y + uy * spacing * i);
    if (round(o.x) !== x || round(o.y) !== y) out.push({ op: 'set-pose', objectId: o.id, x, y, angle: o.angle });
  });
  return out;
}

function resolveOp(state: EditableState, op: IntentOp): SceneOp[] | CommandError {
  const needObj = (id: string): SceneObject | CommandError =>
    state.scene.objects.find((o) => o.id === id) ?? { code: 'UNKNOWN_TARGET', path: 'objectId', message: `No object "${id}" in this scene.` };
  switch (op.op) {
    case 'set-property': {
      const o = needObj(op.objectId);
      if (isErr(o)) return o;
      const current = o[op.property];
      const v = resolveNumber(op.value, typeof current === 'number' ? current : NaN, 'value');
      if (v === undefined || isErr(v)) return v ?? { code: 'SCHEMA', path: 'value', message: 'value is required.' };
      return [{ op: 'set-property', objectId: o.id, property: op.property, value: v }];
    }
    case 'set-pose': {
      const o = needObj(op.objectId);
      if (isErr(o)) return o;
      const x = resolveNumber(op.x, o.x, 'x') ?? o.x;
      const y = resolveNumber(op.y, o.y, 'y') ?? o.y;
      const angle = resolveNumber(op.angle, o.angle, 'angle') ?? o.angle;
      for (const v of [x, y, angle]) if (isErr(v)) return v;
      return [{ op: 'set-pose', objectId: o.id, x: x as number, y: y as number, angle: angle as number }];
    }
    case 'set-dimensions': {
      const o = needObj(op.objectId);
      if (isErr(o)) return o;
      const dims: Record<string, number | string> = {};
      for (const [k, spec] of Object.entries(op.dims)) {
        if (typeof spec === 'string') {
          dims[k] = spec;
          continue;
        }
        const cur = o.dims[k];
        const v = resolveNumber(spec, typeof cur === 'number' ? cur : NaN, `dims.${k}`);
        if (v === undefined || isErr(v)) return v ?? { code: 'SCHEMA', path: `dims.${k}`, message: 'value required' };
        dims[k] = v;
      }
      return [{ op: 'set-dimensions', objectId: o.id, dims }];
    }
    case 'set-velocity': {
      const o = needObj(op.objectId);
      if (isErr(o)) return o;
      const lv = o.linearVelocity ?? { vx: 0, vy: 0 };
      const vx = resolveNumber(op.vx, lv.vx, 'vx') ?? lv.vx;
      const vy = resolveNumber(op.vy, lv.vy, 'vy') ?? lv.vy;
      const omega = resolveNumber(op.omega, o.angularVelocity ?? 0, 'omega');
      for (const v of [vx, vy, omega]) if (isErr(v)) return v;
      const out: SceneOp = { op: 'set-velocity', objectId: o.id, vx: vx as number, vy: vy as number };
      if (omega !== undefined) out.omega = omega as number;
      return [out];
    }
    case 'set-gravity': {
      const g = state.scene.gravity;
      const gx = resolveNumber(op.gx, g.gx, 'gx') ?? g.gx;
      const gy = resolveNumber(op.gy, g.gy, 'gy') ?? g.gy;
      for (const v of [gx, gy]) if (isErr(v)) return v;
      return [{ op: 'set-gravity', gx: gx as number, gy: gy as number }];
    }
    case 'set-scale': {
      const v = resolveNumber(op.metersPerPx, state.scene.metersPerPx, 'metersPerPx');
      if (v === undefined || isErr(v)) return v ?? { code: 'SCHEMA', path: 'metersPerPx', message: 'value required' };
      return [{ op: 'set-scale', metersPerPx: v }];
    }
    case 'space-evenly':
      return resolveSpaceEvenly(state, op);
    case 'set-body-type':
    case 'remove-object':
    case 'add-object':
      return [op];
  }
}

/**
 * Resolve an untrusted intent against the current state. Never throws and never mutates `state`.
 * A returned batch has already passed a dry-run of the atomic validator.
 */
export function resolveIntent(state: EditableState, raw: unknown, opts: ResolveOptions): Resolution {
  const v = validateCommandIntent(raw);
  if (!v.ok) return { kind: 'error', error: { ...v.error, message: `The command result was not usable: ${v.error.message}` } };
  const intent = v.intent;
  if (intent.status === 'unsupported') return { kind: 'unsupported', reason: intent.reason || 'That change is outside supported mechanics.' };
  if (intent.status === 'needs-clarification') return { kind: 'question', question: intent.question as CommandQuestion };
  if (intent.lifecycle) {
    if (intent.ops.length) return { kind: 'error', error: { code: 'SCHEMA', message: 'A command cannot mix run controls and scene edits.' } };
    return { kind: 'lifecycle', command: { kind: intent.lifecycle, origin: opts.origin } };
  }
  if (intent.ops.length === 0) return { kind: 'error', error: { code: 'AMBIGUOUS_TARGET', message: 'No change was understood. Rephrase or edit directly.' } };
  const unknownTarget = intent.targets.find((id) => !state.scene.objects.some((o) => o.id === id));
  if (unknownTarget) return { kind: 'error', error: { code: 'UNKNOWN_TARGET', path: 'targets', message: `No object "${unknownTarget}" in this scene.` } };
  const ops: SceneOp[] = [];
  for (let i = 0; i < intent.ops.length; i++) {
    const r = resolveOp(state, intent.ops[i] as IntentOp);
    if (isErr(r)) return { kind: 'error', error: { ...r, opIndex: i } };
    ops.push(...r);
  }
  if (ops.length === 0) return { kind: 'error', error: { code: 'SCHEMA', message: 'That would not change anything.' } };
  const batch: CommandBatch = {
    batchId: opts.batchId ?? newBatchId(),
    requestId: intent.requestId,
    baseSceneRevision: opts.baseSceneRevision ?? state.scene.revision,
    origin: opts.origin,
    ops,
    summary: [],
  };
  const dry = applyBatch(state, batch);
  if (!dry.ok) return { kind: 'error', error: dry.error };
  batch.summary = diffSummary(state, dry.state);
  if (batch.summary.length === 0) return { kind: 'error', error: { code: 'SCHEMA', message: 'That would not change anything.' } };
  return { kind: 'batch', batch };
}

/** Whether an origin needs explicit Apply before changing the scene (R-04 confirmation rule). */
export function needsConfirmation(origin: CommandBatch['origin']): boolean {
  return origin === 'voice' || origin === 'typed';
}

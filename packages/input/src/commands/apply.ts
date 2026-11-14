/**
 * Atomic command-batch validation and application (R-04).
 * All ops are checked against the evolving copy; any failure applies nothing.
 * Physical ranges come from the placeholder geometry adapter.
 */
import { DEFAULTS, LIMITS, checkNumber, checkShape, inRange, nonFiniteOrSchema } from '../contract/geometry';
import {
  OBJECT_KINDS,
  RELATIONSHIP_KINDS,
  SCENE_OP_NAMES,
  type Assumption,
  type CommandBatch,
  type CommandError,
  type EditableState,
  type Relationship,
  type SceneObject,
  type SceneOp,
} from '../contract/types';

export type ApplyResult = { ok: true; state: EditableState } | { ok: false; error: CommandError };

export function clone<T>(v: T): T {
  return structuredClone(v);
}

function err(code: CommandError['code'], message: string, opIndex?: number, path?: string): CommandError {
  const e: CommandError = { code, message };
  if (opIndex !== undefined) e.opIndex = opIndex;
  if (path !== undefined) e.path = path;
  return e;
}

function findObject(state: EditableState, id: unknown): SceneObject | undefined {
  return typeof id === 'string' ? state.scene.objects.find((o) => o.id === id) : undefined;
}

function setAssumptionFromUser(state: EditableState, path: string, value: unknown, unit: string): void {
  const existing = state.assumptions.find((a) => a.path === path);
  if (existing) {
    existing.value = value;
    existing.origin = 'user';
    return;
  }
  const a: Assumption = { id: `as-user-${path}`, path, value, unit, origin: 'user' };
  state.assumptions.push(a);
}

const PROPERTY_RANGES = {
  mass: [LIMITS.mass, 'kg'],
  friction: [LIMITS.friction, ''],
  restitution: [LIMITS.restitution, ''],
} as const;

export function validateRelationship(rel: Relationship, state: EditableState, path: string): CommandError | null {
  if (typeof rel !== 'object' || rel === null) return err('SCHEMA', 'Relationship must be an object.', undefined, path);
  if (typeof rel.id !== 'string' || !rel.id) return err('SCHEMA', 'Relationship needs an id.', undefined, `${path}.id`);
  if (!RELATIONSHIP_KINDS.includes(rel.kind)) {
    return err('SCHEMA', `Unknown relationship kind "${String(rel.kind)}".`, undefined, `${path}.kind`);
  }
  if (!findObject(state, rel.subjectId)) {
    return err('UNKNOWN_TARGET', `Relationship refers to unknown object "${String(rel.subjectId)}".`, undefined, `${path}.subjectId`);
  }
  if (rel.kind === 'rests-on' || rel.kind === 'inside') {
    const target = findObject(state, rel.targetId);
    if (!target) {
      return err('UNKNOWN_TARGET', `Relationship refers to unknown object "${String(rel.targetId)}".`, undefined, `${path}.targetId`);
    }
    if (rel.targetId === rel.subjectId) return err('SCHEMA', 'An object cannot rest on or be inside itself.', undefined, path);
    if (rel.kind === 'inside' && target.kind !== 'container') {
      return err('SCHEMA', '"inside" needs a container as its target.', undefined, `${path}.targetId`);
    }
  }
  if (rel.kind === 'velocity-of') {
    if (findObject(state, rel.subjectId)?.bodyType !== 'dynamic') {
      return err('SCHEMA', 'Only a moving (dynamic) object can have a starting velocity.', undefined, `${path}.subjectId`);
    }
    const v = rel.value;
    if (!v || typeof v !== 'object') return err('SCHEMA', 'velocity-of needs value {vx, vy}.', undefined, `${path}.value`);
    for (const k of ['vx', 'vy'] as const) {
      if (typeof v[k] !== 'number' || !Number.isFinite(v[k])) {
        return err(nonFiniteOrSchema(v[k]), `${k} must be a finite number (m/s).`, undefined, `${path}.value.${k}`);
      }
    }
    if (!inRange(Math.hypot(v.vx, v.vy), LIMITS.speed)) {
      return err('OUT_OF_RANGE', `Speed must be at most ${LIMITS.speed[1]} m/s.`, undefined, `${path}.value`);
    }
  }
  return null;
}

export function validateObject(obj: SceneObject, path: string): CommandError | null {
  if (typeof obj !== 'object' || obj === null) return err('SCHEMA', 'Object must be an object.', undefined, path);
  if (typeof obj.id !== 'string' || !obj.id) return err('SCHEMA', 'Object needs an id.', undefined, `${path}.id`);
  if (!OBJECT_KINDS.includes(obj.kind)) return err('SCHEMA', `Unknown object kind "${String(obj.kind)}".`, undefined, `${path}.kind`);
  if (obj.bodyType !== 'fixed' && obj.bodyType !== 'dynamic') {
    return err('SCHEMA', 'bodyType must be "fixed" or "dynamic".', undefined, `${path}.bodyType`);
  }
  const shape = checkShape(obj)[0];
  if (shape) return err(shape.code, shape.message, undefined, `${path}.${shape.path}`);
  for (const p of ['friction', 'restitution'] as const) {
    const issue = checkNumber(obj[p], p, PROPERTY_RANGES[p][0], '');
    if (issue) return err(issue.code, issue.message, undefined, `${path}.${p}`);
  }
  if (obj.bodyType === 'dynamic') {
    const issue = checkNumber(obj.mass, 'mass', LIMITS.mass, 'kg');
    if (issue) return err(issue.code, issue.message, undefined, `${path}.mass`);
  }
  if (obj.linearVelocity !== undefined) {
    const { vx, vy } = obj.linearVelocity;
    for (const [k, v] of [
      ['vx', vx],
      ['vy', vy],
    ] as const) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        return err(nonFiniteOrSchema(v), `${k} must be finite.`, undefined, `${path}.linearVelocity.${k}`);
      }
    }
    if (!inRange(Math.hypot(vx, vy), LIMITS.speed)) return err('OUT_OF_RANGE', `Speed must be at most ${LIMITS.speed[1]} m/s.`, undefined, `${path}.linearVelocity`);
  }
  if (obj.angularVelocity !== undefined) {
    const w: unknown = obj.angularVelocity;
    if (typeof w !== 'number' || !Number.isFinite(w)) {
      return err(nonFiniteOrSchema(w), 'Angular velocity must be a finite number (rad/s).', undefined, `${path}.angularVelocity`);
    }
    if (!inRange(Math.abs(w), LIMITS.angularSpeed)) {
      return err('OUT_OF_RANGE', `Angular speed must be at most ${LIMITS.angularSpeed[1]} rad/s.`, undefined, `${path}.angularVelocity`);
    }
  }
  if (!Array.isArray(obj.sourceRefs)) return err('SCHEMA', 'sourceRefs must be a list.', undefined, `${path}.sourceRefs`);
  return null;
}

/** Validate and apply one op to `state` in place. Returns an error or null. */
function applyOp(state: EditableState, op: SceneOp, i: number): CommandError | null {
  if (typeof op !== 'object' || op === null || !SCENE_OP_NAMES.includes((op as SceneOp).op)) {
    return err('UNKNOWN_OP', `Unknown operation "${String((op as { op?: unknown })?.op)}".`, i);
  }
  const scene = state.scene;
  const need = (id: unknown): SceneObject | CommandError => {
    const o = findObject(state, id);
    return o ?? err('UNKNOWN_TARGET', `No object "${String(id)}" in this scene.`, i, 'objectId');
  };
  const num = (v: unknown, path: string, range: readonly [number, number], unit: string): CommandError | null => {
    const issue = checkNumber(v, path, range, unit);
    return issue ? err(issue.code, issue.message, i, path) : null;
  };

  switch (op.op) {
    case 'add-object': {
      const e = validateObject(op.object, 'object');
      if (e) return { ...e, opIndex: i };
      if (findObject(state, op.object.id)) return err('SCHEMA', `Object id "${op.object.id}" already exists.`, i, 'object.id');
      if (scene.objects.length >= LIMITS.maxObjects) return err('OUT_OF_RANGE', `At most ${LIMITS.maxObjects} objects.`, i);
      scene.objects.push(clone(op.object));
      return null;
    }
    case 'remove-object': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      scene.objects = scene.objects.filter((x) => x.id !== o.id);
      state.relationships = state.relationships.filter((r) => r.subjectId !== o.id && r.targetId !== o.id);
      return null;
    }
    case 'set-pose': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      const e =
        num(op.x, 'x', LIMITS.position, 'm') ??
        num(op.y, 'y', LIMITS.position, 'm') ??
        (typeof op.angle === 'number' && Number.isFinite(op.angle) ? null : err(nonFiniteOrSchema(op.angle), 'angle must be finite (rad).', i, 'angle'));
      if (e) return e;
      o.x = op.x;
      o.y = op.y;
      o.angle = op.angle;
      return null;
    }
    case 'set-dimensions': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      if (typeof op.dims !== 'object' || op.dims === null) return err('SCHEMA', 'dims must be an object.', i, 'dims');
      const next = { ...o, dims: { ...o.dims, ...op.dims } };
      const issue = checkShape(next)[0];
      if (issue) return err(issue.code, issue.message, i, issue.path);
      o.dims = next.dims; // entered mass is kept (Execution policies)
      return null;
    }
    case 'set-property': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      const spec = PROPERTY_RANGES[op.property];
      if (!spec) return err('SCHEMA', `Property "${String(op.property)}" cannot be set.`, i, 'property');
      if (op.property === 'mass' && o.bodyType === 'fixed') return err('SCHEMA', 'Fixed objects have no mass to edit.', i, 'property');
      const e = num(op.value, 'value', spec[0], spec[1]);
      if (e) {
        if (op.property === 'restitution' && e.code === 'OUT_OF_RANGE') e.message = 'Restitution must be between 0 and 1.';
        return e;
      }
      o[op.property] = op.value;
      setAssumptionFromUser(state, `objects.${o.id}.${op.property}`, op.value, spec[1]);
      return null;
    }
    case 'set-velocity': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      if (o.bodyType === 'fixed') return err('SCHEMA', 'Fixed objects cannot be given a velocity.', i, 'objectId');
      for (const k of ['vx', 'vy'] as const) {
        if (typeof op[k] !== 'number' || !Number.isFinite(op[k])) return err(nonFiniteOrSchema(op[k]), `${k} must be finite (m/s).`, i, k);
      }
      if (!inRange(Math.hypot(op.vx, op.vy), LIMITS.speed)) return err('OUT_OF_RANGE', `Speed must be at most ${LIMITS.speed[1]} m/s.`, i, 'vx');
      if (op.omega !== undefined) {
        if (typeof op.omega !== 'number' || !Number.isFinite(op.omega)) return err(nonFiniteOrSchema(op.omega), 'omega must be finite.', i, 'omega');
        if (!inRange(Math.abs(op.omega), LIMITS.angularSpeed)) return err('OUT_OF_RANGE', 'Angular speed out of range.', i, 'omega');
        o.angularVelocity = op.omega;
      }
      o.linearVelocity = { vx: op.vx, vy: op.vy };
      setAssumptionFromUser(state, `objects.${o.id}.linearVelocity`, { vx: op.vx, vy: op.vy }, 'm/s');
      // Single source of truth (R4-07): an arrow relationship always states the executable velocity.
      for (const r of state.relationships) {
        if (r.kind === 'velocity-of' && r.subjectId === o.id) {
          r.value = { vx: op.vx, vy: op.vy };
          r.origin = 'user';
        }
      }
      return null;
    }
    case 'set-body-type': {
      const o = need(op.objectId);
      if ('code' in o) return o;
      if (op.bodyType !== 'fixed' && op.bodyType !== 'dynamic') return err('SCHEMA', 'bodyType must be "fixed" or "dynamic".', i, 'bodyType');
      o.bodyType = op.bodyType;
      if (op.bodyType === 'dynamic' && o.mass === undefined) {
        o.mass = DEFAULTS.mass;
        state.assumptions.push({ id: `as-default-${o.id}-mass`, path: `objects.${o.id}.mass`, value: DEFAULTS.mass, unit: 'kg', origin: 'default' });
      }
      if (op.bodyType === 'fixed') {
        delete o.linearVelocity;
        delete o.angularVelocity;
      }
      return null;
    }
    case 'set-gravity': {
      for (const k of ['gx', 'gy'] as const) {
        if (typeof op[k] !== 'number' || !Number.isFinite(op[k])) return err(nonFiniteOrSchema(op[k]), `${k} must be finite.`, i, k);
      }
      if (!inRange(Math.hypot(op.gx, op.gy), LIMITS.gravity)) return err('OUT_OF_RANGE', `Gravity must be at most ${LIMITS.gravity[1]} m/s².`, i, 'gy');
      scene.gravity = { gx: op.gx, gy: op.gy };
      setAssumptionFromUser(state, 'scene.gravity', { gx: op.gx, gy: op.gy }, 'm/s^2');
      return null;
    }
    case 'set-scale': {
      const e = num(op.metersPerPx, 'metersPerPx', LIMITS.metersPerPx, 'm/px');
      if (e) return e;
      scene.metersPerPx = op.metersPerPx;
      setAssumptionFromUser(state, 'scene.metersPerPx', op.metersPerPx, 'm/px');
      return null;
    }
    case 'add-relationship': {
      if (state.relationships.some((r) => r.id === op.relationship?.id)) {
        return err('SCHEMA', `Relationship id "${op.relationship.id}" already exists.`, i, 'relationship.id');
      }
      const e = validateRelationship(op.relationship, state, 'relationship');
      if (e) return { ...e, opIndex: i };
      const added = clone(op.relationship);
      state.relationships.push(added);
      if (added.kind === 'velocity-of') syncVelocityFromRelationship(state, added);
      return null;
    }
    case 'update-relationship': {
      const idx = state.relationships.findIndex((r) => r.id === op.id);
      if (idx < 0) return err('UNKNOWN_TARGET', `No relationship "${String(op.id)}".`, i, 'id');
      const current = state.relationships[idx] as Relationship;
      const next: Relationship = { ...current, ...op.changes, id: current.id };
      const e = validateRelationship(next, state, 'changes');
      if (e) return { ...e, opIndex: i };
      state.relationships[idx] = next;
      if (current.kind === 'velocity-of' && (next.kind !== 'velocity-of' || next.subjectId !== current.subjectId)) {
        resetVelocity(state, current.subjectId);
      }
      if (next.kind === 'velocity-of') syncVelocityFromRelationship(state, next);
      return null;
    }
    case 'remove-relationship': {
      const removed = state.relationships.find((r) => r.id === op.id);
      if (!removed) return err('UNKNOWN_TARGET', `No relationship "${String(op.id)}".`, i, 'id');
      state.relationships = state.relationships.filter((r) => r.id !== op.id);
      // Removing the arrow removes the velocity it defined, so the scene never keeps an unexplained value.
      if (removed.kind === 'velocity-of') resetVelocity(state, removed.subjectId);
      return null;
    }
  }
}

/** Whole-scene check after all ops (INVALID_RESULT). */
function checkResult(state: EditableState): CommandError | null {
  const ids = new Set<string>();
  for (const o of state.scene.objects) {
    if (ids.has(o.id)) return err('INVALID_RESULT', `Duplicate object id "${o.id}".`);
    ids.add(o.id);
  }
  for (const r of state.relationships) {
    const e = validateRelationship(r, state, `relationships.${r.id}`);
    if (e) return { ...e, code: 'INVALID_RESULT' };
    if (r.kind === 'velocity-of') {
      const v = findObject(state, r.subjectId)?.linearVelocity ?? { vx: 0, vy: 0 };
      if (!sameVelocity(v, r.value)) {
        return err('INVALID_RESULT', `The arrow for ${r.subjectId} says (${r.value?.vx}, ${r.value?.vy}) m/s but the object would start at (${v.vx}, ${v.vy}) m/s.`, undefined, `relationships.${r.id}.value`);
      }
    }
  }
  return null;
}

export function sameVelocity(a: { vx: number; vy: number } | undefined, b: { vx: number; vy: number } | undefined): boolean {
  if (!a || !b) return false;
  return Math.abs(a.vx - b.vx) < 1e-9 && Math.abs(a.vy - b.vy) < 1e-9;
}

function syncVelocityFromRelationship(state: EditableState, rel: Relationship): void {
  const o = findObject(state, rel.subjectId);
  if (!o || !rel.value) return; // validateRelationship reports this
  o.linearVelocity = { vx: rel.value.vx, vy: rel.value.vy };
  setAssumptionFromUser(state, `objects.${o.id}.linearVelocity`, { ...o.linearVelocity }, 'm/s');
}

function resetVelocity(state: EditableState, objectId: string): void {
  const o = findObject(state, objectId);
  if (!o || o.bodyType !== 'dynamic') return;
  o.linearVelocity = { vx: 0, vy: 0 };
  setAssumptionFromUser(state, `objects.${o.id}.linearVelocity`, { vx: 0, vy: 0 }, 'm/s');
}

/**
 * Validate a complete batch against `state` and apply it atomically.
 * Success increments the scene revision by exactly 1. Failure returns the first error and changes nothing.
 */
export function applyBatch(state: EditableState, batch: CommandBatch): ApplyResult {
  if (typeof batch !== 'object' || batch === null || !Array.isArray(batch.ops)) {
    return { ok: false, error: err('SCHEMA', 'A batch needs an ops list.') };
  }
  if (batch.baseSceneRevision !== state.scene.revision) {
    return {
      ok: false,
      error: err('STALE_REVISION', 'The scene changed while this command was being understood. Say it again.'),
    };
  }
  if (batch.ops.length === 0) return { ok: false, error: err('SCHEMA', 'The batch has no changes.') };
  const draft = clone(state);
  for (let i = 0; i < batch.ops.length; i++) {
    const e = applyOp(draft, batch.ops[i] as SceneOp, i);
    if (e) return { ok: false, error: e };
  }
  const e = checkResult(draft);
  if (e) return { ok: false, error: e };
  draft.scene.revision = state.scene.revision + 1;
  return { ok: true, state: draft };
}

/** Structural check of ops without a revision (used for question options in model output). */
export function dryRunOps(state: EditableState, ops: SceneOp[]): CommandError | null {
  if (!Array.isArray(ops)) return err('SCHEMA', 'ops must be a list.');
  const draft = clone(state);
  for (let i = 0; i < ops.length; i++) {
    const e = applyOp(draft, ops[i] as SceneOp, i);
    if (e) return e;
  }
  return checkResult(draft);
}

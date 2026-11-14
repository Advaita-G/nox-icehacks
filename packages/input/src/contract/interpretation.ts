/**
 * Validate untrusted model output for a sketch/photo interpretation (R-02, R-03, R-06).
 *
 * - Not JSON, or wrong structure → rejected as a whole (MODEL_OUTPUT_INVALID).
 * - A single out-of-range physical value (mass, friction, restitution, velocity) → replaced
 *   by its default with an assumption and a warning (proposed; needs Advaita).
 * - Dangling references anywhere → rejected as a whole.
 */
import { dryRunOps, sameVelocity, validateObject, validateRelationship } from '../commands/apply';
import { DEFAULTS, LIMITS, checkNumber, inRange } from './geometry';
import {
  INTERPRETATION_QUESTION_KINDS,
  type Assumption,
  type EditableState,
  type InterpretationResult,
  type Question,
  type SceneObject,
  type SourceRef,
} from './types';

export interface Repair {
  path: string;
  from: unknown;
  to: unknown;
}

export type InterpretationOutcome =
  | { ok: true; result: InterpretationResult; repairs: Repair[] }
  | { ok: false; code: 'MODEL_OUTPUT_INVALID'; path?: string; message: string };

export interface ParseContext {
  /** The request we sent; the response must echo it. */
  requestId?: string;
  sourceId?: string;
  sourceRevision?: number;
  /** Stroke ids that exist in the canvas source, when known. */
  strokeIds?: ReadonlySet<string>;
}

/** Questions are shown one at a time and never dropped (R4-04). More than this is rejected as malformed. */
export const MAX_QUESTIONS = 10;

function invalid(message: string, path?: string): InterpretationOutcome {
  const o: InterpretationOutcome = { ok: false, code: 'MODEL_OUTPUT_INVALID', message };
  if (path !== undefined) o.path = path;
  return o;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkSourceRefs(refs: unknown, path: string, ctx: Required<Pick<ParseContext, 'sourceId'>> & ParseContext): string | null {
  if (!Array.isArray(refs)) return `${path} must be a list`;
  for (let i = 0; i < refs.length; i++) {
    const r = refs[i] as SourceRef;
    if (!isObj(r)) return `${path}[${i}] must be an object`;
    if (r.sourceId !== ctx.sourceId) return `${path}[${i}].sourceId does not match the source`;
    if (r.kind === 'strokes') {
      if (!Array.isArray(r.strokeIds) || r.strokeIds.some((s) => typeof s !== 'string')) return `${path}[${i}].strokeIds must be strings`;
      if (ctx.strokeIds) {
        const missing = r.strokeIds.find((s) => !ctx.strokeIds?.has(s));
        if (missing) return `${path}[${i}] refers to unknown stroke "${missing}"`;
      }
    } else if (r.kind === 'region') {
      const b = r.bbox;
      if (!Array.isArray(b) || b.length !== 4 || b.some((n) => typeof n !== 'number' || n < 0 || n > 1)) {
        return `${path}[${i}].bbox must be four numbers between 0 and 1`;
      }
    } else {
      return `${path}[${i}].kind must be "strokes" or "region"`;
    }
  }
  return null;
}

/** Repair one out-of-range physical value; returns false if the object is unrepairable. */
function repairObject(obj: SceneObject, repairs: Repair[], assumptions: Assumption[], warnings: string[]): void {
  const fix = (field: 'mass' | 'friction' | 'restitution', range: readonly [number, number], def: number, unit: string) => {
    const v = obj[field];
    if (field === 'mass' && obj.bodyType !== 'dynamic') return;
    if (v === undefined && field === 'mass') {
      obj.mass = def;
      assumptions.push({ id: `as-${obj.id}-mass`, path: `objects.${obj.id}.mass`, value: def, unit, origin: 'default' });
      return;
    }
    if (checkNumber(v, field, range, unit)) {
      repairs.push({ path: `objects.${obj.id}.${field}`, from: v, to: def });
      obj[field] = def;
      assumptions.push({ id: `as-repair-${obj.id}-${field}`, path: `objects.${obj.id}.${field}`, value: def, unit, origin: 'default' });
      warnings.push(`${capital(field)} from the model was invalid (${String(v)}${unit ? ` ${unit}` : ''}); using the default ${def}${unit ? ` ${unit}` : ''}.`);
    }
  };
  fix('mass', LIMITS.mass, DEFAULTS.mass, 'kg');
  fix('friction', LIMITS.friction, DEFAULTS.friction, '');
  fix('restitution', LIMITS.restitution, DEFAULTS.restitution, '');
  if (obj.bodyType === 'dynamic') {
    const lv = obj.linearVelocity;
    const bad =
      lv !== undefined &&
      (!isObj(lv) || !Number.isFinite(lv.vx) || !Number.isFinite(lv.vy) || !inRange(Math.hypot(lv.vx, lv.vy), LIMITS.speed));
    if (bad) {
      repairs.push({ path: `objects.${obj.id}.linearVelocity`, from: lv, to: { vx: 0, vy: 0 } });
      obj.linearVelocity = { vx: 0, vy: 0 };
      warnings.push(`Velocity from the model was invalid; using 0 m/s.`);
    }
    const w: unknown = obj.angularVelocity;
    if (w !== undefined && (typeof w !== 'number' || !Number.isFinite(w) || !inRange(Math.abs(w), LIMITS.angularSpeed))) {
      repairs.push({ path: `objects.${obj.id}.angularVelocity`, from: w, to: 0 });
      obj.angularVelocity = 0;
      assumptions.push({ id: `as-repair-${obj.id}-angularVelocity`, path: `objects.${obj.id}.angularVelocity`, value: 0, unit: 'rad/s', origin: 'default' });
      warnings.push(`Angular velocity from the model was invalid (${String(w)}); using 0 rad/s.`);
    }
  } else {
    delete obj.linearVelocity;
    delete obj.angularVelocity;
  }
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Parse and validate raw model text. */
export function parseInterpretation(raw: string, ctx: ParseContext = {}): InterpretationOutcome {
  let data: unknown;
  try {
    data = JSON.parse(raw.trim());
  } catch {
    return invalid('Interpretation failed: the model returned an unreadable result.');
  }
  return validateInterpretation(data, ctx);
}

export function validateInterpretation(data: unknown, ctx: ParseContext = {}): InterpretationOutcome {
  if (!isObj(data)) return invalid('The model result is not an object.');
  const d = structuredClone(data) as unknown as InterpretationResult;
  if (typeof d.requestId !== 'string') return invalid('Missing requestId.', 'requestId');
  if (ctx.requestId !== undefined && d.requestId !== ctx.requestId) return invalid('The result belongs to a different request.', 'requestId');
  if (typeof d.sourceId !== 'string') return invalid('Missing sourceId.', 'sourceId');
  if (ctx.sourceId !== undefined && d.sourceId !== ctx.sourceId) return invalid('The result belongs to a different source.', 'sourceId');
  if (!Number.isInteger(d.sourceRevision)) return invalid('Missing sourceRevision.', 'sourceRevision');
  if (ctx.sourceRevision !== undefined && d.sourceRevision !== ctx.sourceRevision) {
    return invalid('The result is for a different version of the sketch.', 'sourceRevision');
  }
  if (!['ready', 'needs-clarification', 'rejected'].includes(d.status)) return invalid('Unknown status.', 'status');

  const refCtx = { ...ctx, sourceId: d.sourceId };
  const repairs: Repair[] = [];
  const warnings: string[] = Array.isArray(d.warnings) ? d.warnings.filter((w) => typeof w === 'string') : [];
  const assumptions: Assumption[] = [];

  if (d.status === 'rejected') {
    if (!isObj(d.rejection) || typeof d.rejection.code !== 'string' || typeof d.rejection.message !== 'string') {
      return invalid('A rejected result needs a rejection code and message.', 'rejection');
    }
    return {
      ok: true,
      repairs,
      result: { requestId: d.requestId, sourceId: d.sourceId, sourceRevision: d.sourceRevision, status: 'rejected', relationships: [], assumptions: [], questions: [], warnings, rejection: d.rejection },
    };
  }

  const scene = d.scene;
  if (!isObj(scene)) return invalid('Missing scene.', 'scene');
  if (scene.schemaVersion !== 1) return invalid('Unsupported scene schemaVersion.', 'scene.schemaVersion');
  if (!Array.isArray(scene.objects)) return invalid('scene.objects must be a list.', 'scene.objects');
  if (scene.objects.length > LIMITS.maxObjects) return invalid(`More than ${LIMITS.maxObjects} objects.`, 'scene.objects');
  if (!Number.isInteger(scene.revision)) scene.revision = 1;
  if (checkNumber(scene.metersPerPx, 'metersPerPx', LIMITS.metersPerPx, '')) {
    repairs.push({ path: 'scene.metersPerPx', from: scene.metersPerPx, to: DEFAULTS.metersPerPx });
    scene.metersPerPx = DEFAULTS.metersPerPx;
    warnings.push('Scale from the model was invalid; using the default 100 px = 1 m.');
  }
  const g = scene.gravity as unknown;
  if (!isObj(g) || !Number.isFinite(g.gx) || !Number.isFinite(g.gy) || !inRange(Math.hypot(g.gx as number, g.gy as number), LIMITS.gravity)) {
    repairs.push({ path: 'scene.gravity', from: g, to: DEFAULTS.gravity });
    scene.gravity = { ...DEFAULTS.gravity };
    warnings.push('Gravity from the model was invalid; using the default 9.81 m/s² downward.');
  }

  const ids = new Set<string>();
  for (let i = 0; i < scene.objects.length; i++) {
    const o = scene.objects[i] as SceneObject;
    const path = `scene.objects[${i}]`;
    if (!isObj(o)) return invalid('Object must be an object.', path);
    if (typeof o.id === 'string' && ids.has(o.id)) return invalid(`Duplicate object id "${o.id}".`, `${path}.id`);
    if (!Array.isArray(o.sourceRefs)) o.sourceRefs = [];
    if (o.friction === undefined) o.friction = DEFAULTS.friction;
    if (o.restitution === undefined) o.restitution = DEFAULTS.restitution;
    repairObject(o, repairs, assumptions, warnings);
    const e = validateObject(o, path);
    if (e) return invalid(e.message, e.path ?? path);
    const refErr = checkSourceRefs(o.sourceRefs, `${path}.sourceRefs`, refCtx);
    if (refErr) return invalid(refErr, `${path}.sourceRefs`);
    ids.add(o.id);
  }

  const relationships = Array.isArray(d.relationships) ? d.relationships : null;
  if (!relationships) return invalid('relationships must be a list.', 'relationships');
  const baseState: EditableState = { scene, relationships: [], assumptions: [] };
  const relIds = new Set<string>();
  for (let i = 0; i < relationships.length; i++) {
    const r = relationships[i];
    const path = `relationships[${i}]`;
    if (!isObj(r)) return invalid('Relationship must be an object.', path);
    if (!Array.isArray(r.sourceRefs)) r.sourceRefs = [];
    if (r.origin === undefined) r.origin = 'model';
    if (r.status === undefined) r.status = 'proposed';
    const e = validateRelationship(r, baseState, path);
    if (e) {
      const field = e.path?.split('.').pop();
      return invalid(e.message, field && e.path !== path ? `${path}.${field}` : path);
    }
    if (relIds.has(r.id)) return invalid(`Duplicate relationship id "${r.id}".`, `${path}.id`);
    relIds.add(r.id);
    const refErr = checkSourceRefs(r.sourceRefs, `${path}.sourceRefs`, refCtx);
    if (refErr) return invalid(refErr, `${path}.sourceRefs`);
    if (r.kind === 'velocity-of') {
      const subject = scene.objects.find((o) => o.id === r.subjectId);
      if (!sameVelocity(subject?.linearVelocity ?? { vx: 0, vy: 0 }, r.value)) {
        return invalid(`The arrow for ${r.subjectId} contradicts its starting velocity.`, `${path}.value`);
      }
    }
    baseState.relationships.push(r);
  }

  if (!Array.isArray(d.assumptions)) return invalid('assumptions must be a list.', 'assumptions');
  for (let i = 0; i < d.assumptions.length; i++) {
    const a = d.assumptions[i] as Assumption;
    if (!isObj(a) || typeof a.path !== 'string' || !['model', 'user', 'default'].includes(a.origin)) {
      return invalid('Assumption needs a path and an origin.', `assumptions[${i}]`);
    }
    if (typeof a.id !== 'string') a.id = `as-${i}`;
    if (typeof a.unit !== 'string') a.unit = '';
  }
  // Repairs override the model's own claim for the same path.
  const repairedPaths = new Set(assumptions.map((a) => a.path));
  const mergedAssumptions = [...d.assumptions.filter((a) => !repairedPaths.has(a.path)), ...assumptions];
  ensureDefaultAssumptions(scene.objects, mergedAssumptions, scene.metersPerPx);

  if (!Array.isArray(d.questions)) return invalid('questions must be a list.', 'questions');
  const questions: Question[] = [];
  if (d.questions.length > MAX_QUESTIONS) return invalid(`The model asked more than ${MAX_QUESTIONS} questions.`, 'questions');
  for (let i = 0; i < d.questions.length; i++) {
    const q = d.questions[i] as Question;
    const path = `questions[${i}]`;
    if (!isObj(q) || typeof q.id !== 'string' || typeof q.prompt !== 'string' || !q.prompt.trim()) {
      return invalid('Question needs an id and a prompt.', path);
    }
    if (!INTERPRETATION_QUESTION_KINDS.includes(q.kind)) return invalid(`Unknown question kind "${String(q.kind)}".`, `${path}.kind`);
    const t = q.targetRefs;
    if (!isObj(t) || !Array.isArray(t.objectIds)) return invalid('Question needs targetRefs.', `${path}.targetRefs`);
    if (!Array.isArray(t.relationshipIds)) t.relationshipIds = [];
    if (!Array.isArray(t.sourceRefs)) t.sourceRefs = [];
    const missing = t.objectIds.find((id) => !ids.has(id));
    if (missing) return invalid(`Question refers to unknown object "${missing}".`, `${path}.targetRefs.objectIds`);
    const missingRel = t.relationshipIds.find((id) => !relIds.has(id));
    if (missingRel) return invalid(`Question refers to unknown relationship "${missingRel}".`, `${path}.targetRefs.relationshipIds`);
    const refErr = checkSourceRefs(t.sourceRefs, `${path}.targetRefs.sourceRefs`, refCtx);
    if (refErr) return invalid(refErr, `${path}.targetRefs.sourceRefs`);
    if (!Array.isArray(q.options) || q.options.length === 0) return invalid('Question needs at least one option.', `${path}.options`);
    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      if (!isObj(opt) || typeof opt.id !== 'string' || typeof opt.label !== 'string') return invalid('Option needs an id and label.', `${path}.options[${j}]`);
      const opErr = dryRunOps(baseState, opt.ops);
      if (opErr) return invalid(`Option "${opt.label}" is not a valid change: ${opErr.message}`, `${path}.options[${j}].ops`);
    }
    q.allowManual = q.allowManual !== false;
    questions.push(q);
  }
  let status = d.status;
  if (status === 'ready' && questions.length > 0) status = 'needs-clarification';
  if (status === 'needs-clarification' && questions.length === 0) {
    return invalid('The model said it needs clarification but asked no question.', 'questions');
  }

  return {
    ok: true,
    repairs,
    result: {
      requestId: d.requestId,
      sourceId: d.sourceId,
      sourceRevision: d.sourceRevision,
      status,
      scene,
      relationships: baseState.relationships,
      assumptions: mergedAssumptions,
      questions,
      warnings,
    },
  };
}

/** Make sure every defaulted field is visible as an assumption (R-03). */
function ensureDefaultAssumptions(objects: SceneObject[], assumptions: Assumption[], metersPerPx: number): void {
  const has = (path: string) =>
    assumptions.some((a) => a.path === path || (a.path.endsWith('.*.' + path.split('.').pop()) && path.startsWith('objects.')));
  if (!has('scene.metersPerPx')) {
    assumptions.push({ id: 'as-auto-scale', path: 'scene.metersPerPx', value: metersPerPx, unit: 'm/px', origin: 'default' });
  }
  for (const o of objects) {
    if (o.bodyType === 'dynamic' && !has(`objects.${o.id}.mass`)) {
      assumptions.push({ id: `as-auto-${o.id}-mass`, path: `objects.${o.id}.mass`, value: o.mass, unit: 'kg', origin: 'default' });
    }
  }
}

/** The editable state an accepted interpretation produces. */
export function toEditableState(result: InterpretationResult): EditableState | null {
  if (!result.scene) return null;
  return structuredClone({ scene: result.scene, relationships: result.relationships, assumptions: result.assumptions });
}

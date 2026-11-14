/**
 * Runtime validation of untrusted command intents (model replies or the typed parser) — R4-02.
 * Everything is checked here, once, before any code reads the payload as a CommandIntent.
 * Returns a structured error instead of throwing; never mutates its input.
 */
import { validateObject } from './apply';
import {
  COMMAND_QUESTION_KINDS,
  LIFECYCLE_KINDS,
  type CommandError,
  type CommandIntent,
  type CommandQuestion,
  type IntentNumber,
  type IntentOp,
  type SceneObject,
} from '../contract/types';

export type IntentValidation = { ok: true; intent: CommandIntent } | { ok: false; error: CommandError };

const MAX_OPS = 50;
const MAX_TARGETS = 50;
const MAX_OPTIONS = 6;
const PROPERTIES = ['mass', 'friction', 'restitution'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isStrList = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(isStr);

class Invalid extends Error {
  constructor(
    readonly path: string,
    message: string,
    readonly code: CommandError['code'] = 'SCHEMA',
  ) {
    super(message);
  }
}

function num(v: unknown, path: string): IntentNumber {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Invalid(path, `${path} must be finite.`, 'NON_FINITE');
    return v;
  }
  if (!isObj(v)) throw new Invalid(path, `${path} must be a number or {absolute|factor|delta}.`);
  const keys = Object.keys(v);
  const key = keys[0];
  if (keys.length !== 1 || (key !== 'absolute' && key !== 'factor' && key !== 'delta')) {
    throw new Invalid(path, `${path} must have exactly one of absolute, factor or delta.`);
  }
  const n = v[key];
  if (typeof n !== 'number') throw new Invalid(path, `${path}.${key} must be a number.`);
  if (!Number.isFinite(n)) throw new Invalid(path, `${path}.${key} must be finite.`, 'NON_FINITE');
  return { [key]: n } as IntentNumber;
}

function optNum(o: Record<string, unknown>, k: string, path: string): IntentNumber | undefined {
  return o[k] === undefined ? undefined : num(o[k], `${path}.${k}`);
}

function id(o: Record<string, unknown>, k: string, path: string): string {
  if (!isStr(o[k])) throw new Invalid(`${path}.${k}`, `${path}.${k} must be an object id.`);
  return o[k] as string;
}

function op(raw: unknown, path: string): IntentOp {
  if (!isObj(raw)) throw new Invalid(path, `${path} must be an operation object.`);
  switch (raw.op) {
    case 'set-property': {
      if (!PROPERTIES.includes(raw.property as (typeof PROPERTIES)[number])) throw new Invalid(`${path}.property`, `Property "${String(raw.property)}" cannot be set.`);
      return { op: 'set-property', objectId: id(raw, 'objectId', path), property: raw.property as (typeof PROPERTIES)[number], value: num(raw.value, `${path}.value`) };
    }
    case 'set-pose': {
      const o: IntentOp = { op: 'set-pose', objectId: id(raw, 'objectId', path) };
      for (const k of ['x', 'y', 'angle'] as const) {
        const v = optNum(raw, k, path);
        if (v !== undefined) o[k] = v;
      }
      return o;
    }
    case 'set-dimensions': {
      if (!isObj(raw.dims) || Object.keys(raw.dims).length === 0 || Object.keys(raw.dims).length > 8) throw new Invalid(`${path}.dims`, 'dims must be a non-empty object.');
      const dims: Record<string, IntentNumber | string> = {};
      for (const [k, v] of Object.entries(raw.dims)) dims[k] = typeof v === 'string' ? v : num(v, `${path}.dims.${k}`);
      return { op: 'set-dimensions', objectId: id(raw, 'objectId', path), dims };
    }
    case 'set-velocity': {
      const o: IntentOp = { op: 'set-velocity', objectId: id(raw, 'objectId', path) };
      for (const k of ['vx', 'vy', 'omega'] as const) {
        const v = optNum(raw, k, path);
        if (v !== undefined) o[k] = v;
      }
      return o;
    }
    case 'set-gravity': {
      const o: IntentOp = { op: 'set-gravity' };
      for (const k of ['gx', 'gy'] as const) {
        const v = optNum(raw, k, path);
        if (v !== undefined) o[k] = v;
      }
      return o;
    }
    case 'set-scale':
      return { op: 'set-scale', metersPerPx: num(raw.metersPerPx, `${path}.metersPerPx`) };
    case 'space-evenly': {
      if (!isStrList(raw.objectIds, MAX_TARGETS) || raw.objectIds.length < 2) throw new Invalid(`${path}.objectIds`, 'space-evenly needs at least two object ids.');
      if (new Set(raw.objectIds).size !== raw.objectIds.length) throw new Invalid(`${path}.objectIds`, 'space-evenly object ids must be distinct.');
      return { op: 'space-evenly', objectIds: [...raw.objectIds], spacing: num(raw.spacing, `${path}.spacing`) };
    }
    case 'set-body-type':
      if (raw.bodyType !== 'fixed' && raw.bodyType !== 'dynamic') throw new Invalid(`${path}.bodyType`, 'bodyType must be "fixed" or "dynamic".');
      return { op: 'set-body-type', objectId: id(raw, 'objectId', path), bodyType: raw.bodyType };
    case 'remove-object':
      return { op: 'remove-object', objectId: id(raw, 'objectId', path) };
    case 'add-object': {
      const e = validateObject(raw.object as SceneObject, `${path}.object`);
      if (e) throw new Invalid(e.path ?? `${path}.object`, e.message, e.code);
      return { op: 'add-object', object: structuredClone(raw.object as SceneObject) };
    }
    default:
      throw new Invalid(`${path}.op`, `Unknown operation "${String(raw.op)}".`, 'UNKNOWN_OP');
  }
}

function ops(raw: unknown, path: string): IntentOp[] {
  if (!Array.isArray(raw)) throw new Invalid(path, `${path} must be a list.`);
  if (raw.length > MAX_OPS) throw new Invalid(path, `At most ${MAX_OPS} operations.`);
  return raw.map((o, i) => op(o, `${path}[${i}]`));
}

function question(raw: unknown, path: string): CommandQuestion {
  if (!isObj(raw)) throw new Invalid(path, 'question must be an object.');
  if (!COMMAND_QUESTION_KINDS.includes(raw.kind as CommandQuestion['kind'])) throw new Invalid(`${path}.kind`, `Unknown question kind "${String(raw.kind)}".`);
  if (typeof raw.prompt !== 'string' || !raw.prompt.trim() || raw.prompt.length > 300) throw new Invalid(`${path}.prompt`, 'question needs a prompt.');
  if (!Array.isArray(raw.options) || raw.options.length > MAX_OPTIONS) throw new Invalid(`${path}.options`, `options must be a list of at most ${MAX_OPTIONS}.`);
  const options = raw.options.map((o, i) => {
    const p = `${path}.options[${i}]`;
    if (!isObj(o) || !isStr(o.id) || typeof o.label !== 'string' || !o.label.trim() || o.label.length > 120) throw new Invalid(p, 'Option needs an id and a label.');
    const intentOps = ops(o.intentOps, `${p}.intentOps`);
    if (intentOps.length === 0) throw new Invalid(`${p}.intentOps`, 'Option needs at least one operation.');
    return { id: o.id, label: o.label, intentOps };
  });
  return { id: isStr(raw.id) ? raw.id : 'q', kind: raw.kind as CommandQuestion['kind'], prompt: raw.prompt, options, allowManual: raw.allowManual !== false };
}

export function validateCommandIntent(data: unknown): IntentValidation {
  try {
    if (!isObj(data)) throw new Invalid('', 'The command result is not an object.');
    if (!isStr(data.requestId)) throw new Invalid('requestId', 'Missing requestId.');
    const status = data.status;
    if (status !== 'proposed' && status !== 'needs-clarification' && status !== 'unsupported') throw new Invalid('status', 'Unknown command status.');
    const targets = data.targets === undefined ? [] : data.targets;
    if (!isStrList(targets, MAX_TARGETS)) throw new Invalid('targets', 'targets must be a list of object ids.');
    const intent: CommandIntent = { requestId: data.requestId, status, targets: [...targets], ops: data.ops === undefined ? [] : ops(data.ops, 'ops') };
    if (data.lifecycle !== undefined) {
      if (!LIFECYCLE_KINDS.includes(data.lifecycle as CommandIntent['lifecycle'] & string)) throw new Invalid('lifecycle', `Unknown run control "${String(data.lifecycle)}".`);
      intent.lifecycle = data.lifecycle as CommandIntent['lifecycle'];
    }
    if (status === 'needs-clarification') {
      if (data.question === undefined) throw new Invalid('question', 'A clarification needs a question.');
      intent.question = question(data.question, 'question');
    } else if (data.question !== undefined) {
      throw new Invalid('question', 'Only a clarification may carry a question.');
    }
    if (data.reason !== undefined) {
      if (typeof data.reason !== 'string' || data.reason.length > 300) throw new Invalid('reason', 'reason must be short text.');
      intent.reason = data.reason;
    }
    return { ok: true, intent };
  } catch (e) {
    if (e instanceof Invalid) {
      const error: CommandError = { code: e.code, message: e.message };
      if (e.path) error.path = e.path;
      return { ok: false, error };
    }
    return { ok: false, error: { code: 'SCHEMA', message: 'The command result could not be read.' } };
  }
}

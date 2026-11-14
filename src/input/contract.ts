import { applyCommands, check, keys, LIMITS, number, record, text, validateScene } from '../physics/scene.ts';
import type { CommandBatch, Operation, Scene } from '../physics/scene.ts';
import { add, dot, length, mul, rotate, sub } from '../physics/math.ts';

export const REQUEST_TIMEOUTS = { sketch: 120_000, command: 120_000 };

const THIN_SHAPES: Record<string, 'box' | 'cylinder'> = { block: 'box', platform: 'box', domino: 'box', cylinder: 'cylinder' };
/**
 * A model may return a thin plank or wheel as a primitive body below dimensionMin. Express it as a dimensionMin body
 * frame with geometry at the real size (same collider, mass and pose) and say so in assumptions. Only finite positive
 * sizes are converted; anything else is left for validation to reject.
 */
function frameThinPrimitives(scene: unknown): void {
  const s = scene as { objects?: unknown; assumptions?: unknown };
  if (!s || typeof s !== 'object' || !Array.isArray(s.objects) || !Array.isArray(s.assumptions)) return;
  const min = LIMITS.dimensionMin;
  for (const o of s.objects as Record<string, unknown>[]) {
    const shape = o && typeof o === 'object' && o.geometry === undefined ? THIN_SHAPES[String(o.kind)] : undefined;
    if (!shape) continue;
    const dims = { width: o.width, height: o.height, depth: o.depth } as Record<string, unknown>;
    const thin = Object.entries(dims).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < min);
    if (!thin.length || !Object.values(dims).every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) continue;
    const scale = (key: string) => thin.some(([k]) => k === key) ? (dims[key] as number) / min : 1;
    o.geometry = [{ shape, size: { x: scale('width'), y: scale('height'), z: scale('depth') }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }];
    for (const [k, v] of thin) { o[k] = min; (s.assumptions as unknown[]).push(`${String(o.id)}: ${k} ${v} m is below the ${min} m body minimum, so it is modelled as geometry at its real size inside a ${min} m body frame.`); }
  }
}

export interface SourceIdentity { id: string; revision: number; kind: 'canvas' | 'photo'; strokeIds: string[] }
export interface Grounding { objectId: string; origin: 'sketch' | 'inferred'; note: string; strokeIds?: string[]; bbox?: [number, number, number, number] }
export interface Clarification { id: string; prompt: string; options: string[] }
export interface Interpretation {
  requestId: string; sourceId: string; sourceRevision: number;
  status: 'ready' | 'needs-clarification' | 'rejected'; scene?: Scene;
  grounding: Grounding[]; questions: Clarification[]; warnings: string[]; message: string;
}
export interface CommandProposal {
  requestId: string; status: 'proposed' | 'needs-clarification' | 'unsupported';
  operations: Operation[]; lifecycle?: 'run' | 'pause' | 'resume' | 'reset' | 'replay';
  summary: string[]; questions: Clarification[]; message: string;
}

function parsed(raw: string): Record<string, unknown> {
  check(raw.length <= 2_000_000, 'Model response exceeds 2 MB.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    // A model can answer with prose (for example a refusal), refuse partway, or stop early; say which, not a parser error.
    const words = raw.trim().replace(/\s+/g, ' '), short = (t: string) => t.length > 200 ? `${t.slice(0, 200)}…` : t;
    if (words.startsWith('{') || words.startsWith('[')) {
      const refusal = /(I'm sorry|I am sorry|I cannot|I can't|I can not)[^{}"]*$/i.exec(words);
      if (refusal) throw new Error(`The AI stopped partway and refused: "${short(refusal[0].trim())}" Nothing was changed; try again or rephrase.`);
      throw new Error(`The AI's structured answer was cut off after ${words.length} characters. Nothing was changed; try again.`);
    }
    throw new Error(`The AI replied with text instead of a structured answer: "${short(words)}" Nothing was changed; try again or rephrase.`);
  }
  record(value); return value;
}
function strings(value: unknown, max: number, name: string): asserts value is string[] {
  check(Array.isArray(value) && value.length <= max, `Too many ${name}.`); value.forEach(v => text(v, 500, name));
}
function questions(value: unknown): asserts value is Clarification[] {
  check(Array.isArray(value) && value.length <= 12, 'Invalid clarification questions.');
  const ids = new Set();
  for (const q of value) {
    record(q); keys(q, ['id', 'prompt', 'options']); text(q.id, 64, 'Question ID'); check(!ids.has(q.id), 'Duplicate question ID.'); ids.add(q.id); text(q.prompt, 500, 'Question');
    check(Array.isArray(q.options) && q.options.length <= 8, 'Too many options.');
    q.options = q.options.map(option => {
      if (typeof option === 'string') return option;
      record(option); keys(option, ['label', 'value']);
      text(option.label, 500, 'Option label'); text(option.value, 500, 'Option value');
      return option.label;
    });
    strings(q.options, 8, 'options');
  }
}

function checkInitialConnections(scene: Scene, constraints: Scene['constraints']): void {
  for (const c of constraints.filter(c => c.type === 'slider')) {
    const a = scene.objects.find(o => o.id === c.bodyA)!, b = scene.objects.find(o => o.id === c.bodyB)!;
    const axis = rotate(a.rotation, c.axisA!);
    const separation = sub(add(b.position, rotate(b.rotation, c.anchorB)), add(a.position, rotate(a.rotation, c.anchorA)));
    const transverse = length(sub(separation, mul(axis, dot(separation, axis) / dot(axis, axis))));
    check(transverse <= LIMITS.joints.initialTransverseTolerance,
      `Slider ${c.id} places its parts ${transverse.toFixed(4)} m off the rail. Align the anchors across the rail before running.`);
  }
  for (const c of constraints.filter(c => c.type === 'hinge' || c.type === 'fixed' || c.type === 'spherical')) {
    const a = scene.objects.find(o => o.id === c.bodyA)!, b = scene.objects.find(o => o.id === c.bodyB)!;
    const gap = length(sub(add(b.position, rotate(b.rotation, c.anchorB)), add(a.position, rotate(a.rotation, c.anchorA))));
    const name = c.type[0].toUpperCase() + c.type.slice(1);
    check(gap <= LIMITS.joints.initialTransverseTolerance,
      `${name} ${c.id} connects its parts ${gap.toFixed(4)} m apart. Place the parts so the joint anchors meet before running.`);
  }
}

export function parseInterpretation(raw: string, requestId: string, source: SourceIdentity): Interpretation {
  const result = parsed(raw);
  keys(result, ['requestId', 'sourceId', 'sourceRevision', 'status', 'scene', 'grounding', 'questions', 'warnings', 'message']);
  check(result.requestId === requestId && result.sourceId === source.id && result.sourceRevision === source.revision, 'The interpretation belongs to another request or source.');
  check(['ready', 'needs-clarification', 'rejected'].includes(String(result.status)), 'Unknown interpretation status.');
  result.message ??= ''; check(typeof result.message === 'string' && result.message.length <= 500, 'Invalid interpretation message.');
  questions(result.questions); strings(result.warnings, 20, 'warnings');
  check(result.status !== 'needs-clarification' || result.questions.length > 0, 'Clarification needs a specific question.');
  check(result.status !== 'ready' || result.questions.length === 0, 'Resolve clarification before previewing.');
  check(Array.isArray(result.grounding) && result.grounding.length <= 128, 'Invalid source grounding.');
  if (result.scene !== undefined) frameThinPrimitives(result.scene);
  const scene = result.scene === undefined ? undefined : validateScene(result.scene);
  check(result.status !== 'ready' || scene && scene.objects.length > 0, 'A ready interpretation needs a nonempty complete scene.');
  // Check new connections here so saved scenes can still be opened and repaired.
  if (scene && result.status === 'ready') checkInitialConnections(scene, scene.constraints);
  const ids = new Set();
  for (const g of result.grounding) {
    record(g); keys(g, ['objectId', 'origin', 'note', 'strokeIds', 'bbox']);
    if (!scene) text(g.objectId, 80, 'Grounded part ID');
    check((!scene || scene.objects.some(o => o.id === g.objectId)) && !ids.has(g.objectId), 'Grounding references an unknown or duplicate part.'); ids.add(g.objectId);
    check(['sketch', 'inferred'].includes(String(g.origin)), 'Unknown grounding origin.'); text(g.note, 240, 'Grounding explanation');
    if (g.strokeIds !== undefined || g.origin === 'sketch' && source.kind === 'canvas') {
      strings(g.strokeIds, 500, 'stroke references'); check(g.strokeIds.length > 0 && g.strokeIds.every(id => source.strokeIds.includes(id)), 'Grounding references missing strokes.');
    }
    if (source.kind === 'canvas' && g.origin === 'sketch') delete g.bbox; // Canvas provenance is the verified strokes, not optional model regions.
    if (g.bbox !== undefined || g.origin === 'sketch' && source.kind === 'photo') {
      check(Array.isArray(g.bbox) && g.bbox.length === 4, 'Photo grounding needs [x,y,width,height].'); g.bbox.forEach(v => number(v, 0, 1, 'Normalized source region'));
      check(g.bbox[2] > 0 && g.bbox[3] > 0 && g.bbox[0] + g.bbox[2] <= 1.00001 && g.bbox[1] + g.bbox[3] <= 1.00001, 'Source region extends outside the image.');
    }
  }
  if (scene) {
    check(scene.objects.every(o => ids.has(o.id)), 'Every physical part needs source grounding or an explicit inferred explanation.');
    scene.sources = [{ kind: source.kind, reference: source.id }];
  }
  return { ...result, ...(scene ? { scene } : {}) } as unknown as Interpretation;
}

export function parseCommand(raw: string, requestId: string, scene: Scene): CommandProposal {
  const result = parsed(raw);
  keys(result, ['requestId', 'status', 'operations', 'lifecycle', 'summary', 'questions', 'message']);
  check(result.requestId === requestId, 'The command belongs to another request.');
  check(['proposed', 'needs-clarification', 'unsupported'].includes(String(result.status)), 'Unknown command status.');
  result.message ??= ''; check(typeof result.message === 'string' && result.message.length <= 500, 'Invalid command message.');
  strings(result.summary, 20, 'change descriptions'); questions(result.questions);
  check(Array.isArray(result.operations) && result.operations.length <= 60, 'Invalid command operations.');
  check(result.lifecycle === undefined || ['run', 'pause', 'resume', 'reset', 'replay'].includes(String(result.lifecycle)), 'Unknown lifecycle command.');
  if (result.status === 'proposed') {
    check(result.questions.length === 0 && result.summary.length > 0, 'A proposed change needs a clear summary and no unresolved question.');
    check(result.lifecycle ? result.operations.length === 0 : result.operations.length > 0, 'Propose either lifecycle or physical changes.');
    if (result.operations.length) {
      for (const op of result.operations) if (typeof op === 'object' && op !== null && op.type === 'replace-scene') { record(op.scene); op.scene.sources = structuredClone(scene.sources); }
      const batch = { baseSceneRevision: scene.revision, operations: result.operations } as CommandBatch;
      const next = applyCommands(scene, batch);
      const connections = batch.operations.some(op => op.type === 'replace-scene') ? next.constraints
        : next.constraints.filter(c => batch.operations.some(op => op.type === 'upsert-constraint' && op.constraint.id === c.id));
      checkInitialConnections(next, connections);
    }
  } else {
    check(result.operations.length === 0 && result.lifecycle === undefined, 'Unresolved commands must not carry executable changes.');
    check(result.status !== 'needs-clarification' || result.questions.length > 0, 'Ask a specific command clarification.');
  }
  return result as unknown as CommandProposal;
}

/**
 * Input-side contract types (PROPOSED in docs/product/ARCHITECTURE.md,
 * "Input, interpretation and command contract").
 *
 * Scene geometry (SceneObject/Scene) is a PLACEHOLDER that mirrors the published
 * 2D draft. It must be replaced by the shared physics interface once Advaita
 * publishes it; keep every geometry-specific rule in ./geometry.ts so that swap
 * touches one module.
 */

export type ObjectKind = 'ball' | 'block' | 'ramp' | 'domino' | 'platform' | 'container';
export const OBJECT_KINDS: readonly ObjectKind[] = ['ball', 'block', 'ramp', 'domino', 'platform', 'container'];

export type BodyType = 'fixed' | 'dynamic';
export type Origin = 'model' | 'user' | 'default';

export type SourceRef =
  | { kind: 'strokes'; sourceId: string; strokeIds: string[] }
  | { kind: 'region'; sourceId: string; bbox: [number, number, number, number] };

export interface Vec2 {
  vx: number;
  vy: number;
}

export interface SceneObject {
  id: string;
  kind: ObjectKind;
  bodyType: BodyType;
  x: number;
  y: number;
  angle: number;
  dims: Record<string, number | string>;
  mass?: number;
  linearVelocity?: Vec2;
  angularVelocity?: number;
  friction: number;
  restitution: number;
  sourceRefs: SourceRef[];
}

export interface Scene {
  schemaVersion: 1;
  revision: number;
  metersPerPx: number;
  gravity: { gx: number; gy: number };
  objects: SceneObject[];
}

export type RelationshipKind = 'rests-on' | 'inside' | 'velocity-of';
export const RELATIONSHIP_KINDS: readonly RelationshipKind[] = ['rests-on', 'inside', 'velocity-of'];

export interface Relationship {
  id: string;
  kind: RelationshipKind;
  subjectId: string;
  targetId?: string;
  value?: Vec2;
  origin: Origin;
  status: 'proposed' | 'confirmed';
  sourceRefs: SourceRef[];
}

export interface Assumption {
  id: string;
  path: string;
  value: unknown;
  unit: string;
  origin: Origin;
  note?: string;
}

export type InterpretationQuestionKind =
  | 'choose-kind'
  | 'choose-body-type'
  | 'confirm-contact'
  | 'choose-arrow-target'
  | 'unsupported-element'
  | 'confirm-scale';
export type CommandQuestionKind = 'choose-target' | 'amount';
export const INTERPRETATION_QUESTION_KINDS: readonly InterpretationQuestionKind[] = [
  'choose-kind',
  'choose-body-type',
  'confirm-contact',
  'choose-arrow-target',
  'unsupported-element',
  'confirm-scale',
];
export const COMMAND_QUESTION_KINDS: readonly CommandQuestionKind[] = ['choose-target', 'amount'];

export interface QuestionTargetRefs {
  objectIds: string[];
  relationshipIds: string[];
  sourceRefs: SourceRef[];
}

export interface QuestionOption {
  id: string;
  label: string;
  ops: SceneOp[];
}

export interface Question {
  id: string;
  kind: InterpretationQuestionKind;
  prompt: string;
  targetRefs: QuestionTargetRefs;
  options: QuestionOption[];
  allowManual: boolean;
}

export interface CommandQuestion {
  id: string;
  kind: CommandQuestionKind;
  prompt: string;
  options: { id: string; label: string; intentOps: IntentOp[] }[];
  allowManual: boolean;
}

export type InterpretationStatus = 'ready' | 'needs-clarification' | 'rejected';

export interface InterpretationResult {
  requestId: string;
  sourceId: string;
  sourceRevision: number;
  status: InterpretationStatus;
  scene?: Scene;
  relationships: Relationship[];
  assumptions: Assumption[];
  questions: Question[];
  warnings: string[];
  rejection?: { code: string; message: string };
}

/* ---------- Scene operations (absolute values) ---------- */

export type MutableProperty = 'mass' | 'friction' | 'restitution';

export type SceneOp =
  | { op: 'add-object'; object: SceneObject }
  | { op: 'remove-object'; objectId: string }
  | { op: 'set-pose'; objectId: string; x: number; y: number; angle: number }
  | { op: 'set-dimensions'; objectId: string; dims: Record<string, number | string> }
  | { op: 'set-property'; objectId: string; property: MutableProperty; value: number }
  | { op: 'set-velocity'; objectId: string; vx: number; vy: number; omega?: number }
  | { op: 'set-body-type'; objectId: string; bodyType: BodyType }
  | { op: 'set-gravity'; gx: number; gy: number }
  | { op: 'set-scale'; metersPerPx: number }
  | { op: 'add-relationship'; relationship: Relationship }
  | { op: 'update-relationship'; id: string; changes: Partial<Omit<Relationship, 'id'>> }
  | { op: 'remove-relationship'; id: string };

export type SceneOpName = SceneOp['op'];
export const SCENE_OP_NAMES: readonly SceneOpName[] = [
  'add-object',
  'remove-object',
  'set-pose',
  'set-dimensions',
  'set-property',
  'set-velocity',
  'set-body-type',
  'set-gravity',
  'set-scale',
  'add-relationship',
  'update-relationship',
  'remove-relationship',
];

export type BatchOrigin = 'direct' | 'voice' | 'typed' | 'clarification' | 'interpretation';

export interface CommandBatch {
  batchId: string;
  requestId?: string;
  baseSceneRevision: number;
  origin: BatchOrigin;
  ops: SceneOp[];
  summary: string[];
}

export type CommandErrorCode =
  | 'STALE_REVISION'
  | 'UNKNOWN_TARGET'
  | 'AMBIGUOUS_TARGET'
  | 'UNKNOWN_OP'
  | 'SCHEMA'
  | 'NON_FINITE'
  | 'OUT_OF_RANGE'
  | 'INVALID_RESULT';

export interface CommandError {
  code: CommandErrorCode;
  opIndex?: number;
  path?: string;
  message: string;
}

/* ---------- Intents (from the model or the typed parser) ---------- */

/** A number in an intent: absolute, multiply current, or add to current. Plain numbers mean absolute. */
export type IntentNumber = number | { absolute: number } | { factor: number } | { delta: number };

export type IntentOp =
  | { op: 'set-property'; objectId: string; property: MutableProperty; value: IntentNumber }
  | { op: 'set-pose'; objectId: string; x?: IntentNumber; y?: IntentNumber; angle?: IntentNumber }
  | { op: 'set-dimensions'; objectId: string; dims: Record<string, IntentNumber | string> }
  | { op: 'set-velocity'; objectId: string; vx?: IntentNumber; vy?: IntentNumber; omega?: IntentNumber }
  | { op: 'set-gravity'; gx?: IntentNumber; gy?: IntentNumber }
  | { op: 'set-scale'; metersPerPx: IntentNumber }
  | { op: 'space-evenly'; objectIds: string[]; spacing: IntentNumber }
  | { op: 'set-body-type'; objectId: string; bodyType: BodyType }
  | { op: 'remove-object'; objectId: string }
  | { op: 'add-object'; object: SceneObject };

export type LifecycleKind = 'run' | 'pause' | 'resume' | 'reset' | 'replay';
export const LIFECYCLE_KINDS: readonly LifecycleKind[] = ['run', 'pause', 'resume', 'reset', 'replay'];

export interface LifecycleCommand {
  kind: LifecycleKind;
  origin: BatchOrigin;
}

export interface CommandIntent {
  requestId: string;
  status: 'proposed' | 'needs-clarification' | 'unsupported';
  targets: string[];
  ops: IntentOp[];
  lifecycle?: LifecycleKind;
  question?: CommandQuestion;
  reason?: string;
}

/* ---------- Editable state held by the editor ---------- */

export interface EditableState {
  scene: Scene;
  relationships: Relationship[];
  assumptions: Assumption[];
}

/* ---------- Request identity (R-06) ---------- */

export interface TargetToken {
  experimentId: string;
  versionId: string;
  sceneRevision: number;
  sourceId: string;
  sourceRevision: number;
  epoch: number;
}

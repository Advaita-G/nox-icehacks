/**
 * PLACEHOLDER geometry + physical-limit adapter.
 *
 * Everything here belongs to the shared physics interface (Advaita: R-01 shapes and
 * frame, R-09 physical ranges). It mirrors the provisional 2D frame in
 * docs/product/ARCHITECTURE.md so the input lane can be built and tested. When the
 * shared types/validator are published, replace this module; nothing else in the
 * input package should hard-code shapes or ranges.
 */
import type { ObjectKind, SceneObject } from './types.ts';

export const PLACEHOLDER_NOTICE =
  'Geometry and physical ranges are placeholders until the shared physics interface is published (R-01, R-09).';

/** Required numeric dimension fields per kind (provisional R-01). */
export const DIMENSION_FIELDS: Record<ObjectKind, readonly string[]> = {
  ball: ['radius'],
  block: ['width', 'height'],
  domino: ['width', 'height'],
  platform: ['width', 'height'],
  ramp: ['width', 'height'],
  container: ['innerWidth', 'innerHeight', 'wallThickness'],
};

/** Provisional default body type per kind (needs Advaita, R-01). */
export const DEFAULT_BODY_TYPE: Record<ObjectKind, 'fixed' | 'dynamic'> = {
  ball: 'dynamic',
  block: 'dynamic',
  domino: 'dynamic',
  platform: 'fixed',
  ramp: 'fixed',
  container: 'fixed',
};

/** Provisional ranges (needs Advaita, R-09). [min, max] inclusive. */
export const LIMITS = {
  position: [-100, 100] as const,
  dimension: [0.01, 20] as const,
  mass: [0.001, 1000] as const,
  friction: [0, 2] as const,
  restitution: [0, 1] as const,
  speed: [0, 50] as const,
  angularSpeed: [0, 200] as const,
  gravity: [0, 50] as const,
  metersPerPx: [0.001, 0.1] as const,
  maxObjects: 30,
};

/** Physical defaults from ARCHITECTURE.md "Execution policies" (owned by Advaita). */
export const DEFAULTS = {
  mass: 1,
  friction: 0.3,
  restitution: 0.2,
  gravity: { gx: 0, gy: -9.81 },
  metersPerPx: 0.01,
  arrowSpeed: 2,
};

export const UNITS: Record<string, string> = {
  mass: 'kg',
  friction: '',
  restitution: '',
  x: 'm',
  y: 'm',
  angle: 'rad',
  radius: 'm',
  width: 'm',
  height: 'm',
  innerWidth: 'm',
  innerHeight: 'm',
  wallThickness: 'm',
  vx: 'm/s',
  vy: 'm/s',
  omega: 'rad/s',
  metersPerPx: 'm/px',
  gx: 'm/s²',
  gy: 'm/s²',
};

export function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return value >= min && value <= max;
}

export interface GeometryIssue {
  path: string;
  code: 'SCHEMA' | 'NON_FINITE' | 'OUT_OF_RANGE';
  message: string;
}

/** Validate an object's shape fields only (not mass/friction/velocity). */
export function checkShape(obj: SceneObject): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const fields = DIMENSION_FIELDS[obj.kind];
  if (!fields) return [{ path: 'kind', code: 'SCHEMA', message: `Unknown object kind "${String(obj.kind)}".` }];
  if (typeof obj.dims !== 'object' || obj.dims === null) {
    return [{ path: 'dims', code: 'SCHEMA', message: 'dims must be an object.' }];
  }
  for (const f of fields) {
    const v = obj.dims[f];
    const issue = checkNumber(v, `dims.${f}`, LIMITS.dimension, 'm');
    if (issue) issues.push(issue);
  }
  if (obj.kind === 'ramp') {
    const facing = obj.dims.facing;
    if (facing !== 'left' && facing !== 'right') {
      issues.push({ path: 'dims.facing', code: 'SCHEMA', message: 'Ramp facing must be "left" or "right".' });
    }
  }
  if (obj.kind === 'container') {
    const t = obj.dims.wallThickness;
    const w = obj.dims.innerWidth;
    if (typeof t === 'number' && typeof w === 'number' && t >= w) {
      issues.push({ path: 'dims.wallThickness', code: 'OUT_OF_RANGE', message: 'Container walls must be thinner than its opening.' });
    }
  }
  for (const [path, v] of [
    ['x', obj.x],
    ['y', obj.y],
  ] as const) {
    const issue = checkNumber(v, path, LIMITS.position, 'm');
    if (issue) issues.push(issue);
  }
  if (typeof obj.angle !== 'number' || !Number.isFinite(obj.angle)) {
    issues.push({ path: 'angle', code: nonFiniteOrSchema(obj.angle), message: 'Angle must be a finite number of radians.' });
  }
  return issues;
}

export function nonFiniteOrSchema(v: unknown): 'NON_FINITE' | 'SCHEMA' {
  if (typeof v === 'number') return 'NON_FINITE';
  if (typeof v === 'string' && /^\s*[-+]?(nan|infinity|inf)\s*$/i.test(v)) return 'NON_FINITE';
  return 'SCHEMA';
}

export function checkNumber(
  v: unknown,
  path: string,
  range: readonly [number, number],
  unit: string,
): GeometryIssue | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { path, code: nonFiniteOrSchema(v), message: `${path} must be a finite number${unit ? ` (${unit})` : ''}.` };
  }
  if (!inRange(v, range)) {
    return { path, code: 'OUT_OF_RANGE', message: `${path} must be between ${range[0]} and ${range[1]}${unit ? ` ${unit}` : ''}.` };
  }
  return null;
}

/** Axis-aligned bounding box in world metres (for hit-testing/highlighting only). */
export function boundingRadius(obj: SceneObject): number {
  const d = obj.dims;
  const n = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
  switch (obj.kind) {
    case 'ball':
      return n('radius');
    case 'container':
      return Math.hypot(n('innerWidth') + 2 * n('wallThickness'), n('innerHeight') + n('wallThickness')) / 2;
    default:
      return Math.hypot(n('width'), n('height')) / 2;
  }
}

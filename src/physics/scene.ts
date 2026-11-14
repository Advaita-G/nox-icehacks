import { add, sub, cross, dot, length, rotate, product, inverse, axisFrame, ZERO, IDENTITY } from './math.ts';
export type Vec3 = { x: number; y: number; z: number };
export type Quaternion = Vec3 & { w: number };
export const KINDS = ['ball', 'block', 'ramp', 'domino', 'platform', 'container', 'cylinder', 'capsule'] as const;
export type Kind = string;
export interface GeometryPart { shape: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'convex'; size: Vec3; position: Vec3; rotation: Quaternion; vertices?: Vec3[] }
export interface Constraint {
  id: string; type: 'fixed' | 'hinge' | 'slider' | 'spherical' | 'rope' | 'spring'; bodyA: string; bodyB: string;
  anchorA: Vec3; anchorB: Vec3; axisA?: Vec3; axisB?: Vec3; frameA?: Quaternion; frameB?: Quaternion;
  limits?: [number, number]; length?: number; stiffness?: number; damping?: number; contactsEnabled?: boolean;
  motor?: { targetVelocity: number; gain: number; maxEffort: number };
}
export interface Force { id: string; body: string; vector: Vec3; torque: Vec3; point?: Vec3; frame: 'world' | 'local' }
export interface Fan { id: string; rotor: string; stator?: string; axis: Vec3; position: Vec3; radius: number; tipRatio: number; spread: number; range: number }
export interface Assembly { id: string; label: string; bodies: string[] }
export interface SceneObject {
  id: string;
  label: string;
  kind: Kind;
  fixed: boolean;
  position: Vec3;
  rotation: Quaternion;
  width: number;
  height: number;
  depth: number;
  mass: number;
  velocity: Vec3;
  angularVelocity: Vec3;
  friction: number;
  restitution: number;
  wallThickness: number;
  geometry?: GeometryPart[];
  aerodynamics?: { coefficient: number; area: number };
}
export interface Scene {
  schemaVersion: 2;
  revision: number;
  name: string;
  scale: number;
  gravity: Vec3;
  assumptions: string[];
  sources: { kind: 'manual' | 'canvas' | 'photo'; reference: string }[];
  objects: SceneObject[];
  constraints: Constraint[];
  forces: Force[];
  fans: Fan[];
  assemblies: Assembly[];
  environment: { airDensity: number; airVelocity: Vec3 };
}
export const LIMITS = {
  objects: 128, colliders: 512, seconds: 30, speed: 50, angularSpeed: 80, position: 1000,
  massMin: .05, massMax: 100, dimensionMin: .1, dimensionMax: 30, frictionMax: 2, restitutionMax: 1,
  wallThicknessMin: .02, wallThicknessMax: 15,
  scale: [5, 500], gravity: 30, componentsPerCollection: 128, unitTolerance: 1e-5, assumptions: { count: 20, length: 500 },
  geometry: { parts: 32, normalizedSize: [.001, 2], normalizedPosition: 2, hullVertices: [4, 128], hullVertexMagnitude: 1, curvedDiameterTolerance: 1e-6 },
  joints: { anchor: 100, initialTransverseTolerance: .001, hingeLimit: Math.PI, sliderLimit: 100, length: [.001, 100], stiffness: [.001, 10000], damping: [0, 1000] },
  motor: { targetVelocity: [-80, 80], gain: [0, 1000], maxEffort: [0, 1000] },
  loads: { force: 10000, torque: 1000, localPoint: 100 },
  air: { density: [0, 20], speed: 50, dragCoefficient: [0, 5], dragArea: [.0001, 900] },
  fan: { origin: 100, radius: [.02, 10], tipRatio: [0, .5], spread: [0, 1], range: [.01, 100] },
} as const;
export type Property = 'mass' | 'friction' | 'restitution' | 'fixed' | 'velocity' | 'angularVelocity' | 'wallThickness' | 'label';
export type Operation =
  | { type: 'add'; object: SceneObject }
  | { type: 'replace-scene'; scene: Scene }
  | { type: 'remove'; id: string; cascade?: boolean }
  | { type: 'set-geometry'; id: string; geometry: GeometryPart[] }
  | { type: 'set-aerodynamics'; id: string; aerodynamics: SceneObject['aerodynamics'] | null }
  | { type: 'upsert-constraint'; constraint: Constraint }
  | { type: 'upsert-force'; force: Force }
  | { type: 'upsert-fan'; fan: Fan }
  | { type: 'upsert-assembly'; assembly: Assembly }
  | { type: 'remove-component'; collection: 'constraints' | 'forces' | 'fans' | 'assemblies'; id: string }
  | { type: 'set-environment'; environment: Scene['environment'] }
  | { type: 'transform-assembly'; id: string; translation: Vec3; rotation: Quaternion; pivot: Vec3 }
  | { type: 'move'; id: string; position: Vec3 }
  | { type: 'rotate'; id: string; rotation: Quaternion }
  | { type: 'resize'; id: string; width: number; height: number; depth: number }
  | { type: 'set-property'; id: string; property: Property; value: number | boolean | string | Vec3 }
  | { type: 'set-gravity'; gravity: Vec3 }
  | { type: 'set-scale'; scale: number };
export interface CommandBatch { baseSceneRevision: number; operations: Operation[] }

export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function record(value: unknown): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object.');
}
export function keys(value: object, allowed: readonly string[]): void {
  check(Object.keys(value).every(k => allowed.includes(k)), `Unsupported fields: ${Object.keys(value).filter(k => !allowed.includes(k)).join(', ')}. Clarify the intended physical behavior.`);
}
export function number(value: unknown, min: number, max: number, name: string): asserts value is number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${name} must be finite and between ${min} and ${max}.`);
}
export function text(value: unknown, max: number, name: string): asserts value is string {
  check(typeof value === 'string' && value.length > 0 && value.length <= max, `${name} must contain 1–${max} characters.`);
}
export function vector(value: unknown, max: number, name: string): asserts value is Vec3 {
  record(value);
  number(value.x, -max, max, `${name} x`); number(value.y, -max, max, `${name} y`); number(value.z, -max, max, `${name} z`);
  check(Math.hypot(value.x, value.y, value.z) <= max + 1e-8, `${name} magnitude must be at most ${max}.`);
}
export function quaternion(value: unknown): asserts value is Quaternion {
  record(value);
  for (const key of ['x', 'y', 'z', 'w']) number(value[key], -1, 1, 'Quaternion component');
  const q = value as Quaternion;
  check(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < LIMITS.unitTolerance, 'Rotation must be a unit quaternion.');
}
export function rotateZ(angle: number): Quaternion { return { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) }; }
export function validateScene(input: unknown): Scene {
  record(input);
  check(JSON.stringify(input).length <= 2_000_000, 'Scene exceeds 2 MB.');
  input = structuredClone(input); record(input);
  keys(input, ['schemaVersion', 'revision', 'name', 'scale', 'gravity', 'assumptions', 'sources', 'objects', 'constraints', 'forces', 'fans', 'assemblies', 'environment']);
  check(input.schemaVersion === 2, 'Unsupported scene schema; keep the original file.');
  number(input.revision, 0, 1e9, 'Revision'); check(Number.isInteger(input.revision), 'Revision must be an integer.');
  text(input.name, 80, 'Experiment name'); number(input.scale, ...LIMITS.scale, 'Drawing pixels per meter');
  vector(input.gravity, LIMITS.gravity, 'Gravity');
  check(Array.isArray(input.assumptions) && input.assumptions.length <= LIMITS.assumptions.count, `At most ${LIMITS.assumptions.count} assumptions.`);
  input.assumptions.forEach(a => text(a, LIMITS.assumptions.length, 'Assumption'));
  check(Array.isArray(input.sources) && input.sources.length <= 20, 'At most 20 source references.');
  input.sources.forEach(s => { record(s); check(['manual', 'canvas', 'photo'].includes(String(s.kind)), 'Unknown source kind.'); text(s.reference, 500, 'Source reference'); });
  check(Array.isArray(input.objects) && input.objects.length <= LIMITS.objects, `At most ${LIMITS.objects} objects.`);
  const ids = new Set<string>();
  input.objects.forEach(o => {
    record(o); keys(o, ['id', 'label', 'kind', 'fixed', 'position', 'rotation', 'width', 'height', 'depth', 'mass', 'velocity', 'angularVelocity', 'friction', 'restitution', 'wallThickness', 'geometry', 'aerodynamics']); text(o.id, 64, 'Object ID'); check(/^[\w-]+$/.test(o.id) && !ids.has(o.id), 'Object IDs must be unique letters, digits, underscores or hyphens.'); ids.add(o.id);
    text(o.label, 80, 'Object label'); text(o.kind, 80, 'Object kind');
    check(KINDS.includes(o.kind as typeof KINDS[number]) || o.geometry !== undefined, 'Custom named parts require explicit geometry.');
    check(typeof o.fixed === 'boolean', 'Fixed must be true or false.');
    record(o.position); number(o.position.x, -LIMITS.position, LIMITS.position, 'Position x'); number(o.position.y, -LIMITS.position, LIMITS.position, 'Position y'); number(o.position.z, -LIMITS.position, LIMITS.position, 'Position z');
    quaternion(o.rotation); number(o.width, LIMITS.dimensionMin, LIMITS.dimensionMax, `${o.id}: Width`); number(o.height, LIMITS.dimensionMin, LIMITS.dimensionMax, `${o.id}: Height`); number(o.depth, LIMITS.dimensionMin, LIMITS.dimensionMax, `${o.id}: Depth`);
    check(o.geometry !== undefined || o.kind !== 'ball' || (o.width === o.height && o.width === o.depth), 'A ball is a sphere: width, height and depth must match.');
    number(o.mass, LIMITS.massMin, LIMITS.massMax, `${o.id}: Mass`); vector(o.velocity, LIMITS.speed, 'Velocity'); vector(o.angularVelocity, LIMITS.angularSpeed, 'Angular velocity');
    check(!o.fixed || (o.velocity.x === 0 && o.velocity.y === 0 && o.velocity.z === 0 && Math.hypot(o.angularVelocity.x, o.angularVelocity.y, o.angularVelocity.z) === 0), 'Fixed objects must have zero velocity.');
    number(o.friction, 0, LIMITS.frictionMax, `${o.id}: Friction`); number(o.restitution, 0, LIMITS.restitutionMax, `${o.id}: Restitution`); number(o.wallThickness, LIMITS.wallThicknessMin, LIMITS.wallThicknessMax, `${o.id}: Wall thickness`);
    check(o.geometry !== undefined || o.kind !== 'container' || o.wallThickness * 2 < Math.min(o.width, o.height, o.depth), 'Container walls must leave an open interior.');
  });
  const scene = input as unknown as Scene;
  for (const key of ['constraints', 'forces', 'fans', 'assemblies'] as const) {
    scene[key] ??= []; check(Array.isArray(scene[key]) && scene[key].length <= LIMITS.componentsPerCollection, `At most ${LIMITS.componentsPerCollection} ${key}.`);
    const componentIds = new Set();
    for (const item of scene[key]) { record(item); text(item.id, 64, 'Component ID'); check(/^[\w-]+$/.test(item.id) && !componentIds.has(item.id), 'Component IDs must be valid and unique within a collection.'); componentIds.add(item.id); }
  }
  scene.environment ??= { airDensity: 1.225, airVelocity: { ...ZERO } };
  record(scene.environment); keys(scene.environment, ['airDensity', 'airVelocity']); number(scene.environment.airDensity, ...LIMITS.air.density, 'Air density'); vector(scene.environment.airVelocity, LIMITS.air.speed, 'Air velocity');
  const { geometry, joints, motor, loads, fan } = LIMITS;
  let count = 0;
  for (const o of scene.objects) {
    if (o.aerodynamics !== undefined) { record(o.aerodynamics); keys(o.aerodynamics, ['coefficient', 'area']); number(o.aerodynamics.coefficient, ...LIMITS.air.dragCoefficient, 'Drag coefficient'); number(o.aerodynamics.area, ...LIMITS.air.dragArea, 'Drag reference area'); }
    if (o.geometry === undefined) {
      check(!['cylinder', 'capsule'].includes(o.kind) || Math.abs(o.width - o.depth) < geometry.curvedDiameterTolerance, 'Cylinder/capsule x/z diameters must match.');
      check(o.kind !== 'capsule' || o.height >= o.width, 'Capsule height must include both hemispheres.');
      count += o.kind === 'container' ? 5 : 1; continue; }
    check(Array.isArray(o.geometry) && o.geometry.length > 0 && o.geometry.length <= geometry.parts, `Geometry requires 1–${geometry.parts} parts.`); count += o.geometry.length;
    for (const p of o.geometry) {
      record(p); keys(p, ['shape', 'size', 'position', 'rotation', ...(p.shape === 'convex' ? ['vertices'] : [])]); check(['box', 'sphere', 'cylinder', 'capsule', 'convex'].includes(p.shape), 'Unsupported geometry shape.');
      vector(p.position, geometry.normalizedPosition, 'Normalized part position'); quaternion(p.rotation); record(p.size);
      for (const axis of ['x', 'y', 'z'] as const) number(p.size[axis], ...geometry.normalizedSize, 'Normalized part size');
      const w = p.size.x * o.width, h = p.size.y * o.height, d = p.size.z * o.depth;
      check(p.shape === 'box' || p.shape === 'convex' || Math.abs(w - d) < geometry.curvedDiameterTolerance, `${o.id}: curved parts require equal x/z diameters after scaling (${w.toPrecision(8)} m vs ${d.toPrecision(8)} m).`);
      check(p.shape !== 'sphere' || Math.abs(w - h) < geometry.curvedDiameterTolerance, `${o.id}: sphere dimensions must match after scaling (${w.toPrecision(8)} m vs ${h.toPrecision(8)} m).`);
      check(p.shape !== 'capsule' || h >= w, 'Capsule height includes both hemispheres and must be at least its diameter.');
      if (p.shape === 'convex') {
        check(Array.isArray(p.vertices) && p.vertices.length >= geometry.hullVertices[0] && p.vertices.length <= geometry.hullVertices[1], `Convex hull needs ${geometry.hullVertices.join('–')} vertices.`);
        p.vertices.forEach(v => vector(v, geometry.hullVertexMagnitude, 'Normalized hull vertex'));
        const a = p.vertices[0], b = p.vertices.reduce((best, v) => length(sub(v, a)) > length(sub(best, a)) ? v : best);
        const c = p.vertices.reduce((best, v) => length(cross(sub(b, a), sub(v, a))) > length(cross(sub(b, a), sub(best, a))) ? v : best);
        const normal = cross(sub(b, a), sub(c, a));
        check(p.vertices.some(v => Math.abs(dot(normal, sub(v, a))) > 1e-8), 'Convex vertices must span a volume.');
      }
    }
  }
  check(count <= LIMITS.colliders, `At most ${LIMITS.colliders} collider parts.`);
  const body = (id: string) => { const o = scene.objects.find(o => o.id === id); check(o, `Unknown connected body: ${id}.`); return o; };
  const unit = (v: unknown, name: string) => { vector(v, 1 + LIMITS.unitTolerance, name); check(Math.abs(length(v) - 1) < LIMITS.unitTolerance, `${name} must be a unit vector.`); };
  for (const c of scene.constraints) {
    keys(c, ['id', 'type', 'bodyA', 'bodyB', 'anchorA', 'anchorB', 'contactsEnabled', ...(['hinge', 'slider'].includes(c.type) ? ['axisA', 'axisB', 'limits', 'motor', ...(c.type === 'slider' ? ['frameA', 'frameB'] : [])] : c.type === 'fixed' ? ['frameA', 'frameB'] : c.type === 'spring' ? ['length', 'stiffness', 'damping'] : c.type === 'rope' ? ['length'] : [])]);
    check(['fixed', 'hinge', 'slider', 'spherical', 'rope', 'spring'].includes(c.type), 'Unsupported constraint type.');
    const a = body(c.bodyA), b = body(c.bodyB); check(a !== b && !(a.fixed && b.fixed), 'Connect different bodies with at least one dynamic body.');
    vector(c.anchorA, joints.anchor, 'Local anchor A'); vector(c.anchorB, joints.anchor, 'Local anchor B');
    check(c.contactsEnabled === undefined || typeof c.contactsEnabled === 'boolean', 'Contact flag must be boolean.');
    if (c.type === 'hinge' || c.type === 'slider') {
      unit(c.axisA, 'Axis A'); c.axisB ??= structuredClone(c.axisA); unit(c.axisB, 'Axis B');
      check(dot(rotate(a.rotation, c.axisA!), rotate(b.rotation, c.axisB!)) > .9999, 'Joint axes must align in world space at creation.');
      if (c.type === 'slider') {
        c.frameA ??= axisFrame(c.axisA!); c.frameB ??= product(product(inverse(b.rotation), a.rotation), c.frameA); quaternion(c.frameA); quaternion(c.frameB);
        check(dot(rotate(c.frameA, { x: 1, y: 0, z: 0 }), c.axisA!) > .99999 && dot(rotate(c.frameB, { x: 1, y: 0, z: 0 }), c.axisB!) > .99999, 'Slider frames must match the declared local axes.');
      }
      if (c.limits !== undefined) { const extent = c.type === 'hinge' ? joints.hingeLimit : joints.sliderLimit; check(Array.isArray(c.limits) && c.limits.length === 2, 'Two joint limits required.'); c.limits.forEach(v => number(v, -extent, extent, 'Joint limit')); check(c.limits[0] <= c.limits[1], 'Joint limits must increase.'); }
      if (c.motor !== undefined) { record(c.motor); keys(c.motor, ['targetVelocity', 'gain', 'maxEffort']); number(c.motor.targetVelocity, ...motor.targetVelocity, 'Motor target velocity'); number(c.motor.gain, ...motor.gain, 'Motor gain'); number(c.motor.maxEffort, ...motor.maxEffort, 'Motor effort cap'); }
    } else check(c.motor === undefined && c.limits === undefined, 'Motors and limits require a hinge or slider.');
    if (c.type === 'fixed') { c.frameA ??= product(inverse(a.rotation), b.rotation); c.frameB ??= { ...IDENTITY }; quaternion(c.frameA); quaternion(c.frameB); }
    if (c.type === 'rope' || c.type === 'spring') number(c.length, ...joints.length, 'Connection rest/max length');
    if (c.type === 'spring') { number(c.stiffness, ...joints.stiffness, 'Spring stiffness'); number(c.damping, ...joints.damping, 'Spring damping'); }
  }
  for (const f of scene.forces) { keys(f, ['id', 'body', 'vector', 'torque', 'point', 'frame']); body(f.body); vector(f.vector, loads.force, 'Force'); vector(f.torque, loads.torque, 'Torque'); check(['world', 'local'].includes(f.frame), 'Force frame must be world or local.'); if (f.point !== undefined) vector(f.point, f.frame === 'local' ? loads.localPoint : LIMITS.position, 'Force point'); }
  for (const f of scene.fans) {
    keys(f, ['id', 'rotor', 'stator', 'axis', 'position', 'radius', 'tipRatio', 'spread', 'range']);
    const rotor = body(f.rotor); check(!rotor.fixed, 'Fan rotor must be dynamic.'); if (f.stator !== undefined) { body(f.stator); check(f.stator !== f.rotor, 'Rotor and stator differ.'); }
    unit(f.axis, 'Fan local axis'); vector(f.position, fan.origin, 'Fan local origin'); number(f.radius, ...fan.radius, 'Fan radius'); number(f.tipRatio, ...fan.tipRatio, 'Induced/tip speed ratio'); number(f.spread, ...fan.spread, 'Wake spread'); number(f.range, ...fan.range, 'Wake range');
  }
  for (const a of scene.assemblies) { keys(a, ['id', 'label', 'bodies']); text(a.label, 80, 'Assembly label'); check(Array.isArray(a.bodies) && a.bodies.length > 0 && a.bodies.length <= LIMITS.objects && new Set(a.bodies).size === a.bodies.length, 'Assembly requires unique bodies.'); a.bodies.forEach(body); }
  return scene;
}

export function applyCommands(scene: Scene, batch: unknown): Scene {
  record(batch); check(batch.baseSceneRevision === scene.revision, 'Stale scene revision. Refresh the scene and retry.');
  check(Array.isArray(batch.operations) && batch.operations.length > 0 && batch.operations.length <= 60, 'Provide 1–60 operations.');
  if (batch.operations.length === 1 && batch.operations[0]?.type === 'replace-scene') { const replacement = validateScene(batch.operations[0].scene); replacement.revision = scene.revision + 1; return replacement; }
  const next = validateScene(scene);
  for (const op of batch.operations) {
    record(op);
    if (op.type === 'add') { next.objects.push(op.object as SceneObject); continue; }
    if (op.type === 'set-gravity') { next.gravity = op.gravity as Vec3; continue; }
    if (op.type === 'set-scale') { next.scale = op.scale as number; continue; }
    if (op.type === 'set-environment') { next.environment = op.environment as Scene['environment']; continue; }
    const upserts = { 'upsert-constraint': ['constraints', 'constraint'], 'upsert-force': ['forces', 'force'], 'upsert-fan': ['fans', 'fan'], 'upsert-assembly': ['assemblies', 'assembly'] } as const;
    if (Object.hasOwn(upserts, String(op.type))) {
      const [key, field] = upserts[op.type as keyof typeof upserts], item = op[field]; record(item);
      const list = next[key] as { id: string }[], i = list.findIndex(c => c.id === item.id); if (i < 0) list.push(item as { id: string }); else list[i] = item as { id: string }; continue;
    }
    if (op.type === 'remove-component') { check(['constraints', 'forces', 'fans', 'assemblies'].includes(String(op.collection)), 'Unknown component collection.'); const list = next[op.collection as 'constraints']; const i = list.findIndex(c => c.id === op.id); check(i >= 0, 'Unknown component.'); list.splice(i, 1); continue; }
    if (op.type === 'transform-assembly') {
      const a = next.assemblies.find(a => a.id === op.id); check(a, 'Unknown assembly.'); vector(op.translation, 1000, 'Translation'); vector(op.pivot, 1000, 'Pivot'); quaternion(op.rotation);
      for (const o of next.objects.filter(o => a.bodies.includes(o.id))) { o.position = add(add(op.pivot, rotate(op.rotation, sub(o.position, op.pivot))), op.translation); o.rotation = product(op.rotation, o.rotation); o.velocity = rotate(op.rotation, o.velocity); o.angularVelocity = rotate(op.rotation, o.angularVelocity); } continue;
    }
    const object = next.objects.find(o => o.id === op.id);
    check(object, `Unknown object: ${String(op.id)}.`);
    switch (op.type) {
      case 'remove':
        if (op.cascade === true) {
          next.constraints = next.constraints.filter(c => c.bodyA !== object.id && c.bodyB !== object.id); next.forces = next.forces.filter(f => f.body !== object.id); next.fans = next.fans.filter(f => f.rotor !== object.id && f.stator !== object.id);
          next.assemblies = next.assemblies.map(a => ({ ...a, bodies: a.bodies.filter(id => id !== object.id) })).filter(a => a.bodies.length);
        }
        next.objects.splice(next.objects.indexOf(object), 1); break;
      case 'set-geometry': object.geometry = op.geometry as GeometryPart[]; break;
      case 'set-aerodynamics': if (op.aerodynamics === null) delete object.aerodynamics; else object.aerodynamics = op.aerodynamics as SceneObject['aerodynamics']; break;
      case 'move': object.position = op.position as Vec3; break;
      case 'rotate': object.rotation = op.rotation as Quaternion; break;
      case 'resize': object.width = op.width as number; object.height = op.height as number; object.depth = op.depth as number; break;
      case 'set-property':
        check(['mass', 'friction', 'restitution', 'fixed', 'velocity', 'angularVelocity', 'wallThickness', 'label'].includes(String(op.property)), 'Unsupported property.');
        Object.assign(object, { [op.property as Property]: op.value });
        if (op.property === 'fixed' && op.value === true) { object.velocity = { x: 0, y: 0, z: 0 }; object.angularVelocity = { x: 0, y: 0, z: 0 }; }
        break;
      default: throw new Error(`Unknown operation: ${String(op.type)}.`);
    }
  }
  next.revision++;
  return validateScene(next);
}

export function newObject(kind: Kind, id: string): SceneObject {
  const fixed = ['ramp', 'platform', 'container'].includes(kind);
  return { id, label: `${kind} ${id}`, kind, fixed, position: { x: 0, y: 3, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 },
    width: kind === 'domino' ? .18 : kind === 'ramp' ? 4 : kind === 'container' ? 2 : 1,
    height: kind === 'platform' ? .2 : kind === 'ramp' ? 2 : kind === 'container' ? 1.5 : 1,
    depth: kind === 'ramp' ? 2 : kind === 'container' ? 2 : kind === 'platform' ? 6 : kind === 'domino' ? .5 : 1,
    mass: 1, velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, friction: .3, restitution: .2, wallThickness: .1 };
}
export function emptyScene(name = 'Untitled experiment'): Scene {
  return { schemaVersion: 2, revision: 0, name, scale: 70, gravity: { x: 0, y: -9.81, z: 0 },
    assumptions: ['3D rigid bodies; balls are uniform solid spheres.', 'Rigid bodies; air drag only when explicitly configured. No deformation or rolling resistance.', 'Contact coefficients are assumed, not measured.'],
    sources: [{ kind: 'manual', reference: 'Manual physics workbench' }], objects: [], constraints: [], forces: [], fans: [], assemblies: [], environment: { airDensity: 1.225, airVelocity: { ...ZERO } } };
}

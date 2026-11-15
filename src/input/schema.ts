import { KINDS, LIMITS } from '../physics/scene.ts';

type Schema = Record<string, unknown>;
const object = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: 'object', properties, required, additionalProperties: false });
const number = (minimum: number, maximum: number): Schema => ({ type: 'number', minimum, maximum });
const text = (maxLength = 500, minLength = 1): Schema => ({ type: 'string', minLength, maxLength });
const array = (items: Schema, maxItems: number, minItems = 0): Schema => ({ type: 'array', items, minItems, maxItems });
const enumeration = (values: readonly (string | number)[]): Schema => ({ enum: values });
const vector = (bound: number): Schema => object({ x: number(-bound, bound), y: number(-bound, bound), z: number(-bound, bound) });
const xyz = (minimum: number, maximum: number): Schema => object({ x: number(minimum, maximum), y: number(minimum, maximum), z: number(minimum, maximum) });
const quaternion = object({ x: number(-1, 1), y: number(-1, 1), z: number(-1, 1), w: number(-1, 1) });
const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' }, bool = { type: 'boolean' };
const { geometry, joints, motor, air, loads, fan } = LIMITS;

// Generation constrains structure; the canonical validator still checks identity, geometry and physics.
const partFields = { size: xyz(...geometry.normalizedSize), position: vector(geometry.normalizedPosition), rotation: quaternion };
const geometryPart: Schema = { anyOf: [
  object({ shape: enumeration(['box', 'sphere', 'cylinder', 'capsule']), ...partFields }),
  object({ shape: enumeration(['convex']), ...partFields, vertices: array(vector(geometry.hullVertexMagnitude), geometry.hullVertices[1], geometry.hullVertices[0]) }),
] };
const parts = array(geometryPart, geometry.parts, 1);
const aerodynamics = object({ coefficient: number(...air.dragCoefficient), area: number(...air.dragArea) });
const bodyFields = {
  id, label: text(80), kind: text(80), fixed: bool, position: vector(LIMITS.position), rotation: quaternion,
  width: number(LIMITS.dimensionMin, LIMITS.dimensionMax), height: number(LIMITS.dimensionMin, LIMITS.dimensionMax), depth: number(LIMITS.dimensionMin, LIMITS.dimensionMax),
  mass: number(LIMITS.massMin, LIMITS.massMax), velocity: vector(LIMITS.speed), angularVelocity: vector(LIMITS.angularSpeed),
  friction: number(0, LIMITS.frictionMax), restitution: number(0, LIMITS.restitutionMax), wallThickness: number(LIMITS.wallThicknessMin, LIMITS.wallThicknessMax),
};
const body: Schema = { anyOf: [
  object({ ...bodyFields, kind: enumeration(KINDS), geometry: parts, aerodynamics }, Object.keys(bodyFields)),
  object({ ...bodyFields, geometry: parts, aerodynamics }, [...Object.keys(bodyFields), 'geometry']),
] };
const jointFields = { id, bodyA: id, bodyB: id, anchorA: vector(joints.anchor), anchorB: vector(joints.anchor) };
const joint = (type: string, fields: Record<string, Schema>, required: string[] = []): Schema => object({ ...jointFields, type: enumeration([type]), contactsEnabled: bool, ...fields }, [...Object.keys(jointFields), 'type', ...required]);
const drive = object({ targetVelocity: number(...motor.targetVelocity), gain: number(...motor.gain), maxEffort: number(...motor.maxEffort) });
const axes = { axisA: vector(1), axisB: vector(1), motor: drive };
const frames = { frameA: quaternion, frameB: quaternion };
const jointSchema: Schema = { anyOf: [
  joint('fixed', frames), joint('spherical', {}), joint('rope', { length: number(...joints.length) }, ['length']),
  joint('spring', { length: number(...joints.length), stiffness: number(...joints.stiffness), damping: number(...joints.damping) }, ['length', 'stiffness', 'damping']),
  joint('hinge', { ...axes, limits: array(number(-joints.hingeLimit, joints.hingeLimit), 2, 2) }, ['axisA']),
  joint('slider', { ...axes, ...frames, limits: array(number(-joints.sliderLimit, joints.sliderLimit), 2, 2) }, ['axisA']),
] };
const force = object({ id, body: id, vector: vector(loads.force), torque: vector(loads.torque), frame: enumeration(['world', 'local']), point: vector(LIMITS.position) }, ['id', 'body', 'vector', 'torque', 'frame']);
const fanSchema = object({ id, rotor: id, stator: id, axis: vector(1), position: vector(fan.origin), radius: number(...fan.radius), tipRatio: number(...fan.tipRatio), spread: number(...fan.spread), range: number(...fan.range) }, ['id', 'rotor', 'axis', 'position', 'radius', 'tipRatio', 'spread', 'range']);
const assembly = object({ id, label: text(80), bodies: array(id, LIMITS.objects, 1) });
const environment = object({ airDensity: number(...air.density), airVelocity: vector(air.speed) });
const sceneFields = {
  schemaVersion: enumeration([2]), revision: { type: 'integer', minimum: 0, maximum: 1e9 }, name: text(80), scale: number(...LIMITS.scale), gravity: vector(LIMITS.gravity),
  assumptions: array(text(LIMITS.assumptions.length), LIMITS.assumptions.count), sources: array(object({ kind: enumeration(['manual', 'canvas', 'photo']), reference: text(500) }), 20),
  objects: array(body, LIMITS.objects), constraints: array(jointSchema, LIMITS.componentsPerCollection), forces: array(force, LIMITS.componentsPerCollection),
  fans: array(fanSchema, LIMITS.componentsPerCollection), assemblies: array(assembly, LIMITS.componentsPerCollection), environment,
};
const scene = object(sceneFields), readyScene = object({ ...sceneFields, objects: array(body, LIMITS.objects, 1) });
const question = object({ id: text(64), prompt: text(500), options: array(text(500), 8) });
const questions = array(question, 12), descriptions = array(text(500), 20);
const provenance = { objectId: text(80), note: text(240), strokeIds: array(text(500), 500, 1), bbox: array(number(0, 1), 4, 4) };
const drawn: Schema = { anyOf: [
  object({ ...provenance, origin: enumeration(['sketch']) }, ['objectId', 'origin', 'note', 'bbox']),
  object({ ...provenance, origin: enumeration(['sketch']) }, ['objectId', 'origin', 'note', 'strokeIds']),
] };
const inferred = object({ ...provenance, origin: enumeration(['inferred']) }, ['objectId', 'origin', 'note']);

const interpretationFields = {
  requestId: text(256), sourceId: text(256), sourceRevision: { type: 'integer', minimum: 0 }, status: enumeration(['ready', 'needs-clarification', 'rejected']),
  grounding: array({ anyOf: [drawn, inferred] }, 128), questions, warnings: descriptions, message: text(500, 0),
};
// Full union branches avoid relying on the host grammar to merge sibling constraints.
export const INTERPRET_3D_SCHEMA: Schema = { type: 'object', $defs: { scene, readyScene }, anyOf: [
  object({ ...interpretationFields, status: enumeration(['ready']), scene: { $ref: '#/$defs/readyScene' }, grounding: array({ anyOf: [drawn, inferred] }, 128, 1), questions: array(question, 0) }),
  object({ ...interpretationFields, status: enumeration(['needs-clarification']), scene: { $ref: '#/$defs/scene' }, questions: array(question, 12, 1) }, Object.keys(interpretationFields)),
  object({ ...interpretationFields, status: enumeration(['rejected']), scene: { $ref: '#/$defs/scene' } }, Object.keys(interpretationFields)),
] };

const operation = (type: string, fields: Record<string, Schema>, required = Object.keys(fields)): Schema => object({ type: enumeration([type]), ...fields }, ['type', ...required]);
const property = (name: string, value: Schema): Schema => operation('set-property', { id, property: enumeration([name]), value });
const operations: Schema = { anyOf: [
  operation('add', { object: body }), operation('replace-scene', { scene }), operation('remove', { id, cascade: bool }, ['id']),
  operation('move', { id, position: vector(LIMITS.position) }), operation('rotate', { id, rotation: quaternion }),
  operation('resize', { id, width: bodyFields.width, height: bodyFields.height, depth: bodyFields.depth }),
  property('mass', bodyFields.mass), property('friction', bodyFields.friction), property('restitution', bodyFields.restitution), property('wallThickness', bodyFields.wallThickness),
  property('fixed', bool), property('label', text(80)), property('velocity', vector(LIMITS.speed)), property('angularVelocity', vector(LIMITS.angularSpeed)),
  operation('set-geometry', { id, geometry: parts }), operation('set-aerodynamics', { id, aerodynamics: { anyOf: [aerodynamics, { type: 'null' }] } }),
  operation('upsert-constraint', { constraint: jointSchema }), operation('upsert-force', { force }), operation('upsert-fan', { fan: fanSchema }), operation('upsert-assembly', { assembly }),
  operation('remove-component', { collection: enumeration(['constraints', 'forces', 'fans', 'assemblies']), id }), operation('set-environment', { environment }),
  operation('transform-assembly', { id, translation: vector(LIMITS.position), rotation: quaternion, pivot: vector(LIMITS.position) }),
  operation('set-gravity', { gravity: vector(LIMITS.gravity) }), operation('set-scale', { scale: number(...LIMITS.scale) }),
] };
const operationReference = { $ref: '#/$defs/operation' };
const commandFields = {
  requestId: text(256), status: enumeration(['proposed', 'needs-clarification', 'unsupported']), operations: array(operationReference, 60),
  summary: descriptions, questions, message: text(500, 0),
};
export const COMMAND_3D_SCHEMA: Schema = { type: 'object', $defs: { operation: operations }, anyOf: [
  object({ ...commandFields, status: enumeration(['proposed']), operations: array(operationReference, 60, 1), summary: array(text(500), 20, 1), questions: array(question, 0) }),
  object({ ...commandFields, status: enumeration(['proposed']), lifecycle: enumeration(['run', 'pause', 'resume', 'reset', 'replay']), operations: array(operationReference, 0), summary: array(text(500), 20, 1), questions: array(question, 0) }),
  object({ ...commandFields, status: enumeration(['needs-clarification']), operations: array(operationReference, 0), questions: array(question, 12, 1) }),
  object({ ...commandFields, status: enumeration(['unsupported']), operations: array(operationReference, 0) }),
] };

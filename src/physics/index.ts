export * from './scene.ts';
export * from './engine.ts';
export * from './experiments.ts';
export { geometryParts, primitive } from './geometry.ts';
export { EXAMPLES } from './examples.ts';
import { ENGINE, DT } from './engine.ts';
import { KINDS, LIMITS } from './scene.ts';

export const CAPABILITIES = {
  model: ENGINE, sceneSchema: 2, units: 'meters, kilograms, seconds, radians; right-handed XYZ with Y up', timestep: DT,
  objectNames: 'Unrestricted semantic names; custom parts require explicit geometry. Names never select behavior.',
  builtInKinds: KINDS,
  shapes: ['box', 'sphere', 'cylinder', 'capsule', 'convex', 'compound'],
  constraints: ['fixed', 'hinge', 'slider', 'spherical', 'rope', 'spring'],
  actuators: ['finite-effort hinge/slider velocity motor', 'force/torque in world or body frame'],
  air: ['declared quadratic drag', 'rotor-driven ideal actuator disk with finite conical wake'],
  editing: ['atomic command batches', 'custom geometry', 'all physical parameters', 'assembly translation/rotation', 'versioned scene replacement'],
  measurements: ['XYZ pose/velocity/spin', 'mass/inertia/center of mass', 'momentum/energy', 'motor effort/power', 'fan thrust/power/target/residual wake'],
  unresolvedSketchFields: ['scale/dimensions', 'rigid part separation', 'fixed or free supports', 'connections/axes', 'material coefficients', 'power/force intent', 'initial motion', 'physical law outside supported models'],
  modelLimits: ['rigid mechanics; no deformable solids, fracture, thermodynamics, circuits, chemistry or resolved CFD', 'fan reversed through-flow rejected', 'drag Cd/reference area and fan tip ratio are declared assumptions, not inferred measurements', 'contact/joint integration is numerical', 'determinism applies to this pinned engine/model and setup'],
  limits: LIMITS,
} as const;

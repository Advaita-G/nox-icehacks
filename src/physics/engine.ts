import RAPIER from '@dimforge/rapier3d-compat';
import { check, LIMITS, number, quaternion, record, validateScene, vector } from './scene.ts';
import type { Scene, Vec3, Quaternion } from './scene.ts';

import { colliderParts } from './geometry.ts';
import { Components } from './mechanisms.ts';
import type { MechanismSample } from './mechanisms.ts';

export const ENGINE = 'nox-mechanics@1/rapier3d-compat@0.21.0';
export const DT = 1 / 120;
export const SAMPLE_EVERY = 4;
export const SETTINGS = { timestep: DT, solverIterations: 12, ccdSubsteps: 4, frictionMix: 'average', restitutionMix: 'average' } as const;
let initialization: Promise<void> | undefined;
export function initPhysics(): Promise<void> { return initialization ??= RAPIER.init(); }
export interface BodySample {
  objectId: string;
  position: Vec3;
  centerOfMass: Vec3;
  rotation: Quaternion;
  velocity: Vec3;
  angularVelocity: Vec3;
  speed: number;
  mass: number;
  inertia: Vec3;
}
export interface Sample {
  simulationTime: number;
  bodies: BodySample[];
  kineticEnergy: number;
  potentialEnergy: number;
  momentum: Vec3;
  mechanisms: MechanismSample;
}
export interface Intervention { previousTime: number; previousVersionId: string; description: string }
export interface Run {
  versionId: string;
  engine: string;
  settings: { timestep: number; solverIterations: number; ccdSubsteps: number; frictionMix: string; restitutionMix: string };
  samples: Sample[];
  interventions: Intervention[];
}
export interface Checkpoint {
  engine: string;
  schemaVersion: 1;
  ticks: number;
  sceneRevision: number;
  setup: string;
  handles: [string, number][];
  snapshot: number[];
}

export class Physics {
  scene: Scene;
  world: RAPIER.World;
  handles = new Map<string, number>();
  ticks = 0;
  readonly timestep: number;
  components!: Components;
  constructor(input: Scene, timestep = DT) {
    // JSON storage converts -0 to 0; initialize with the same values used on reload.
    this.scene = JSON.parse(JSON.stringify(validateScene(input)));
    number(timestep, DT / 2, DT, 'Test timestep');
    this.timestep = timestep;
    this.world = new RAPIER.World(this.scene.gravity);
    this.world.timestep = timestep; this.world.numSolverIterations = SETTINGS.solverIterations; this.world.maxCcdSubsteps = SETTINGS.ccdSubsteps;
    try {
      for (const o of this.scene.objects) {
        const desc = (o.fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic())
          .setTranslation(o.position.x, o.position.y, o.position.z).setRotation(o.rotation).setLinvel(o.velocity.x, o.velocity.y, o.velocity.z)
          .setAngvel(o.angularVelocity).setLinearDamping(0).setAngularDamping(0).setCanSleep(false).setCcdEnabled(!o.fixed);
        const body = this.world.createRigidBody(desc); this.handles.set(o.id, body.handle);
        const parts = colliderParts(o).map(shape => this.world.createCollider(shape.setDensity(1)
          .setFriction(o.friction).setRestitution(o.restitution)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average), body));
        const volume = parts.reduce((sum, c) => sum + c.volume(), 0);
        check(volume > 1e-12 && Number.isFinite(volume), `Geometry for ${o.id} has no usable volume.`);
        for (const c of parts) c.setMass(o.mass * c.volume() / volume);
        body.recomputeMassPropertiesFromColliders();
      }
      this.components = new Components(this.scene, this.world, this.handles);
      this.sample();
    } catch (e) { this.world.free(); throw e; }
  }
  get time(): number { return this.ticks * this.timestep; }
  sample(): Sample {
    const result: Sample = { simulationTime: this.time, bodies: [], kineticEnergy: 0, potentialEnergy: 0, momentum: { x: 0, y: 0, z: 0 }, mechanisms: this.components.measure(this.world) };
    for (const o of this.scene.objects) {
      const body = this.world.getRigidBody(this.handles.get(o.id)!);
      const p = body.translation(), v = body.linvel(), com = body.worldCom(), rotation = body.rotation(), omega = body.angvel();
      const speed = Math.hypot(v.x, v.y, v.z), mass = o.fixed ? 0 : body.mass(), inertia = o.fixed ? { x: 0, y: 0, z: 0 } : body.principalInertia();
      number(p.x, -LIMITS.position, LIMITS.position, 'Runtime position x'); number(p.y, -LIMITS.position, LIMITS.position, 'Runtime position y'); number(p.z, -LIMITS.position, LIMITS.position, 'Runtime position z');
      vector(v, LIMITS.speed + .001, 'Runtime velocity'); vector(omega, LIMITS.angularSpeed, 'Runtime angular velocity');
      quaternion(rotation);
      result.bodies.push({ objectId: o.id, position: { ...p }, centerOfMass: { ...com }, rotation: { ...rotation }, velocity: { ...v }, angularVelocity: { ...omega }, speed, mass, inertia: { ...inertia } });
      // Rapier's inertia matrix borrows WASM memory; consume it before another engine call.
      const I = body.effectiveAngularInertia();
      result.kineticEnergy += .5 * mass * speed ** 2 + (o.fixed ? 0 : .5 * (I.m11 * omega.x ** 2 + I.m22 * omega.y ** 2 + I.m33 * omega.z ** 2
        + 2 * I.m12 * omega.x * omega.y + 2 * I.m13 * omega.x * omega.z + 2 * I.m23 * omega.y * omega.z));
      result.potentialEnergy -= mass * (this.scene.gravity.x * com.x + this.scene.gravity.y * com.y + this.scene.gravity.z * com.z);
      result.momentum.x += mass * v.x; result.momentum.y += mass * v.y; result.momentum.z += mass * v.z;
    }
    result.potentialEnergy += result.mechanisms.springEnergy;
    return result;
  }
  step(): Sample {
    check(this.time < LIMITS.seconds - 1e-9, '30 s run complete. Reset or edit to start a new run.');
    const before = this.world.takeSnapshot(), ticks = this.ticks;
    try {
      this.components.apply(this.world);
      this.world.step(); this.ticks++;
      return this.sample();
    } catch (e) {
      this.world.free(); this.world = RAPIER.World.restoreSnapshot(before); this.ticks = ticks;
      throw e;
    }
  }
  currentScene(): Scene {
    const current = structuredClone(this.scene), sample = this.sample();
    for (const o of current.objects) {
      const b = sample.bodies.find(b => b.objectId === o.id)!;
      o.position = { ...b.position }; o.rotation = { ...b.rotation }; o.velocity = { ...b.velocity }; o.angularVelocity = { ...b.angularVelocity };
    }
    return current;
  }
  checkpoint(): Checkpoint {
    return { engine: ENGINE, schemaVersion: 1, ticks: this.ticks, sceneRevision: this.scene.revision,
      setup: JSON.stringify(this.scene),
      handles: [...this.handles], snapshot: Array.from(this.world.takeSnapshot()) };
  }
  restore(input: unknown): void {
    record(input); check(input.engine === ENGINE && input.schemaVersion === 1, 'Incompatible checkpoint. Restart the saved setup.');
    check(input.sceneRevision === this.scene.revision, 'Checkpoint revision does not match the setup.');
    check(input.setup === JSON.stringify(this.scene), 'Checkpoint setup differs. Restart the saved setup.');
    number(input.ticks, 0, LIMITS.seconds / DT, 'Checkpoint ticks'); check(Number.isInteger(input.ticks), 'Invalid checkpoint tick count.');
    check(Array.isArray(input.snapshot) && input.snapshot.length > 0 && input.snapshot.length <= 2_000_000, 'Invalid checkpoint size.');
    check(input.snapshot.every(b => Number.isInteger(b) && b >= 0 && b <= 255), 'Invalid checkpoint bytes.');
    check(Array.isArray(input.handles) && input.handles.length === this.scene.objects.length, 'Invalid checkpoint object mappings.');
    const handles = new Map<string, number>();
    for (const pair of input.handles) {
      check(Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && typeof pair[1] === 'number' && Number.isFinite(pair[1]), 'Invalid body handle.');
      check(this.scene.objects.some(o => o.id === pair[0]) && !handles.has(pair[0]), 'Checkpoint has unknown or duplicate objects.'); handles.set(pair[0], pair[1]);
    }
    const snapshot = input.snapshot as number[], verified = new Physics(this.scene);
    try {
      for (let i = 0; i < input.ticks; i++) verified.step();
      const bytes = verified.world.takeSnapshot();
      check(JSON.stringify([...verified.handles]) === JSON.stringify([...handles]) && bytes.length === input.snapshot.length
        && bytes.every((b, i) => b === snapshot[i]), 'Checkpoint does not match deterministic physics. Setup and history retained.');
    } finally { verified.free(); }
    let restored: RAPIER.World | undefined;
    try {
      restored = RAPIER.World.restoreSnapshot(Uint8Array.from(input.snapshot));
      check(restored && Math.abs(restored.timestep - DT) < 1e-8 && restored.bodies.len() === this.scene.objects.length, 'Invalid snapshot world.');
      check(new Set(handles.values()).size === handles.size, 'Duplicate checkpoint body handles.');
      for (const h of handles.values()) check(restored.getRigidBody(h), 'Checkpoint body missing.');
      const previous = this.world, previousHandles = this.handles, previousTicks = this.ticks;
      this.world = restored; this.handles = handles; this.ticks = input.ticks;
      try { this.sample(); } catch (e) { this.world = previous; this.handles = previousHandles; this.ticks = previousTicks; throw e; }
      previous.free(); restored = undefined;
    } finally { restored?.free(); }
  }
  free(): void { this.world.free(); }
}

export class FixedClock {
  accumulator = 0;
  advance(elapsed: number, step: () => void): void {
    number(elapsed, 0, .1, 'Frame interval; playback paused after a delayed frame');
    this.accumulator += elapsed;
    while (this.accumulator + 1e-10 >= DT) { step(); this.accumulator -= DT; }
  }
  reset(): void { this.accumulator = 0; }
}

import RAPIER from '@dimforge/rapier3d-compat';
import { check } from './scene.ts';
import type { Scene, Constraint, Vec3 } from './scene.ts';
import { add, sub, mul, dot, length, rotate, cross, ZERO } from './math.ts';

export interface MechanismSample {
  springEnergy: number;
  connections: { id: string; separation: number; relativeVelocity: number; effort: number; power: number }[];
  fans: { id: string; angularVelocity: number; inducedSpeed: number; thrust: number; shaftPower: number; availablePower: number; targetForce: Vec3; targetPower: number; wakeForce: Vec3 }[];
}
type Load = { body: string; force: Vec3; torque: Vec3; point?: Vec3 };

export class Components {
  scene: Scene;
  handles: Map<string, number>;
  constructor(scene: Scene, world: RAPIER.World, handles: Map<string, number>) {
    this.scene = scene; this.handles = handles;
    for (const c of scene.constraints) {
      const a = this.body(world, c.bodyA), b = this.body(world, c.bodyB);
      const data = c.type === 'fixed' ? RAPIER.JointData.fixed(c.anchorA, c.frameA!, c.anchorB, c.frameB!)
        : c.type === 'hinge' ? RAPIER.JointData.revoluteWithAxes(c.anchorA, c.anchorB, c.axisA!, c.axisB!)
        : c.type === 'slider' ? RAPIER.JointData.prismatic(c.anchorA, c.anchorB, c.axisA!)
        : c.type === 'spherical' ? RAPIER.JointData.spherical(c.anchorA, c.anchorB)
        : c.type === 'rope' ? RAPIER.JointData.rope(c.length!, c.anchorA, c.anchorB)
        : RAPIER.JointData.spring(c.length!, c.stiffness!, c.damping!, c.anchorA, c.anchorB);
      const joint = world.createImpulseJoint(data, a, b, true); joint.setContactsEnabled(c.contactsEnabled ?? false);
      if (c.type === 'slider') { joint.setLocalFrame1(c.anchorA, c.frameA!); joint.setLocalFrame2(c.anchorB, c.frameB!); }
      if (c.limits) (joint as RAPIER.UnitImpulseJoint).setLimits(...c.limits);
    }
  }
  private body(world: RAPIER.World, id: string): RAPIER.RigidBody { return world.getRigidBody(this.handles.get(id)!); }
  private point(body: RAPIER.RigidBody, local: Vec3): Vec3 { return add(body.translation(), rotate(body.rotation(), local)); }
  private connection(world: RAPIER.World, c: Constraint) {
    const a = this.body(world, c.bodyA), b = this.body(world, c.bodyB), pa = this.point(a, c.anchorA), pb = this.point(b, c.anchorB);
    const axis = rotate(a.rotation(), c.axisA ?? { x: 1, y: 0, z: 0 });
    const va = c.type === 'hinge' ? a.angvel() : a.velocityAtPoint(pa), vb = c.type === 'hinge' ? b.angvel() : b.velocityAtPoint(pb);
    const relativeVelocity = dot(sub(vb, va), axis), effort = c.motor ? Math.max(-c.motor.maxEffort, Math.min(c.motor.maxEffort, c.motor.gain * (c.motor.targetVelocity - relativeVelocity))) : 0;
    return { a, b, pa, pb, axis, relativeVelocity, effort };
  }
  private evaluate(world: RAPIER.World): { sample: MechanismSample; loads: Load[] } {
    const dt = world.timestep, density = this.scene.environment.airDensity, ambient = this.scene.environment.airVelocity;
    const sample: MechanismSample = { springEnergy: 0, connections: [], fans: [] }, loads: Load[] = [], fanLoads: Load[] = [];
    const quadratic = (b: RAPIER.RigidBody, torque: Vec3) => { const I = b.effectiveWorldInvInertia(); return I.m11 * torque.x ** 2 + I.m22 * torque.y ** 2 + I.m33 * torque.z ** 2 + 2 * I.m12 * torque.x * torque.y + 2 * I.m13 * torque.x * torque.z + 2 * I.m23 * torque.y * torque.z; };
    for (const c of this.scene.constraints) {
      const { pa, pb, axis, relativeVelocity, effort } = this.connection(world, c), separation = length(sub(pb, pa));
      if (c.type === 'spring') sample.springEnergy += .5 * c.stiffness! * (separation - c.length!) ** 2;
      sample.connections.push({ id: c.id, separation, relativeVelocity, effort, power: effort * relativeVelocity });
      if (c.motor) {
        const f = mul(axis, effort), hinge = c.type === 'hinge';
        loads.push({ body: c.bodyB, force: hinge ? ZERO : f, torque: hinge ? f : ZERO, point: hinge ? undefined : pb },
          { body: c.bodyA, force: hinge ? ZERO : mul(f, -1), torque: hinge ? mul(f, -1) : ZERO, point: hinge ? undefined : pa });
      }
    }
    for (const f of this.scene.forces) {
      const b = this.body(world, f.body), local = f.frame === 'local';
      loads.push({ body: f.body, force: local ? rotate(b.rotation(), f.vector) : f.vector, torque: local ? rotate(b.rotation(), f.torque) : f.torque,
        point: f.point && (local ? this.point(b, f.point) : f.point) });
    }
    // One combined drag calculation per body prevents overlapping wakes from duplicating its drag.
    const fields: { id: string; origin: Vec3; axis: Vec3; induced: number; thrust: number; power: number; spin: number; excluded: Set<string>; sourceVelocity: Vec3 }[] = [];
    for (const f of this.scene.fans) {
      const rotor = this.body(world, f.rotor), stator = f.stator ? this.body(world, f.stator) : undefined;
      const shaft = rotate(rotor.rotation(), f.axis), spin = dot(sub(rotor.angvel(), stator?.angvel() ?? ZERO), shaft), sign = Math.sign(spin);
      const axis = mul(shaft, sign), origin = this.point(rotor, f.position), sourceVelocity = rotor.velocityAtPoint(origin);
      const induced = f.tipRatio * Math.abs(spin) * f.radius, inflow = dot(sub(ambient, sourceVelocity), axis);
      const through = inflow + induced;
      check(induced < 1e-9 || through >= 0, `Fan ${f.id}: reversed through-flow is outside the actuator-disk model. Reduce inflow or change the setup.`);
      const thrust = induced < 1e-9 ? 0 : 2 * density * Math.PI * f.radius ** 2 * induced * through;
      const power = thrust * Math.max(0, through), torque = Math.abs(spin) < 1e-9 ? 0 : power / Math.abs(spin);
      fanLoads.push({ body: f.rotor, force: mul(axis, -thrust), torque: mul(shaft, -sign * torque), point: origin });
      // Idealized stator recovers swirl: relative shaft work sums to -P in any rotating frame.
      if (f.stator) fanLoads.push({ body: f.stator, force: ZERO, torque: mul(shaft, sign * torque) });
      const inverseShaft = quadratic(rotor, shaft) + (stator ? quadratic(stator, shaft) : 0);
      check(torque * inverseShaft * dt <= Math.abs(spin) + 1e-10, `Fan ${f.id}: air load is too stiff at this timestep; increase rotor inertia or reduce radius/tip ratio. Setup retained.`);
      const excluded = new Set([f.rotor, f.stator ?? '']);
      this.scene.assemblies.filter(a => a.bodies.includes(f.rotor)).forEach(a => a.bodies.forEach(id => excluded.add(id)));
      fields.push({ id: f.id, origin, axis, induced, thrust, power, spin, excluded, sourceVelocity });
    }
    const sourceLoads = new Map<string, { force: Vec3; torque: Vec3 }>();
    for (const load of fanLoads) {
      const b = this.body(world, load.body), previous = sourceLoads.get(load.body) ?? { force: { ...ZERO }, torque: { ...ZERO } };
      previous.force = add(previous.force, load.force); previous.torque = add(previous.torque, add(load.torque, load.point ? cross(sub(load.point, b.worldCom()), load.force) : ZERO)); sourceLoads.set(load.body, previous);
    }
    const baseDrag = new Map<string, Vec3>();
    const candidates = fields.map(() => [] as { body: string; force: Vec3; velocity: Vec3; mass: number }[]);
    for (const o of [...this.scene.objects].sort((a, b) => a.id.localeCompare(b.id))) {
      if (o.fixed || !o.aerodynamics) continue;
      const b = this.body(world, o.id), velocity = b.linvel(), position = b.worldCom(), mass = b.mass();
      const k = .5 * density * o.aerodynamics.coefficient * o.aerodynamics.area, relative = sub(ambient, velocity);
      // Exact isolated quadratic-drag impulse avoids overshooting the air velocity in one step.
      const drag = (v: Vec3) => mul(v, k * length(v) / (1 + k * length(v) * dt / mass));
      const base = drag(relative); baseDrag.set(o.id, base); loads.push({ body: o.id, force: base, torque: ZERO });
      const hits: { index: number; jet: Vec3 }[] = [];
      fields.forEach((field, index) => {
        if (field.excluded.has(o.id) || field.thrust === 0) return;
        const f = this.scene.fans[index], offset = sub(position, field.origin), distance = dot(offset, field.axis), radius = f.radius + f.spread * distance;
        if (distance <= 0 || distance > f.range || length(sub(offset, mul(field.axis, distance))) > radius) return;
        hits.push({ index, jet: mul(field.axis, 2 * field.induced * f.radius / radius) });
      });
      if (!hits.length) continue;
      const totalJet = hits.reduce((sum, h) => add(sum, h.jet), { ...ZERO }), extra = sub(drag(add(relative, totalJet)), base);
      const weights = hits.map(h => length(h.jet)), totalWeight = weights.reduce((s, v) => s + v, 0);
      hits.forEach((h, i) => candidates[h.index].push({ body: o.id, force: mul(extra, weights[i] / totalWeight), velocity: sub(add(velocity, mul(add(base, sourceLoads.get(o.id)?.force ?? ZERO), dt / mass)), ambient), mass }));
    }
    let sourcePower = 0, sourceQuadratic = 0;
    for (const [id, load] of sourceLoads) {
      const b = this.body(world, id); if (!b.isDynamic()) continue;
      const velocity = add(b.linvel(), mul(baseDrag.get(id) ?? ZERO, dt / b.mass()));
      sourcePower += dot(load.force, sub(velocity, ambient)) + dot(load.torque, b.angvel());
      sourceQuadratic += dot(load.force, load.force) / b.mass() + quadratic(b, load.torque);
    }
    // Full source recoil and shared-body cross terms must not create passive air-frame energy.
    const extracted = -sourcePower - .5 * dt * sourceQuadratic;
    check(extracted >= -1e-9, 'Fan reaction is too stiff at this timestep; increase source mass/inertia or reduce aerodynamic load. Setup retained.');
    const totalPower = fields.reduce((sum, f) => sum + f.power, 0), availability = totalPower > 0 ? Math.min(1, Math.max(0, extracted) / totalPower) : 0;
    const available = fields.map(f => f.power * availability);
    loads.push(...fanLoads);
    const scales = fields.map((field, index) => {
      const axial = candidates[index].reduce((sum, c) => sum + Math.max(0, dot(c.force, field.axis)), 0);
      return axial > 0 ? Math.min(1, field.thrust / axial) : 1;
    });
    const totals = new Map<string, number>();
    candidates.forEach((list, i) => list.forEach(c => totals.set(c.body, (totals.get(c.body) ?? 0) + length(c.force) * scales[i])));
    // Cross terms from overlapping wakes share one conservative finite-step energy budget.
    const work = (index: number, global: number) => candidates[index].reduce((sum, c) => {
      const s = scales[index] * global;
      return sum + Math.max(0, s * dot(c.force, c.velocity) + .5 * dt * s * length(c.force) * global * totals.get(c.body)! / c.mass);
    }, 0);
    let global = 1;
    if (fields.some((_, i) => work(i, 1) > available[i])) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (fields.every((_, j) => work(j, mid) <= available[j])) lo = mid; else hi = mid; } global = lo;
    }
    fields.forEach((field, index) => {
      let total = { ...ZERO };
      for (const c of candidates[index]) { const force = mul(c.force, scales[index] * global); total = add(total, force); loads.push({ body: c.body, force, torque: ZERO }); }
      sample.fans.push({ id: field.id, angularVelocity: field.spin, inducedSpeed: field.induced, thrust: field.thrust, shaftPower: field.power, availablePower: available[index], targetForce: total, targetPower: work(index, global), wakeForce: sub(mul(field.axis, field.thrust), total) });
    });
    return { sample, loads };
  }
  measure(world: RAPIER.World): MechanismSample { return this.evaluate(world).sample; }
  apply(world: RAPIER.World): void {
    for (const handle of this.handles.values()) { const b = world.getRigidBody(handle); b.resetForces(true); b.resetTorques(true); }
    for (const load of this.evaluate(world).loads) {
      const b = this.body(world, load.body); if (load.point) b.addForceAtPoint(load.force, load.point, true); else b.addForce(load.force, true); b.addTorque(load.torque, true);
    }
  }
}

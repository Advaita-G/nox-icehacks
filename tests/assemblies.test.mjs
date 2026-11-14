import test from 'node:test';
import assert from 'node:assert/strict';
import { Physics, initPhysics, DT } from '../src/physics/engine.ts';
import { emptyScene, validateScene, applyCommands, rotateZ } from '../src/physics/scene.ts';
import { object, fan, spring, pendulum } from '../src/physics/examples.ts';
import { primitive, geometryParts } from '../src/physics/geometry.ts';
import { ZERO, IDENTITY } from '../src/physics/math.ts';
import { Workbench, validateLibrary } from '../src/physics/experiments.ts';
await initPhysics();
const close = (a, b, tolerance = .01) => assert.ok(Math.abs(a - b) < tolerance, `${a} versus ${b} ±${tolerance}`);
const body = (p, id) => p.sample().bodies.find(b => b.objectId === id);
const advance = (p, seconds) => { for (let i = 0; i < Math.round(seconds / p.timestep); i++) p.step(); };
function isolated(objects) { const s = emptyScene(); s.gravity = { ...ZERO }; s.objects = objects; return s; }

test('arbitrary named convex and compound parts have real volume, center of mass and inertia', () => {
  const tetra = { ...primitive('convex'), vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }] };
  const s = isolated([object('rough hand drawn bracket', 'tetra', { position: { ...ZERO }, geometry: [tetra], mass: 2 }),
    object('dumbbell', 'compound', { position: { x: 10, y: 0, z: 0 }, geometry: [primitive('sphere', { x: .5, y: .5, z: .5 }), { ...primitive('box', { x: .5, y: .5, z: .5 }), position: { x: 1, y: 0, z: 0 } }] })]);
  const p = new Physics(s);
  close(body(p, 'tetra').mass, 2, 1e-5); close(body(p, 'tetra').centerOfMass.x, .25, .001);
  assert.ok(body(p, 'compound').centerOfMass.x > 10.6); assert.ok(body(p, 'compound').inertia.z > body(p, 'compound').inertia.x);
  const before = JSON.stringify(p.scene); const bad = structuredClone(s); bad.objects[0].geometry[0].vertices[3] = { x: .2, y: .2, z: 0 };
  assert.throws(() => new Physics(bad), /span a volume/); assert.equal(JSON.stringify(p.scene), before); p.free();
});

test('cylinder and capsule dimensions compile consistently and invalid nonuniform curved resize is atomic', () => {
  const o = object('wheel', 'wheel', { geometry: [primitive('cylinder')], height: .2, mass: 2 });
  const s = validateScene(isolated([o])), p = new Physics(s);
  close(body(p, 'wheel').inertia.y, .25, .001);
  assert.deepEqual(geometryParts(o)[0].size, { x: 1, y: .2, z: 1 });
  assert.throws(() => applyCommands(s, { baseSceneRevision: 0, operations: [{ type: 'resize', id: 'wheel', width: 2, height: .2, depth: 1 }] }), /diameters/);
  assert.equal(s.objects[0].width, 1); p.free();
  const capsule = new Physics(isolated([object('capsule', 'cap', { height: 2 })])); close(body(capsule, 'cap').mass, 1, 1e-5); capsule.free();
});

test('explicit force and torque obey mass/inertia; local off-center force rotates with body', () => {
  const s = isolated([object('block', 'b', { mass: 2, position: { ...ZERO } })]);
  s.forces = [{ id: 'push', body: 'b', frame: 'world', vector: { x: 4, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 1 } }];
  const p = new Physics(s); advance(p, .5); close(body(p, 'b').velocity.x, 1, .001); close(body(p, 'b').angularVelocity.z, 1.5, .001); p.free();
  s.objects[0].rotation = rotateZ(Math.PI / 2); s.forces[0] = { id: 'push', body: 'b', frame: 'local', vector: { x: 4, y: 0, z: 0 }, torque: { ...ZERO }, point: { x: 0, y: 1, z: 0 } };
  const q = new Physics(s); q.step(); close(body(q, 'b').velocity.y, 2 * DT, .0001); assert.ok(body(q, 'b').angularVelocity.z < 0); q.free();
});

test('hinge motor has finite torque and equal/opposite free-base angular momentum', () => {
  const s = isolated([object('block', 'a', { position: { ...ZERO } }), object('block', 'b', { position: { ...ZERO } })]);
  s.constraints = [{ id: 'shaft', type: 'hinge', bodyA: 'a', bodyB: 'b', anchorA: { ...ZERO }, anchorB: { ...ZERO }, axisA: { x: 0, y: 0, z: 1 }, motor: { targetVelocity: 8, gain: 1, maxEffort: .2 } }];
  const p = new Physics(s); close(p.sample().mechanisms.connections[0].effort, .2, 1e-8); advance(p, .5);
  close(body(p, 'a').angularVelocity.z + body(p, 'b').angularVelocity.z, 0, 1e-5); close(body(p, 'b').angularVelocity.z, .6, .002); p.free();
});

test('rotated hinge, fixed connection and spherical joint hold their local anchors', () => {
  const p = new Physics(pendulum()); advance(p, 2); assert.ok(p.sample().mechanisms.connections[0].separation < .001); assert.ok(Math.abs(body(p, 'arm').angularVelocity.z) > .1); p.free();
  for (const type of ['fixed', 'spherical']) {
    const s = isolated([object('block', 'a', { fixed: true, position: { ...ZERO }, rotation: rotateZ(.6) }), object('block', 'b', { position: { x: 0, y: 2, z: 0 }, rotation: rotateZ(-.2), angularVelocity: { x: 0, y: 0, z: 1 } })]);
    s.constraints = [{ id: 'joint', type, bodyA: 'a', bodyB: 'b', anchorA: { ...ZERO }, anchorB: { x: Math.sin(.2) * 2, y: -Math.cos(.2) * 2, z: 0 } }];
    const q = new Physics(s); advance(q, .5); assert.ok(q.sample().mechanisms.connections[0].separation < .003); if (type === 'fixed') close(body(q, 'b').rotation.z, Math.sin(-.1), .002); q.free();
  }
});

test('slider motor respects rotated axis/limits and rope is unilateral', () => {
  const s = isolated([object('block', 'a', { fixed: true, position: { ...ZERO }, rotation: rotateZ(Math.PI / 2) }), object('block', 'b', { position: { ...ZERO }, rotation: rotateZ(Math.PI / 2) })]);
  s.constraints = [{ id: 'slide', type: 'slider', bodyA: 'a', bodyB: 'b', anchorA: { ...ZERO }, anchorB: { ...ZERO }, axisA: { x: 1, y: 0, z: 0 }, limits: [0, 1], motor: { targetVelocity: 2, gain: 4, maxEffort: 4 } }];
  const p = new Physics(s); advance(p, 2); close(body(p, 'b').position.y, 1, .003); close(body(p, 'b').position.x, 0, .001); p.free();
  s.objects[0].rotation = { ...IDENTITY }; s.objects[1].rotation = { ...IDENTITY }; s.objects[1].position = { x: 1, y: 0, z: 0 };
  s.constraints = [{ id: 'rope', type: 'rope', bodyA: 'a', bodyB: 'b', anchorA: { ...ZERO }, anchorB: { ...ZERO }, length: 2 }];
  const q = new Physics(s); advance(q, .5); close(body(q, 'b').position.x, 1, .0001); q.free();
  s.objects[1].velocity = { x: 3, y: 0, z: 0 }; const r = new Physics(s); advance(r, 1); assert.ok(body(r, 'b').position.x <= 2.002); r.free();
});

test('slider preserves initial twist and distinct body-local axes through edit and checkpoint restore', () => {
  for (const rotation of [{ x: Math.sin(.25), y: 0, z: 0, w: Math.cos(.25) }, rotateZ(Math.PI / 2)]) {
    const s = isolated([object('block', 'a', { fixed: true, position: { ...ZERO } }), object('block', 'b', { position: { ...ZERO }, rotation })]);
    s.constraints = [{ id: 'slide', type: 'slider', bodyA: 'a', bodyB: 'b', anchorA: { ...ZERO }, anchorB: { ...ZERO }, axisA: { x: 1, y: 0, z: 0 }, axisB: rotation.z ? { x: 0, y: -1, z: 0 } : { x: 1, y: 0, z: 0 }, motor: { targetVelocity: 1, gain: 2, maxEffort: 1 } }];
    const p = new Physics(s); advance(p, .5); close(body(p, 'b').rotation.x, rotation.x, 1e-5); close(body(p, 'b').rotation.z, rotation.z, 1e-5); assert.ok(body(p, 'b').position.x > .1);
    const resumed = new Physics(p.scene); resumed.restore(p.checkpoint()); p.step(); resumed.step(); assert.deepEqual(resumed.sample(), p.sample());
    const edited = new Physics(applyCommands(p.currentScene(), { baseSceneRevision: 0, operations: [{ type: 'set-property', id: 'b', property: 'mass', value: 2 }] })); edited.step(); close(body(edited, 'b').rotation.x, rotation.x, 1e-5); close(body(edited, 'b').rotation.z, rotation.z, 1e-5);
    p.free(); resumed.free(); edited.free();
  }
});

test('spring oscillator follows analytic period with bounded energy and damping removes energy', () => {
  const s = spring(), p = new Physics(s), initial = p.sample().potentialEnergy;
  advance(p, Math.PI / 4); close(body(p, 'mass').position.x, 1, .04);
  advance(p, Math.PI / 4); close(body(p, 'mass').position.x, 3, .05);
  assert.ok(p.sample().kineticEnergy + p.sample().potentialEnergy <= initial * 1.01); p.free();
  s.constraints[0].damping = 2; const q = new Physics(s); advance(q, 1.5); assert.ok(q.sample().kineticEnergy + q.sample().potentialEnergy < initial * .2); q.free();
});

test('declared quadratic drag matches analytic velocity and never accelerates past steady air', () => {
  const s = isolated([object('block', 'b', { velocity: { x: 10, y: 0, z: 0 }, aerodynamics: { coefficient: 1, area: 1 } })]); s.environment.airDensity = 2;
  const p = new Physics(s); advance(p, 1); close(body(p, 'b').velocity.x, 10 / 11, .001); p.free();
  s.objects[0].mass = .05; s.objects[0].aerodynamics.area = 900; const q = new Physics(s); q.step(); assert.ok(body(q, 'b').velocity.x >= 0); q.free();
});

test('fan rotation, on/off/reverse, shared wake budget and exact checkpoint continuation', () => {
  const s = fan(), p = new Physics(s); advance(p, 1);
  assert.ok(body(p, 'rotor').angularVelocity.z > 5); assert.ok(body(p, 'target').velocity.z > .05);
  const f = p.sample().mechanisms.fans[0]; assert.ok(f.thrust > 0); assert.ok(f.targetPower <= f.shaftPower + 1e-8); assert.ok(f.targetForce.z <= f.thrust + 1e-8); close(f.targetForce.z + f.wakeForce.z, f.thrust, 1e-8);
  const q = new Physics(p.scene); q.restore(p.checkpoint()); p.step(); q.step(); assert.deepEqual(q.sample(), p.sample()); p.free(); q.free();
  s.constraints[0].motor.targetVelocity = 0; const off = new Physics(s); advance(off, 1); close(body(off, 'target').velocity.z, 0, 1e-7); off.free();
  s.constraints[0].motor.targetVelocity = -30; s.objects[2].position.z = -2; const reverse = new Physics(s); advance(reverse, 1); assert.ok(body(reverse, 'target').velocity.z < -.05); reverse.free();
  const many = fan(); many.objects[2].mass = .05; many.objects.push(...Array.from({ length: 8 }, (_, i) => ({ ...structuredClone(many.objects[2]), id: `target${i}`, position: { x: -3 + (i - 4) * .12, y: 2, z: 1.5 + i * .5 }, width: .1, height: .1, depth: .1, aerodynamics: { coefficient: 5, area: 20 } })));
  const a = new Physics(many), reversed = structuredClone(many); reversed.objects.reverse(); const b = new Physics(reversed);
  advance(a, .5); advance(b, .5);
  const af = a.sample().mechanisms.fans[0], bf = b.sample().mechanisms.fans[0]; assert.ok(af.targetPower <= af.shaftPower + 1e-8); assert.ok(af.targetForce.z <= af.thrust + 1e-8); close(af.targetForce.z, bf.targetForce.z, .001);
  a.free(); b.free();
});

test('motor-off fan spins down and rotating whole base does not count as shaft spin', () => {
  const s = fan(); s.constraints[0].motor.maxEffort = 0; s.objects[1].angularVelocity.z = 20;
  const p = new Physics(s); advance(p, .5); assert.ok(body(p, 'rotor').angularVelocity.z < 20); p.free();
  const base = s.objects[0]; base.fixed = false; base.angularVelocity.z = 20; const q = new Physics(s); close(q.sample().mechanisms.fans[0].angularVelocity, 0, 1e-8); close(q.sample().mechanisms.fans[0].thrust, 0, 1e-8); q.free();
});

test('counter-rotating free stator and rotor lose the declared air power rather than gaining energy', () => {
  const s = fan(); s.objects = s.objects.filter(o => o.id !== 'target');
  s.objects[0].fixed = false; s.objects[0].mass = 10; s.objects[0].angularVelocity.z = -10;
  s.objects[1].angularVelocity.z = -5; s.constraints[0].motor.maxEffort = 0;
  const p = new Physics(s), before = p.sample(), power = before.mechanisms.fans[0].shaftPower;
  assert.ok(power > 0); p.step(); const after = p.sample();
  assert.ok(after.kineticEnergy < before.kineticEnergy); close(after.kineticEnergy - before.kineticEnergy, -power * DT, .00005); p.free();
});

test('under-resolved fan angular drag and free-source recoil reject without creating energy or changing valid work', () => {
  const rotor = object('ball', 'rotor', { position: { ...ZERO }, width: 20, height: 20, depth: 20, mass: .05, angularVelocity: { x: 0, y: 0, z: .01 } });
  const angular = isolated([object('block', 'base', { fixed: true, position: { ...ZERO } }), rotor]);
  angular.constraints = [{ id: 'shaft', type: 'hinge', bodyA: 'base', bodyB: 'rotor', anchorA: { ...ZERO }, anchorB: { ...ZERO }, axisA: { x: 0, y: 0, z: 1 } }];
  angular.fans = [{ id: 'fan', rotor: 'rotor', stator: 'base', axis: { x: 0, y: 0, z: 1 }, position: { ...ZERO }, radius: 10, tipRatio: .5, spread: .1, range: 10 }];
  assert.throws(() => new Physics(angular), /air load is too stiff/);
  const recoil = isolated([{ ...rotor, angularVelocity: { x: 0, y: 0, z: .1 } }]); recoil.fans = [{ ...angular.fans[0], stator: undefined, tipRatio: .08 }];
  assert.throws(() => new Physics(recoil), /Fan reaction is too stiff/);
  const bench = new Workbench(fan()); bench.play(); bench.capture(); const library = structuredClone(bench.library), checkpoint = bench.physics.checkpoint();
  assert.throws(() => bench.edit({ ...bench.commandContext, operations: [{ type: 'replace-scene', scene: recoil }] }), /Fan reaction is too stiff/); assert.deepEqual(bench.library, library); assert.equal(bench.running, true); assert.deepEqual(bench.physics.checkpoint(), checkpoint); bench.physics.free();
  recoil.fans[0].tipRatio = .001; const p = new Physics(recoil), before = p.checkpoint(); p.scene.fans[0].tipRatio = .08;
  assert.throws(() => p.step(), /Fan reaction is too stiff/); assert.equal(p.ticks, 0); assert.deepEqual(p.checkpoint().snapshot, before.snapshot); p.free();
});

test('legacy schema-2 libraries normalize missing components while retaining old history for explicit restart', async () => {
  const old = new Workbench(isolated([object('ball', 'b')])); old.tick(); old.capture();
  const library = structuredClone(old.library), saved = library.experiments[0].versions[0];
  for (const key of ['constraints', 'forces', 'fans', 'assemblies', 'environment']) delete saved.scene[key];
  for (const sample of saved.run.samples) delete sample.mechanisms;
  saved.run.engine = 'rapier3d-compat@0.21.0'; saved.checkpoint.engine = saved.run.engine;
  const valid = validateLibrary(library); assert.deepEqual(valid.experiments[0].versions[0].scene.constraints, []);
  const loaded = new Workbench(emptyScene()); await loaded.load({ read: async () => library, write: async () => {} });
  assert.equal(loaded.restartRequired, true); assert.deepEqual(loaded.scene.fans, []); assert.equal(loaded.selected.run.samples.length, 2);
  loaded.replay(saved.run.samples.at(-1).simulationTime); assert.ok(loaded.sample.bodies[0].velocity.x === 0); old.physics.free(); loaded.physics.free();
});

test('connections, components, group transforms and arbitrary geometry persist through atomic edits/history', async () => {
  const b = new Workbench(fan()); for (let i = 0; i < 30; i++) b.tick(); b.pinBaseline(); const old = structuredClone(b.library), context = b.commandContext;
  assert.throws(() => b.edit({ ...context, operations: [{ type: 'remove', id: 'rotor' }] }), /Unknown connected body/); assert.deepEqual(b.library, old);
  b.edit({ ...context, operations: [{ type: 'transform-assembly', id: 'fan', translation: { x: 2, y: 1, z: 0 }, rotation: rotateZ(.3), pivot: { ...ZERO } }] });
  assert.equal(b.scene.constraints.length, 1); assert.equal(b.experiment.baseline.scene.fans.length, 1);
  let saved; const storage = { read: async () => saved, write: async v => { saved = structuredClone(v); } }; await b.save(storage); validateLibrary(saved);
  const loaded = new Workbench(emptyScene()); await loaded.load(storage); assert.deepEqual(loaded.sample, b.sample); assert.equal(loaded.restartRequired, false);
  loaded.edit({ ...loaded.commandContext, operations: [{ type: 'remove', id: 'rotor', cascade: true }] }); assert.equal(loaded.scene.fans.length, 0); assert.equal(loaded.scene.constraints.length, 0);
  assert.equal(loaded.scene.assemblies[0].bodies.length, 1); b.physics.free(); loaded.physics.free();
});

test('overlapping fan wakes bound the actual finite-step target energy including cross terms', () => {
  const s = fan(); s.objects[0].position.x = -.8; s.objects[1].position.x = -.8;
  s.objects[1].angularVelocity.z = 30; s.constraints[0].motor.maxEffort = 0; s.fans[0].spread = 1;
  s.objects[2] = object('test target', 'target', { geometry: [primitive('box', { x: .1, y: .1, z: .1 })], position: { x: 0, y: 2, z: .35 }, width: .1, height: .1, depth: .1, mass: .05, aerodynamics: { coefficient: 5, area: 900 } });
  for (const id of ['base', 'rotor']) s.objects.push({ ...structuredClone(s.objects.find(o => o.id === id)), id: `${id}2`, position: { ...s.objects.find(o => o.id === id).position, x: .8 } });
  s.constraints.push({ ...structuredClone(s.constraints[0]), id: 'shaft2', bodyA: 'base2', bodyB: 'rotor2' });
  s.fans.push({ ...structuredClone(s.fans[0]), id: 'air2', rotor: 'rotor2', stator: 'base2' });
  s.assemblies.push({ id: 'fan2', label: 'Second fan', bodies: ['base2', 'rotor2'] });
  const p = new Physics(s), before = p.sample(), power = before.mechanisms.fans.reduce((sum, f) => sum + f.shaftPower, 0);
  assert.ok(power > 0); p.step(); const target = body(p, 'target'), energy = .5 * target.mass * target.speed ** 2;
  assert.ok(energy > 0 && energy <= power * DT + 1e-6, `${energy} J versus ${power * DT} J`); p.free();
});

test('all component edits and scene replacement are atomic; unsupported physics never disappears silently', () => {
  const s = fan(), original = JSON.stringify(s), shaft = structuredClone(s.constraints[0]); shaft.motor.targetVelocity = 10;
  const edited = applyCommands(s, { baseSceneRevision: 0, operations: [
    { type: 'upsert-constraint', constraint: shaft }, { type: 'upsert-fan', fan: { ...s.fans[0], tipRatio: .1 } },
    { type: 'upsert-force', force: { id: 'push', body: 'target', frame: 'world', vector: { x: 1, y: 0, z: 0 }, torque: { ...ZERO } } },
    { type: 'upsert-assembly', assembly: { id: 'system', label: 'System', bodies: s.objects.map(o => o.id) } },
    { type: 'set-aerodynamics', id: 'target', aerodynamics: { coefficient: .9, area: .2 } },
    { type: 'set-geometry', id: 'target', geometry: [primitive('sphere')] },
    { type: 'resize', id: 'target', width: .5, height: .5, depth: .5 },
    { type: 'set-environment', environment: { airDensity: 1, airVelocity: { ...ZERO } } },
  ] });
  assert.equal(JSON.stringify(s), original); assert.equal(edited.constraints[0].motor.targetVelocity, 10); assert.equal(edited.forces.length, 1);
  const without = applyCommands(edited, { baseSceneRevision: 1, operations: [{ type: 'remove-component', collection: 'forces', id: 'push' }, { type: 'set-aerodynamics', id: 'target', aerodynamics: null }] });
  assert.equal(without.forces.length, 0); assert.equal(without.objects[2].aerodynamics, undefined);
  const replaced = applyCommands(s, { baseSceneRevision: 0, operations: [{ type: 'replace-scene', scene: spring() }] }); assert.equal(replaced.revision, 1); assert.equal(replaced.constraints[0].type, 'spring');
  const unknown = structuredClone(s); unknown.objects[0].electricity = { voltage: 12 };
  assert.throws(() => validateScene(unknown), /Unsupported fields: electricity/);
  const bad = structuredClone(s); bad.constraints[0].type = 'gear'; assert.throws(() => validateScene(bad), /Unsupported fields|Unsupported constraint/);
  assert.throws(() => applyCommands(s, { baseSceneRevision: 0, operations: [{ type: 'upsert-fan', fan: { ...s.fans[0], rotor: 'missing' } }] }), /Unknown connected body/); assert.equal(JSON.stringify(s), original);
});

test('unsupported reversed fan through-flow rejects initial setup and a failed tick preserves the last valid world', () => {
  const s = fan(); s.objects[1].angularVelocity.z = 10; s.environment.airVelocity.z = -20;
  assert.throws(() => new Physics(s), /reversed through-flow/);
  const p = new Physics(fan()), before = p.checkpoint();
  // A supported external force may drive a source beyond this declared air-model regime.
  p.scene.environment.airVelocity.z = -20;
  assert.throws(() => p.step(), /reversed through-flow/); assert.equal(p.ticks, 0); assert.deepEqual(p.checkpoint().snapshot, before.snapshot); p.free();
});

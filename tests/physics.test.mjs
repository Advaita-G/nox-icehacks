import test from 'node:test';
import assert from 'node:assert/strict';
import { Physics, initPhysics, DT, FixedClock } from '../src/physics/engine.ts';
import { emptyScene, applyCommands, validateScene } from '../src/physics/scene.ts';
import { collision, dominoes, floor, newComposition, object, rampContainer } from '../src/physics/examples.ts';

await initPhysics();
function run(scene, seconds, dt = DT) {
  const physics = new Physics(scene, dt);
  for (let i = 0; i < Math.round(seconds / dt); i++) physics.step();
  return physics;
}
function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}, tolerance ${tolerance}`);
}

test('free fall matches analytic position/velocity; halving dt reduces position error', () => {
  const scene = emptyScene(); scene.objects = [object('ball', 'fall', { position: { x: 0, y: 10, z: 0 }, mass: 2 })];
  const errors = [];
  for (const dt of [DT, DT / 2]) {
    const p = run(scene, 1, dt), b = p.sample().bodies[0];
    close(b.position.y, 5.095, .05095, 'free-fall y'); close(b.velocity.y, -9.81, .0981, 'free-fall vy');
    close(b.inertia.z, .2, 1e-6, 'sphere inertia'); errors.push(Math.abs(b.position.y - 5.095)); p.free();
  }
  assert.ok(errors[1] < errors[0]); console.log('free-fall errors (m), dt and dt/2:', errors);
});

test('equal/unequal-mass elastic and inelastic head-on impacts obey momentum and restitution', () => {
  for (const mass of [1, 2, 4]) for (const e of [0, .5, 1]) {
    const p = run(collision(mass, e), 1.2), sample = p.sample(), [a, b] = sample.bodies;
    const va = (1 - e * mass) * 3 / (1 + mass), vb = (1 + e) * 3 / (1 + mass);
    close(a.velocity.x, va, .03, 'impact a'); close(b.velocity.x, vb, .03, 'impact b');
    close(sample.momentum.x, 3, .03, 'momentum');
    if (e === 1) close(sample.kineticEnergy, 4.5, .09, 'elastic energy');
    else assert.ok(sample.kineticEnergy <= 4.5 + 1e-5);
    p.free();
  }
});

test('oblique frictionless sphere collision conserves vector momentum and kinetic energy', () => {
  const scene = collision(2, 1); scene.objects[1].position.y = 2.3; scene.objects[1].position.z = .4;
  const p = run(scene, 1.2), s = p.sample();
  close(s.momentum.x, 3, .03, 'px'); close(s.momentum.y, 0, .01, 'py'); close(s.kineticEnergy, 4.5, .09, 'energy');
  close(s.momentum.z, 0, .01, 'pz'); assert.ok(Math.abs(s.bodies[1].velocity.z) > .1);
  assert.ok(Math.abs(s.bodies[1].velocity.y) > .1); p.free();
});

test('3D sphere, cuboid and compound-container inertia/center of mass follow geometry', () => {
  const s = emptyScene(); s.gravity = { x: 0, y: 0, z: 0 };
  s.objects = [object('ball', 'sphere', { position: { x: -4, y: 3, z: 0 }, mass: 2 }),
    object('block', 'box', { width: 2, height: 3, depth: 4, mass: 12, angularVelocity: { x: 1, y: 2, z: 3 } }),
    object('container', 'cup', { fixed: false, width: 2, height: 1.5, depth: 2, mass: 4.8, position: { x: 4, y: 3, z: 0 } })];
  const p = new Physics(s), sample = p.sample(), [sphere, box, cup] = sample.bodies;
  for (const value of Object.values(sphere.inertia)) close(value, .2, 1e-6, 'solid sphere inertia');
  const values = Object.values(box.inertia).sort((a, b) => a - b); [13, 20, 25].forEach((value, i) => close(values[i], value, .0001, 'cuboid principal inertia'));
  close(cup.mass, 4.8, 1e-5, 'compound mass');
  const baseVolume = 2 * 2 * .1, sideVolume = 2 * 2 * 1.4 * .1 + 2 * .1 * 1.4 * 1.8;
  close(cup.centerOfMass.y, 3 + (-.7 * baseVolume + .05 * sideVolume) / (baseVolume + sideVolume), .0001, 'container COM');
  close(sample.kineticEnergy, .5 * (25 * 1 + 20 * 4 + 13 * 9), .001, 'world tensor rotational energy'); p.free();
});
test('different masses fall together and 3D sphere motion is not locked to a plane', () => {
  const s = emptyScene(); s.objects = [object('ball', 'light', { mass: 1, position: { x: -2, y: 10, z: -2 }, velocity: { x: 0, y: 0, z: 2 } }),
    object('ball', 'heavy', { mass: 20, position: { x: 2, y: 10, z: 2 } })];
  const p = run(s, 1), [light, heavy] = p.sample().bodies;
  close(light.position.y, heavy.position.y, 1e-6, 'mass-independent free fall'); close(light.position.z, 0, .002, 'depth motion'); p.free();
});

test('sliding block follows Coulomb friction; average coefficient mixing is explicit', () => {
  const scene = emptyScene();
  scene.objects = [floor(), object('block', 'slider', { position: { x: -5, y: .501, z: 0 }, velocity: { x: 5, y: 0, z: 0 }, friction: .1, restitution: 0 })];
  const p = run(scene, .6), b = p.sample().bodies[1];
  close(b.velocity.x, 5 - .3 * 9.81 * .6, .065, 'sliding speed with mean mu=.3');
  console.log('sliding velocity:', b.velocity.x); p.free();
});

test('incline: frictionless acceleration, rolling sphere inertia and no-slip relation', () => {
  const angle = Math.PI / 12, tangent = { x: Math.cos(angle), y: -Math.sin(angle), z: 0 }, normal = { x: Math.sin(angle), y: Math.cos(angle), z: 0 };
  for (const rolling of [false, true]) for (const dt of [DT, DT / 2]) {
    const scene = emptyScene();
    scene.objects = [object('platform', 'slope', { position: { x: 0, y: 0, z: 0 }, width: 24, height: .2, rotation: { x: 0, y: 0, z: Math.sin(-angle / 2), w: Math.cos(angle / 2) }, friction: rolling ? 1 : 0, restitution: 0 }),
      object('ball', 'disk', { position: { x: -3 * tangent.x + .601 * normal.x, y: -3 * tangent.y + .601 * normal.y, z: 0 }, friction: rolling ? 1 : 0, restitution: 0 })];
    const p = run(scene, .8, dt), b = p.sample().bodies[1], v = b.velocity.x * tangent.x + b.velocity.y * tangent.y;
    const expected = 9.81 * Math.sin(angle) * .8 * (rolling ? 5 / 7 : 1);
    close(v, expected, Math.max(.02, expected * .02), rolling ? 'rolling' : 'sliding incline');
    if (rolling) close(v, -b.angularVelocity.z * .5, .02, 'no slip');
    console.log('incline', { rolling, dt, v, expected }); p.free();
  }
});

test('actual triangle ramp delivers the sphere through an open top into the container', () => {
  const p = run(rampContainer(), 5), ball = p.sample().bodies.find(b => b.objectId === 'ball');
  console.log('ramp/container sphere position:', ball.position);
  assert.ok(ball.position.x > .9 && ball.position.x < 3.1); assert.ok(ball.position.y > .3 && ball.position.y < 1.5); p.free();
});

test('domino propagation reaches last body and a deliberately large gap stops it', () => {
  for (const gap of [false, true]) {
    const p = run(dominoes(gap), 5), s = p.sample();
    assert.ok(Math.abs(s.bodies.find(b => b.objectId === 'd3').rotation.z) > .5);
    const last = s.bodies.find(b => b.objectId === 'd8');
    if (gap) close(last.rotation.z, 0, .02, 'gap stops chain'); else assert.ok(Math.abs(last.rotation.z) > .5);
    p.free();
  }
});

test('CCD prevents 50 m/s sphere and block tunneling through a .1 m wall', () => {
  for (const kind of ['ball', 'block']) {
    const scene = emptyScene(); scene.gravity = { x: 0, y: 0, z: 0 };
    scene.objects = [object('platform', 'wall', { position: { x: 0, y: 1, z: 0 }, width: .1, height: 4, restitution: 1, friction: 0 }),
      object(kind, 'fast', { position: { x: -1, y: 1, z: 0 }, width: kind === 'ball' ? .1 : .3, height: kind === 'ball' ? .1 : .3, depth: kind === 'ball' ? .1 : .3, velocity: { x: 50, y: 0, z: 0 }, restitution: 1, friction: 0 })];
    const p = run(scene, .05), b = p.sample().bodies[1]; assert.ok(b.position.x < 0); assert.ok(b.velocity.x < 0); p.free();
  }
});

test('fresh composition, deterministic reset and 30-body 30-second workload stay finite', () => {
  const scene = newComposition(), a = run(scene, 3), b = run(scene, 3);
  assert.deepEqual(a.sample(), b.sample()); a.free(); b.free();
  const load = emptyScene(); load.objects = [floor(), ...Array.from({ length: 29 }, (_, i) => object('ball', `ball${i}`, {
    position: { x: (i % 10) - 4.5, y: 2 + Math.floor(i / 10) * 1.1, z: 0 }, width: .6, height: .6, depth: .6, restitution: .1,
  }))];
  const start = performance.now(), p = run(load, 30); assert.equal(p.sample().bodies.length, 30);
  console.log('30 bodies ×30 s, wall time ms:', performance.now() - start); p.free();
});

test('snapshot restore continues exactly and malformed/incompatible snapshots preserve valid state', () => {
  const scene = dominoes(), a = run(scene, .8), b = new Physics(scene);
  const checkpoint = a.checkpoint(); b.restore(checkpoint); assert.deepEqual(a.sample(), b.sample());
  for (let i = 0; i < 120; i++) { a.step(); b.step(); }
  assert.deepEqual(a.sample(), b.sample());
  const before = b.sample();
  assert.throws(() => b.restore({ ...checkpoint, engine: 'old' }), /Incompatible/);
  assert.throws(() => b.restore({ ...checkpoint, snapshot: [1, 2, 3] })); assert.deepEqual(b.sample(), before); a.free(); b.free();
});

test('atomic commands reject NaN, unsupported/stale/unknown and partial mutations', () => {
  const s = collision(), before = structuredClone(s);
  for (const operations of [[{ type: 'remove', id: 'a' }, { type: 'move', id: 'missing', position: { x: 0, y: 0, z: 0 } }],
    [{ type: 'resize', id: 'a', width: NaN, height: 1 }], [{ type: 'set-property', id: 'a', property: '__proto__', value: {} }],
    [{ type: 'unknown', id: 'a' }], [{ type: 'set-property', id: 'a', property: 'velocity', value: { x: 51, y: 0, z: 0 } }]]) {
    assert.throws(() => applyCommands(s, { baseSceneRevision: s.revision, operations })); assert.deepEqual(s, before);
  }
  assert.throws(() => applyCommands(s, { baseSceneRevision: 99, operations: [{ type: 'remove', id: 'a' }] }), /Stale/);
  const bad = structuredClone(s); bad.objects[1].id = 'a'; assert.throws(() => validateScene(bad), /unique/);
});

test('fixed clock gives identical ticks at 30/60/144 Hz, pauses on a long frame', () => {
  for (const rate of [30, 60, 144]) {
    const clock = new FixedClock(); let ticks = 0;
    for (let i = 0; i < rate * 2; i++) clock.advance(1 / rate, () => ticks++);
    assert.equal(ticks, 240); assert.throws(() => clock.advance(.5, () => ticks++), /paused/); assert.equal(ticks, 240);
  }
});

test('the real 3D solver reaches identical state at different render cadences', () => {
  const samples = [];
  for (const rate of [30, 60, 144]) {
    const p = new Physics(collision()), clock = new FixedClock();
    for (let i = 0; i < rate * 2; i++) clock.advance(1 / rate, () => p.step());
    samples.push(p.sample()); p.free();
  }
  assert.deepEqual(samples[0], samples[1]); assert.deepEqual(samples[1], samples[2]);
});
test('a torque-free anisotropic body conserves vector angular momentum and rotational energy', () => {
  const s = emptyScene(); s.gravity = { x: 0, y: 0, z: 0 };
  s.objects = [object('block', 'rotor', { width: 2, height: 1, depth: .5, angularVelocity: { x: 1, y: 2, z: 3 } })];
  const p = new Physics(s), initialEnergy = p.sample().kineticEnergy;
  function angularMomentum() {
    const body = p.world.getRigidBody(p.handles.get('rotor')), w = body.angvel(), I = body.effectiveAngularInertia();
    return [I.m11 * w.x + I.m12 * w.y + I.m13 * w.z, I.m12 * w.x + I.m22 * w.y + I.m23 * w.z, I.m13 * w.x + I.m23 * w.y + I.m33 * w.z];
  }
  const initial = angularMomentum(); for (let i = 0; i < 360; i++) p.step(); const final = angularMomentum();
  initial.forEach((value, i) => close(final[i], value, .01 * Math.hypot(...initial), 'angular momentum component'));
  close(p.sample().kineticEnergy, initialEnergy, .02 * initialEnergy, 'rotational energy'); p.free();
});

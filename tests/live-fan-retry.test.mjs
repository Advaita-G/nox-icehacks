// Live fan retry (Momen #33, after PR #14): the verbatim reply is rejected for two geometry/aim errors;
// correcting exactly those two produces measured wake force on the box, and a zero-speed control produces none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics, initPhysics, validateScene } from '../src/physics/index.ts';

const reply = JSON.parse(readFileSync(new URL('../docs/evidence/live-momen-2026-11-10-fan-retry/conv-33-response.json', import.meta.url), 'utf8'));
const scene = () => structuredClone(reply.scene);
const rotorOf = (s) => s.objects.find((o) => o.id === 'fan-rotor');
const fixHub = (s) => { const hub = rotorOf(s).geometry.find((g) => g.shape === 'cylinder'); hub.size = { x: hub.size.y, y: hub.size.x, z: hub.size.z }; return s; };
const pitch = (s) => { const { y, w } = rotorOf(s).rotation; rotorOf(s).rotation = { x: 0, y: 0, z: y, w }; return s; };
const at3s = (s) => {
  const physics = new Physics(validateScene(s));
  try { let x; for (let i = 0, n = Math.round(3 / physics.timestep); i < n; i++) x = physics.step(); return x; } finally { physics.free(); }
};

test('live fan retry: recorded reply rejected, two-fix control blows on the box, motor-off control does not', async () => {
  assert.equal(reply.status, 'ready');
  assert.equal(reply.scene.constraints[0].motor.targetVelocity, 62.8318530718); // 600 rpm, inside the published limit
  assert.throws(() => validateScene(scene()), /fan-rotor: curved parts require equal x\/z diameters after scaling \(0\.040000000 m vs 0\.060000000 m\)/);
  assert.throws(() => validateScene(fixHub(scene())), /Joint axes must align in world space at creation/);
  await initPhysics();
  const on = at3s(pitch(fixHub(scene())));
  assert.ok(on.mechanisms.fans[0].thrust > 0.3);
  assert.ok(on.mechanisms.fans[0].targetForce.x > 0.05);
  const off = scene(); fixHub(off); pitch(off); off.constraints[0].motor.targetVelocity = 0;
  assert.equal(at3s(off).mechanisms.fans[0].targetForce.x, 0);
});

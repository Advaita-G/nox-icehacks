// Live unfamiliar mechanism (Momen #35): the model connects a spring-return cart correctly but anchors the slider
// 4 cm low, so the run halts; with only that anchor corrected, doubling stiffness shortens the period by ~1/sqrt(2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics, initPhysics, validateScene } from '../src/physics/index.ts';

const reply = JSON.parse(readFileSync(new URL('../docs/evidence/live-momen-2026-11-10-spring-cart/conv-35-response.json', import.meta.url), 'utf8'));
const variant = (stiffness, sliderY) => {
  const s = structuredClone(reply.scene);
  s.constraints.find((c) => c.id === 'return-spring').stiffness = stiffness;
  if (sliderY !== undefined) s.constraints.find((c) => c.id === 'cart-track-slider').anchorA.y = sliderY;
  return s;
};
const period = (scene) => {
  const physics = new Physics(validateScene(scene)); const cross = []; let prev;
  try {
    for (let i = 0, n = Math.round(4 / physics.timestep); i < n; i++) {
      physics.step(); const x = physics.sample().bodies.find((b) => b.objectId === 'cart-body').position.x; const t = (i + 1) * physics.timestep;
      if (prev && prev[1] > 0.4 && x <= 0.4) cross.push(prev[0] + (prev[1] - 0.4) / (prev[1] - x) * (t - prev[0]));
      prev = [t, x];
    }
  } finally { physics.free(); }
  return (cross.at(-1) - cross[0]) / (cross.length - 1);
};

test('live spring cart: connections are present, recorded slider halts the run, corrected stiffness change is measured', async () => {
  const types = reply.scene.constraints.map((c) => `${c.type}:${c.bodyA}-${c.bodyB}`).sort();
  assert.deepEqual(types, ['hinge:cart-body-wheel-left', 'hinge:cart-body-wheel-right', 'slider:track-cart-body', 'spring:wall-cart-body']);
  await initPhysics();
  const halted = new Physics(validateScene(variant(40)));
  try { assert.throws(() => { for (let i = 0; i < 120; i++) halted.step(); }, /Runtime angular velocity z must be finite/); } finally { halted.free(); }
  const soft = period(variant(20, 0.12)), stiff = period(variant(40, 0.12));
  assert.ok(Math.abs(soft - 0.993) < 0.02, `k=20 period ${soft}`);
  assert.ok(Math.abs(stiff / soft - Math.SQRT1_2) < 0.01, `ratio ${stiff / soft}`);
});

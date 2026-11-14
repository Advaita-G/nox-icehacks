// Advaita's #23 follow-ups on the live seesaw (Momen #91-#98):
//   G3 the drawn ground line was silently dropped; L3 "1 kg left box" stayed after the mass became 2 kg;
//   slider spike: the generated slider kept contacts on between touching bodies with no rail limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Physics, initPhysics, validateScene, applyCommands } from '../src/physics/index.ts';
import { INTERPRET_3D, COMMAND_3D } from '../src/input/prompt.ts';

const read = (id) => JSON.parse(readFileSync(new URL(`../docs/evidence/live-22-seesaw-2026-11-12/attempt-3/conv-${id}-response.json`, import.meta.url), 'utf8'));
const apply = (scene, id) => applyCommands(scene, { baseSceneRevision: scene.revision, operations: read(id).operations });
const version9 = () => { let s = validateScene(read(91).scene); for (const id of [93, 94, 96, 98]) s = apply(s, id); return s; };

function energyAndSpin(scene) {
  const p = new Physics(validateScene(scene)); let e0, maxE = -Infinity, outOfPlane = 0, maxAlong = 0;
  try {
    for (let i = 1; i <= 240; i++) {
      const x = p.step(), e = x.kineticEnergy + x.potentialEnergy; if (i === 1) e0 = e; maxE = Math.max(maxE, e);
      const box = x.bodies.find((b) => b.objectId === 'right-box'), plank = x.bodies.find((b) => b.objectId === 'plank');
      outOfPlane = Math.max(outOfPlane, Math.hypot(box.angularVelocity.x, box.angularVelocity.y));
      const a = 2 * Math.atan2(plank.rotation.z, plank.rotation.w);
      maxAlong = Math.max(maxAlong, (box.position.x - plank.position.x) * Math.cos(a) + (box.position.y - plank.position.y) * Math.sin(a));
    }
  } finally { p.free(); }
  return { gain: maxE - e0, outOfPlane, maxAlong };
}

test('slider spike: the generated slider (contacts on, no limits) gains energy and spins out of plane', async () => {
  await initPhysics();
  const slider = version9().constraints.find((c) => c.id === 'right-box-slider');
  assert.equal(slider.contactsEnabled, true); assert.equal(slider.limits, undefined);
  const r = energyAndSpin(version9());
  assert.ok(r.gain > 1, `energy gain ${r.gain} J`);
  assert.ok(r.outOfPlane > 3, `out-of-plane spin ${r.outOfPlane} rad/s`);
});

test('slider spike: contacts off plus rail limits conserve energy, stay in plane and keep the box on the plank', async () => {
  await initPhysics();
  const scene = version9(); const slider = scene.constraints.find((c) => c.id === 'right-box-slider');
  slider.contactsEnabled = false; slider.limits = [-0.6, 0.1];
  const r = energyAndSpin(scene);
  assert.ok(r.gain < 1e-3, `energy gain ${r.gain} J`);
  // Joint compliance at the floor impact leaves ~0.19 rad/s; the defective setup reaches > 3 rad/s.
  assert.ok(r.outOfPlane < 0.3, `out-of-plane spin ${r.outOfPlane} rad/s`);
  assert.ok(r.maxAlong <= 1 - 0.129 + 1e-3, `box reached ${r.maxAlong} m along a 1 m half-plank`);
});

test('G3/L3 are present in the verbatim replies', () => {
  const scene = read(91).scene, strokes = JSON.parse(readFileSync(new URL('../docs/evidence/live-22-seesaw-2026-11-12/attempt-3/conv-91-request.json', import.meta.url), 'utf8')).source.strokes;
  const cited = new Set(read(91).grounding.flatMap((g) => g.strokeIds ?? []));
  assert.ok(strokes.some((s) => !cited.has(s.id)), 'some drawn stroke (the ground line) is not represented');
  assert.ok(!scene.objects.some((o) => /floor|ground/i.test(o.id)), 'no ground body in the generated scene');
  assert.match(scene.objects.find((o) => o.id === 'left-box').label, /1 kg/);
  assert.ok(!read(94).operations.some((op) => op.property === 'label'), 'the mass edit left the "1 kg" label unchanged');
});

test('prompts now require drawn supports, value-free labels and non-fighting joints', () => {
  for (const prompt of [INTERPRET_3D, COMMAND_3D]) {
    assert.match(prompt, /set contactsEnabled:false/);
    assert.match(prompt, /give a slider limits that keep the part on its rail/);
    assert.match(prompt, /Labels name a part by its role, never by a value an edit can change/);
  }
  assert.match(INTERPRET_3D, /Model every drawn ground, floor, table, wall or support line as a fixed body, or ask about it; never drop a drawn support silently/);
  assert.match(COMMAND_3D, /If a changed value appears in a part's label, also update that label/);
});

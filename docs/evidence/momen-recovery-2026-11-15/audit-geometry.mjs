// Offline checks of preserved actual replies; no model calls or inferred accuracy score.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { geometryParts } from '../../../src/physics/geometry.ts';
import { add, rotate } from '../../../src/physics/math.ts';

const load = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
function bounds(object, part) {
  const points = part.vertices ?? [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => ({ x: x * part.size.x / 2, y: y * part.size.y / 2, z: z * part.size.z / 2 }))));
  const world = points.map(p => add(object.position, rotate(object.rotation, add(part.position, rotate(part.rotation, p)))));
  return Object.fromEntries(['x', 'y', 'z'].map(a => [a, [Math.min(...world.map(p => p[a])), Math.max(...world.map(p => p[a]))]]));
}
const bodyBounds = object => {
  const parts = geometryParts(object).map(p => bounds(object, p));
  return Object.fromEntries(['x', 'y', 'z'].map(a => [a, [Math.min(...parts.map(p => p[a][0])), Math.max(...parts.map(p => p[a][1]))]]));
};
function connectedChair(path) {
  const object = load(path).scene.objects.find(o => /chair/i.test(o.id));
  const parts = geometryParts(object);
  assert.ok(parts.every(p => p.shape === 'box' && Math.abs(p.rotation.w - 1) < 1e-10), 'Connectivity check is exact only for these unrotated box members');
  const boxes = parts.map(p => bounds(object, p)), reached = new Set([0]);
  for (let pass = 0; pass < boxes.length; pass++) for (let i = 0; i < boxes.length; i++) {
    if ([...reached].some(j => ['x', 'y', 'z'].every(a => boxes[i][a][0] <= boxes[j][a][1] + .0005 && boxes[j][a][0] <= boxes[i][a][1] + .0005))) reached.add(i);
  }
  return { parts: boxes.length, reached: reached.size, connected: reached.size === boxes.length };
}
const original = connectedChair('corpus/case-03/canonical.json');
assert.equal(original.connected, false, 'Retain the original actual geometry failure');
const pilot = connectedChair('metric-pilot/case-03/canonical.json');
const final = connectedChair('final-metric/case-03/canonical.json');
assert.ok(pilot.connected && final.connected, 'All chair frame members must touch');
const houses = ['final-metric/case-01/canonical.json', 'final-repeat/case-01-repeat/canonical.json'].map(path => {
  const scene = load(path).scene, roof = scene.objects.find(o => o.id === 'roof');
  const wall = scene.objects.find(o => /^(house_base|base|walls|wall|house)$/.test(o.id));
  assert.ok(roof && wall, path);
  const gap = bodyBounds(roof).y[0] - bodyBounds(wall).y[1];
  assert.ok(Math.abs(gap) < .0001, `Roof gap: ${gap}`);
  return { path, roofWallGapMeters: gap, facadeParts: scene.objects.filter(o => /window|door/.test(o.id)).map(o => ({ id: o.id, parts: o.geometry.length })) };
});
const annotated = load('metric-pilot/case-02/canonical.json').scene;
const ball = annotated.objects.find(o => o.id === 'ball'), plank = annotated.objects.find(o => o.id === 'plank');
assert.equal(ball.mass, 1); assert.equal(geometryParts(ball)[0].size.x, 1); assert.equal(geometryParts(plank)[0].size.x, 3);
const contact = bodyBounds(ball).y[0] - bodyBounds(plank).y[1]; assert.ok(Math.abs(contact) < .001, `Ball/plank contact exceeds 1 mm: ${contact}`);
const lever = load('final-metric/case-10/canonical.json').scene;
const hinge = lever.constraints.find(c => c.type === 'hinge'); assert.ok(hinge && !hinge.motor);
const a = lever.objects.find(o => o.id === hinge.bodyA), b = lever.objects.find(o => o.id === hinge.bodyB);
const pa = add(a.position, rotate(a.rotation, hinge.anchorA)), pb = add(b.position, rotate(b.rotation, hinge.anchorB));
const anchorGap = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z); assert.ok(anchorGap <= .001); assert.ok(!a.fixed || !b.fixed);
const fluid = load('metric-pilot/case-09/receipt.json'); assert.equal(fluid.canonicalStatus, 'needs-clarification'); assert.equal(fluid.requests, 0);
const report = { scope: 'Exact preserved-chair box connectivity, roof contact, supplied ball/plank dimensions/contact, free-hinge alignment and essential-fluid guard; no population or physical-device accuracy claim.', originalChair: original, pilotChair: pilot, finalChair: final, houses, annotated: { ballDiameterMeters: 1, ballMassKg: 1, plankLengthMeters: 3, contactGapMeters: contact }, lever: { actualFreeHinge: true, anchorGapMeters: anchorGap }, essentialFluid: { status: fluid.canonicalStatus, modelCalls: fluid.requests } };
writeFileSync(fileURLToPath(new URL('geometry-review.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', originalChairFailureRetained: true, finalChairMembers: final.parts, roofRepeats: houses.length, freeHinge: true }));

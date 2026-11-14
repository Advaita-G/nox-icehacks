// Live seesaw recheck (Momen #108): ground kept and every joint anchored, but the 0.04 m plank came back as a primitive
// block below dimensionMin (K1 again, despite prompt guidance). New interpretations now express a too-thin primitive
// box/cylinder as a dimensionMin body frame with geometry at its real size: same collider, mass and pose, and the
// conversion is stated in scene.assumptions. Rounded quaternions stay rejected (Advaita's precision policy), so the
// verbatim #108 reply still fails, now on its pivot face rotations (|q| = 1.0000287) instead of the plank.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseInterpretation } from '../src/input/contract.ts';
import { Physics, initPhysics, validateScene, LIMITS } from '../src/physics/index.ts';
import { geometryParts } from '../src/physics/geometry.ts';

const dir = new URL('../docs/evidence/live-22-seesaw-2026-11-12/recheck/', import.meta.url);
const raw = readFileSync(new URL('conv-108-response.json', dir), 'utf8');
const request = JSON.parse(readFileSync(new URL('conv-108-request.json', dir), 'utf8'));
const source = { id: request.source.id, revision: request.source.revision, kind: request.source.kind, strokeIds: request.source.strokes.map((s) => s.id) };
const exactPivot = () => {
  const reply = JSON.parse(raw);
  for (const g of reply.scene.objects.find((o) => o.id === 'pivot').geometry) { const s = Math.sign(g.rotation.z), a = Math.atan2(0.2011, 0.9796); g.rotation = { x: 0, y: 0, z: s * Math.sin(a), w: Math.cos(a) }; }
  return JSON.stringify(reply);
};

test('verbatim #108: the plank is no longer the blocker; the rounded pivot rotations still reject', () => {
  assert.throws(() => validateScene(JSON.parse(raw).scene), /plank: Height must be finite/);
  assert.throws(() => parseInterpretation(raw, request.requestId, source), /Rotation must be a unit quaternion/);
});

test('with exact pivot rotations, the 0.04 m plank is kept as geometry inside a dimensionMin body frame', async () => {
  const parsed = parseInterpretation(exactPivot(), request.requestId, source);
  const plank = parsed.scene.objects.find((o) => o.id === 'plank');
  assert.equal(plank.height, LIMITS.dimensionMin);
  const [part] = geometryParts(plank);
  assert.equal(part.shape, 'box');
  assert.ok(Math.abs(part.size.y - 0.04) < 1e-9 && Math.abs(part.size.x - 2) < 1e-9 && Math.abs(part.size.z - 0.2) < 1e-9, JSON.stringify(part.size));
  assert.equal(plank.mass, 1);
  assert.ok(parsed.scene.assumptions.some((a) => /plank: height 0\.04 m is below the 0\.1 m body minimum/.test(a)));
  assert.ok(parsed.scene.objects.some((o) => o.id === 'ground'), 'drawn ground kept (G3)');
  await initPhysics();
  const p = new Physics(validateScene(parsed.scene));
  try { let ke = 0; for (let i = 0; i < 6; i++) ke = Math.max(ke, p.step().kineticEnergy); assert.ok(ke < 0.05, `start-up kinetic energy ${ke} J`); } finally { p.free(); }
});

test('non-finite or non-positive dimensions are not converted and still reject', () => {
  for (const bad of [0, -0.04, Number.NaN]) {
    const reply = JSON.parse(exactPivot()); reply.scene.objects.find((o) => o.id === 'plank').height = bad;
    assert.throws(() => parseInterpretation(JSON.stringify(reply), request.requestId, source), /plank: Height must be finite/);
  }
});

// Live seesaw recheck (Momen #106): the plank's hinge anchors were 0.12 m apart at creation, so the solver snapped
// the plank up on the first step (about 8.5 J lost in 0.25 s, both boxes thrown upward). New interpretations must put
// hinge, fixed and spherical anchors together, as sliders already must across their rail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseInterpretation } from '../src/input/contract.ts';
import { Physics, initPhysics, validateScene } from '../src/physics/index.ts';

const dir = new URL('../docs/evidence/live-22-seesaw-2026-11-12/recheck/', import.meta.url);
const raw = readFileSync(new URL('conv-106-response.json', dir), 'utf8');
const request = JSON.parse(readFileSync(new URL('conv-106-request.json', dir), 'utf8'));
const source = { id: request.source.id, revision: request.source.revision, kind: request.source.kind, strokeIds: request.source.strokes.map((s) => s.id) };

test('a new interpretation with separated hinge anchors is rejected with the joint and the gap', () => {
  assert.throws(() => parseInterpretation(raw, request.requestId, source), /Hinge plank-hinge connects its parts 0\.1200 m apart/);
});

test('the same reply with the plank moved onto its hinge is accepted and starts without a snap', async () => {
  const reply = JSON.parse(raw);
  for (const o of reply.scene.objects) if (['plank', 'left-box', 'right-box'].includes(o.id)) o.position.y += 0.12;
  const parsed = parseInterpretation(JSON.stringify(reply), request.requestId, source);
  await initPhysics();
  const p = new Physics(validateScene(parsed.scene));
  try {
    const e0 = p.sample().kineticEnergy + p.sample().potentialEnergy; let maxKE = 0;
    for (let i = 0; i < 6; i++) maxKE = Math.max(maxKE, p.step().kineticEnergy);
    assert.ok(maxKE < 0.05, `kinetic energy ${maxKE} J in the first 0.05 s (a snap would be joules)`);
    assert.ok(Number.isFinite(e0));
  } finally { p.free(); }
});

test('saved scenes with the same gap still load for repair (validateScene does not apply the creation check)', () => {
  assert.doesNotThrow(() => validateScene(JSON.parse(raw).scene));
});

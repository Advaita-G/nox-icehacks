import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the actual JSON CLI accepts a custom physical scene, repeats exactly and rejects invalid input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nox-physics-'));
  const cli = (...args) => execFileSync(process.execPath, ['scripts/physics.mjs', ...args], { encoding: 'utf8', maxBuffer: 10_000_000 });
  try {
    const capabilities = JSON.parse(cli('capabilities')); assert.ok(capabilities.shapes.includes('convex')); assert.ok(capabilities.constraints.includes('hinge'));
    const source = JSON.parse(cli('example', 'fan')); source.name = 'Rough fan interpretation'; source.objects[1].label = 'User drawn rotor';
    const file = join(dir, 'scene.json'); await writeFile(file, JSON.stringify(source));
    assert.equal(JSON.parse(cli('check', file)).valid, true);
    const a = cli('run', file, '.5'), b = cli('run', file, '.5'); assert.equal(a, b); assert.ok(JSON.parse(a).samples.at(-1).bodies.find(b => b.objectId === 'target').velocity.z > 0);
    source.constraints[0].bodyB = 'unknown'; await writeFile(file, JSON.stringify(source));
    const bad = spawnSync(process.execPath, ['scripts/physics.mjs', 'run', file], { encoding: 'utf8' }); assert.equal(bad.status, 1); assert.match(bad.stderr, /Unknown connected body/); assert.equal(bad.stdout, '');
    const duration = spawnSync(process.execPath, ['scripts/physics.mjs', 'run', 'examples/fan.json', '31'], { encoding: 'utf8' }); assert.equal(duration.status, 1); assert.match(duration.stderr, /Duration/);
  } finally { await rm(dir, { recursive: true }); }
});

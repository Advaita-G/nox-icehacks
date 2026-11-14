import { readFile } from 'node:fs/promises';
import { CAPABILITIES, EXAMPLES, Physics, initPhysics, validateScene, number, SAMPLE_EVERY, LIMITS } from '../src/physics/index.ts';

const [command, argument, duration = '2'] = process.argv.slice(2);
try {
  if (command === 'capabilities') process.stdout.write(`${JSON.stringify(CAPABILITIES, null, 2)}\n`);
  else if (command === 'example') {
    if (!Object.hasOwn(EXAMPLES, argument)) throw new Error(`Choose an example: ${Object.keys(EXAMPLES).join(', ')}.`);
    process.stdout.write(`${JSON.stringify(EXAMPLES[argument](), null, 2)}\n`);
  } else if (command === 'run' || command === 'check') {
    if (!argument) throw new Error('Provide a scene JSON file.');
    const source = await readFile(argument, 'utf8'); if (source.length > 2_000_000) throw new Error('Scene exceeds 2 MB.');
    const scene = validateScene(JSON.parse(source)); await initPhysics(); const physics = new Physics(scene);
    try {
      if (command === 'check') process.stdout.write(`${JSON.stringify({ valid: true, model: CAPABILITIES.model, scene, initial: physics.sample() })}\n`);
      else {
        const seconds = Number(duration); number(seconds, 0, LIMITS.seconds, 'Duration'); const ticks = Math.round(seconds / physics.timestep), samples = [physics.sample()];
        for (let i = 0; i < ticks; i++) { const sample = physics.step(); if (physics.ticks % SAMPLE_EVERY === 0 || i === ticks - 1) samples.push(sample); }
        process.stdout.write(`${JSON.stringify({ model: CAPABILITIES.model, scene, samples, checkpoint: physics.checkpoint() })}\n`);
      }
    } finally { physics.free(); }
  } else throw new Error('Usage: node scripts/physics.mjs capabilities | example <name> | check <scene.json> | run <scene.json> [seconds]');
} catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }

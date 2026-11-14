import { spring } from '../physics/examples.ts';
import type { Scene } from '../physics/scene.ts';
import type { Run } from '../physics/engine.ts';
import type { Workbench } from '../physics/experiments.ts';

/** Compile and settle the visible scene while physics is paused, before starting its clock. */
export async function warmupRendering(render: () => void, nextFrame: () => Promise<number>, signal: AbortSignal, transitionPending = () => false): Promise<void> {
  let previous = await nextFrame(), started = previous, stable = 0;
  while (transitionPending()) {
    if (signal.aborted) throw new Error('The request was cancelled.');
    previous = await nextFrame();
    if (previous - started > 2500) throw new Error('The scene transition has not finished. Your simulation remains paused.');
  }
  started = previous;
  for (let frame = 0; frame < 40; frame++) {
    if (signal.aborted) throw new Error('The request was cancelled.');
    render(); const now = await nextFrame();
    if (signal.aborted) throw new Error('The request was cancelled.');
    stable = now > previous && now - previous <= 75 ? stable + 1 : 0;
    if (stable === 3) return;
    if (now - started > 5000) break;
    previous = now;
  }
  throw new Error('Rendering has not settled on this device. The simulation is paused and your work is retained.');
}

export function measuredPeriod(run: Run, objectId: string, equilibrium: number): number | undefined {
  const crossings: number[] = [];
  for (let i = 1; i < run.samples.length; i++) {
    const previous = run.samples[i - 1]!, current = run.samples[i]!;
    const a = previous.bodies.find(body => body.objectId === objectId), b = current.bodies.find(body => body.objectId === objectId);
    if (a && b && a.position.x < equilibrium && b.position.x >= equilibrium) crossings.push(previous.simulationTime + (equilibrium - a.position.x) / (b.position.x - a.position.x) * (current.simulationTime - previous.simulationTime));
  }
  return crossings.length > 1 ? crossings[1]! - crossings[0]! : undefined;
}

interface DemoHost {
  current(): Workbench;
  begin(scene: Scene): void;
  changed(): void;
  say(text: string): Promise<void>;
  runFor(seconds: number, signal: AbortSignal): Promise<void>;
  compare(): void;
  save(): Promise<void>;
}

/** A narrated experiment using fresh solver runs, with no model or recorded motion. */
export async function demonstrate(host: DemoHost, signal: AbortSignal): Promise<string> {
  const active = () => { if (signal.aborted) throw new Error('Demonstration stopped. Your experiments are retained.'); };
  active();
  await host.say('I will build a spring experiment, measure its motion, double the mass, and compare. This is my built-in demonstration, using the real physics solver without an AI call.');
  active(); host.begin(spring());
  const bench = host.current(), id = 'mass';
  await host.say('The mass is attached to a spring and starts one meter from equilibrium. I am measuring the original oscillation.');
  active(); await host.runFor(5, signal); active();
  bench.pinBaseline(); const baseline = measuredPeriod(bench.experiment.baseline!.run, id, 2);
  if (baseline === undefined) throw new Error('The original run did not contain enough complete oscillations. I kept the measured samples; please try the demonstration again.');
  await host.say(`I measured an original period of ${baseline.toFixed(2)} seconds. I will return to the same starting position and double the mass for the comparison.`);
  active(); bench.reset();
  const mass = bench.scene.objects.find(object => object.id === id)!.mass;
  bench.edit({ ...bench.commandContext, operations: [{ type: 'set-property', id, property: 'mass', value: mass * 2 }] }, 'Jarvis demonstration: double mass from the same initial setup');
  host.changed(); await host.runFor(5, signal); active();
  const edited = measuredPeriod(bench.selected.run, id, 2);
  if (edited === undefined) throw new Error('The edited run did not contain enough complete oscillations. I retained the baseline and edited samples.');
  host.compare();
  await host.say(`The heavier mass takes ${edited.toFixed(2)} seconds per oscillation, compared with ${baseline.toFixed(2)} seconds before. Those numbers come from the actual simulation samples. The solid line is the edited run; the dashed line is the original baseline.`);
  active(); await host.save();
  return 'I saved the experiment, both measured runs and the baseline in this browser. You can ask me to create a pendulum, run it, select a part, change its mass, compare, or save. For a custom system, tell me what you want to build.';
}

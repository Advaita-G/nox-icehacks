import { emptyScene, newObject, validateScene } from './scene.ts';
import type { Kind, Scene, SceneObject } from './scene.ts';
import { primitive } from './geometry.ts';
import { ZERO } from './math.ts';

export function object(kind: Kind, id: string, properties: Partial<SceneObject> = {}): SceneObject {
  return { ...newObject(kind, id), ...properties };
}
export function floor(): SceneObject {
  return object('platform', 'floor', { label: 'Ground', position: { x: 0, y: -.1, z: 0 }, width: 24, height: .2, friction: .5, restitution: 0 });
}
export function collision(mass = 2, restitution = 1): Scene {
  const scene = emptyScene('Momentum exchange'); scene.gravity = { x: 0, y: 0, z: 0 };
  scene.objects = [object('ball', 'a', { label: 'Incoming sphere', position: { x: -2, y: 2, z: 0 }, velocity: { x: 3, y: 0, z: 0 }, friction: 0, restitution }),
    object('ball', 'b', { label: 'Target sphere', position: { x: 1, y: 2, z: 0 }, mass, friction: 0, restitution })];
  return validateScene(scene);
}
export function rampContainer(): Scene {
  const scene = emptyScene('Ramp into an open container');
  scene.objects = [floor(), object('ramp', 'ramp', { label: 'Launch ramp', position: { x: -3, y: 3, z: 0 }, width: 6, height: 2, friction: .6, restitution: 0 }),
    object('ball', 'ball', { label: 'Rolling sphere', position: { x: -5, y: 4.02, z: 0 }, width: .6, height: .6, depth: .6, friction: .6, restitution: 0 }),
    object('container', 'cup', { label: 'Open container', position: { x: 2, y: .8, z: 0 }, width: 3, height: 1.6, friction: .6, restitution: 0 })];
  return validateScene(scene);
}
export function rampBall(): Scene {
  const scene = rampContainer(); scene.name = 'Ramp and ball';
  scene.objects = scene.objects.filter(body => body.id !== 'cup');
  const ramp = scene.objects.find(body => body.id === 'ramp')!, ball = scene.objects.find(body => body.id === 'ball')!;
  ramp.label = 'Ramp'; ramp.position.y = ramp.height / 2; ball.label = 'Ball';
  const slope = ramp.height / ramp.width, normal = Math.hypot(slope, 1), radius = ball.width / 2, contactX = -ramp.width / 3;
  ball.position = { x: ramp.position.x + contactX + radius * slope / normal, y: ramp.position.y - contactX * slope + radius / normal, z: ramp.position.z };
  scene.assumptions.push('Fresh local setup with assumed dimensions: fixed 6 m long, 2 m high, 2 m wide ramp; 0.6 m diameter, 1 kg ball; ramp/ball friction 0.6 and restitution 0. No image measurements or recorded motion were used.');
  return validateScene(scene);
}
export function dominoes(gap = false): Scene {
  const scene = emptyScene(gap ? 'A gap stops the chain' : 'Domino chain');
  scene.objects = [floor(), ...Array.from({ length: 9 }, (_, i) => object('domino', `d${i}`, {
    label: `Domino ${i + 1}`, position: { x: -3 + i * .42 + (gap && i >= 4 ? 2 : 0), y: .51, z: 0 },
    width: .16, height: 1, depth: .5, friction: .6, restitution: 0, angularVelocity: { x: 0, y: 0, z: i === 0 ? -2 : 0 },
  }))];
  return validateScene(scene);
}
export function newComposition(): Scene {
  const scene = emptyScene('Disk, bridge and falling block');
  scene.objects = [floor(), object('platform', 'bridge', { label: 'Raised bridge', position: { x: -2, y: 2, z: 0 }, width: 4, height: .2, friction: 0 }),
    object('ball', 'disk', { label: 'Moving sphere', position: { x: -3, y: 2.61, z: 0 }, velocity: { x: 2, y: 0, z: 0 }, friction: 0, restitution: .4 }),
    object('block', 'block', { label: 'Falling block', position: { x: 1, y: 4, z: 0 }, width: .6, height: .6, depth: .6, mass: 2, restitution: .1 })];
  return validateScene(scene);
}
export function fan(): Scene {
  const s = emptyScene('Motor, rotor and airflow'); s.gravity = { ...ZERO };
  s.assumptions = ['Declared ideal actuator-disk fan, finite conical wake; not CFD or measured blade performance.', 'Air density 1.225 kg/m³, assumed Cd=1.1 and reference area=0.25 m² for the target.', 'Motor target 30 rad/s; proportional gain 0.08 N·m·s/rad, torque cap 0.8 N·m.'];
  s.objects = [object('block', 'base', { label: 'Motor mount', fixed: true, position: { x: -3, y: 2, z: 0 }, width: .3, height: .3, depth: .3 }),
    object('fan rotor', 'rotor', { label: 'Fan rotor', position: { x: -3, y: 2, z: .25 }, width: 1.5, height: 1.5, depth: .12, mass: .3,
      geometry: [primitive('box', { x: 1, y: .12, z: 1 }), primitive('box', { x: .12, y: 1, z: 1 })] }),
    object('card', 'target', { label: 'Light target', geometry: [primitive('box')], position: { x: -3, y: 2, z: 2 }, width: .5, height: .5, depth: .1, mass: .1, aerodynamics: { coefficient: 1.1, area: .25 } })];
  s.constraints = [{ id: 'shaft', type: 'hinge', bodyA: 'base', bodyB: 'rotor', anchorA: { x: 0, y: 0, z: .25 }, anchorB: { ...ZERO }, axisA: { x: 0, y: 0, z: 1 }, axisB: { x: 0, y: 0, z: 1 }, motor: { targetVelocity: 30, gain: .08, maxEffort: .8 } }];
  s.fans = [{ id: 'air', rotor: 'rotor', stator: 'base', axis: { x: 0, y: 0, z: 1 }, position: { ...ZERO }, radius: .75, tipRatio: .08, spread: .15, range: 8 }];
  s.assemblies = [{ id: 'fan', label: 'Electric fan', bodies: ['base', 'rotor'] }];
  return validateScene(s);
}
export function pendulum(): Scene {
  const s = emptyScene('Hinged pendulum');
  s.objects = [object('block', 'anchor', { fixed: true, position: { x: 0, y: 4, z: 0 }, width: .2, height: .2, depth: .2 }),
    object('pendulum arm', 'arm', { geometry: [primitive('box')], position: { x: .7, y: 3.3, z: 0 }, rotation: { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) }, width: .15, height: 2, depth: .15 })];
  s.constraints = [{ id: 'pivot', type: 'hinge', bodyA: 'anchor', bodyB: 'arm', anchorA: { ...ZERO }, anchorB: { x: 0, y: 1, z: 0 }, axisA: { x: 0, y: 0, z: 1 } }];
  return validateScene(s);
}
export function spring(): Scene {
  const s = emptyScene('Spring oscillator'); s.gravity = { ...ZERO };
  s.objects = [object('block', 'anchor', { fixed: true, position: { ...ZERO } }), object('ball', 'mass', { position: { x: 3, y: 0, z: 0 } })];
  s.constraints = [{ id: 'spring', type: 'spring', bodyA: 'anchor', bodyB: 'mass', anchorA: { ...ZERO }, anchorB: { ...ZERO }, length: 2, stiffness: 16, damping: 0 }];
  return validateScene(s);
}
export const EXAMPLES = { fan, pendulum, spring, ramp: rampContainer, collision, dominoes, gap: () => dominoes(true), composition: newComposition };

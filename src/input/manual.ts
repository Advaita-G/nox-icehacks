import { Euler, Quaternion } from 'three';
import { parseTyped } from '../../packages/input/src/commands/typed.ts';
import type { IntentNumber } from '../../packages/input/src/contract/types.ts';
import { check } from '../physics/scene.ts';
import type { Operation, Scene } from '../physics/scene.ts';
import type { CommandProposal } from './contract.ts';

function value(change: IntentNumber | undefined, current: number): number {
  if (change === undefined) return current;
  if (typeof change === 'number') return change;
  if ('factor' in change) return current * change.factor;
  if ('delta' in change) return current + change.delta;
  return change.absolute;
}
export function manualCommand(input: string, scene: Scene, selectedId: string, requestId: string): CommandProposal | undefined {
  const parsed = parseTyped(input, requestId); if (!parsed.ok) return undefined;
  const intent = parsed.intent, operations: Operation[] = [];
  for (const op of intent.ops) {
    if (op.op === 'set-gravity') { operations.push({ type: 'set-gravity', gravity: { ...scene.gravity, x: value(op.gx, scene.gravity.x), y: value(op.gy, scene.gravity.y) } }); continue; }
    if (op.op === 'set-scale') { operations.push({ type: 'set-scale', scale: 1 / value(op.metersPerPx, 1 / scene.scale) }); continue; }
    if (op.op === 'space-evenly') {
      const bodies = op.objectIds.map(id => scene.objects.find(o => o.id === id)).sort((a, b) => (a?.position.x ?? 0) - (b?.position.x ?? 0));
      check(bodies.every(Boolean) && bodies.length > 1 && new Set(op.objectIds).size === op.objectIds.length, 'Choose distinct existing parts to space.');
      const first = bodies[0]!, current = (bodies.at(-1)!.position.x - first.position.x) / (bodies.length - 1), spacing = value(op.spacing, current);
      check(spacing > 0, 'Spacing must be positive.'); bodies.forEach((body, i) => operations.push({ type: 'move', id: body!.id, position: { ...body!.position, x: first.position.x + i * spacing } })); continue;
    }
    check('objectId' in op, 'This manual operation needs the natural-language interpreter.');
    const id = op.objectId === 'this' ? selectedId : op.objectId, o = scene.objects.find(o => o.id === id); check(o, `Unknown part: ${id}.`);
    if (op.op === 'set-property') operations.push({ type: 'set-property', id, property: op.property, value: value(op.value, o[op.property]) });
    else if (op.op === 'set-pose') {
      if (op.x !== undefined || op.y !== undefined) operations.push({ type: 'move', id, position: { ...o.position, x: value(op.x, o.position.x), y: value(op.y, o.position.y) } });
      if (op.angle !== undefined) { const e = new Euler().setFromQuaternion(new Quaternion(o.rotation.x, o.rotation.y, o.rotation.z, o.rotation.w)); e.z = value(op.angle, e.z); const q = new Quaternion().setFromEuler(e); operations.push({ type: 'rotate', id, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } }); }
    } else if (op.op === 'set-velocity') {
      operations.push({ type: 'set-property', id, property: 'velocity', value: { ...o.velocity, x: value(op.vx, o.velocity.x), y: value(op.vy, o.velocity.y) } });
      if (op.omega !== undefined) operations.push({ type: 'set-property', id, property: 'angularVelocity', value: { ...o.angularVelocity, z: value(op.omega, o.angularVelocity.z) } });
    } else if (op.op === 'set-body-type') operations.push({ type: 'set-property', id, property: 'fixed', value: op.bodyType === 'fixed' });
    else if (op.op === 'remove-object') operations.push({ type: 'remove', id });
    else return undefined;
  }
  return { requestId, status: 'proposed', operations, ...(intent.lifecycle ? { lifecycle: intent.lifecycle } : {}), summary: [`Manual command: ${input.trim()}`], questions: [], message: '' };
}

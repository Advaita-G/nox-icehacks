import { applyCommands } from '../physics/scene.ts';
import type { Operation, Scene } from '../physics/scene.ts';
import type { CommandProposal } from './contract.ts';
import { Euler, Quaternion } from 'three';

/** Direct spoken edits are reversible; removal, replacement and mechanism changes still need review. */
export function canApplyDirectly(operations: readonly Operation[]): boolean {
  return operations.length > 0 && operations.every(op => ['move', 'rotate', 'resize', 'set-property', 'set-geometry', 'set-aerodynamics', 'set-gravity', 'set-scale', 'set-environment', 'transform-assembly'].includes(op.type));
}

export function describeApplied(scene: Scene, operations: readonly Operation[]): string {
  const next = applyCommands(scene, { baseSceneRevision: scene.revision, operations });
  const sentences = operations.flatMap(op => {
    const before = 'id' in op ? scene.objects.find(o => o.id === op.id) : undefined;
    const after = 'id' in op ? next.objects.find(o => o.id === op.id) : undefined;
    if (op.type === 'rotate' && before && after) {
      const q = (r: typeof before.rotation) => new Quaternion(r.x, r.y, r.z, r.w).normalize();
      const degrees = +(q(before.rotation).angleTo(q(after.rotation)) * 180 / Math.PI).toFixed(2);
      return [`I rotated ${after.label} by ${degrees} degrees.`];
    }
    if (op.type === 'set-property' && after) return [op.property === 'mass' ? `${after.label} is now ${after.mass} kilograms.` : `I updated ${after.label}'s ${op.property.replace(/[A-Z]/g, c => ' ' + c.toLowerCase())}.`];
    if (op.type === 'move' && after) return operations.some(o => o.type === 'rotate' && o.id === op.id) ? [] : [`I moved ${after.label}.`];
    if (op.type === 'resize' && after) return [`I resized ${after.label}.`];
    if (op.type === 'set-geometry' && after) return [`I changed ${after.label}'s shape.`];
    return [];
  });
  return [...new Set(sentences)].slice(0, 2).join(' ') || 'Done. I applied your change.';
}

function reviewValue(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const point = value as Record<string, unknown>;
    // Spoken and drawn reviews: four decimals are exact enough to judge a change; float noise reads as 0.
    const read = (n: number) => String(Math.abs(n) < 5e-5 ? 0 : +n.toFixed(4));
    if (Object.keys(point).length === 3 && ['x', 'y', 'z'].every(key => typeof point[key] === 'number')) return `(${read(point.x as number)}, ${read(point.y as number)}, ${read(point.z as number)})`;
  }
  return JSON.stringify(value) ?? 'none';
}

export function describeChanges(scene: Scene, proposal: CommandProposal): string[] {
  if (proposal.lifecycle) return [proposal.lifecycle === 'reset' ? 'Reset to the selected setup at 0 seconds; retain recorded history in a prior version.' : `${proposal.lifecycle[0].toUpperCase()}${proposal.lifecycle.slice(1)} experiment.`];
  const next = applyCommands(scene, { baseSceneRevision: scene.revision, operations: proposal.operations });
  const lines: string[] = [];
  for (const before of scene.objects) if (!next.objects.some(after => after.id === before.id)) lines.push(`Remove ${before.label} (${before.id}).`);
  for (const after of next.objects) {
    const before = scene.objects.find(o => o.id === after.id);
    if (!before) lines.push(`Add ${after.label} (${after.id}).`);
    for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(after)]) as Set<keyof typeof after>) {
      if (key === 'id' || !before && key === 'label' || JSON.stringify(before?.[key]) === JSON.stringify(after[key])) continue;
      if (key === 'rotation') {
        const degrees = (q?: typeof after.rotation) => { if (!q) return 'none'; const e = new Euler().setFromQuaternion(new Quaternion(q.x, q.y, q.z, q.w)); return reviewValue({ x: e.x * 180 / Math.PI, y: e.y * 180 / Math.PI, z: e.z * 180 / Math.PI }); };
        lines.push(`${after.label} · rotation x/y/z: ${degrees(before?.rotation)} → ${degrees(after.rotation)} degrees`); continue;
      }
      const unit = key === 'mass' ? ' kg' : ['width', 'height', 'depth', 'wallThickness', 'position'].includes(key) ? ' m' : key === 'velocity' ? ' m/s' : key === 'angularVelocity' ? ' rad/s' : '';
      const axes = ['position', 'velocity', 'angularVelocity'].includes(key) ? ' x/y/z' : '';
      lines.push(`${after.label} · ${key}${axes}: ${reviewValue(before?.[key])} → ${reviewValue(after[key])}${unit}`);
    }
  }
  const names = { constraints: 'Connection', forces: 'Force', fans: 'Fan', assemblies: 'Assembly' };
  for (const collection of ['constraints', 'forces', 'fans', 'assemblies'] as const) {
    for (const before of scene[collection]) if (!next[collection].some(after => after.id === before.id)) lines.push(`Remove ${names[collection]} ${before.id}.`);
    for (const after of next[collection]) {
      const before = scene[collection].find(item => item.id === after.id);
      if (!before) lines.push(`Add ${names[collection]} ${after.id}.`);
      const oldValues = new Map<string, unknown>(Object.entries(before ?? {})), newValues = new Map<string, unknown>(Object.entries(after));
      const spring = 'type' in after && after.type === 'spring' || before && 'type' in before && before.type === 'spring';
      const units: Record<string, string> = collection === 'constraints'
        ? { stiffness: ' N/m', length: ' m', anchorA: ' m', anchorB: ' m', ...(spring ? { damping: ' N·s/m' } : {}) }
        : collection === 'forces' ? { vector: ' N', torque: ' N·m', point: ' m' }
        : collection === 'fans' ? { position: ' m', radius: ' m', range: ' m' } : {};
      for (const key of new Set([...oldValues.keys(), ...newValues.keys()])) {
        if (key === 'id' || JSON.stringify(oldValues.get(key)) === JSON.stringify(newValues.get(key))) continue;
        lines.push(`${names[collection]} ${after.id} · ${key}: ${reviewValue(oldValues.get(key))} → ${reviewValue(newValues.get(key))}${units[key] ?? ''}`);
      }
    }
  }
  for (const key of ['gravity', 'scale', 'environment', 'assumptions'] as const) if (JSON.stringify(scene[key]) !== JSON.stringify(next[key])) lines.push(key === 'gravity'
    ? `Gravity (m/s²), x/y/z: (${scene.gravity.x}, ${scene.gravity.y}, ${scene.gravity.z}) → (${next.gravity.x}, ${next.gravity.y}, ${next.gravity.z})`
    : `${key}: ${JSON.stringify(scene[key])} → ${JSON.stringify(next[key])}`);
  return lines.length ? lines : ['No physical values change.'];
}

import { applyCommands } from '../physics/scene.ts';
import type { Scene } from '../physics/scene.ts';
import type { CommandProposal } from './contract.ts';

function reviewValue(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const point = value as Record<string, unknown>;
    if (Object.keys(point).length === 3 && ['x', 'y', 'z'].every(key => typeof point[key] === 'number')) return `(${point.x}, ${point.y}, ${point.z})`;
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

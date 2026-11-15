import type { Operation, Scene, SceneObject, Vec3 } from '../physics/scene.ts';

/**
 * What a reviewed (not yet applied) change looks like in the room. Marks are derived only from the proposal's actual
 * operations and the current scene; they never change the experiment. Unknown or non-spatial operations produce a note
 * on the part they touch, so every referenced part is still visibly identified.
 */
export type ProposalMark =
  | { kind: 'ghost'; id: string; object: SceneObject }
  | { kind: 'arrow'; id: string; vector: Vec3 }
  | { kind: 'note'; id: string };

const touched = (op: Operation): string | undefined => 'id' in op && typeof op.id === 'string' ? op.id : undefined;

export function proposalMarks(scene: Scene, operations: readonly Operation[]): ProposalMark[] {
  const objects = new Map(scene.objects.map(object => [object.id, object]));
  const proposed = new Map<string, SceneObject>(), marks: ProposalMark[] = [], noted = new Set<string>();
  const draft = (id: string) => { const current = proposed.get(id) ?? structuredClone(objects.get(id)!); proposed.set(id, current); return current; };
  for (const op of operations) {
    const id = touched(op);
    if (!id || !objects.has(id)) continue;
    if (op.type === 'move') draft(id).position = { ...op.position };
    else if (op.type === 'rotate') draft(id).rotation = { ...op.rotation };
    else if (op.type === 'resize') Object.assign(draft(id), { width: op.width, height: op.height, depth: op.depth });
    else if (op.type === 'set-property' && op.property === 'velocity' && typeof op.value === 'object' && op.value) {
      const vector = op.value as Vec3;
      if (Math.hypot(vector.x, vector.y, vector.z) > 1e-6) marks.push({ kind: 'arrow', id, vector: { ...vector } });
      else noted.add(id);
    } else noted.add(id);
  }
  for (const [id, object] of proposed) marks.unshift({ kind: 'ghost', id, object });
  for (const id of noted) if (!marks.some(mark => mark.id === id)) marks.push({ kind: 'note', id });
  return marks;
}

/**
 * Clarification rule for manual correction (R4-03).
 * A blocking question chosen for manual correction stays open until a VALID applied edit
 * changes something the question is about.
 */
import type { Question, Relationship, SceneOp } from '../contract/types';

/**
 * Whether an applied batch changed something `q` is about.
 * `before` is the relationship list before the batch (to see what an update/remove touched).
 */
export function batchTouchesQuestion(ops: readonly SceneOp[], q: Question, before: readonly Relationship[]): boolean {
  const objects = new Set(q.targetRefs.objectIds);
  const rels = new Set(q.targetRefs.relationshipIds);
  const involves = (r: Pick<Relationship, 'subjectId' | 'targetId'>) => objects.has(r.subjectId) || (r.targetId !== undefined && objects.has(r.targetId));
  return ops.some((op) => {
    switch (op.op) {
      case 'set-scale':
        return q.kind === 'confirm-scale';
      case 'set-gravity':
      case 'add-object':
        return false;
      case 'add-relationship':
        return involves(op.relationship);
      case 'update-relationship':
      case 'remove-relationship': {
        const r = before.find((x) => x.id === op.id);
        return rels.has(op.id) || (r !== undefined && involves(r));
      }
      default:
        return objects.has(op.objectId);
    }
  });
}

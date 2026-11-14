/** Keyboard shortcuts for the sketch dialog. */
export interface KeyLike { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
interface TargetLike { tagName?: string; type?: string; isContentEditable?: boolean }

const TEXT_INPUTS = new Set(['', 'text', 'search', 'url', 'tel', 'email', 'password', 'number']);

/** True when focus is in a field where Ctrl+Z must keep its native "undo typing" meaning. */
export function isTextEditing(target: unknown): boolean {
  const t = target as TargetLike | null;
  if (!t || typeof t !== 'object') return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA') return true;
  return tag === 'INPUT' && TEXT_INPUTS.has((t.type ?? '').toLowerCase());
}

/** Ctrl+Z (Windows/Linux) or Cmd+Z (macOS) without Shift or Alt, outside text fields: undo the last stroke. */
export function isUndoStroke(event: KeyLike, target: unknown): boolean {
  return event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && !isTextEditing(target);
}

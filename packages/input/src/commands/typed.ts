/**
 * Offline typed-command parser: a small, explicit grammar that works without a model.
 * It is the labelled manual fallback (EXPERIENCE "Model/transcription unavailable"), not AI.
 * Output goes through the same resolver, confirmation and validator as model intents.
 *
 *   reset | replay | resume | pause | run
 *   set <id> mass|friction|restitution <number>     (also "x2", "*2", "+0.5", "-0.5")
 *   move <id> <x> <y>
 *   rotate <id> <degrees>
 *   velocity <id> <vx> <vy>
 *   gravity <gy>
 *   scale <metersPerPx>
 *   fixed <id> | dynamic <id>
 *   remove <id>
 *   space <id> <id> [...] <spacing | x factor>
 */
import { LIFECYCLE_KINDS, type CommandIntent, type IntentNumber, type LifecycleKind } from '../contract/types.ts';

export type TypedParse = { ok: true; intent: CommandIntent } | { ok: false; message: string };

export const TYPED_HELP =
  'Try: "set ball-1 mass 2", "set ball-1 mass x2", "move ball-1 3 2", "rotate ramp-1 15", "velocity ball-1 2 0", "gravity -9.81", "space dom-1 dom-2 dom-3 x1.5", "reset".';

function num(token: string | undefined): IntentNumber | null {
  if (token === undefined) return null;
  const t = token.trim().toLowerCase();
  const factor = /^[x*×]\s*([-+]?\d*\.?\d+(e[-+]?\d+)?)$/.exec(t);
  if (factor) return { factor: Number(factor[1]) };
  const delta = /^([+-])(\d*\.?\d+(e[-+]?\d+)?)$/.exec(t);
  if (delta && (t.startsWith('+') || t.startsWith('-'))) {
    // A leading sign on a property value means a change; on coordinates callers use absolute().
    return { delta: Number(`${delta[1]}${delta[2]}`) };
  }
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : null;
}

function absolute(token: string | undefined): number | null {
  if (token === undefined) return null;
  const n = Number(token);
  return token.trim() !== '' && Number.isFinite(n) ? n : null;
}

export function parseTyped(text: string, requestId: string): TypedParse {
  // Speech recognition can add sentence punctuation and spaces after numeric signs.
  const words = text.trim().replace(/[.!?;,]+$/, '').split(/\s+/).filter(Boolean);
  const [verbRaw, ...rest] = words;
  if (!verbRaw) return { ok: false, message: 'Type a command.' };
  const verb = verbRaw.toLowerCase();
  const valuesFrom = verb === 'gravity' || verb === 'scale' ? 0 : verb === 'set' ? 2 : ['move', 'rotate', 'velocity'].includes(verb) ? 1 : rest.length;
  // Dictation may spell the sign as a word or use the Unicode minus; only value positions are rewritten, never IDs.
  for (let i = valuesFrom; i < rest.length; i++) {
    if (/^(minus|negative)$/i.test(rest[i]!)) rest[i] = '-';
    else rest[i] = rest[i]!.replace(/^−/, '-');
  }
  for (let i = valuesFrom; i + 1 < rest.length; i++) {
    if ((rest[i] === '+' || rest[i] === '-') && /^(\d|\.\d)/.test(rest[i + 1]!)) rest.splice(i, 2, rest[i]! + rest[i + 1]!);
  }
  const base = { requestId, status: 'proposed' as const };
  const fail = (m: string): TypedParse => ({ ok: false, message: `${m} ${TYPED_HELP}` });

  if ((LIFECYCLE_KINDS as readonly string[]).includes(verb) && rest.length === 0) {
    return { ok: true, intent: { ...base, targets: [], ops: [], lifecycle: verb as LifecycleKind } };
  }
  const id = rest[0];
  switch (verb) {
    case 'set': {
      const prop = rest[1]?.toLowerCase();
      if (!id || (prop !== 'mass' && prop !== 'friction' && prop !== 'restitution')) return fail('Use: set <id> mass|friction|restitution <value>.');
      const value = num(rest[2]);
      if (value === null || rest.length !== 3) return fail('The value must be a number.');
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'set-property', objectId: id, property: prop, value }] } };
    }
    case 'move': {
      const x = absolute(rest[1]);
      const y = absolute(rest[2]);
      if (!id || x === null || y === null || rest.length !== 3) return fail('Use: move <id> <x m> <y m>.');
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'set-pose', objectId: id, x, y }] } };
    }
    case 'rotate': {
      const deg = absolute(rest[1]);
      if (!id || deg === null || rest.length !== 2) return fail('Use: rotate <id> <degrees>.');
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'set-pose', objectId: id, angle: (deg * Math.PI) / 180 }] } };
    }
    case 'velocity': {
      const vx = absolute(rest[1]);
      const vy = absolute(rest[2]);
      if (!id || vx === null || vy === null || rest.length !== 3) return fail('Use: velocity <id> <vx m/s> <vy m/s>.');
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'set-velocity', objectId: id, vx, vy }] } };
    }
    case 'gravity': {
      const gy = absolute(rest[0]);
      if (gy === null || rest.length !== 1) return fail('Use: gravity <gy m/s²>, for example gravity -9.81.');
      return { ok: true, intent: { ...base, targets: [], ops: [{ op: 'set-gravity', gy }] } };
    }
    case 'scale': {
      const s = absolute(rest[0]);
      if (s === null || rest.length !== 1) return fail('Use: scale <metres per pixel>.');
      return { ok: true, intent: { ...base, targets: [], ops: [{ op: 'set-scale', metersPerPx: s }] } };
    }
    case 'fixed':
    case 'dynamic': {
      if (!id || rest.length !== 1) return fail(`Use: ${verb} <id>.`);
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'set-body-type', objectId: id, bodyType: verb }] } };
    }
    case 'remove': {
      if (!id || rest.length !== 1) return fail('Use: remove <id>.');
      return { ok: true, intent: { ...base, targets: [id], ops: [{ op: 'remove-object', objectId: id }] } };
    }
    case 'space': {
      if (rest.length < 3) return fail('Use: space <id> <id> ... <spacing m | x factor>.');
      const spacing = num(rest[rest.length - 1]);
      const ids = rest.slice(0, -1);
      if (spacing === null || typeof spacing === 'object' && 'delta' in spacing) return fail('Spacing must be metres or a factor like x1.5.');
      return { ok: true, intent: { ...base, targets: ids, ops: [{ op: 'space-evenly', objectIds: ids, spacing }] } };
    }
    default:
      return fail(`Unknown command "${verbRaw}".`);
  }
}

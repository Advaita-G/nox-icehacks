/**
 * Provider-neutral instructions sent with interpretation/command requests.
 * No provider is chosen yet (R-11). These texts are what any adapter would send.
 */
import { DEFAULTS, DIMENSION_FIELDS, PLACEHOLDER_NOTICE } from '../contract/geometry.ts';
import { INTERPRETATION_QUESTION_KINDS, OBJECT_KINDS, RELATIONSHIP_KINDS } from '../contract/types.ts';

export const INTERPRET_INSTRUCTIONS = `You interpret a rough hand-drawn 2D mechanics sketch for NOX.
Return ONLY one JSON object (no prose, no code fences) with fields:
requestId, sourceId, sourceRevision (echo the request), status ("ready" | "needs-clarification" | "rejected"),
scene { schemaVersion: 1, revision: 1, metersPerPx, gravity {gx, gy}, objects[] }, relationships[], assumptions[], questions[], warnings[].
Object kinds: ${OBJECT_KINDS.join(', ')}. Shape fields per kind: ${Object.entries(DIMENSION_FIELDS)
  .map(([k, v]) => `${k}: ${v.join('/')}`)
  .join('; ')}; ramp also has facing "left"|"right".
World frame: metres, origin bottom-left of the 1600x900 canvas, +y up, angles in radians counter-clockwise; positions are centroids.
Every object has sourceRefs pointing at the stroke ids (canvas) or a normalized bbox (photo) it came from.
Relationship kinds: ${RELATIONSHIP_KINDS.join(', ')}. An arrow from an object is velocity-of with value {vx, vy}; use ${DEFAULTS.arrowSpeed} m/s unless a speed is written.
Do not guess consequential facts. Ask (status "needs-clarification") only with question kinds: ${INTERPRETATION_QUESTION_KINDS.join(', ')}; at most 3 questions; each option carries the exact scene ops it applies.
Anything outside rigid-body mechanics (springs, ropes, liquids, magnets, circuits) must be an unsupported-element question, never replaced with a supported object.
List every value you did not read from the drawing as an assumption with origin "default".
(${PLACEHOLDER_NOTICE})`;

export const COMMAND_INSTRUCTIONS = `You turn one spoken or typed edit for a NOX mechanics scene into a JSON CommandIntent.
Return ONLY one JSON object: { requestId, status: "proposed" | "needs-clarification" | "unsupported", targets: objectId[], ops: IntentOp[], lifecycle?, question?, reason? }.
Never compute new values from scene values: write relative changes as {"factor": n} or {"delta": n} and absolute ones as {"absolute": n}.
"this"/"these" mean the selected object ids given in the request. If the target or amount is unclear, ask with a question of kind "choose-target" or "amount".
Lifecycle words (run, pause, resume, reset, replay) use the lifecycle field and no ops.
Anything outside rigid-body mechanics is status "unsupported" with a short reason.`;

import type { ModelProvider } from '../packages/input/server/api.ts';
import { applyCommands, check, keys, record, text, validateScene } from '../src/physics/scene.ts';
import type { Operation } from '../src/physics/scene.ts';
import { product } from '../src/physics/math.ts';
import { initPhysics } from '../src/physics/engine.ts';
import { parseCommand } from '../src/input/contract.ts';
import { COMMAND_3D } from '../src/input/prompt.ts';
import { COMMAND_3D_SCHEMA } from '../src/input/schema.ts';
import { rotation, seat } from './drawing.ts';
import { validateRequest } from './request.ts';
import { ProviderFailure } from './anthropic.ts';

type Schema = Record<string, any>;
const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' };
const object = (properties: Schema): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const COMMAND_PLAN_SCHEMA = structuredClone(COMMAND_3D_SCHEMA) as Schema;
COMMAND_PLAN_SCHEMA.$defs.operation.anyOf = COMMAND_PLAN_SCHEMA.$defs.operation.anyOf.filter((branch: Schema) => branch.properties.type.enum[0] !== 'rotate');
COMMAND_PLAN_SCHEMA.$defs.operation.anyOf.push(
  object({ type: { enum: ['rotate-degrees'] }, id, deltaDegrees: object(Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, { type: 'number', minimum: -360, maximum: 360 }]))), supportId: { anyOf: [id, { type: 'null' }] } }),
  object({ type: { enum: ['seat-on-support'] }, id, supportId: id }),
);

export async function compileCommand(raw: string, request: unknown): Promise<string> {
  validateRequest('/api/command', request); record(request);
  check(raw.length <= 2_000_000, 'Command plan exceeds its size limit.');
  const plan: unknown = JSON.parse(raw); record(plan);
  check(Array.isArray(plan.operations) && plan.operations.length <= 60, 'Invalid command operations.');
  let scene = validateScene(request.scene);
  const operations: Operation[] = [];
  for (const op of plan.operations) {
    record(op);
    let compiled: Operation[];
    if (op.type === 'rotate-degrees' || op.type === 'seat-on-support') {
      keys(op, op.type === 'rotate-degrees' ? ['type', 'id', 'deltaDegrees', 'supportId'] : ['type', 'id', 'supportId']);
      text(op.id, 64, 'Part ID'); const original = scene.objects.find(o => o.id === op.id); check(original, 'The requested part does not exist.');
      const next = structuredClone(original);
      compiled = [];
      if (op.type === 'rotate-degrees') { record(op.deltaDegrees); next.rotation = product(rotation(op.deltaDegrees), original.rotation); compiled.push({ type: 'rotate', id: original.id, rotation: next.rotation }); }
      check(op.supportId === null || typeof op.supportId === 'string', 'Choose an existing support or null.');
      if (op.supportId !== null) {
        const support = scene.objects.find(o => o.id === op.supportId); check(support && support.id !== original.id, 'The requested support does not exist.');
        await initPhysics(); seat(next, support);
        compiled.push({ type: 'move', id: original.id, position: next.position });
      } else check(op.type === 'rotate-degrees', 'Seating requires a support.');
    } else { check(op.type !== 'rotate', 'Use degrees for model-generated body rotations.'); compiled = [op as unknown as Operation]; }
    scene = applyCommands(scene, { baseSceneRevision: scene.revision, operations: compiled });
    operations.push(...compiled);
  }
  return JSON.stringify(parseCommand(JSON.stringify({ ...plan, operations }), request.requestId as string, validateScene(request.scene)));
}

export function commandProvider(provider: ModelProvider): ModelProvider {
  return { async complete(input) {
    if (input.instructions !== COMMAND_3D || !input.outputSchema) return provider.complete(input);
    validateRequest('/api/command', input.request);
    const instructions = `${input.instructions}\nCommand-plan rotation override: NEVER emit a body rotate operation or compute a quaternion. Emit {type:"rotate-degrees",id,deltaDegrees:{x,y,z},supportId:partId|null}. Degrees are a WORLD-axis relative rotation from the supplied pose; Nox computes the quaternion. Ordinary front-view sketches lie in XY, so changing their incline uses Z only (negative Z steepens a surface descending toward +X). For a grounded part, choose its actual floor/support ID: Nox computes the new Y contact against the real collider, so do not invent a second move for that part. Use supportId:null for a deliberately floating/hanging part. If another part rests on the tilted support and should remain seated, follow with {type:"seat-on-support",id,supportId}. Nox computes its exact vertical contact, preserving its X/Z. Preserve joints and don't seat hanging or intentionally separated parts. Other canonical operations are unchanged. Describe these operations as proposals, not already applied changes. Return only the supplied command-plan schema.`;
    const raw = await provider.complete({ ...input, instructions, outputSchema: COMMAND_PLAN_SCHEMA });
    input.signal.throwIfAborted();
    try { const compiled = await compileCommand(raw, input.request); input.signal.throwIfAborted(); return compiled; }
    catch (error) { if (input.signal.aborted) throw error; throw new ProviderFailure('That change could not form a consistent physical model. Your drawing and previous version are retained.', 'invalid'); }
  } };
}

import type { ModelProvider } from '../packages/input/server/api.ts';
import { MAX_RESPONSE_TEXT_BYTES, ProviderFailure } from './anthropic.ts';
import { buildContent, extractText } from './cloudflare.ts';
import type { FetchLike } from './cloudflare.ts';

// OpenMDW-1.1 vision model. Never substitute a paid model or a provider with nonzero pricing.
export const OPENROUTER_FREE_MODEL = 'nvidia/nemotron-3.5-super-vl:free';

export function createOpenRouterProvider(apiKey: string, doFetch: FetchLike = (url, init) => fetch(url, init)): ModelProvider {
  if (!apiKey.trim()) throw new Error('An OpenRouter server API key is required.');
  return { async complete({ instructions, request, signal, outputSchema }) {
    signal.throwIfAborted();
    const drawing = typeof request === 'object' && request !== null && 'source' in request;
    const body = JSON.stringify({
      model: OPENROUTER_FREE_MODEL,
      messages: [{ role: 'system', content: drawing ? `${instructions}\nKeep the parts of each rigid manufactured object or rigid character proxy together as one compound body, or join the separate bodies with explicit fixed constraints. Legs, seats and backs must physically meet; a model must not fall apart merely because its parts were drawn with separate lines. Use the supplied numeric bounds, including drawing scale between 5 and 500 pixels/m. Every convex part must have real 3D thickness, with vertices on at least two distinct Z planes. An explicitly requested pivot needs a real free hinge with coincident world anchors; verify the constraint is actually present.` : instructions }, { role: 'user', content: buildContent(request, 'OpenRouter') }],
      // Budget reasoning for geometric and joint consistency on drawings.
      response_format: outputSchema ? { type: 'json_schema', json_schema: { name: 'nox_response', strict: true, schema: outputSchema } } : { type: 'json_object' }, reasoning: drawing ? { enabled: true, max_tokens: 2048, exclude: true } : { enabled: false },
      provider: { allow_fallbacks: false, require_parameters: true, max_price: { prompt: 0, completion: 0, image: 0, request: 0 } },
      max_tokens: 16384, stream: false, n: 1,
    });
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await doFetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey.trim()}` }, body, signal, redirect: 'error' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderFailure('The free AI service could not be reached. Your work is retained.', 'network');
    }
    if (!response.ok) throw new ProviderFailure(response.status === 429 ? 'The free AI request limit was reached. Your work is retained; try again after its reset.' : 'The free AI service could not complete the request. Your work is retained.', 'http');
    signal.throwIfAborted();
    let raw: string;
    try { raw = await response.text(); }
    catch (error) { if (signal.aborted) throw error; throw new ProviderFailure('The free AI response could not be read.', 'network'); }
    signal.throwIfAborted();
    if (Buffer.byteLength(raw) > MAX_RESPONSE_TEXT_BYTES * 4) throw new ProviderFailure('The free AI response was too large.', 'invalid');
    let data: { usage?: { cost?: unknown }; model?: unknown } | null;
    try { data = JSON.parse(raw); }
    catch { throw new ProviderFailure('The free AI response was unreadable.', 'invalid'); }
    if (data?.usage?.cost !== 0) throw new ProviderFailure('The free AI response did not confirm zero cost.', 'invalid');
    const text = extractText(raw, 'OpenRouter');
    if (drawing) {
      const notes = (request as { notes?: unknown }).notes;
      // shortcut: English free-pivot notes only; upgrade when structured intent is available.
      const freePivot = typeof notes === 'string' && /\b(?:free|freely|pinned)\b/i.test(notes) && /\b(?:pivot|hinge)\b/i.test(notes) && !/\b(?:no|without|remove) (?:a |the )?(?:hinge|pivot)\b/i.test(notes);
      let plan: { status?: unknown; constraints?: unknown } | null;
      try { plan = JSON.parse(text); } catch { throw new ProviderFailure('The drawing response was not valid JSON.', 'invalid'); }
      if (freePivot && plan?.status === 'ready' && (!Array.isArray(plan.constraints) || !plan.constraints.some(c => c && c.type === 'hinge'))) {
        const prompt = 'Which two parts should the free hinge connect, and where is its pivot?';
        const answers = (request as { answers?: unknown }).answers;
        const answered = Array.isArray(answers) && answers.some(a => a && a.question === prompt && typeof a.answer === 'string' && a.answer.trim());
        return JSON.stringify({
          status: answered ? 'rejected' : 'needs-clarification', name: 'Clarify the free pivot', bodies: [], assumptions: [], warnings: [],
          message: answered ? 'I could not build a valid free hinge from this drawing and answer. Your drawing and previous experiment are retained.' : 'I have not built the requested free hinge yet. Your drawing and previous experiment are retained.',
          questions: answered ? [] : [{ id: 'free-pivot', prompt, options: ['Connect the lever to the fixed support at the drawn pivot'] }],
        });
      }
    }
    return text;
  } };
}

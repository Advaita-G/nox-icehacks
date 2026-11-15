/**
 * Bounded server route for interpretation and command requests (dev server middleware).
 *
 * No model provider is registered: R-11 (provider, budget, credentials) is Advaita's decision.
 * Until then every request returns 503 PROVIDER_NOT_CONFIGURED. An adapter added later must
 * implement ModelProvider, read its key from the server environment only, and never retry
 * paid calls automatically.
 */
import { COMMAND_INSTRUCTIONS, INTERPRET_INSTRUCTIONS } from '../src/provider/prompt.ts';

export interface ModelProvider {
  /** Returns the model's raw text. Must honour `signal` and never log credentials. */
  complete(input: { instructions: string; request: unknown; signal: AbortSignal; outputSchema?: Record<string, unknown> }): Promise<string>;
}

export const MAX_BODY_BYTES = 3 * 1024 * 1024;

export interface ApiInput {
  method: string;
  url: string;
  body: string;
  env: Record<string, string | undefined>;
  providers: Record<string, ModelProvider>;
  signal: AbortSignal;
  instructions?: Record<string, string>;
  outputSchemas?: Record<string, Record<string, unknown>>;
}

export interface ApiOutput {
  status: number;
  body: Record<string, unknown>;
}

const ROUTES: Record<string, string> = {
  '/api/interpret': INTERPRET_INSTRUCTIONS,
  '/api/command': COMMAND_INSTRUCTIONS,
};

export function isApiPath(url: string): boolean {
  return (url.split('?')[0] ?? '') in ROUTES;
}

export async function handleApi(input: ApiInput): Promise<ApiOutput> {
  const path = input.url.split('?')[0] ?? '';
  const instructions = input.instructions?.[path] ?? ROUTES[path];
  if (!instructions) return { status: 404, body: { code: 'BAD_REQUEST', message: 'Unknown route.' } };
  if (input.method !== 'POST') return { status: 405, body: { code: 'BAD_REQUEST', message: 'Use POST.' } };
  if (Buffer.byteLength(input.body, 'utf8') > MAX_BODY_BYTES) {
    return { status: 413, body: { code: 'REQUEST_TOO_LARGE', message: 'Request body over 3 MB.' } };
  }
  let request: unknown;
  try {
    request = JSON.parse(input.body);
  } catch {
    return { status: 400, body: { code: 'BAD_REQUEST', message: 'Body must be JSON.' } };
  }
  if (typeof request !== 'object' || request === null || typeof (request as { requestId?: unknown }).requestId !== 'string') {
    return { status: 400, body: { code: 'BAD_REQUEST', message: 'requestId is required.' } };
  }
  const name = input.env.NOX_MODEL_PROVIDER;
  const provider = name ? input.providers[name] : undefined;
  if (!provider) {
    return { status: 503, body: { code: 'PROVIDER_NOT_CONFIGURED', message: 'No vision runtime is configured. Your source is retained. Configure the server runtime before trying again.' } };
  }
  try {
    const outputSchema = input.outputSchemas?.[path];
    const raw = await provider.complete({ instructions, request, signal: input.signal, ...(outputSchema ? { outputSchema } : {}) });
    return { status: 200, body: { requestId: (request as { requestId: string }).requestId, raw } };
  } catch (error) {
    if (input.signal.aborted) return { status: 499, body: { code: 'PROVIDER_ERROR', message: 'Client closed the request.' } };
    // Only a provider's explicitly safe message is surfaced; never raw errors, bodies or secrets.
    const safe = typeof error === 'object' && error !== null && typeof (error as { safeMessage?: unknown }).safeMessage === 'string' ? (error as { safeMessage: string }).safeMessage.slice(0, 300) : 'The model provider failed.';
    return { status: 502, body: { code: 'PROVIDER_ERROR', message: safe } };
  }
}

/**
 * Browser client for the bounded server route (ARCHITECTURE "One bounded server route").
 * Credentials never reach the browser; the route returns the model's raw text, which the
 * client validates as untrusted data.
 */

export type ProviderErrorCode = 'ACCESS_REQUIRED' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_ERROR' | 'REQUEST_TOO_LARGE' | 'BAD_REQUEST';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const PROVIDER_MESSAGES: Record<ProviderErrorCode, string> = {
  ACCESS_REQUIRED: 'Live AI is not enabled for public use in this deployment. Your sketch and experiment are retained. Local controls remain available.',
  PROVIDER_NOT_CONFIGURED:
    'Live interpretation is not configured. Your sketch and experiment are retained. Local controls and offline commands remain available.',
  PROVIDER_UNAVAILABLE: 'The AI service could not be reached. Your sketch and scene are unchanged; Retry when ready.',
  PROVIDER_ERROR: 'The AI service returned an error. Your sketch and scene are unchanged; Retry when ready.',
  REQUEST_TOO_LARGE: 'The request was too large to send.',
  BAD_REQUEST: 'The request was malformed.',
};

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export async function postModel(path: '/api/interpret' | '/api/command', body: unknown, signal: AbortSignal, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<string> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new ProviderError('PROVIDER_UNAVAILABLE', PROVIDER_MESSAGES.PROVIDER_UNAVAILABLE);
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const p = (payload ?? {}) as { raw?: unknown; code?: unknown };
  if (res.ok && typeof p.raw === 'string') return p.raw;
  const code = typeof p.code === 'string' && p.code in PROVIDER_MESSAGES ? (p.code as ProviderErrorCode) : res.status === 413 ? 'REQUEST_TOO_LARGE' : 'PROVIDER_ERROR';
  throw new ProviderError(code, PROVIDER_MESSAGES[code]);
}

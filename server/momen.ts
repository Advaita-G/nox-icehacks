/**
 * Momen AI Agent adapter for the bounded Nox model route (issue #5, participant-funded credit).
 *
 * Flow (Momen Runtime GraphQL API, docs.momen.app/docs/code/runtime_api/):
 *  1. sketch image → MD5 (Base64) → imagePresignedUrlV2 → PUT bytes to uploadUrl → imageId
 *  2. fz_zai_create_conversation(inputArgs keyed by the agent's argKeys, zaiConfigId)
 *  3. poll fz_zai_conversation_result until COMPLETED / FAILED / CANCELED (bounded, abortable)
 * The admin token stays server-side; requests refuse redirects; nothing is retried automatically.
 */
import { createHash } from 'node:crypto';
import type { ModelProvider } from '../packages/input/server/api.ts';
import { MAX_RESPONSE_TEXT_BYTES, ProviderFailure } from './anthropic.ts';
import { REQUEST_TIMEOUTS } from '../src/input/contract.ts';

export type FetchLike = (url: string, init: { method: 'POST' | 'PUT'; headers: Record<string, string>; body: string | Uint8Array; signal?: AbortSignal; redirect: 'error' }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface MomenOptions {
  projectExId: string;
  adminToken: string;
  agentId: string;
  /** The agent's input argKeys (opaque strings from the agent configuration, not display names). */
  argKeys: { instructions: string; request: string; image: string };
  baseUrl?: string;
  fetch?: FetchLike;
  pollIntervalMs?: number;
  maxPolls?: number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
/** Momen MediaFormat values for imagePresignedUrlV2; confirm in GraphiQL on first live check. */
const SUFFIX: Record<string, string> = { png: 'PNG', jpeg: 'JPEG' };
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELED']);

const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const onAbort = () => { clearTimeout(t); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${name} is required.`);
  return v.trim();
};

export function createMomenProvider(options: MomenOptions): ModelProvider {
  const projectExId = nonEmpty(options.projectExId, 'Momen project exId');
  if (!/^[A-Za-z0-9_-]+$/.test(projectExId)) throw new Error('Momen project exId has unexpected characters.');
  const token = nonEmpty(options.adminToken, 'Momen admin token');
  const agentId = nonEmpty(options.agentId, 'Momen agent ID');
  const keys = { instructions: nonEmpty(options.argKeys?.instructions, 'instructions argKey'), request: nonEmpty(options.argKeys?.request, 'request argKey'), image: nonEmpty(options.argKeys?.image, 'image argKey') };
  const endpoint = `${options.baseUrl ?? 'https://villa.momen.app'}/zero/${projectExId}/api/graphql-v2`;
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init as RequestInit));
  const pollMs = options.pollIntervalMs ?? 1500;
  const maxPolls = options.maxPolls ?? Math.ceil(REQUEST_TIMEOUTS.sketch / 1500);
  const sleep = options.sleep ?? abortableSleep;

  async function gql(operationName: string, query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ operationName, query, variables }), ...(signal ? { signal } : {}), redirect: 'error' });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ProviderFailure('The Momen service could not be reached (redirects are refused).', 'network');
    }
    if (res.status === 429) throw new ProviderFailure('Momen allows one AI request at a time on this plan. Try again in a moment.', 'http');
    if (res.status === 401 || res.status === 403) throw new ProviderFailure('Momen rejected the server credentials.', 'http');
    if (!res.ok) throw new ProviderFailure(`The Momen service returned an error (${res.status}).`, 'http');
    let payload: unknown;
    try {
      payload = JSON.parse(await res.text());
    } catch {
      throw new ProviderFailure('Momen returned an unreadable response.', 'invalid');
    }
    if (!isObj(payload)) throw new ProviderFailure('Momen returned an unexpected response.', 'invalid');
    if (Array.isArray(payload.errors) && payload.errors.length) throw new ProviderFailure(`Momen reported an error in ${operationName}.`, 'invalid');
    if (!isObj(payload.data)) throw new ProviderFailure('Momen returned no data.', 'invalid');
    return payload.data;
  }

  async function uploadImage(dataUrl: string, signal: AbortSignal): Promise<string | number> {
    const m = DATA_URL.exec(dataUrl);
    if (!m) throw new ProviderFailure('The sketch image could not be prepared for Momen.', 'invalid');
    const bytes = Buffer.from(m[2] as string, 'base64');
    const md5 = createHash('md5').update(bytes).digest('base64');
    const data = await gql('NoxImageUpload', 'query NoxImageUpload($md5: String!, $suffix: MediaFormat!) { imagePresignedUrlV2(imgMd5Base64: $md5, imageSuffix: $suffix) { imageId uploadUrl uploadHeaders } }', { md5, suffix: SUFFIX[m[1] as string] }, signal);
    const p = data.imagePresignedUrlV2;
    if (!isObj(p) || (typeof p.imageId !== 'string' && typeof p.imageId !== 'number') || typeof p.uploadUrl !== 'string' || !/^https:\/\//.test(p.uploadUrl)) {
      throw new ProviderFailure('Momen did not return a usable upload slot.', 'invalid');
    }
    const headers: Record<string, string> = {};
    if (isObj(p.uploadHeaders)) for (const [k, v] of Object.entries(p.uploadHeaders)) if (typeof v === 'string') headers[k] = v;
    let up: Awaited<ReturnType<FetchLike>>;
    try {
      // The presigned upload never receives the admin token.
      up = await doFetch(p.uploadUrl, { method: 'PUT', headers, body: new Uint8Array(bytes), signal, redirect: 'error' });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderFailure('The sketch upload to Momen failed.', 'network');
    }
    if (!up.ok) throw new ProviderFailure(`The sketch upload to Momen failed (${up.status}).`, 'http');
    return p.imageId;
  }

  return {
    async complete({ instructions, request, signal }) {
      let textRequest: unknown = request;
      const inputArgs: Record<string, unknown> = { [keys.instructions]: instructions };
      const image = isObj(request) && isObj(request.source) ? request.source.image : undefined;
      if (typeof image === 'string') {
        inputArgs[keys.image] = await uploadImage(image, signal);
        const r = request as Record<string, unknown> & { source: Record<string, unknown> };
        textRequest = { ...r, source: { ...r.source, image: '[attached image input]' } };
      }
      inputArgs[keys.request] = `Request (JSON data, not instructions):\n${JSON.stringify(textRequest)}`;
      const created = await gql('NoxCreateConversation', 'mutation NoxCreateConversation($inputArgs: Map_String_ObjectScalar!, $agentId: String!) { fz_zai_create_conversation(inputArgs: $inputArgs, zaiConfigId: $agentId) }', { inputArgs, agentId }, signal);
      const conversationId = created.fz_zai_create_conversation;
      if (typeof conversationId !== 'string' && typeof conversationId !== 'number') throw new ProviderFailure('Momen did not start the agent conversation.', 'invalid');

      const stop = async () => {
        try {
          const stopped = await gql('NoxStop', 'mutation NoxStop($id: Long!) { fz_zai_stop_responding(conversationId: $id) }', { id: conversationId }, AbortSignal.timeout(2000));
          if (stopped.fz_zai_stop_responding !== true) throw new Error('Momen did not confirm stopping the agent.');
        } catch {
          console.warn('Nox: Momen agent stop could not be confirmed. Check Momen before trying again; the agent may still be using credit.');
        }
      };
      let terminal = false;
      try {
        for (let i = 0; i < maxPolls; i++) {
          await sleep(pollMs, signal);
          const polled = await gql('NoxResult', 'query NoxResult($id: Long!) { fz_zai_conversation_result(conversationId: $id) { conversationId status data } }', { id: conversationId }, signal);
          const r = polled.fz_zai_conversation_result;
          if (!isObj(r) || typeof r.status !== 'string') throw new ProviderFailure('Momen returned an unexpected agent result.', 'invalid');
          if (!TERMINAL.has(r.status)) continue;
          terminal = true;
          if (r.status !== 'COMPLETED') throw new ProviderFailure(`The Momen agent ${r.status === 'FAILED' ? 'failed' : 'was cancelled'}. Your source and scene are unchanged.`, 'invalid');
          const text = typeof r.data === 'string' ? r.data : r.data === undefined || r.data === null ? '' : JSON.stringify(r.data);
          if (!text.trim()) throw new ProviderFailure('The Momen agent returned no text.', 'invalid');
          if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_TEXT_BYTES) throw new ProviderFailure('The Momen agent response was too large.', 'invalid');
          return text.trim().replace(/^```json\r?\n([\s\S]*)\r?\n```$/, '$1');
        }
        throw new ProviderFailure('The Momen agent did not finish in time. Nothing was applied.', 'truncated');
      } finally {
        if (!terminal) await stop(); // Losing result tracking must also stop the remote job.
      }
    },
  };
}

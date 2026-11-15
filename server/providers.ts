/**
 * Which model providers the local Nox server registers (issue #5).
 * A provider is registered only when it is named, fully configured server-side and live calls are
 * explicitly enabled. Otherwise the API keeps returning 503 PROVIDER_NOT_CONFIGURED.
 *
 * Budget: $0 out of pocket. "momen" uses the participant-funded IceHacks Momen credit; "anthropic"
 * stays code-only and must not be enabled for a paid account.
 */
import type { ModelProvider } from '../packages/input/server/api.ts';
import { createAnthropicProvider, type Effort, type FetchLike } from './anthropic.ts';
import { createMomenProvider, type FetchLike as MomenFetch } from './momen.ts';
import { createCloudflareProvider, type FetchLike as CloudflareFetch } from './cloudflare.ts';

export function buildProviders(env: Record<string, string | undefined>, fetchImpl?: FetchLike | MomenFetch | CloudflareFetch): Record<string, ModelProvider> {
  const providers: Record<string, ModelProvider> = {};
  if (env.NOX_LIVE_CALLS !== 'enabled') return providers; // live calls need an explicit, budgeted opt-in
  if (env.NOX_MODEL_PROVIDER === 'cloudflare') {
    if (!env.NOX_CLOUDFLARE_ACCOUNT_ID?.trim() || !env.NOX_CLOUDFLARE_API_TOKEN?.trim()) return providers;
    providers.cloudflare = createCloudflareProvider({
      accountId: env.NOX_CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.NOX_CLOUDFLARE_API_TOKEN,
      ...(env.NOX_CLOUDFLARE_MODEL ? { model: env.NOX_CLOUDFLARE_MODEL } : {}),
      ...(env.NOX_CLOUDFLARE_MAX_TOKENS ? { maxTokens: Number(env.NOX_CLOUDFLARE_MAX_TOKENS) } : {}),
      ...(fetchImpl ? { fetch: fetchImpl as CloudflareFetch } : {}),
    });
    return providers;
  }
  if (env.NOX_MODEL_PROVIDER === 'momen') {
    const required = ['NOX_MOMEN_PROJECT_EX_ID', 'NOX_MOMEN_ADMIN_TOKEN', 'NOX_MOMEN_AGENT_ID', 'NOX_MOMEN_ARG_INSTRUCTIONS', 'NOX_MOMEN_ARG_REQUEST', 'NOX_MOMEN_ARG_IMAGE'];
    if (required.some((k) => !env[k]?.trim())) return providers;
    providers.momen = createMomenProvider({
      projectExId: env.NOX_MOMEN_PROJECT_EX_ID as string,
      adminToken: env.NOX_MOMEN_ADMIN_TOKEN as string,
      agentId: env.NOX_MOMEN_AGENT_ID as string,
      argKeys: { instructions: env.NOX_MOMEN_ARG_INSTRUCTIONS as string, request: env.NOX_MOMEN_ARG_REQUEST as string, image: env.NOX_MOMEN_ARG_IMAGE as string },
      ...(fetchImpl ? { fetch: fetchImpl as MomenFetch } : {}),
    });
    return providers;
  }
  if (env.NOX_MODEL_PROVIDER !== 'anthropic') return providers;
  const apiKey = env.NOX_ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return providers;
  const maxTokens = env.NOX_ANTHROPIC_MAX_TOKENS ? Number(env.NOX_ANTHROPIC_MAX_TOKENS) : undefined;
  providers.anthropic = createAnthropicProvider({
    apiKey,
    ...(env.NOX_ANTHROPIC_MODEL ? { model: env.NOX_ANTHROPIC_MODEL } : {}),
    ...(env.NOX_ANTHROPIC_EFFORT ? { effort: env.NOX_ANTHROPIC_EFFORT as Effort } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(fetchImpl ? { fetch: fetchImpl as FetchLike } : {}),
  });
  return providers;
}

import { defineConfig, loadEnv } from 'vite';
import { apiMiddleware } from './server/middleware.ts';
import { buildProviders } from './server/providers.ts';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'NOX_'), ...process.env };
  // Providers register only with NOX_MODEL_PROVIDER, a server-side key and NOX_LIVE_CALLS=enabled (see .env.example).
  const middleware = apiMiddleware(env, buildProviders(env));
  return { plugins: [{ name: 'nox-input-api', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } }] };
});

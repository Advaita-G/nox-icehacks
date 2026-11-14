import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import type { ModelProvider } from './server/api.ts';
import { createApiMiddleware } from './server/middleware.ts';

/** No providers are registered until R-11 is decided. */
const providers: Record<string, ModelProvider> = {};

function noxApi(): Plugin {
  return {
    name: 'nox-api',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware(providers, process.env));
    },
  };
}

export default defineConfig({
  plugins: [noxApi()],
  // The repo root is allowed so the UI can load the shared contract examples in docs/product/examples.
  server: { port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  test: { include: ['test/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);

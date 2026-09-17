import { realpathSync } from 'node:fs';
import { join } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { searchForWorkspaceRoot, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import { WEB_ROOT, readApiEnv, readEnvFile } from './scripts/ronin-api-dir.mjs';

const DEV_HOST = '127.0.0.1';
const DEV_PORT = 5310;
const SHARED_PACKAGE = '@raphasparda/ronin-shared';

/**
 * Pasta real do pacote de contratos. Com `link:../ronin-api/packages/shared` ela fica fora deste
 * repositório, e o servidor de dev do Vite só serve arquivos dentro de `server.fs.allow`.
 * Instalado do GitHub Packages, fica em node_modules e não precisa de nada.
 */
function sharedPackageDir(): string | undefined {
  try {
    return realpathSync(join(WEB_ROOT, 'node_modules', ...SHARED_PACKAGE.split('/')));
  } catch {
    return undefined;
  }
}

/**
 * A API exige `Origin === APP_ORIGIN` (`http://127.0.0.1:5310`): quem abre `localhost:5310`
 * tomaria 403 em toda mutação. Em dev, redireciona para o mesmo caminho em `127.0.0.1`.
 */
function redirectLocalhost(): Plugin {
  return {
    name: 'ronin:redirect-localhost',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const hostname = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
        if (hostname !== 'localhost') {
          next();
          return;
        }
        res.statusCode = 307;
        res.setHeader('Location', `http://${DEV_HOST}:${DEV_PORT}${req.url ?? '/'}`);
        res.end();
      });
    },
  };
}

export default defineConfig(() => {
  // Não usar `loadEnv` do Vite aqui: ele propaga o `NODE_ENV=development` de um `.env` e o build
  // de produção sairia em modo dev. Lê só o necessário: `.env` do web e `.env` do ronin-api (PORT).
  const webEnv = readEnvFile(join(WEB_ROOT, '.env'));
  const port = process.env.PORT ?? readApiEnv().PORT ?? '3000';
  const apiTarget =
    process.env.API_PROXY_TARGET ?? webEnv.API_PROXY_TARGET ?? `http://127.0.0.1:${port}`;
  const sharedDir = sharedPackageDir();

  return {
    plugins: [react(), tailwindcss(), redirectLocalhost()],
    resolve: {
      // O pacote de contratos ligado por `link:` resolveria o zod do ronin-api: uma cópia só no bundle.
      dedupe: ['zod'],
    },
    server: {
      // 5173 é usada por outro projeto na máquina do cliente: porta fixa e falha se ocupada.
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: true,
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), ...(sharedDir ? [sharedDir] : [])],
      },
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Zod e `src/lib/zod-csp.ts` no mesmo chunk: o `z.config({ jitless: true })` roda
            // antes de qualquer schema (os do @raphasparda/ronin-shared ficam em outro chunk e
            // seriam avaliados antes do corpo de `main.tsx`). Veja docs/ops/deploy-render.md (CSP).
            groups: [
              {
                name: 'zod',
                test: /[\\/]node_modules[\\/]zod[\\/]|[\\/]src[\\/]lib[\\/]zod-csp\.ts$/,
              },
            ],
          },
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
  };
});

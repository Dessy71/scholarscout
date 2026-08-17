/// <reference types="vitest/config" />
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Dev-only middleware that mounts the Vercel serverless handler
 * (api/update.ts) at /api/update, and serves /data/*.json from ./data —
 * so `npm run dev` behaves like the deployed app without `vercel dev`.
 */
function devApi(): Plugin {
  return {
    name: 'scholarscout-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/update', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"method-not-allowed"}'); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          void (async () => {
            const mod = await server.ssrLoadModule('/api/update.ts');
            const shim = {
              statusCode: 200,
              status(code: number) { this.statusCode = code; return this; },
              setHeader(k: string, v: string) { res.setHeader(k, v); },
              json(payload: unknown) {
                res.statusCode = this.statusCode;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(payload));
              },
            };
            let parsed: unknown = {};
            try { parsed = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
            await mod.default({ method: 'POST', headers: req.headers, body: parsed }, shim);
          })().catch((err) => {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          });
        });
      });
      // Serve repository data files at /data/* in dev (prod copies them into public/data)
      server.middlewares.use('/data', (req, res, next) => {
        const file = path.join(__dirname, 'data', (req.url ?? '/').split('?')[0]);
        import('node:fs/promises').then(async (fs) => {
          try {
            const content = await fs.readFile(file, 'utf8');
            res.setHeader('content-type', 'application/json');
            res.end(content);
          } catch { next(); }
        }).catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
  },
});

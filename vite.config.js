import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import worksHandler from './api/works.js';
import healthHandler from './api/health.js';
import seoHandler from './api/seo.js';
import settingsHandler from './api/settings.js';
import saveImportsHandler from './api/save-imports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url.split('?')[0];

        // Mock express-like res helpers for Vercel handler compatibility
        if (!res.status) {
          res.status = function(code) {
            this.statusCode = code;
            return this;
          };
        }
        if (!res.json) {
          res.json = function(data) {
            this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
            return this;
          };
        }
        if (!res.send) {
          res.send = function(data) {
            this.end(data);
            return this;
          };
        }

        const parseBody = () => new Promise((resolve) => {
          if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return resolve(null);
          }
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch {
              resolve(body);
            }
          });
        });

        try {
          // 1. Health & Diagnostics
          if (url === '/api/health' || url === '/api/health/database' || url === '/api/health-database' || url === '/api/test-db') {
            req.body = await parseBody();
            return await healthHandler(req, res);
          }

          // 2. Works & Episodes CRUD
          if (
            url === '/api/works' ||
            url === '/api/save-data' ||
            url === '/api/delete-work' ||
            url === '/api/update-status' ||
            url === '/api/related-works'
          ) {
            req.body = await parseBody();
            return await worksHandler(req, res);
          }

          // 3. Imports
          if (url === '/api/save-imports') {
            req.body = await parseBody();
            return await saveImportsHandler(req, res);
          }

          // 4. Settings, Ads & Verifications
          if (
            url === '/api/ads' ||
            url === '/api/gsc' ||
            url === '/api/hilltopads-verification' ||
            url === '/api/google-verification' ||
            (url.startsWith('/hilltopads') && url.endsWith('.html')) ||
            (url.startsWith('/google') && url.endsWith('.html'))
          ) {
            req.body = await parseBody();
            return await settingsHandler(req, res);
          }

          // 5. SEO (Robots, Sitemaps, Audit)
          if (
            url === '/robots.txt' ||
            url === '/api/seo-audit' ||
            url === '/api/sitemap-links' ||
            url === '/sitemap.xml' ||
            url === '/sitemap-pages.xml' ||
            url === '/sitemap-works.xml' ||
            (url.startsWith('/sitemap-episodes-') && url.endsWith('.xml'))
          ) {
            return await seoHandler(req, res);
          }
        } catch (err) {
          console.error(`Error handling ${url}:`, err);
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [apiMiddlewarePlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {}
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true
  }
});

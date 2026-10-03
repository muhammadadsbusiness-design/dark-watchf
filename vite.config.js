import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import worksHandler from './api/works.js';
import saveDataHandler from './api/save-data.js';
import deleteWorkHandler from './api/delete-work.js';
import testDbHandler from './api/test-db.js';
import healthDatabaseHandler from './api/health-database.js';
import healthHandler from './api/health.js';
import saveImportsHandler from './api/save-imports.js';
import updateStatusHandler from './api/update-status.js';
import gscHandler from './api/gsc.js';
import googleVerificationHandler from './api/google-verification.js';
import relatedWorksHandler from './api/related-works.js';
import adsHandler from './api/ads.js';
import hilltopadsVerificationHandler from './api/hilltopads-verification.js';
import robotsHandler from './api/robots.js';
import sitemapHandler from './api/sitemap.js';
import sitemapLinksHandler from './api/sitemap-links.js';
import seoAuditHandler from './api/seo-audit.js';

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
          if (url === '/api/health/database') {
            req.body = await parseBody();
            return await healthDatabaseHandler(req, res);
          }
          if (url === '/api/health') {
            req.body = await parseBody();
            return await healthHandler(req, res);
          }
          if (url === '/api/works') {
            req.body = await parseBody();
            return await worksHandler(req, res);
          }
          if (url === '/api/save-data') {
            req.body = await parseBody();
            return await saveDataHandler(req, res);
          }
          if (url === '/api/delete-work') {
            req.body = await parseBody();
            return await deleteWorkHandler(req, res);
          }
          if (url === '/api/test-db') {
            req.body = await parseBody();
            return await testDbHandler(req, res);
          }
          if (url === '/api/save-imports') {
            req.body = await parseBody();
            return await saveImportsHandler(req, res);
          }
          if (url === '/api/update-status') {
            req.body = await parseBody();
            return await updateStatusHandler(req, res);
          }
          if (url === '/api/gsc') {
            req.body = await parseBody();
            return await gscHandler(req, res);
          }
          if (url === '/api/related-works') {
            req.body = await parseBody();
            return await relatedWorksHandler(req, res);
          }
          if (url === '/api/ads') {
            req.body = await parseBody();
            return await adsHandler(req, res);
          }
          if (url === '/api/hilltopads-verification' || (url.startsWith('/hilltopads') && url.endsWith('.html'))) {
            req.body = await parseBody();
            return await hilltopadsVerificationHandler(req, res);
          }
          if (url === '/api/google-verification' || (url.startsWith('/google') && url.endsWith('.html'))) {
            req.body = await parseBody();
            return await googleVerificationHandler(req, res);
          }
          if (url === '/robots.txt') {
            return await robotsHandler(req, res);
          }
          if (url === '/api/seo-audit') {
            return await seoAuditHandler(req, res);
          }
          if (url === '/api/sitemap-links') {
            return await sitemapLinksHandler(req, res);
          }
          if (url === '/sitemap.xml') {
            req.query = { type: 'index' };
            return await sitemapHandler(req, res);
          }
          if (url === '/sitemap-pages.xml') {
            req.query = { type: 'pages' };
            return await sitemapHandler(req, res);
          }
          if (url === '/sitemap-works.xml') {
            req.query = { type: 'works' };
            return await sitemapHandler(req, res);
          }
          if (url.startsWith('/sitemap-episodes-') && url.endsWith('.xml')) {
            const pageMatch = url.match(/sitemap-episodes-(\d+)\.xml/);
            req.query = { type: 'episodes', page: pageMatch ? pageMatch[1] : 1 };
            return await sitemapHandler(req, res);
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

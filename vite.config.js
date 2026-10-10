import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { checkEnvironment } from "./src/environment.js";
import { readFile } from 'node:fs/promises';
import { storefrontHandler } from './api/storefront.js';

export default defineConfig(({ mode, command }) => {
  const config = checkEnvironment(
    {
      ...loadEnv(mode, process.cwd(), ""),
      ...process.env,
    },
    { command },
  );
  return {
    plugins: [react(), {
      name: 'storefront-preview',
      configurePreviewServer(server) {
        const handler = storefrontHandler({
          catalog: async () => JSON.parse(await readFile(new URL('./server/storefront-catalog.json', import.meta.url), 'utf8')).catalog,
          preview: () => true,
        });
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url, 'http://localhost').pathname;
          if (path === '/index.html') { res.writeHead(308, { Location: '/' }); res.end(); return; }
          if (path !== '/' && path !== '/sitemap.xml' && !path.startsWith('/hoa/')) return next();
          req.query = { path };
          res.status = code => { res.statusCode = code; return res; };
          res.send = text => res.end(text);
          handler(req, res).catch(next);
        });
      },
    }],
    build: { manifest: true },
    define: {
      "import.meta.env.VITE_APP_ENV": JSON.stringify(config.environment),
    },
  };
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDashboard, pages, accountPages } from "./scripts/build-dashboard.mjs";

export default defineConfig(({ mode }) => ({
  server: { proxy: { "/api/v1": { target: loadEnv(mode, process.cwd(), "").IMPACT_GATE_API_ORIGIN || "http://127.0.0.1:3000", changeOrigin: false } } },
  plugins: [react(), {
    name: "impact-gate-workspace",
    async configureServer(server) {
      const output = resolve("node_modules/.cache/impact-gate-dashboard");
      await buildDashboard(output);
      let rebuild = Promise.resolve();
      server.watcher.add(resolve("src/dashboard"));
      server.watcher.add(resolve("src/auth"));
      server.watcher.add(resolve("src/analytics"));
      server.watcher.add(resolve("src/ui"));
      server.watcher.add(resolve("src/data/contact-emails.json"));
      server.watcher.on("change", (file) => {
        if (file.includes("/src/dashboard/") || file.includes("/src/auth/") || file.includes("/src/analytics/") || file.includes("/src/ui/") || file.endsWith("/src/data/contact-emails.json")) {
          rebuild = rebuild.then(() => buildDashboard(output)).then(() => {
            server.ws.send({ type: "full-reload" });
          }).catch((error: unknown) => { server.config.logger.error(String(error)); });
        }
      });
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || "/", "http://localhost").pathname.replace(/\/$/, "");
        const aliases: Record<string, string> = { "/dependency-graph": "/dashboard/dependency-graph", "/deprecation-candidates": "/dashboard/deprecation-candidates" };
        if (aliases[pathname]) {
          response.writeHead(302, { Location: aliases[pathname] }); response.end(); return;
        }
        const page = pages.find(([, slug]) => pathname === `/dashboard${slug ? `/${slug}` : ""}`);
        const account = accountPages.find(([route]) => pathname === `/${route}`);
        const asset = /^\/assets\/workspace-[a-z0-9-]+\.(css|js)$/.test(pathname);
        if (!page && !account && !asset) { next(); return; }
        try {
          await rebuild;
          const file = account ? `${account[0]}.html` : page ? page[1] ? `dashboard/${page[1]}.html` : "dashboard.html" : pathname.slice(1);
          const content = await readFile(resolve(output, file));
          response.setHeader("Content-Type", page || account ? "text/html; charset=utf-8" : pathname.endsWith(".css") ? "text/css" : "text/javascript");
          response.end(content);
        } catch (error) { next(error as Error); }
      });
    },
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));

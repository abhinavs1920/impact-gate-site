import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  configFile: "vite.config.ts",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const { default: App } = await server.ssrLoadModule("/src/App.tsx");
  const html = readFileSync("dist/index.html", "utf8");
  const root = `<div id="root">${renderToString(createElement(App))}</div>`;

  if (!html.includes('<div id="root"></div>')) {
    throw new Error("React root placeholder is missing from dist/index.html.");
  }

  writeFileSync("dist/index.html", html.replace('<div id="root"></div>', root));
} finally {
  await server.close();
}

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { graphSnapshot } from "./fixtures/graph.mjs";

const directory = await mkdtemp(
  path.join(tmpdir(), "impact-gate-graph-browser-"),
);
const result = await build({
  stdin: {
    contents: `import { mountDependencyGraph } from './src/dashboard/dependency-graph/mount';
      const response = await fetch('/fixture');
      const mounted = mountDependencyGraph(document.getElementById('root') || document.getElementById('workspace-content'), await response.json());
      window.updateGraph = mounted.update; window.destroyGraph = mounted.destroy;`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
  outfile: "graph.js",
});
const js = result.outputFiles.find((file) =>
  file.path.endsWith(".js"),
).contents;
const css = result.outputFiles.find((file) =>
  file.path.endsWith(".css"),
).contents;
const html = `<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/graph.css"><style>body{margin:0;padding:30px;background:#f3f5f9;font-family:system-ui}*{box-sizing:border-box}html[data-theme=dark] body{background:#0c1522}@media(max-width:780px){body{padding:12px}}</style></head><body><main id="root"></main><script type="module" src="/graph.js"></script></body></html>`;
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/assets/") && !pathname.includes("..")) {
    try {
      response.setHeader(
        "Content-Type",
        pathname.endsWith(".css") ? "text/css" : "text/javascript",
      );
      response.end(await readFile(path.join("dist", pathname)));
    } catch {
      response.writeHead(404);
      response.end();
    }
    return;
  }
  if (pathname === "/dashboard-shell") {
    const shell = (
      await readFile("dist/dashboard/dependency-graph.html", "utf8")
    ).replace(
      /<script type="module"[^>]*><\/script>/g,
      '<script type="module" src="/graph.js"></script>',
    );
    response.setHeader("Content-Type", "text/html");
    response.end(shell);
    return;
  }
  response.setHeader(
    "Content-Type",
    pathname === "/graph.js"
      ? "text/javascript"
      : pathname === "/graph.css"
        ? "text/css"
        : pathname === "/fixture"
          ? "application/json"
          : "text/html",
  );
  response.end(
    pathname === "/graph.js"
      ? js
      : pathname === "/graph.css"
        ? css
        : pathname === "/fixture"
          ? JSON.stringify(graphSnapshot())
          : html,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.GRAPH_CHROME ||
    (existsSync("/usr/bin/google-chrome")
      ? "/usr/bin/google-chrome"
      : undefined),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const ready = async () => {
  await expect(page.locator("[data-graph-canvas]")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 30000 },
  );
  await page.locator(".react-flow__node").first().waitFor();
};
try {
  await page.goto(origin);
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.screenshot({
    path: path.join(directory, "repositories-light.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open repository acme/platform", exact: true })
    .last()
    .click();
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(36);
  const geometry = await page
    .locator(".react-flow__node")
    .evaluateAll((nodes) => {
      const boxes = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
      return {
        boxes,
        canvas: document
          .querySelector("[data-graph-canvas]")
          .getBoundingClientRect()
          .toJSON(),
        overlapping: boxes.some((a, i) =>
          boxes
            .slice(i + 1)
            .some(
              (b) =>
                a.x < b.x + b.w - 1 &&
                a.x + a.w > b.x + 1 &&
                a.y < b.y + b.h - 1 &&
                a.y + a.h > b.y + 1,
            ),
        ),
      };
    });
  assert.equal(
    geometry.overlapping,
    false,
    "36 isolated modules do not overlap",
  );
  assert.ok(
    geometry.boxes.every((box) => box.w >= 145 && box.h >= 65),
    "cards remain readable at initial zoom",
  );
  assert.ok(
    geometry.boxes.every(
      (box) =>
        box.x >= geometry.canvas.x &&
        box.y >= geometry.canvas.y &&
        box.x + box.w <= geometry.canvas.right &&
        box.y + box.h <= geometry.canvas.bottom,
    ),
    "all 36 modules fit within the initial canvas",
  );
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await expect(page.locator(".react-flow")).toHaveClass(/dark/);
  await page.screenshot({
    path: path.join(directory, "modules-36-dark.png"),
    fullPage: true,
  });
  const viewport = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  const visibleNodeId = await page
    .locator(".react-flow__node")
    .evaluateAll((nodes) => {
      const canvas = document
        .querySelector("[data-graph-canvas]")
        .getBoundingClientRect();
      return nodes
        .find((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.left > canvas.left + 10 &&
            box.right < canvas.right - 10 &&
            box.top > canvas.top + 80 &&
            box.bottom < canvas.bottom - 10
          );
        })
        ?.getAttribute("data-id");
    });
  assert.ok(visibleNodeId, "a readable module is visible");
  await page.locator(`.react-flow__node[data-id="${visibleNodeId}"]`).click();
  await expect(page.locator("[data-graph-inspector] h4")).toHaveText(
    "Defined APIs",
  );
  assert.equal(
    await page.locator(".react-flow__viewport").getAttribute("style"),
    viewport,
    "module click preserves layout and zoom",
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(36);
  await page.getByLabel("Search repositories and modules").fill("module-036");
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await ready();
  await page.getByRole("button", { name: "Repositories", exact: true }).click();
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.goBack();
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(36);

  await page.evaluate(
    (snapshot) => window.updateGraph(snapshot),
    graphSnapshot(141, 24),
  );
  await ready();
  await page.getByRole("button", { name: /^Connected/ }).click();
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(25);
  await expect(page.locator(".react-flow__edge")).toHaveCount(26);
  await page.locator(".react-flow__edge").first().dispatchEvent("click");
  await expect(page.locator("[data-graph-inspector] h3")).toHaveText(
    "Dependency evidence",
  );
  await page.getByRole("button", { name: "Close details" }).click();
  await page.screenshot({
    path: path.join(directory, "modules-141-connected-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /^All modules/ }).click();
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(142);
  await page.getByLabel("Dependency evidence").selectOption("runtime");
  await ready();
  assert.ok((await page.locator(".react-flow__edge").count()) < 26);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await ready();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export snapshot/ }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.modules.length, 142);
  assert.equal(exported.repositoryDependencies.length, 2);

  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(page.locator("[data-graph-canvas]")).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "mobile view has no page overflow",
  );
  await page.screenshot({
    path: path.join(directory, "modules-mobile.png"),
    fullPage: true,
  });

  const otherScope = {
    ...graphSnapshot(),
    activeGroupId: "new-group",
    repositories: [graphSnapshot().repositories[2]],
    services: [],
    endpoints: [],
    edges: [],
  };
  await page.evaluate((snapshot) => window.updateGraph(snapshot), otherScope);
  await ready();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  assert.equal(
    new URL(page.url()).searchParams.has("repo"),
    false,
    "group changes clear repository navigation",
  );
  await page.evaluate(() => window.destroyGraph());
  await expect(page.locator("[data-repository-graph-app]")).toHaveCount(0);

  if (existsSync("dist/dashboard/dependency-graph.html")) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ contentType: "text/css", body: "" }),
    );
    await page.goto(`${origin}/dashboard-shell`);
    await ready();
    await page
      .getByRole("button", {
        name: "Open repository acme/platform",
        exact: true,
      })
      .last()
      .click();
    await ready();
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await page.screenshot({
      path: path.join(directory, "dashboard-shell-dark.png"),
      fullPage: true,
    });
    await expect(page.locator(".react-flow__node")).toHaveCount(36);
    assert.ok(
      await page
        .locator(".rg-node")
        .first()
        .evaluate((node) => getComputedStyle(node).borderRadius === "10px"),
      "production dashboard styles preserve graph cards",
    );
  }
  assert.deepEqual(errors, [], "browser has no React Flow or runtime errors");
  console.log(
    `Graph browser checks passed: 36 isolated modules, module selection, history, 141 modules, boundary edges, filters, export, dark theme, and mobile. Screenshots: ${directory}`,
  );
} catch (error) {
  await page.screenshot({
    path: path.join(directory, "failure.png"),
    fullPage: true,
  });
  console.error(
    "Browser diagnostics",
    JSON.stringify({
      errors,
      state: await page.evaluate(() => ({
        nodes: document.querySelectorAll(".react-flow__node").length,
        viewport: document
          .querySelector(".react-flow__viewport")
          ?.getAttribute("style"),
        canvas: document
          .querySelector("[data-graph-canvas]")
          ?.getBoundingClientRect()
          .toJSON(),
      })),
      directory,
    }),
  );
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

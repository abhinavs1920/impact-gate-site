import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { Writable } from "node:stream";

function renderToHtml(element) {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        html += chunk.toString();
        callback();
      },
    });
    const { pipe } = renderToPipeableStream(element, {
      onAllReady() {
        pipe(sink);
      },
      onError(error) {
        reject(error);
      },
    });
    sink.on("finish", () => resolve(html));
    sink.on("error", reject);
  });
}
import { createServer } from "vite";

const server = await createServer({
  configFile: "vite.config.ts",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});

const origin = "https://impactgate.in";
const rootPlaceholder = '<div id="root"></div>';

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function replaceRequired(html, expression, replacement, label) {
  if (!expression.test(html)) {
    throw new Error(`The ${label} placeholder is missing from dist/index.html.`);
  }
  return html.replace(expression, () => replacement);
}

function documentationHtml(template, route, renderedRoot) {
  const title = `${route.title} | Impact Gate${route.contact ? "" : " Docs"}`;
  const canonical = `${origin}${route.pathname}`;
  let html = template.replace(rootPlaceholder, () => renderedRoot);
  html = replaceRequired(
    html,
    /<\/head>/,
    `<meta name="impact-gate-prerendered" content="${route.pathname}" /></head>`,
    "prerender marker",
  );
  html = replaceRequired(
    html,
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(title)}</title>`,
    "document title",
  );

  const metadata = [
    ["name", "description", route.description],
    ["property", "og:type", route.page ? "article" : "website"],
    ["property", "og:title", title],
    ["property", "og:description", route.description],
    ["property", "og:url", canonical],
    [
      "property",
      "og:image:alt",
      route.contact ? "Contact the Impact Gate team" : "Impact Gate product documentation",
    ],
    ["name", "twitter:title", title],
    ["name", "twitter:description", route.description],
  ];
  for (const [attribute, key, value] of metadata) {
    const expression = new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*\\/?>`);
    html = replaceRequired(
      html,
      expression,
      `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`,
      key,
    );
  }
  html = replaceRequired(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}" />`,
    "canonical URL",
  );

  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "Impact Gate", item: `${origin}/` },
    {
      "@type": "ListItem",
      position: 2,
      name: route.contact ? "Contact" : "Documentation",
      item: route.contact ? canonical : `${origin}/docs`,
    },
    ...(route.page
      ? [{ "@type": "ListItem", position: 3, name: route.title, item: canonical }]
      : []),
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": route.contact ? "ContactPage" : route.page ? "TechArticle" : "CollectionPage",
        "@id": `${canonical}#document`,
        url: canonical,
        headline: route.title,
        name: route.title,
        description: route.description,
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: "Impact Gate", url: `${origin}/` },
        publisher: { "@type": "Organization", name: "Impact Gate", url: `${origin}/` },
      },
      { "@type": "BreadcrumbList", itemListElement: breadcrumb },
    ],
  };
  const json = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  html = replaceRequired(
    html,
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${json}</script>`,
    "structured data",
  );
  if (route.preloadChunks?.length) {
    const links = route.preloadChunks
      .map((chunk) => `<link rel="modulepreload" href="/assets/${chunk}" />`)
      .join("");
    html = replaceRequired(html, /<\/head>/, `${links}</head>`, "modulepreload hint");
  }
  return html;
}

function collectLazyChunks(entryPattern) {
  const assetsDir = join("dist", "assets");
  const names = new Set(readdirSync(assetsDir).filter((name) => name.endsWith(".js")));
  const entry = [...names].find((name) => entryPattern.test(name));
  if (!entry) throw new Error(`Lazy chunk not found in dist/assets: ${entryPattern}`);
  const mainEntry = readFileSync("dist/index.html", "utf8").match(
    /src="\/assets\/([^"]+\.js)"/,
  )?.[1];
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const code = readFileSync(join(assetsDir, name), "utf8");
    for (const match of code.matchAll(/import\s*\(?\s*["']\.\/([^"']+\.js)["']\s*\)?/g)) {
      const dep = match[1];
      if (names.has(dep) && dep !== mainEntry && !seen.has(dep)) queue.push(dep);
    }
  }
  seen.delete(mainEntry);
  return [...seen];
}

try {
  const { default: App } = await server.ssrLoadModule("/src/App.tsx");
  const { docPages } = await server.ssrLoadModule("/src/docs/content.ts");
  const template = readFileSync("dist/index.html", "utf8");
  if (!template.includes(rootPlaceholder)) {
    throw new Error("React root placeholder is missing from dist/index.html.");
  }
  const renderRoot = async (pathname) =>
    `<div id="root">${await renderToHtml(createElement(App, { pathname }))}</div>`;
  const routes = [
    {
      pathname: "/docs",
      title: "Documentation",
      description:
        "Set up Impact Gate, connect GitHub repositories, review pull request reports, and understand analysis coverage.",
    },
  ];
  const slugs = new Set();
  for (const page of docPages) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) || slugs.has(page.slug)) {
      throw new Error(`Invalid or duplicate documentation slug: ${page.slug}`);
    }
    if (!page.title || !page.description) {
      throw new Error(`Missing documentation metadata: ${page.slug}`);
    }
    slugs.add(page.slug);
    routes.push({
      pathname: `/docs/${page.slug}`,
      title: page.title,
      description: page.description,
      page,
    });
  }
  routes.push({
    pathname: "/contact",
    title: "Contact the team",
    description:
      "Contact Impact Gate for product support, onboarding, business inquiries, billing, privacy requests, and security disclosures.",
    contact: true,
  });
  const docsChunks = collectLazyChunks(/^DocsApp-.*\.js$/);
  for (const route of routes) {
    if (route.pathname === "/docs" || route.pathname.startsWith("/docs/"))
      route.preloadChunks = docsChunks;
  }
  const homeRoot = await renderRoot("/");
  const homeHtml = replaceRequired(
    template.replace(rootPlaceholder, () => homeRoot),
    /<\/head>/,
    '<meta name="impact-gate-prerendered" content="/" /></head>',
    "prerender marker",
  );
  writeFileSync("dist/index.html", homeHtml);
  for (const route of routes) {
    const output = `dist${route.pathname}.html`;
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, documentationHtml(template, route, await renderRoot(route.pathname)));
  }

  const sitemapRoutes = ["/", ...routes.map((route) => route.pathname)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((pathname) => `  <url>\n    <loc>${origin}${pathname}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${pathname === "/" ? "1.0" : pathname === "/docs" ? "0.9" : "0.7"}</priority>\n  </url>`).join("\n")}\n</urlset>\n`;
  writeFileSync("dist/sitemap.xml", sitemap);
  console.log(
    `Prerendered the homepage, contact page, and ${routes.length - 1} documentation pages.`,
  );
} finally {
  await server.close();
}

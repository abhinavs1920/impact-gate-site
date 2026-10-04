import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
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
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
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
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(title)}</title>`, "document title");

  const metadata = [
    ["name", "description", route.description],
    ["property", "og:type", route.page ? "article" : "website"],
    ["property", "og:title", title],
    ["property", "og:description", route.description],
    ["property", "og:url", canonical],
    ["property", "og:image:alt", route.contact ? "Contact the Impact Gate team" : "Impact Gate product documentation"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", route.description],
  ];
  for (const [attribute, key, value] of metadata) {
    const expression = new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*\\/?>`);
    html = replaceRequired(html, expression,
      `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`, key);
  }
  html = replaceRequired(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonical}" />`, "canonical URL");

  const breadcrumb = [
    { "@type": "ListItem", position: 1, name: "Impact Gate", item: `${origin}/` },
    { "@type": "ListItem", position: 2, name: route.contact ? "Contact" : "Documentation", item: route.contact ? canonical : `${origin}/docs` },
    ...(route.page ? [{ "@type": "ListItem", position: 3, name: route.title, item: canonical }] : []),
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
  html = replaceRequired(html, /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${json}</script>`, "structured data");
  return html;
}

try {
  const { default: App } = await server.ssrLoadModule("/src/App.tsx");
  const { docPages } = await server.ssrLoadModule("/src/docs/content.ts");
  const template = readFileSync("dist/index.html", "utf8");
  if (!template.includes(rootPlaceholder)) {
    throw new Error("React root placeholder is missing from dist/index.html.");
  }
  const renderRoot = (pathname) =>
    `<div id="root">${renderToString(createElement(App, { pathname }))}</div>`;
  writeFileSync("dist/index.html", template.replace(rootPlaceholder, () => renderRoot("/")));

  const routes = [{
    pathname: "/docs",
    title: "Documentation",
    description: "Set up Impact Gate, connect GitHub repositories, review pull request reports, and understand analysis coverage.",
  }];
  const slugs = new Set();
  for (const page of docPages) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) || slugs.has(page.slug)) {
      throw new Error(`Invalid or duplicate documentation slug: ${page.slug}`);
    }
    if (!page.title || !page.description) {
      throw new Error(`Missing documentation metadata: ${page.slug}`);
    }
    slugs.add(page.slug);
    routes.push({ pathname: `/docs/${page.slug}`, title: page.title, description: page.description, page });
  }
  routes.push({ pathname: "/contact", title: "Contact the team", description: "Contact Impact Gate for pilot access, product support, business inquiries, billing, privacy requests, and security disclosures.", contact: true });
  for (const route of routes) {
    const output = `dist${route.pathname}.html`;
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, documentationHtml(template, route, renderRoot(route.pathname)));
  }

  const sitemapRoutes = ["/", ...routes.map((route) => route.pathname)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((pathname) => `  <url>\n    <loc>${origin}${pathname}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${pathname === "/" ? "1.0" : pathname === "/docs" ? "0.9" : "0.7"}</priority>\n  </url>`).join("\n")}\n</urlset>\n`;
  writeFileSync("dist/sitemap.xml", sitemap);
  console.log(`Prerendered the homepage, contact page, and ${routes.length - 1} documentation pages.`);
} finally {
  await server.close();
}

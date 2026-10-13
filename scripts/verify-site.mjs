import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";

const required = [
  "vite.config.ts",
  "wrangler.jsonc",
  "src/App.tsx",
  "src/worker.ts",
  "src/data/site-facts.json",
  "public/robots.txt",
  "public/sitemap.xml",
  "public/og-image.svg",
  "dist/index.html",
  "dist/robots.txt",
  "dist/sitemap.xml",
  "dist/og-image.svg",
];
const missing = required.filter((file) => !existsSync(file));
if (missing.length)
  throw new Error(`Missing required files: ${missing.join(", ")}`);

const html = readFileSync("dist/index.html", "utf8");
const banned =
  /\b(revolutionary|seamless|powerful|effortless|supercharge|unlock|game-changing|next-gen|cutting-edge|10x|safe|guaranteed|no risk|bulletproof|AI-powered)\b/i;
if (banned.test(html))
  throw new Error("Banned marketing language found in rendered HTML.");
for (const metadata of [
  '<meta name="robots" content="index, follow, max-image-preview:large" />',
  '<link rel="canonical" href="https://impactgate.in/" />',
  '<meta property="og:type" content="website" />',
  '<meta name="twitter:card" content="summary_large_image" />',
  '"@type": "SoftwareApplication"',
  '"@type": "FAQPage"',
  "See API Change Impact Across Services",
]) {
  if (!html.includes(metadata))
    throw new Error(`Expected SEO metadata is missing: ${metadata}`);
}
const structuredData = html.match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
);
if (!structuredData) throw new Error("Structured SEO data is missing.");
const graph = JSON.parse(structuredData[1])["@graph"];
const faq = graph.find((entry) => entry["@type"] === "FAQPage");
if (!faq || faq.mainEntity.length !== 5)
  throw new Error("Structured FAQ data does not match the visible FAQ.");
const visibleFaqItems = [...parseHTML(html).document.querySelectorAll("details.faq-item")];
if (visibleFaqItems.length !== faq.mainEntity.length)
  throw new Error("Visible and structured FAQ counts differ.");
for (const [index, question] of faq.mainEntity.entries()) {
  const visibleQuestion = visibleFaqItems[index].querySelector("summary").textContent.replace(/[−+]/g, "").trim();
  const visibleAnswer = visibleFaqItems[index].querySelector("p").textContent.trim();
  if (visibleQuestion !== question.name || visibleAnswer !== question.acceptedAnswer.text)
    throw new Error(`Visible and structured FAQ differ: ${question.name}`);
}
const robots = readFileSync("dist/robots.txt", "utf8");
if (!robots.includes("Allow: /") || !robots.includes("Disallow: /api/"))
  throw new Error("Robots policy must allow indexing while excluding the API.");
for (const crawler of [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-SearchBot",
]) {
  if (!robots.includes(`User-agent: ${crawler}`))
    throw new Error(`AI search crawler ${crawler} is not explicitly allowed.`);
}
const sitemap = readFileSync("dist/sitemap.xml", "utf8");
if (!sitemap.includes("<loc>https://impactgate.in/</loc>"))
  throw new Error("The sitemap must include the canonical homepage URL.");
if (!readFileSync("dist/og-image.svg", "utf8").includes('width="1200" height="630"'))
  throw new Error("The social sharing image must use the expected dimensions.");
if (!html.includes('id="root"'))
  throw new Error("React application root is missing.");
for (const id of [
  "main-content",
  "how-it-works",
  "evidence",
  "changes",
  "limits",
  "contact",
  "faq",
]) {
  if (!html.includes(`id="${id}"`))
    throw new Error(`Expected prerendered landmark #${id} is missing.`);
}
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
const missingAnchors = [...html.matchAll(/\bhref="#([^"]+)"/g)]
  .map(([, id]) => id)
  .filter((id) => !ids.has(id));
if (missingAnchors.length)
  throw new Error(
    `Broken in-page links: ${[...new Set(missingAnchors)].join(", ")}`,
  );
const stylesheet = html.match(/href="([^"]+\.css)"/)?.[1];
if (!stylesheet) throw new Error("Rendered stylesheet is missing.");
const cssPath = join("dist", stylesheet.replace(/^\/+/, ""));
if (!existsSync(cssPath))
  throw new Error(`Rendered stylesheet not found: ${cssPath}`);
const css = readFileSync(cssPath, "utf8");
const assets = readdirSync("dist/assets");
const htmlFiles = [];
function collectHtml(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectHtml(path);
    else if (path.endsWith(".html")) htmlFiles.push(path);
  }
}
collectHtml("dist");
for (const path of htmlFiles) {
  const rendered = readFileSync(path, "utf8");
  if (/private\s+pilot|shadow\s+pilot|join\s+pilot|in preparation|\bnot\s+(?:production[-\s]+ready|ready\s+for\s+production)\b|\bbeta\b(?!@impactgate\.in)/i.test(rendered))
    throw new Error(`Restricted launch wording appears in rendered HTML: ${path}`);
  const document = parseHTML(rendered).document;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) script.remove();
  const accessibleCopy = [
    document.body?.textContent ?? "",
    ...[...document.querySelectorAll("[aria-label], [alt], [title]")]
      .flatMap((element) => [element.getAttribute("aria-label"), element.getAttribute("alt"), element.getAttribute("title")])
      .filter(Boolean),
  ].join(" ");
  if (/\bbeta\b|\bnot\s+(?:production[-\s]+ready|ready\s+for\s+production)\b/i.test(accessibleCopy))
    throw new Error(`Restricted launch wording appears in rendered text or accessible labels: ${path}`);
}
for (const path of [...htmlFiles, ...assets.map((name) => join("dist/assets", name)).filter((name) => name.endsWith(".js"))]) {
  const rendered = readFileSync(path, "utf8");
  for (const match of rendered.matchAll(/pilot/gi)) {
    const context = rendered.slice(Math.max(0, match.index - 20), match.index + 25);
    if (!/request_pilot|pilot_request/.test(context))
      throw new Error(`Unapproved legacy wording appears in built output: ${path}`);
  }
}
if (!html.includes("open to engineering teams"))
  throw new Error("Open availability metadata is missing from the homepage.");
const script = html.match(/src="([^"]+\.js)"/)?.[1];
if (!script) throw new Error("Rendered React bundle is missing.");
const scriptPath = join("dist", script.replace(/^\/+/, ""));
if (!existsSync(scriptPath))
  throw new Error(`Rendered React bundle not found: ${scriptPath}`);
const js = readFileSync(scriptPath, "utf8");
for (const id of [
  "main-content",
  "how-it-works",
  "evidence",
  "changes",
  "limits",
  "contact",
  "faq",
]) {
  if (!js.includes(id))
    throw new Error(
      `Expected page landmark #${id} is missing from the React bundle.`,
    );
}
if (!js.includes("data-waitlist-form"))
  throw new Error("Contact form is missing.");
if (!css.includes("prefers-reduced-motion"))
  throw new Error("Reduced-motion support is missing.");
if (!css.includes("max-width:54rem") || !css.includes("max-width:34rem"))
  throw new Error("Responsive breakpoints are missing.");
if (!css.includes(".hero-grid{"))
  throw new Error("Hero layout styles are missing.");
if (!css.includes(".hero-copy{"))
  throw new Error("Hero content sizing styles are missing.");
if (
  !js.includes("Switch to dark theme") ||
  !js.includes("Switch to light theme")
)
  throw new Error("Accessible theme toggle labels are missing.");
if (!css.includes("[data-theme=dark]"))
  throw new Error("Dark theme styles are missing.");
if (!css.includes(".hero-video"))
  throw new Error("Hero video styles are missing.");
if (!css.includes("hero-glow-drift") || !css.includes("no-preference"))
  throw new Error("Lightweight motion styles are missing.");
if (!css.includes("grid-template-columns:1.35rem minmax(0,1fr)"))
  throw new Error("Narrow-screen trace overflow fix is missing.");
if (!assets.some((asset) => asset.endsWith(".js")))
  throw new Error("No React application bundle was generated.");
console.log("Static build and content checks passed.");

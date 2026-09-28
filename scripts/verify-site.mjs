import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const required = [
  "vite.config.ts",
  "wrangler.jsonc",
  "src/App.tsx",
  "src/worker.ts",
  "src/data/site-facts.json",
  "public/robots.txt",
  "dist/index.html",
];
const missing = required.filter((file) => !existsSync(file));
if (missing.length)
  throw new Error(`Missing required files: ${missing.join(", ")}`);

const html = readFileSync("dist/index.html", "utf8");
const banned =
  /\b(revolutionary|seamless|powerful|effortless|supercharge|unlock|game-changing|next-gen|cutting-edge|10x|safe|guaranteed|no risk|bulletproof|AI-powered)\b/i;
if (banned.test(html))
  throw new Error("Banned marketing language found in rendered HTML.");
if (!html.includes('name="robots" content="noindex"'))
  throw new Error("Rendered page must remain noindex.");
if (!html.includes('id="root"'))
  throw new Error("React application root is missing.");
for (const id of [
  "main-content",
  "how-it-works",
  "evidence",
  "changes",
  "limits",
  "pilot",
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
  "pilot",
  "faq",
]) {
  if (!js.includes(id))
    throw new Error(
      `Expected page landmark #${id} is missing from the React bundle.`,
    );
}
if (!js.includes("ILLUSTRATIVE") || !js.includes("NOT LIVE"))
  throw new Error("Illustrative review example must be labeled as not live.");
if (!js.includes("data-waitlist-form"))
  throw new Error("Waitlist form is missing.");
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
if (!css.includes("html[data-theme=dark] .review-card"))
  throw new Error("Dark theme card styles must override component styles.");
if (!css.includes("grid-template-columns:1.35rem minmax(0,1fr)"))
  throw new Error("Narrow-screen trace overflow fix is missing.");
if (!assets.some((asset) => asset.endsWith(".js")))
  throw new Error("No React application bundle was generated.");
console.log("Static build and content checks passed.");

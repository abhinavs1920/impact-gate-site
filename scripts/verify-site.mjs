import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const required = ["astro.config.mjs", "wrangler.jsonc", "src/pages/index.astro", "src/data/site-facts.json", "public/robots.txt"];
const missing = required.filter((file) => !existsSync(file));
if (missing.length) throw new Error(`Missing required files: ${missing.join(", ")}`);

const result = spawnSync("astro", ["build"], { stdio: "inherit", shell: true });
if (result.status !== 0) process.exit(result.status ?? 1);

const html = readFileSync("dist/index.html", "utf8");
const banned = /\b(revolutionary|seamless|powerful|effortless|supercharge|unlock|game-changing|next-gen|cutting-edge|10x|safe|guaranteed|no risk|bulletproof|AI-powered)\b/i;
if (banned.test(html)) throw new Error("Banned marketing language found in rendered HTML.");
if (!html.includes('name="robots" content="noindex"')) throw new Error("Rendered page must remain noindex.");
console.log("Static build and content checks passed.");
console.log("Lighthouse was not run by this script; install Lighthouse and run the production server before claiming performance results.");

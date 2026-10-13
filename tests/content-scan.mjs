import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHTML } from "linkedom";

const facts = JSON.parse(
  readFileSync(new URL("../src/data/site-facts.json", import.meta.url)),
);
assert.equal(facts.warnOnly.status, "available");
assert.equal(facts.stage.status, "available");

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
for (const section of [
  "Hero",
  "EvidenceGraph",
  "WorkflowCards",
  "HowItWorks",
  "EvidenceStates",
  "SupportedChanges",
  "Boundaries",
  "ContactForm",
  "FAQ",
]) {
  assert.match(
    source,
    new RegExp(`<${section}\\b`),
    `Homepage should render the ${section} section.`,
  );
}
assert.match(source, /Know what your API changes will affect/);
assert.match(source, /Connect GitHub/);
assert.match(source, /Try demo/);
assert.match(source, /href="\/demo"/);
assert.match(source, /commercial\.mp4/);
assert.match(source, /demo\.mp4/);
assert.match(source, /href: "\/demo"/);
assert.match(source, /Get in touch/);
assert.match(source, /See which/);
assert.match(source, /downstream services/);
assert.doesNotMatch(source, /Replace your production monitoring or observability tools/);
assert.match(source, /data-theme-toggle|className="theme-toggle"/);
assert.match(
  readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8"),
  /\[data-theme="?dark"?\]/,
);
assert.match(
  readFileSync(new URL("../index.html", import.meta.url), "utf8"),
  /prefers-color-scheme/,
);
assert.match(source, /localStorage\.setItem\("impact-gate-theme"/);
const workspace = readFileSync(
  new URL("../src/dashboard/connected.ts", import.meta.url),
  "utf8",
);
assert.match(workspace, /ig-setup-steps/);
assert.match(workspace, /Which API should we map first/);
assert.match(workspace, /Runtime data is optional/);
assert.match(workspace, /Retirement Radar/);

const filesUnder = (root) => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const path = join(root, entry.name);
  return entry.isDirectory() ? filesUnder(path) : [path];
});
const visibleSources = [
  ...filesUnder(new URL("../src", import.meta.url).pathname),
  ...filesUnder(new URL("../public", import.meta.url).pathname),
  ...filesUnder(new URL("../docs", import.meta.url).pathname),
  new URL("../index.html", import.meta.url).pathname,
].filter((path) => /\.(?:tsx?|json|html|md|txt|xml|svg|css)$/i.test(path));
const prohibited = /private\s+pilot|shadow\s+pilot|join\s+pilot|in preparation|\bnot\s+(?:production[-\s]+ready|ready\s+for\s+production)\b/i;
for (const path of visibleSources) {
  const text = readFileSync(path, "utf8");
  assert.doesNotMatch(text, prohibited, `User-facing source contains restricted launch wording: ${path}`);
  assert.doesNotMatch(text, /\bBeta\b/, `User-facing source contains a Beta label: ${path}`);
}

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const jsonLd = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const faq = jsonLd["@graph"].find((entry) => entry["@type"] === "FAQPage");
const renderedHtml = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const renderedDocument = parseHTML(renderedHtml).document;
const visibleFaq = [...renderedDocument.querySelectorAll("details.faq-item")];
assert.equal(visibleFaq.length, faq.mainEntity.length, "Visible and structured FAQ counts must match.");
for (const [index, entry] of faq.mainEntity.entries()) {
  const question = visibleFaq[index].querySelector("summary").textContent.replace(/[−+]/g, "").trim();
  const answer = visibleFaq[index].querySelector("p").textContent.trim();
  assert.equal(question, entry.name, `Structured FAQ question must match visible text: ${entry.name}`);
  assert.equal(answer, entry.acceptedAnswer.text, `Structured FAQ answer must match visible text: ${entry.name}`);
}

const analytics = readFileSync(new URL("../src/analytics/index.ts", import.meta.url), "utf8");
for (const event of ["demo_open", "demo_interact", "video_play", "video_progress", "video_complete"])
  assert.ok(analytics.includes(event), `Missing analytics coverage: ${event}`);

const siteFeatures = JSON.parse(readFileSync(new URL("../src/data/features.json", import.meta.url), "utf8"));
assert.deepEqual(siteFeatures.map(({ id }) => id), ["map", "guard", "retire", "runtime_data"]);
assert.ok(siteFeatures.every(({ stage }) => stage === "ga"));
const backendFeaturesPath = new URL("../../impact-gate/packages/core/src/features.ts", import.meta.url);
if (existsSync(backendFeaturesPath)) {
  const backendSource = readFileSync(backendFeaturesPath, "utf8");
  const registryLiteral = backendSource.match(/export const FEATURE_REGISTRY = (\[[\s\S]*?\]) as const satisfies readonly FeatureDefinition\[\];/)?.[1];
  assert.ok(registryLiteral, "Backend feature registry must be a literal array.");
  const backendJson = registryLiteral
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*):/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, "$1");
  const backendFeatures = JSON.parse(backendJson);
  assert.deepEqual(siteFeatures, backendFeatures, "Site and backend feature registries must match.");
}
console.log("Content source checks passed.");

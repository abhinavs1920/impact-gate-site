import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const facts = JSON.parse(
  readFileSync(new URL("../src/data/site-facts.json", import.meta.url)),
);
assert.equal(facts.warnOnly.status, "available");
assert.equal(facts.stage.status, "in_testing");

const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
for (const section of [
  "Hero",
  "EvidenceGraph",
  "WorkflowCards",
  "HowItWorks",
  "EvidenceStates",
  "SupportedChanges",
  "Boundaries",
  "PilotForm",
  "FAQ",
]) {
  assert.match(
    source,
    new RegExp(`<${section}\\b`),
    `Homepage should render the ${section} section.`,
  );
}
assert.match(source, /ILLUSTRATIVE · NOT LIVE/);
assert.match(source, /Know what your API changes will affect/);
assert.match(source, /Connect GitHub/);
assert.match(source, /View a sample impact report/);
assert.match(source, /href="\/review-desk"/);
assert.match(source, /Join pilot waitlist/);
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
console.log("Content source checks passed.");


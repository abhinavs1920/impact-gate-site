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
assert.match(workspace, /Choose the API contract repository and applications that call its APIs/);
assert.match(workspace, /Connect repositories to discover APIs/);
console.log("Content source checks passed.");


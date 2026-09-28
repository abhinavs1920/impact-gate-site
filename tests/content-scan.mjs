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
assert.match(source, /ILLUSTRATIVE · NOT LIVE/);
assert.match(source, /UserResponse\.email/);
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
console.log("Content source checks passed.");

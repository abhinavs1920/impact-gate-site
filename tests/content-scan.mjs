import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const facts = JSON.parse(readFileSync(new URL("../src/data/site-facts.json", import.meta.url)));
assert.equal(facts.warnOnly.status, "available");
assert.equal(facts.stage.status, "in_testing");

const source = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");
assert.match(source, /siteFacts|Fact/);
console.log("Content source checks passed.");

import assert from "node:assert/strict";
import { build } from "esbuild";
import { graphSnapshot } from "./fixtures/graph.mjs";

async function bundle(entry) {
  const { outputFiles } = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
  );
}
const { buildRepositoryGraph, filteredRepositoryGraph } = await bundle(
  "src/dashboard/dependency-graph.ts",
);
const { projectGraph } = await bundle(
  "src/dashboard/dependency-graph/project.ts",
);

const empty = buildRepositoryGraph(graphSnapshot());
assert.equal(
  projectGraph(empty, null).nodes.length,
  3,
  "repositories without modules or edges remain visible",
);
assert.equal(empty.aggregates.length, 0);
const isolated = filteredRepositoryGraph(empty, "module-036", "");
assert.equal(
  isolated.modules.length,
  1,
  "an isolated module can be found by search",
);
assert.equal(isolated.repositories[0].id, "r1");

const snapshot = graphSnapshot(36, 12);
snapshot.edges.push({
  ...snapshot.edges[0],
  id: "duplicate",
  evidence: "runtime",
});
const model = buildRepositoryGraph(snapshot);
assert.equal(
  model.relations.length,
  snapshot.edges.length - 1,
  "same caller and endpoint counted once",
);
assert.equal(
  model.relations[0].edge.evidence,
  "both",
  "duplicate evidence is combined",
);
assert.equal(model.relations[0].originalIds.length, 2);
assert.equal(model.aggregates.length, 2, "reverse dependencies stay separate");

for (const filter of ["", "static", "runtime", "both"]) {
  const filtered = filteredRepositoryGraph(model, "", filter);
  const detail = projectGraph(filtered, "r1");
  const eligible = filtered.relations.filter(
    (relation) =>
      relation.sourceRepositoryId === "r1" ||
      relation.targetRepositoryId === "r1",
  );
  const relationIds = detail.edges.flatMap((edge) => edge.relationIds);
  assert.equal(
    new Set(relationIds).size,
    relationIds.length,
    "each eligible relation is rendered exactly once",
  );
  assert.deepEqual(
    new Set(relationIds),
    new Set(eligible.map((relation) => relation.id)),
    "internal and both boundary directions survive drill-down",
  );
  const nodeIds = new Set(detail.nodes.map((node) => node.id));
  assert.ok(
    detail.edges.every(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
    "edges have visible endpoints",
  );
  assert.ok(
    detail.nodes.every((node) => !node.parentId),
    "module view has no auto-sized compound parent",
  );
}
const connected = projectGraph(model, "r1", true);
assert.equal(connected.hiddenModuleCount, 24);
assert.equal(
  connected.nodes.filter((node) => node.kind === "module").length,
  12,
);
assert.equal(projectGraph(empty, "r1").nodes.length, 36);
console.log(
  "Repository aggregation, evidence filters, isolated search, and boundary edge conservation passed.",
);

import assert from "node:assert/strict";
import { build } from "esbuild";
import { parseHTML } from "linkedom";

const built = await build({
  entryPoints: ["src/dashboard/post-index.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
});
const {
  renderPostIndexSettings,
  renderCallResolution,
  renderCallResolutionDetail,
  mountCallResolutions,
} = await import(
  `data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`
);
const source = {
  repositoryId: "repo",
  sha: "a".repeat(40),
  filePath: "src/app.ts",
  line: 42,
  url: "",
};
const item = {
  id: "call:src/app.ts:42",
  status: "inferred",
  attempts: 2,
  inputTokens: "100",
  outputTokens: "20",
  observation: {
    source,
    kind: "function_call",
    reason: "Static receiver unresolved",
    staticCall: { targetName: "registry[action]" },
  },
  decision: {
    reason: "Registry selects save",
    targetIds: ["save"],
    targetSetComplete: true,
    uncertainty: "No runtime measurement",
    neededEvidence: [],
    relationship: { explanation: "The create entry refers to save" },
    evidence: [
      {
        evidenceId: "registration",
        quote: "const registry = { create: save };",
      },
    ],
  },
  evidence: [
    {
      id: "registration",
      source,
      text: "const registry = { create: save };",
      truncated: false,
    },
  ],
};
assert.match(renderCallResolution(item), /<td>AI<\/td><td>Resolved/);
assert.match(
  renderCallResolution({
    ...item,
    status: "external",
    decision: null,
    observation: { ...item.observation, origin: "static" },
  }),
  /<td>Static<\/td><td>external/,
);
assert.match(
  renderCallResolution({ ...item, status: "static_resolved", decision: null }),
  /<td>Static<\/td><td>Resolved/,
);
assert.match(
  renderCallResolution({
    ...item,
    decision: { ...item.decision, targetSetComplete: false },
  }),
  /Ambiguous/,
);
assert.match(
  renderCallResolution({
    ...item,
    status: "deferred_budget",
    decision: null,
    error: "investigation_budget_exhausted",
  }),
  /Not ready.*investigation budget exhausted/s,
);
const explained = renderCallResolutionDetail({
  ...item,
  decision: { ...item.decision, reason: '<img src=x onerror="bad()">' },
});
assert.doesNotMatch(explained, /<img/);
assert.match(explained, /src\/app.ts:42/);
assert.match(explained, /No runtime measurement/);
const settings = parseHTML(
  `<form>${renderPostIndexSettings({ postIndexAnalysisEnabled: true, sourceEvidencePolicy: "metadata_only" }, true, "")}</form>`,
).document;
assert.ok(
  settings
    .querySelector('[name="postIndexAnalysisEnabled"]')
    .hasAttribute("checked"),
);
assert.ok(
  !settings
    .querySelector('[name="shareResolutionSource"]')
    .hasAttribute("checked"),
  "Metadata-only consent cannot authorize source transfer",
);
assert.match(settings.body.textContent || settings.toString(), /equal weight/);

const impactBuild = await build({
  entryPoints: ["src/dashboard/impact-evidence.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
});
const { renderImplementationPaths } = await import(
  `data:text/javascript;base64,${Buffer.from(impactBuild.outputFiles[0].text).toString("base64")}`
);
const witness = {
  view: "base",
  endpointId: "orders",
  endpoint: "GET /orders",
  endpointSource: source,
  changedFunction: {
    name: '<img src=x onerror="bad()">',
    before: source,
    after: [{ ...source, sha: "b".repeat(40) }],
    match: "modified",
  },
  calls: [
    {
      id: "dynamic",
      targetName: "<script>bad()</script>",
      source,
      origin: "ai",
      possible: true,
    },
  ],
  evidenceOrigin: "mixed",
  possibleTargets: true,
  truncated: false,
};
const pathHtml = renderImplementationPaths(
  [witness, { ...witness, view: "head" }],
  1,
);
assert.doesNotMatch(pathHtml, /<img|<script/);
assert.match(pathHtml, /Mixed Static\/AI/);
assert.match(pathHtml, /Possible target/);
assert.match(pathHtml, /Showing 1 of 2 paths/);
assert.match(pathHtml, /Before:/);
assert.match(pathHtml, /After:/);
const download = parseHTML(pathHtml).document.querySelector("a[download]");
assert.equal(
  JSON.parse(decodeURIComponent(download.getAttribute("href").split(",")[1]))
    .length,
  2,
  "Export preserves paths omitted from the bounded preview",
);
assert.equal(renderImplementationPaths(undefined), "");

const { document, window } = parseHTML(
  '<html><body><section id="resolution"></section></body></html>',
);
const container = document.querySelector("#resolution");
const requests = [];
const pageResolvers = [];
const api = {
  request: async (url) => {
    requests.push(url);
    if (url.includes("/steps?")) {
      const offset = Number(
        new URL(url, "https://example.com").searchParams.get("offset"),
      );
      return {
        steps: [
          {
            sequence: offset + 1,
            event: {
              kind: "tool",
              details: {
                action: "read_source",
                arguments: { filePath: "src/app.ts" },
              },
            },
          },
        ],
        total: 2,
        hasNext: offset === 0,
      };
    }
    if (url.includes("/calls/")) return { call: item };
    return new Promise((resolve) => pageResolvers.push(resolve));
  },
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
mountCallResolutions(container, api, "workspace", {
  id: "run",
  commitSha: source.sha,
  resolutionSummary: {
    analysisScope: { partial: true },
    chargedMicroUsd: 1000,
    uncertainRequests: 1,
  },
});
assert.match(container.textContent, /Partial indexing/);
assert.match(container.textContent, /\$0.0010/);
const filter = container.querySelector("[data-resolution-origin]");
filter.querySelector('[value="ai"]').setAttribute("selected", "");
filter.dispatchEvent(new window.Event("change", { bubbles: true }));
assert.match(requests.at(-1), /origin=ai/);
pageResolvers[1]({ calls: [item], total: 21, hasNext: true });
await tick();
pageResolvers[0]({
  calls: [
    {
      ...item,
      observation: {
        ...item.observation,
        staticCall: { targetName: "stale_result" },
      },
    },
  ],
  total: 1,
  hasNext: false,
});
await tick();
assert.doesNotMatch(
  container.textContent,
  /stale_result/,
  "An older response must not overwrite the current filter",
);
container.querySelector("[data-resolution-detail]").click();
await tick();
assert.match(requests.at(-1), /call%3Asrc%2Fapp.ts%3A42$/);
assert.match(container.textContent, /Decision explanation/);
const history = container.querySelector("[data-resolution-steps]");
history.click();
await tick();
assert.match(container.textContent, /read source/);
history.click();
await tick();
assert.match(requests.at(-1), /steps\?limit=20&offset=1$/);
assert.ok(history.disabled);
container.querySelector('[data-resolution-page="next"]').click();
assert.match(requests.at(-1), /offset=20/);
pageResolvers[2]({ calls: [], total: 21, hasNext: false });
await tick();
assert.match(container.textContent, /No call outcomes match/);
console.log(
  "Post-index settings, evidence, pagination, origin filtering and stale-response checks passed.",
);

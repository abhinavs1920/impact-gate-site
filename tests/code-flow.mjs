import assert from "node:assert/strict";
import { build } from "esbuild";
import { parseHTML } from "linkedom";

const result = await build({
  entryPoints: ["src/dashboard/code-flow.ts"],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  plugins: [
    {
      name: "graph-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^cytoscape$/ }, () => ({
          path: "graph",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export default options => { globalThis.codeGraphOptions = options; return {on(){},destroy(){}}; }`,
        }));
      },
    },
  ],
});
const { renderCodeFlow, renderFunctionInventory, mountCodeFlow } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
const source = {
  repositoryId: "repo",
  filePath: "src/handler.ts",
  line: 12,
  sha: "a".repeat(40),
  url: "https://github.com/org/api/blob/aaaa/src/handler.ts#L12",
};
const endpoint = {
  id: "orders",
  serviceId: "service",
  method: "GET",
  path: "/orders",
  runtimeCallsInWindow: 120,
  runtimeRequestSource: "prometheus",
};
const fn = (id, extra = {}) => ({
  id,
  name: id,
  qualifiedName: id,
  serviceId: "service",
  kind: "function",
  source,
  attributedRequestsInWindow: 120,
  countsPartial: false,
  attributions: [
    {
      endpointId: "orders",
      requestsInWindow: 120,
      source: "prometheus",
      windowStart: "2026-10-01T00:00:00Z",
      windowEnd: "2026-10-02T00:00:00Z",
    },
  ],
  ...extra,
});
const snapshot = {
  endpoints: [endpoint],
  services: [{ id: "service", name: "Order service" }],
  code: {
    version: 1,
    functions: [
      fn("handler"),
      fn("shared"),
      fn("unused", { attributedRequestsInWindow: null, countsPartial: true, attributions: [] }),
    ],
    calls: [
      {
        id: "helper",
        callerFunctionId: "handler",
        calleeFunctionId: "shared",
        targetName: "shared",
        resolution: "resolved",
        kind: "call",
        conditional: true,
        repeated: false,
        source,
      },
      {
        id: "dynamic",
        callerFunctionId: "shared",
        calleeFunctionId: null,
        targetName: "<unknown>",
        resolution: "unresolved",
        kind: "call",
        conditional: false,
        repeated: false,
        source,
      },
      {
        id: "response",
        callerFunctionId: "handler",
        calleeFunctionId: null,
        targetName: "reply.send",
        resolution: "unresolved",
        modeled: true,
        kind: "call",
        conditional: false,
        repeated: false,
        source,
      },
    ],
    flows: [
      {
        endpointId: "orders",
        entryFunctionIds: ["handler"],
        functionIds: ["handler", "shared"],
        callIds: ["helper", "dynamic", "response"],
        callerFunctionIds: [],
        outboundCalls: [],
        status: "partial",
        notes: ["Dynamic dispatch remains unresolved."],
      },
    ],
    missingRepositoryIds: [],
  },
};
let document = parseHTML(
  `<html><body>${renderCodeFlow(snapshot, endpoint)}</body></html>`,
).document;
assert.match(document.body.textContent, /2 reachable functions/);
assert.match(document.body.textContent, /120 API requests/);
assert.match(document.body.textContent, /measured function invocations/);
assert.match(document.body.textContent, /unresolved boundary/);
assert.match(document.body.textContent, /Modeled framework or language operation/);
assert.match(document.body.textContent, /Modeled/);
assert.equal(document.querySelector("[data-code-flow]").dataset.codeFlow, "orders");
assert.equal(document.querySelectorAll('a[href*="blob/"]').length, 5);
globalThis.document = document;
mountCodeFlow(
  snapshot,
  document.querySelector("[data-code-flow]"),
  document.querySelector("[data-code-inspector]"),
);
assert.equal(globalThis.codeGraphOptions.elements[0].data.label, "GET /orders");
assert.ok(
  globalThis.codeGraphOptions.elements.some((element) => element.data.id === "boundary:dynamic"),
);
assert.ok(
  globalThis.codeGraphOptions.elements.some(
    (element) => element.data.id === "helper" && element.data.conditional === "yes",
  ),
);
document = parseHTML(`<html><body>${renderFunctionInventory(snapshot)}</body></html>`).document;
assert.equal(
  document.querySelector("#function-usage").getAttribute("aria-labelledby"),
  "function-usage-title",
);
assert.equal(document.querySelectorAll("tbody tr").length, 3);
assert.match(document.querySelector("tbody tr:last-child").textContent, /Unknown/);
assert.equal(
  parseHTML(renderFunctionInventory(snapshot, "shared")).document.querySelectorAll("tbody tr")
    .length,
  1,
);
const malicious = structuredClone(snapshot);
malicious.code.functions[0].qualifiedName = "<img src=x onerror=alert(1)>";
malicious.code.functions[0].source.url = "javascript:alert(1)";
document = parseHTML(renderCodeFlow(malicious, endpoint)).document;
assert.equal(document.querySelector("img"), null);
assert.equal(document.querySelector('a[href^="javascript:"]'), null);
assert.match(renderCodeFlow({ ...snapshot, code: undefined }, endpoint), /reindex/i);
const many = structuredClone(snapshot);
many.code.functions = Array.from({ length: 201 }, (_, index) => fn(`f${index}`));
document = parseHTML(renderFunctionInventory(many, "", 2)).document;
assert.equal(document.querySelectorAll("tbody tr").length, 25);
assert.match(document.querySelector(".ig-card").textContent, /51–75 of 201/);
const staticSnapshot = structuredClone(snapshot);
staticSnapshot.endpoints.push({
  id: "checkout",
  method: "POST",
  path: "/checkout",
  serviceId: "caller",
});
staticSnapshot.services.push({ id: "caller", name: "Checkout source" });
staticSnapshot.code.functions.push(fn("submit", { serviceId: "caller" }));
staticSnapshot.code.flows[0].inboundCalls = [
  {
    id: "dep1",
    callerServiceId: "caller",
    callerFunctionId: "submit",
    endpointId: "orders",
    method: "GET",
    path: "/orders",
    source: { ...source, column: 7 },
    resolution: "matched",
    consumerEndpointIds: ["checkout"],
    matchBasis: "server_origin",
    targetOrigin: "https://gateway.example",
  },
];
staticSnapshot.code.apiDependencies = staticSnapshot.code.flows[0].inboundCalls;
staticSnapshot.code.flows[0].pathAnalysis = {
  version: 1,
  status: "indexed",
  notes: [],
  callConditions: [
    {
      callId: "helper",
      source,
      conditions: [
        {
          predicateId: "branch",
          predicate: "orderId !== <literal>",
          polarity: "true",
          source,
          inputOrigins: [
            { entryFunctionId: "handler", parameterIndex: 0, accessPath: ["params", "id"] },
          ],
        },
      ],
    },
  ],
  valuePaths: [
    {
      callId: "helper",
      argumentIndex: 0,
      source,
      inputOrigins: [
        { entryFunctionId: "handler", parameterIndex: 0, accessPath: ["params", "id"] },
      ],
    },
  ],
};
staticSnapshot.endpoints[0].runtimeCallsInWindow = null;
document = parseHTML(
  `<html><body>${renderCodeFlow(staticSnapshot, staticSnapshot.endpoints[0])}</body></html>`,
).document;
assert.match(document.body.textContent, /Consumer APIs and call sites/);
assert.match(document.body.textContent, /POST \/checkout/);
assert.match(document.body.textContent, /Static server origin \+ route match/);
assert.match(document.body.textContent, /No linked runtime observation/);
assert.match(document.body.textContent, /Static conditions and input origins/);
assert.match(document.body.textContent, /parameter 1.params.id/);
assert.match(document.body.textContent, /orderId !== <literal>/);
assert.ok(document.querySelector('a[data-id="checkout"]'));
assert.equal(document.querySelector("literal"), null);
document = parseHTML(
  `<html><body>${renderFunctionInventory(staticSnapshot)}</body></html>`,
).document;
assert.ok(document.querySelector("#static-api-dependencies"));
assert.match(document.body.textContent, /telemetry is optional/);
staticSnapshot.code.flows[0].outboundCalls = [
  {
    callerFunctionId: "shared",
    functionCallId: "dynamic",
    endpointId: "checkout",
    method: "POST",
    path: "/checkout",
    source,
    resolution: "matched",
    matchBasis: "route_only",
  },
];
globalThis.document = document;
mountCodeFlow(staticSnapshot, { dataset: { codeFlow: "orders" } }, null);
assert.ok(
  globalThis.codeGraphOptions.elements.some(
    (element) =>
      element.data.id === "provider:checkout" && element.data.label.includes("POST /checkout"),
  ),
);
assert.ok(
  globalThis.codeGraphOptions.elements.some(
    (element) => element.data.id === "dynamic" && element.data.target === "provider:checkout",
  ),
);
delete globalThis.document;
delete globalThis.codeGraphOptions;
console.log(
  "Code flow graph, function request attribution, unknown usage, source links, and escaped code evidence passed.",
);

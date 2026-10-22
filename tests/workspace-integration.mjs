import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import { build } from "esbuild";
import { parseHTML } from "linkedom";

const directory = await mkdtemp(path.join(tmpdir(), "impact-gate-site-tests-"));
const originalFetch = globalThis.fetch;
const delay = () => new Promise((resolve) => setTimeout(resolve, 5));
try {
  const outfile = path.join(directory, "api.mjs");
  await build({
    entryPoints: ["src/dashboard/api.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  const { WorkspaceApi, WorkspaceApiError } = await import(outfile);
  const refreshes = [];
  const identity = {
    currentUser: { uid: "user-1" },
    getIdToken: async (refresh) => {
      refreshes.push(refresh);
      return refresh ? "fresh-token" : "old-token";
    },
  };
  const api = new WorkspaceApi(identity);
  let calls = 0;
  globalThis.fetch = async (_url, request) => {
    calls++;
    assert.equal(request.credentials, "same-origin");
    assert.equal(
      request.headers.Authorization,
      calls === 1 ? "Bearer old-token" : "Bearer fresh-token",
    );
    return calls === 1
      ? Response.json({ error: { code: "expired", message: "Expired token." } }, { status: 401 })
      : Response.json({ version: 1 });
  };
  assert.deepEqual(await api.request("/api/v1/session"), { version: 1 });
  assert.deepEqual(refreshes, [false, true]);
  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      { error: { code: "forbidden", message: "No membership." } },
      { status: 403 },
    );
  };
  await assert.rejects(
    api.request("/api/v1/session"),
    (error) =>
      error instanceof WorkspaceApiError && error.status === 403 && error.code === "forbidden",
  );
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: { code: "expired", message: "Expired." } }, { status: 401 });
  };
  await assert.rejects(api.request("/api/v1/session"), (error) => error.status === 401);
  assert.equal(calls, 2, "401 refresh stops after one retry");
  let release;
  globalThis.fetch = async () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const stale = api.request("/api/v1/session");
  await delay();
  api.cancel();
  release(Response.json({ version: 1 }));
  await assert.rejects(stale, (error) => error.name === "AbortError");
  const changed = api.request("/api/v1/session");
  await delay();
  identity.currentUser = { uid: "user-2" };
  release(Response.json({ secret: "user-1 data" }));
  await assert.rejects(changed, (error) => error.name === "AbortError");

  const workerFile = path.join(directory, "worker.mjs");
  await build({
    entryPoints: ["src/worker.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: workerFile,
  });
  const { proxyWorkspaceApi } = await import(workerFile);
  const env = {
    IMPACT_GATE_API_ORIGIN: "https://api.impactgate.in",
    IMPACT_GATE_PROXY_SECRET: "server-only",
  };
  globalThis.fetch = async (destination, request) => {
    assert.equal(new URL(destination).origin, "https://api.impactgate.in");
    assert.equal(request.redirect, "manual");
    assert.equal(request.headers.get("Authorization"), "Bearer user-token");
    assert.equal(request.headers.get("X-Impact-Gate-Proxy-Secret"), "server-only");
    assert.equal(request.headers.has("Cookie"), false);
    return Response.json({ workspaces: [] });
  };
  let response = await proxyWorkspaceApi(
    new Request("https://impactgate.in/api/v1/session?upstream=https://evil.example", {
      headers: { Authorization: "Bearer user-token", Cookie: "other=private" },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  response = await proxyWorkspaceApi(new Request("https://impactgate.in/api/v1/session"), {
    IMPACT_GATE_API_ORIGIN: "http://evil.example",
  });
  assert.equal(response.status, 503);
  globalThis.fetch = async (_destination, request) => {
    assert.equal(request.headers.get("Cookie"), "impact_gate_oauth=nonce");
    return new Response(null, {
      status: 303,
      headers: {
        Location: "https://impactgate.in/onboarding?githubSelection=flow",
        "Set-Cookie":
          "impact_gate_oauth=; Path=/api/v1/github; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      },
    });
  };
  response = await proxyWorkspaceApi(
    new Request("https://impactgate.in/api/v1/github/callback?code=test", {
      headers: { Cookie: "other=private; impact_gate_oauth=nonce" },
    }),
    env,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/onboarding?githubSelection=flow");
  assert.match(response.headers.get("Set-Cookie"), /^impact_gate_oauth=/);
  globalThis.fetch = async () =>
    new Response(null, { status: 302, headers: { Location: "https://evil.example/collect" } });
  response = await proxyWorkspaceApi(
    new Request("https://impactgate.in/api/v1/github/callback"),
    env,
  );
  assert.equal(response.status, 502);
  response = await proxyWorkspaceApi(
    new Request("https://impactgate.in/api/v1/workspaces/one/settings", {
      method: "PATCH",
      headers: { Origin: "https://evil.example" },
    }),
    env,
  );
  assert.equal(response.status, 403);

  const mockAuth = `export class ImpactGateAuthClient { config; currentUser={uid:'u1',email:'user@example.com',providerData:[]}; ready=Promise.resolve(this.currentUser); constructor(config){this.config=config} subscribe(fn){fn({status:'signed-in',user:this.currentUser});return ()=>{}} getIdToken(){return Promise.resolve('mock-token')} isEnabled(){return true} dispose(){} signOut(){this.currentUser=null;return Promise.resolve()} } export const parseAuthConfig=x=>x; export const mountAuthPage=()=>()=>{}; export const safeReturnPath=x=>x||'/dashboard'; export const signInDestination=x=>'/sign-in?next='+encodeURIComponent(x);`;
  const result = await build({
    entryPoints: ["src/dashboard/connected.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    write: false,
    outfile: "connected.js",
    plugins: [
      {
        name: "browser-auth-fixture",
        setup(b) {
          b.onResolve({ filter: /^\.\.\/auth$/ }, () => ({ path: "auth", namespace: "fixture" }));
          b.onResolve({ filter: /^cytoscape$/ }, () => ({ path: "graph", namespace: "fixture" }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "auth"
                ? mockAuth
                : "export default options => { globalThis.graphFixture=options; const state={elements:[...options.elements],handlers:[],zoomLevel:1}; globalThis.graphState=state; const graph={on(event,selector,handler){state.handlers.push({event,selector,handler});return this},batch(fn){fn();return this},edges(){return {remove(){state.elements=state.elements.filter(item=>!item.data.source)}}},add(elements){state.elements.push(...elements);return this},nodes(){return {filter(predicate){return state.elements.filter(item=>!item.data.source).map(item=>({id:()=>item.data.id})).filter(predicate)}}},center(elements){state.centered=elements;return this},zoom(value){if(value){state.zoomLevel=value.level;return this}return state.zoomLevel},maxZoom(){return 2.5},width(){return 800},height(){return 600},fit(){state.fitCalled=true;return this},destroy(){state.destroyed=true}};globalThis.graphInstance=graph;return graph}",
          }));
        },
      },
    ],
  });
  const script = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
  const source = JSON.parse(await readFile("tests/fixtures/workspace.json", "utf8"));
  class DOMFormData {
    fields = new Map();
    constructor(form) {
      for (const input of form.querySelectorAll("input[name],select[name],textarea[name]")) {
        if (
          input.disabled ||
          (input.type === "checkbox" && !(input.checked ?? input.hasAttribute("checked")))
        )
          continue;
        const values = this.fields.get(input.name) ?? [];
        values.push(input.value || (input.type === "checkbox" ? "on" : ""));
        this.fields.set(input.name, values);
      }
    }
    get(name) {
      return this.fields.get(name)?.[0] ?? null;
    }
    getAll(name) {
      return this.fields.get(name) ?? [];
    }
    has(name) {
      return this.fields.has(name);
    }
  }
  class DOMForm {
    static [Symbol.hasInstance](node) {
      return node?.tagName === "FORM";
    }
  }
  for (const screen of [
    "home",
    "home-empty",
    "api-usage",
    "dependency-graph",
    "function-usage",
    "deprecation-candidates",
    "repositories",
    "settings",
    "onboarding",
  ]) {
    const { document, window } = parseHTML(
      `<html data-page="${screen === "home-empty" ? "home" : screen}"><body><main id="workspace-content"></main><dialog class="ig-dialog"></dialog><div class="ig-toast" hidden></div></body></html>`,
    );
    const timerIds = new Set();
    const requested = [];
    const serverSnapshot = structuredClone(source);
    if (screen === "dependency-graph") {
      const caller = {
        id: "s2",
        repositoryId: "r2",
        name: "checkout-service",
        rootPath: "/",
        criticality: "medium",
        nameSource: "package",
      };
      serverSnapshot.services.push(caller);
      serverSnapshot.endpoints.push({
        ...serverSnapshot.endpoints[0],
        id: "e2",
        method: "POST",
        path: "/customer/v1/orders",
        source: {
          ...serverSnapshot.endpoints[0].source,
          filePath: "src/checkout.ts",
          functionName: "createOrder",
        },
      });
      serverSnapshot.edges = [
        {
          id: "d1",
          callerServiceId: caller.id,
          endpointId: "e1",
          evidence: "static",
          confidence: "high",
          references: [source.endpoints[0].source],
          callsInWindow: null,
          lastObservedAt: null,
        },
        {
          id: "d2",
          callerServiceId: caller.id,
          endpointId: "e2",
          evidence: "runtime",
          confidence: "medium",
          references: [],
          callsInWindow: 7,
          lastObservedAt: source.generatedAt,
          runtimeCorrelation: "service_route",
        },
      ];
    }
    if (screen === "api-usage") {
      const uiSource = {
        ...serverSnapshot.endpoints[0].source,
        filePath: "scripts/ui.ts",
        line: 45,
        functionName: "healthRoute",
        url: "https://github.com/impact-gate/customer-api/blob/abc123/scripts/ui.ts#L45",
      };
      serverSnapshot.endpoints.push({
        ...serverSnapshot.endpoints[0],
        id: "ui-route",
        path: "/api/healthz",
        source: uiSource,
        definitionSource: "code",
        implementationSources: [uiSource],
      });
    }
    if (screen === "api-usage" || screen === "dependency-graph") {
      const endpoint = serverSnapshot.endpoints[0];
      const fn = (id) => ({
        id,
        serviceId: endpoint.serviceId,
        name: id,
        qualifiedName: id,
        kind: "function",
        source: endpoint.source,
        attributedRequestsInWindow: 120,
        countsPartial: false,
        attributions: [
          {
            endpointId: endpoint.id,
            requestsInWindow: 120,
            source: "prometheus",
            windowStart: "2026-10-01T00:00:00Z",
            windowEnd: "2026-10-02T00:00:00Z",
          },
        ],
      });
      endpoint.runtimeCallsInWindow = 120;
      endpoint.runtimeRequestSource = "prometheus";
      serverSnapshot.code = {
        version: 1,
        functions: [fn("handler"), fn("normalize")],
        calls: [
          {
            id: "call",
            callerFunctionId: "handler",
            calleeFunctionId: "normalize",
            targetName: "normalize",
            resolution: "resolved",
            kind: "call",
            conditional: false,
            repeated: false,
            source: endpoint.source,
          },
        ],
        flows: [
          {
            endpointId: endpoint.id,
            entryFunctionIds: ["handler"],
            callerFunctionIds: [],
            functionIds: ["handler", "normalize"],
            callIds: ["call"],
            outboundCalls: [],
            status: "indexed",
            notes: [],
          },
        ],
        missingRepositoryIds: [],
        partial: false,
        notes: [],
      };
    }
    if (screen === "home") {
      serverSnapshot.jobs = [
        {
          id: "queued-analysis",
          repositoryId: "r1",
          type: "analyze_pull_request",
          status: "queued",
          phase: "static_analysis_queue",
          progress: 0,
          error: null,
          createdAt: source.generatedAt,
          updatedAt: source.generatedAt,
        },
      ];
      const monthEnd = new Date().toISOString();
      const monthStart = new Date(Date.parse(monthEnd) - 30 * 24 * 60 * 60 * 1000).toISOString();
      serverSnapshot.runtimeConnections = [
        {
          provider: "prometheus",
          config: {
            provider: "prometheus",
            windowHours: 720,
            serviceMappings: { "customer-service": "s1" },
            baseUrl: "https://metrics.example.com",
            query: "increase(requests[{{window}}])",
            serviceLabel: "service",
            methodLabel: "method",
            routeLabel: "route",
            callerLabel: null,
          },
          status: "connected",
          lastSyncedAt: monthEnd,
          lastAttemptAt: monthEnd,
          error: null,
          observationCount: 1,
          matchedEndpointCount: 1,
          unmatchedObservationCount: 0,
          windowStart: monthStart,
          windowEnd: monthEnd,
          partial: false,
          warnings: [],
        },
      ];
      serverSnapshot.endpoints = [0, 1, 2, 4, 5].map((count, index) => ({
        ...source.endpoints[0],
        id: `e${index + 1}`,
        path: `/customer/v1/orders/${index + 1}`,
        staticCallerCount: count,
      }));
      serverSnapshot.endpoints[0] = {
        ...serverSnapshot.endpoints[0],
        runtimeCoverage: "available",
        runtimeCallsInWindow: 0,
        runtimeRequestSource: "prometheus",
        runtimeWindowStart: monthStart,
        runtimeWindowEnd: monthEnd,
        runtimePartial: false,
      };
      serverSnapshot.endpoints[1] = {
        ...serverSnapshot.endpoints[1],
        runtimeCoverage: "available",
        runtimeCallsInWindow: 0,
        runtimeRequestSource: "prometheus",
        runtimeWindowStart: monthStart,
        runtimeWindowEnd: monthEnd,
        runtimePartial: true,
      };
      serverSnapshot.endpoints[2] = {
        ...serverSnapshot.endpoints[2],
        runtimeCoverage: "available",
        runtimeCallsInWindow: 0,
        runtimeRequestSource: "prometheus",
        runtimeWindowStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        runtimeWindowEnd: monthEnd,
        runtimePartial: false,
      };
      serverSnapshot.endpoints[3] = {
        ...serverSnapshot.endpoints[3],
        runtimeCoverage: "available",
        runtimeCallsInWindow: 12,
        runtimeRequestSource: "prometheus",
        runtimeWindowStart: monthStart,
        runtimeWindowEnd: monthEnd,
        runtimePartial: false,
      };
      serverSnapshot.code = {
        version: 1,
        functions: [],
        calls: [],
        flows: [
          { endpointId: "e1", status: "indexed" },
          { endpointId: "e2", status: "partial" },
          { endpointId: "e3", status: "entrypoint_not_found" },
        ],
        missingRepositoryIds: [],
        partial: false,
        notes: [],
      };
      serverSnapshot.findings = Array.from({ length: 8 }, (_, index) => ({
        id: `f${index + 1}`,
        analysisId: "analysis-1",
        repositoryId: "r1",
        pullRequestNumber: 100 + index,
        pullRequestUrl: `https://github.com/impact-gate/customer-api/pull/${100 + index}`,
        headSha: "abc123",
        endpointId: "e1",
        endpoint: source.endpoints[0].path,
        consumerServiceId: null,
        consumerName: "customer-app",
        changeKind: "response_field_removed",
        verdict: "breaking",
        risk: ["high", "medium", "low", "none"][index % 4],
        evidence: [source.endpoints[0].source],
        explanation: `Finding ${index + 1}`,
        createdAt: `2026-09-30T00:00:0${index}.000Z`,
        status: index === 7 ? "closed" : "open",
      }));
      serverSnapshot.candidates = [
        "strong_candidate",
        "rare_caller",
        "building_confidence",
        "flagged",
      ].map((status, index) => ({
        ...source.candidates[0],
        endpointId: `e${index + 1}`,
        status,
        zeroCallsOver30Days: index === 0,
      }));
    }
    if (screen === "home-empty") {
      for (const key of [
        "repositories",
        "services",
        "endpoints",
        "edges",
        "findings",
        "candidates",
      ])
        serverSnapshot[key] = [];
    }
    if (screen === "settings")
      serverSnapshot.deploymentIdentity = {
        clusters: [],
        workloads: [],
        artifacts: [],
        links: [],
        matches: [],
        telemetryMatches: [],
      };
    const runtimeWrites = [];
    const kubernetesWrites = [];
    const artifactWrites = [];
    const workloadLinkWrites = [];
    let rejectRuntimeSave = true;
    const dialog = document.querySelector(".ig-dialog");
    Object.defineProperty(dialog, "open", { get: () => dialog.hasAttribute("open") });
    dialog.showModal = () => dialog.setAttribute("open", "");
    dialog.close = () => {
      dialog.removeAttribute("open");
      dialog.dispatchEvent(new window.Event("close"));
    };
    let rejectSave = true;
    const saves = [];
    const repoSaves = [];
    const context = {
      window,
      document,
      navigator: { userAgent: "Node", doNotTrack: null },
      MutationObserver: class {
        observe() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
      location: {
        href: `https://impactgate.in/${screen === "onboarding" ? screen : "dashboard"}`,
        origin: "https://impactgate.in",
        pathname: "/dashboard",
        search: "",
        assign: () => {},
        replace: () => {},
      },
      history: { replaceState: () => {} },
      sessionStorage: { getItem: () => null, setItem: () => {} },
      localStorage: { setItem: () => {} },
      URL,
      URLSearchParams,
      Blob,
      Response,
      Request,
      Headers,
      AbortController,
      DOMException,
      HTMLInputElement: window.HTMLInputElement,
      HTMLSelectElement: window.HTMLSelectElement,
      HTMLFormElement: DOMForm,
      HTMLButtonElement: window.HTMLButtonElement,
      HTMLElement: window.HTMLElement,
      Element: window.Element,
      FormData: DOMFormData,
      console,
      setTimeout: (fn, ms) => {
        const id = setTimeout(fn, ms);
        timerIds.add(id);
        return id;
      },
      clearTimeout,
      fetch: async (endpoint, request = {}) => {
        requested.push(endpoint);
        if (endpoint === "/api/v1/config")
          return Response.json({ firebase: {}, github: { configured: true } });
        assert.equal(request.headers.Authorization, "Bearer mock-token");
        if (endpoint === "/api/v1/session")
          return Response.json({
            version: 1,
            user: { uid: "u1", email: "user@example.com", emailVerified: true },
            workspaces: [
              {
                id: "w1",
                name: "Customer workspace",
                role: "owner",
                accountLogin: "impact-gate",
                installationStatus: "active",
              },
            ],
            capabilities: { externalModels: false, runtimeTelemetry: true },
          });
        if (endpoint.endsWith("/repositories/available"))
          return Response.json({
            repositories:
              screen === "onboarding"
                ? [
                    {
                      githubRepositoryId: 101,
                      fullName: "impact-gate/customer-api",
                      defaultBranch: "main",
                      private: false,
                      language: "TypeScript",
                      htmlUrl: "https://github.com/impact-gate/customer-api",
                      selected: true,
                    },
                    {
                      githubRepositoryId: 102,
                      fullName: "impact-gate/order-service",
                      defaultBranch: "main",
                      private: false,
                      language: "Java",
                      htmlUrl: "https://github.com/impact-gate/order-service",
                      selected: false,
                    },
                    {
                      githubRepositoryId: 103,
                      fullName: "impact-gate/payment-gateway",
                      defaultBranch: "main",
                      private: true,
                      language: "Go",
                      htmlUrl: "https://github.com/impact-gate/payment-gateway",
                      selected: false,
                    },
                  ]
                : [],
          });
        if (endpoint.endsWith("/repositories") && request.method === "PUT") {
          repoSaves.push(JSON.parse(request.body));
          return Response.json(serverSnapshot);
        }
        if (endpoint.endsWith("/settings") && request.method === "PATCH") {
          const change = JSON.parse(request.body);
          saves.push(change);
          return rejectSave
            ? Response.json(
                {
                  error: { code: "conflict", message: "Settings changed. Refresh before saving." },
                },
                { status: 409 },
              )
            : Response.json({ ...source.settings, ...change, version: 2 });
        }
        if (endpoint.endsWith("/deployment-identity/kubernetes") && request.method === "POST") {
          const body = JSON.parse(request.body);
          kubernetesWrites.push(body);
          serverSnapshot.deploymentIdentity.clusters = [
            {
              clusterId: body.clusterId,
              displayName: body.displayName,
              environment: body.environment,
              namespaces: body.namespaces,
              status: "connected",
              lastInventoryAt: new Date().toISOString(),
              lastError: null,
            },
          ];
          serverSnapshot.deploymentIdentity.workloads = [
            {
              clusterId: body.clusterId,
              clusterName: body.displayName,
              environment: body.environment,
              namespace: "payments",
              kind: "Deployment",
              name: "payments-v2",
              uid: "workload-1",
              observedAt: new Date().toISOString(),
              images: [{ name: "api", image: "registry/payments:stable", digest: null }],
              labels: {},
              annotations: {},
              serviceNames: ["payment-api"],
              confidence: "unmapped",
              evidence: [],
              stale: false,
            },
          ];
          serverSnapshot.deploymentIdentity.matches = [
            {
              workloadKey: "prod-east/payments/Deployment/payments-v2",
              repositoryIds: [],
              confidence: "unmapped",
              evidence: [],
            },
          ];
          return Response.json({ workloadCount: 1 });
        }
        if (endpoint.endsWith("/deployment-identity/artifacts") && request.method === "POST") {
          artifactWrites.push(JSON.parse(request.body));
          return Response.json({ accepted: true });
        }
        if (endpoint.endsWith("/deployment-identity/links") && request.method === "POST") {
          workloadLinkWrites.push(JSON.parse(request.body));
          serverSnapshot.deploymentIdentity.links = [workloadLinkWrites.at(-1)];
          return Response.json({ accepted: true });
        }
        if (endpoint.includes("/runtime/")) {
          if (request.method === "POST" && endpoint.endsWith("/test"))
            return Response.json({
              observationCount: 1,
              matchedEndpointCount: 1,
              unmatchedObservationCount: 0,
              warnings: [],
            });
          if (request.method === "POST" && endpoint.endsWith("/discover"))
            return Response.json({
              provider: "prometheus",
              services: [
                {
                  sourceService: "customer-prod",
                  roles: ["provider"],
                  routeCount: 1,
                  suggestedServiceId: "s1",
                  confidence: "high",
                  reason: "Matched API routes.",
                  candidates: [{ serviceId: "s1", matchedRouteCount: 1 }],
                },
              ],
              observationCount: 1,
              autoMatchedCount: 1,
              suggestedCount: 0,
              unmatchedCount: 0,
              windowStart: source.generatedAt,
              windowEnd: source.generatedAt,
              partial: false,
              warnings: [],
            });
          if (request.method === "PUT") {
            const body = JSON.parse(request.body);
            runtimeWrites.push(body);
            if (rejectRuntimeSave)
              return Response.json(
                { error: { code: "source_unauthorized", message: "Source credentials rejected." } },
                { status: 502 },
              );
            const connection = {
              provider: "prometheus",
              config: body.config,
              status: "connected",
              lastSyncedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              error: null,
              observationCount: 1,
              matchedEndpointCount: 1,
              unmatchedObservationCount: 0,
              windowStart: new Date(Date.now() - 86400000).toISOString(),
              windowEnd: new Date().toISOString(),
              partial: false,
              warnings: [],
            };
            serverSnapshot.runtimeConnections = [connection];
            return Response.json({ connection });
          }
          if (request.method === "DELETE") {
            serverSnapshot.runtimeConnections = [];
            return Response.json({ disconnected: true });
          }
          return Response.json({ connection: serverSnapshot.runtimeConnections?.[0] });
        }
        return Response.json(serverSnapshot);
      },
    };
    vm.runInNewContext(script, context);
    await delay();
    await delay();
    const content = document.querySelector("main").textContent;
    assert.ok(
      requested.some((path) => path.startsWith("/api/v1/workspaces/w1/snapshot")),
      `${screen} loads actual workspace snapshot`,
    );
    if (screen === "settings") {
      assert.match(content, /Kubernetes deployment identity/);
      assert.match(content, /Connect cluster/);
    }
    assert.doesNotMatch(content, /Demo workspace|sample records|billing-service|mobile-bff/);
    if (screen.startsWith("home")) {
      assert.equal(document.querySelector("h1").textContent, "Overview");
      assert.equal(
        document.querySelectorAll(".ig-workflow-card").length,
        3,
        "Map, Guard, and Retire workflows remain visible",
      );
      assert.equal(
        document.querySelectorAll(".ig-coverage-banner").length,
        1,
        "coverage status is explicit",
      );
      assert.equal(
        document.querySelector(".ig-job"),
        null,
        "job queues do not replace the dashboard overview",
      );
      assert.doesNotMatch(content, /Analysis jobs|static_analysis_queue/);
      assert.equal(
        document.querySelectorAll("#recent-findings th").length,
        screen === "home" ? 5 : 0,
      );
    }
    if (screen === "home") {
      assert.match(content, /remain (?:runtime-)?unknown/);
      assert.match(content, /API Flows/);
      assert.match(content, /PR Impact/);
      assert.match(content, /Retirement Radar/);
      assert.equal(
        document.querySelectorAll(".ig-workflow-visual[role=img]").length,
        3,
        "workflow metrics each expose a visual summary",
      );
      assert.match(
        document
          .querySelector("[data-workflow=map] .ig-workflow-visual")
          .getAttribute("aria-label"),
        /1 fully mapped, 1 partially mapped, 1 without an entry point, 2 not indexed, out of 5 APIs/,
      );
      assert.match(
        document
          .querySelector("[data-workflow=guard] .ig-workflow-visual")
          .getAttribute("aria-label"),
        /findings by severity: 2 high, 2 medium, 2 low, 1 no risk/,
      );
      assert.match(
        document
          .querySelector("[data-workflow=retire] .ig-workflow-visual")
          .getAttribute("aria-label"),
        /Among 1 API with a complete 30-day zero-call counter, 1 needs review and 0 have a current-snapshot review/,
      );
      assert.equal(
        document.querySelector("[data-workflow=retire] .ig-workflow-metric strong").textContent,
        "1",
        "only full-month complete Prometheus zero counters qualify",
      );
      assert.match(
        document.querySelector("[data-workflow=retire] .ig-workflow-metric").textContent,
        /APIs · 0 calls over 30 days/,
      );
      assert.match(
        document.querySelector("[data-workflow=retire] .ig-workflow-link").textContent,
        /View all candidates/,
      );
      assert.equal(document.querySelectorAll("#recent-findings tbody tr").length, 7);
      assert.equal(
        document.querySelector("[data-action=finding]").dataset.id,
        "f7",
        "recent findings sort newest first",
      );
      const severity = document.querySelector("[data-filter]");
      severity.querySelector("[value=high]").selected = true;
      severity.dispatchEvent(new window.Event("change", { bubbles: true }));
      assert.equal(document.querySelectorAll("#recent-findings tbody tr").length, 2);
      assert.match(
        document.querySelector(".ig-overview-findings-count").textContent,
        /2 of 2 matching/,
      );
      document.querySelector("[data-action=clear-filters]").click();
      assert.equal(document.querySelectorAll("#recent-findings tbody tr").length, 7);
      document.querySelector("[data-action=finding]").click();
      assert.equal(dialog.open, true);
      assert.match(dialog.textContent, /Finding 7/);
      document.querySelector("[data-action=close-dialog]").click();
    }
    if (screen === "home-empty") {
      assert.equal(document.querySelectorAll(".ig-workflow-card").length, 3);
      assert.match(content, /No open findings/);
      assert.equal(
        document.querySelector("#recent-findings .ig-button").getAttribute("href"),
        "/dashboard/repositories?import=1",
      );
      assert.doesNotMatch(document.querySelector(".ig-overview").innerHTML, /NaN|Infinity/);
    }
    if (screen === "deprecation-candidates") {
      assert.match(content, /Full evidence inventory/);
      assert.match(content, /Needs runtime coverage/);
      assert.match(content, /All candidates remain listed/);
    }
    if (screen === "api-usage") {
      assert.match(content, /\/customer\/v1\/orders/);
      assert.match(content, /UI \/ demo/);
      assert.match(content, /healthRoute/);
      assert.match(content, /scripts\/ui\.ts:45/);
      assert.equal(
        document.querySelector("[data-endpoint-detail-screen]"),
        null,
        "detail screen is not shown before clicking an endpoint",
      );
      document.querySelector('[data-action="endpoint"]').click();
      await delay();
      assert.ok(
        document.querySelector("[data-endpoint-detail-screen]"),
        "detail screen opened after clicking endpoint",
      );
      document.querySelector('[data-action="endpoint-tab"][data-tab="flow"]').click();
      await delay();
      assert.match(document.querySelector("main").textContent, /2 reachable functions/);
      assert.match(document.querySelector("main").textContent, /normalize/);
      assert.equal(context.graphFixture.elements[0].data.label, "GET /customer/v1/orders");
      document.querySelector('[data-action="back-to-apis"]').click();
      await delay();
      assert.equal(
        document.querySelector("[data-endpoint-detail-screen]"),
        null,
        "back-to-apis returns to catalog screen",
      );
    }
    if (screen === "repositories") {
      assert.match(content, /impact-gate\/customer-api/);
      const originalFetch = context.fetch;
      const reindexPath = "/api/v1/workspaces/w1/repositories/r1/index";
      let reindexRequest = null;
      let rejectReindex = true;
      context.fetch = async (endpoint, request = {}) => {
        if (endpoint === reindexPath && request.method === "POST") {
          reindexRequest = request;
          assert.equal(request.headers.Authorization, "Bearer mock-token");
          if (rejectReindex) {
            rejectReindex = false;
            return Response.json(
              {
                error: {
                  code: "repository_access_missing",
                  message: "The GitHub installation no longer has access to this repository.",
                },
              },
              { status: 403 },
            );
          }
          const job = {
            id: "index-job-1",
            type: "index_repository",
            repositoryId: "r1",
            status: "queued",
            phase: "queued",
            progress: 0,
            error: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          serverSnapshot.repositories[0].status = "queued";
          serverSnapshot.jobs.unshift(job);
          return Response.json({ job });
        }
        return originalFetch(endpoint, request);
      };
      document.querySelector("[data-action=reindex]").click();
      await delay();
      await delay();
      assert.match(document.querySelector("[data-action=reindex]").textContent, /Re-index/);
      assert.equal(
        document.querySelector("[data-action=reindex]").disabled,
        false,
        "failed request re-enables retry",
      );
      assert.match(document.querySelector("main").textContent, /installation no longer has access/);
      assert.match(
        document.querySelector("[data-action=reindex]").closest("tr").textContent,
        /installation no longer has access/,
      );
      document.querySelector("[data-action=reindex]").click();
      await delay();
      await delay();
      await delay();
      assert.equal(
        reindexRequest?.method,
        "POST",
        "Re-index sends an authenticated POST to the repository index endpoint",
      );
      assert.equal(document.querySelector(".ig-toast").textContent, "Indexing job queued.");
      assert.match(document.querySelector("main").textContent, /Re-index job · queued · 0%/);
      assert.equal(document.querySelector("[data-action=reindex]").textContent, "Indexing…");
      assert.equal(
        document.querySelector("[data-action=reindex]").disabled,
        true,
        "queued repository cannot be reindexed again until processing finishes",
      );
    }
    if (screen === "settings") assert.match(content, /Save preferences/);
    if (screen === "dependency-graph") {
      assert.equal(context.graphFixture.elements[0].data.label, "◆ customer-service");
      const serviceEdges = context.graphFixture.elements.filter(
        (element) => element.data.kind === "service-dependency",
      );
      assert.equal(
        serviceEdges.length,
        1,
        "multiple API relationships collapse into one service arrow",
      );
      assert.equal(serviceEdges[0].data.label, "2 APIs");
      const tapEdge = context.graphState.handlers.find(
        (handler) => handler.event === "tap" && handler.selector === "edge",
      ).handler;
      tapEdge({ target: { data: () => serviceEdges[0].data } });
      assert.equal(
        JSON.stringify(
          context.graphState.elements
            .filter((element) => element.data.kind === "api")
            .map((element) => element.data.label)
            .sort(),
        ),
        JSON.stringify(["GET /customer/v1/orders", "POST /customer/v1/orders"]),
      );
      assert.ok(
        context.graphState.zoomLevel > 1,
        "expanding a service arrow zooms into its API arrows",
      );
      assert.match(
        document.querySelector("[data-graph-inspector]").textContent,
        /Expanded to 2 API relationships/,
      );
      const apiEdge = context.graphState.elements.find((element) => element.data.kind === "api");
      tapEdge({ target: { data: () => apiEdge.data } });
      assert.match(document.querySelector("[data-graph-inspector]").textContent, /Open API flow/);
      document.querySelector("[data-action=graph-collapse]").click();
      assert.equal(
        context.graphFixture.elements.filter(
          (element) => element.data.kind === "service-dependency",
        ).length,
        1,
        "back to service view restores the aggregate arrow",
      );
    }
    if (screen === "function-usage") assert.match(content, /Function usage/);
    if (screen === "settings") {
      const form = document.querySelector("[data-settings-form]");
      form.reportValidity = () => true;
      form.querySelector("[name=retentionDays]").value = "14";
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(saves.length, 1);
      assert.equal(saves[0].version, 1);
      assert.match(document.querySelector("[data-save-status]").textContent, /Settings changed/);
      assert.doesNotMatch(document.querySelector(".ig-toast").textContent, /preferences saved/);
      rejectSave = false;
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(saves.length, 2);
      assert.equal(saves[1].version, 1, "failed writes do not advance the saved settings version");
      assert.equal(document.querySelector("[name=retentionDays]").value, "14");
      assert.equal(document.querySelector(".ig-toast").textContent, "Workspace preferences saved.");
      const click = (element) =>
        element.dispatchEvent(new window.Event("click", { bubbles: true }));
      click(document.querySelector("[data-action=runtime-connect][data-provider=prometheus]"));
      const connectionForm = document.querySelector("[data-runtime-form]");
      assert.equal(
        connectionForm.querySelector("[name=windowHours]").getAttribute("max"),
        "720",
        "runtime connections allow a full 30-day window",
      );
      connectionForm.reportValidity = () => true;
      connectionForm.querySelector("[name=baseUrl]").value = "https://metrics.example.com";
      const authentication = connectionForm.querySelector("[name=authentication]");
      try {
        authentication.value = "bearer";
      } catch {
        Object.defineProperty(authentication, "value", {
          value: "bearer",
          writable: true,
          configurable: true,
        });
      }
      authentication.dispatchEvent(new window.Event("change", { bubbles: true }));
      connectionForm.querySelector("[name=bearerToken]").value = "browser-entered-secret";
      connectionForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.match(
        connectionForm.querySelector("[data-save-status]").textContent,
        /1 matches ready/,
      );
      assert.equal(
        connectionForm.querySelector('[data-runtime-source="customer-prod"]').value,
        "s1",
      );
      assert.equal(
        serverSnapshot.runtimeConnections,
        undefined,
        "discovery does not persist connection",
      );
      connectionForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.match(
        connectionForm.querySelector("[data-save-status]").textContent,
        /Source credentials rejected/,
      );
      assert.equal(dialog.open, true, "failed save preserves connection form");
      rejectRuntimeSave = false;
      connectionForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(dialog.open, false);
      assert.match(document.querySelector("main").textContent, /1 endpoints with observed traffic/);
      assert.deepEqual(runtimeWrites[0].config.serviceMappings, { "customer-prod": "s1" });
      click(document.querySelector("[data-action=runtime-connect][data-provider=prometheus]"));
      const editForm = document.querySelector("[data-runtime-form]");
      editForm.reportValidity = () => true;
      editForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(
        runtimeWrites.at(-1).credentials,
        undefined,
        "empty edit fields retain saved credentials without fetching secrets",
      );
      click(document.querySelector("[data-action=runtime-sync][data-provider=prometheus]"));
      await delay();
      await delay();
      assert.ok(requested.some((path) => path.endsWith("/prometheus/sync")));
      click(document.querySelector("[data-action=runtime-disconnect][data-provider=prometheus]"));
      click(document.querySelector("[data-action=confirm-runtime-disconnect]"));
      await delay();
      await delay();
      assert.match(document.querySelector("main").textContent, /Not connected/);
      assert.equal(serverSnapshot.runtimeConnections.length, 0);

      click(document.querySelector("[data-action=kubernetes-connect]"));
      const clusterForm = document.querySelector("[data-kubernetes-form]");
      clusterForm.reportValidity = () => true;
      clusterForm.querySelector("[name=clusterId]").value = "prod-east";
      clusterForm.querySelector("[name=displayName]").value = "Production East";
      clusterForm.querySelector("[name=apiServerUrl]").value = "https://kube.example";
      clusterForm.querySelector("[name=environment]").value = "production";
      clusterForm.querySelector("[name=namespaces]").value = "payments,checkout";
      clusterForm.querySelector("[name=bearerToken]").value = "browser-kubernetes-token";
      clusterForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.deepEqual(kubernetesWrites[0].namespaces, ["payments", "checkout"]);
      assert.equal(kubernetesWrites[0].bearerToken, "browser-kubernetes-token");
      assert.equal(
        clusterForm.querySelector("[name=bearerToken]").value,
        "",
        "the bearer token is cleared when the connection dialog closes",
      );
      assert.equal(dialog.open, false);
      assert.match(document.querySelector("main").textContent, /payments-v2/);

      click(document.querySelector("[data-action=workload-associate]"));
      const linkForm = document.querySelector("[data-workload-link-form]");
      linkForm.reportValidity = () => true;
      Object.defineProperty(linkForm.querySelector("[name=repositoryId]"), "value", {
        value: "r1",
        configurable: true,
      });
      linkForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(workloadLinkWrites[0].repositoryId, "r1");
      assert.equal(workloadLinkWrites[0].workloadName, "payments-v2");

      click(document.querySelector("[data-action=artifact-provenance]"));
      const artifactForm = document.querySelector("[data-artifact-form]");
      artifactForm.reportValidity = () => true;
      Object.defineProperty(artifactForm.querySelector("[name=repositoryId]"), "value", {
        value: "r1",
        configurable: true,
      });
      artifactForm.querySelector("[name=commitSha]").value = "a".repeat(40);
      artifactForm.querySelector("[name=imageDigest]").value = "sha256:" + "b".repeat(64);
      artifactForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(artifactWrites[0].repositoryId, "r1");
      assert.equal(artifactWrites[0].githubRepositoryId, 1);
      assert.equal(artifactWrites[0].imageDigest, "sha256:" + "b".repeat(64));
    }
    if (screen === "onboarding") {
      assert.match(content, /Which API should we map first/);
      assert.match(content, /impact-gate\/customer-api/);
      assert.equal(document.querySelectorAll(".ig-repo-option").length, 3);
      assert.match(document.querySelector("[data-repo-count]").textContent, /1 of 3 selected/);

      document.querySelector('[data-action="repo-select-all"]').click();
      assert.match(document.querySelector("[data-repo-count]").textContent, /3 of 3 selected/);
      assert.match(
        document.querySelector("[data-repo-submit]").textContent,
        /Save selection \(3 repositories\)/,
      );

      document.querySelector('[data-action="repo-deselect-all"]').click();
      assert.match(document.querySelector("[data-repo-count]").textContent, /0 of 3 selected/);

      const searchInput = document.querySelector("[data-repo-search]");
      searchInput.value = "payment";
      searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
      const visible = [...document.querySelectorAll(".ig-repo-option")].filter(
        (opt) => opt.style.display !== "none",
      );
      assert.equal(visible.length, 1);
      assert.match(visible[0].textContent, /payment-gateway/);

      document.querySelector('[data-action="repo-select-all"]').click();
      assert.match(document.querySelector("[data-repo-count]").textContent, /1 of 3 selected/);

      searchInput.value = "";
      searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
      assert.equal(
        [...document.querySelectorAll(".ig-repo-option")].filter(
          (opt) => opt.style.display !== "none",
        ).length,
        3,
      );

      const chip = document.querySelector('[data-action="toggle-discovery-repo"][data-id="101"]');
      if (chip) chip.click();

      const repoForm = document.querySelector("[data-repositories-form]");
      repoForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await delay();
      await delay();
      assert.equal(repoSaves.length, 1);
      assert.deepEqual(repoSaves[0].repositoryIds.sort(), [101, 103]);
    }
    window.dispatchEvent(new window.Event("pagehide"));
    timerIds.forEach(clearTimeout);
  }
  console.log(
    "Workspace API and proxy boundaries, authenticated screens, settings, runtime sources, and Kubernetes inventory/provenance/link workflows passed.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
}

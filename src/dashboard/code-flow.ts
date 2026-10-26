import cytoscape from "cytoscape";
import type {
  WorkspaceCodeFunction,
  WorkspaceApiFlow,
  ApiExecutionTreeNode,
  WorkspaceCodeSnapshot,
  IndexedFunctionCall,
  WorkspaceOutboundCall,
} from "../types/code";
import type { SourceReference, WorkspaceEndpoint, WorkspaceSnapshot } from "../types/workspace";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
const count = (value: number | null | undefined) =>
  value == null ? "Unknown" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
function source(ref: SourceReference): string {
  let href = "#";
  try {
    const parsed = new URL(ref.url);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password) href = parsed.href;
  } catch {
    /* Keep malformed evidence inert. */
  }
  return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer"><code>${escape(ref.filePath)}:${ref.line}${ref.column ? `:${ref.column}` : ""}</code></a><p class="ig-note">Commit ${escape(ref.sha.slice(0, 12))}</p>`;
}
function table(headers: string[], rows: string[][]): string {
  return `<div class="ig-live-table-wrap"><table class="ig-live-table"><thead><tr>${headers.map((label) => `<th scope="col">${escape(label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<td data-label="${escape(headers[i])}"><div class="ig-table-cell">${cell}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export function renderConsumerApiLinks(
  snapshot: WorkspaceSnapshot,
  ids: string[] | undefined,
): string {
  return ids?.length
    ? ids
        .map((id) => {
          const api = snapshot.endpoints.find((endpoint) => endpoint.id === id);
          return api
            ? `<p><a href="/dashboard/api-usage?endpointId=${encodeURIComponent(id)}&amp;tab=flow" data-action="endpoint" data-id="${escape(id)}" data-tab="flow">${escape(api.method)} ${escape(api.path)}</a></p>`
            : '<p class="ig-note">Consumer API is absent from the current snapshot</p>';
        })
        .join("")
    : '<p class="ig-note">No enclosing API identified; inspect caller source</p>';
}
function staticEvidence(call: WorkspaceOutboundCall): string {
  return (
    escape(
      call.resolution === "matched"
        ? call.matchBasis === "server_origin"
          ? "Static server origin + route match"
          : "Possible static route match"
        : call.resolution,
    ) + (call.targetOrigin ? `<p class="ig-note">${escape(call.targetOrigin)}</p>` : "")
  );
}
function renderInboundApis(snapshot: WorkspaceSnapshot, flow: WorkspaceApiFlow): string {
  if (!flow.inboundCalls?.length) return "";
  const functions = new Map(snapshot.code?.functions.map((fn) => [fn.id, fn]));
  return `<h3>Consumer APIs and call sites</h3><p class="ig-note">These API flows can reach the HTTP caller statically. Runtime service/route traffic does not prove execution of this call site.</p>${table(
    [
      "Consumer service / function",
      "Possible affected APIs",
      "Static evidence",
      "Runtime relationship",
      "Call site",
    ],
    flow.inboundCalls.map((call) => {
      const edge = snapshot.edges?.find(
        (edge) =>
          edge.callerServiceId === call.callerServiceId && edge.endpointId === flow.endpointId,
      );
      return [
        `${escape(snapshot.services.find((service) => service.id === call.callerServiceId)?.name)}<p><code>${escape(functions.get(call.callerFunctionId)?.qualifiedName ?? call.source.functionName)}</code></p>`,
        renderConsumerApiLinks(snapshot, call.consumerEndpointIds),
        staticEvidence(call),
        edge?.runtimeCorrelation === "service_route"
          ? `${count(edge.callsInWindow)} observed service/route calls`
          : "No linked runtime observation",
        source(call.source),
      ];
    }),
  )}`;
}
function renderConditionalAnalysis(snapshot: WorkspaceSnapshot, flow: WorkspaceApiFlow): string {
  const analysis = flow.pathAnalysis;
  if (!analysis) return "";
  const functions = new Map(snapshot.code?.functions.map((fn) => [fn.id, fn]));
  const origins = (
    values: Array<{ entryFunctionId: string; parameterIndex: number; accessPath: string[] }>,
  ) =>
    values.length
      ? values
          .map(
            (value) =>
              `<code>${escape(functions.get(value.entryFunctionId)?.qualifiedName ?? value.entryFunctionId)} parameter ${value.parameterIndex + 1}${value.accessPath.length ? `.${escape(value.accessPath.join("."))}` : ""}</code>`,
          )
          .join("<br>")
      : "Input origin unresolved";
  const conditions = analysis.callConditions.flatMap((call) =>
    call.conditions.map((condition) => ({ call, condition })),
  );
  return `<h3>Static conditions and input origins</h3><p class="ig-note">${escape(analysis.status)} · Possible branches and symbolic parameter paths. These facts do not show which branch executed or persist request values.</p>${analysis.notes.length ? `<ul>${analysis.notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul>` : ""}${
    conditions.length
      ? table(
          ["Condition", "Required branch", "Input origins", "Guarded call"],
          conditions
            .slice(0, 100)
            .map(({ call, condition }) => [
              `<code>${escape(condition.predicate)}</code>`,
              escape(condition.polarity),
              origins(condition.inputOrigins),
              source(call.source),
            ]),
        )
      : '<p class="ig-note">No supported branch conditions recorded.</p>'
  }${
    analysis.valuePaths.length
      ? table(
          ["Call argument", "Input origins", "Call site"],
          analysis.valuePaths
            .slice(0, 100)
            .map((value) => [
              String(value.argumentIndex + 1),
              origins(value.inputOrigins),
              source(value.source),
            ]),
        )
      : ""
  }${conditions.length > 100 || analysis.valuePaths.length > 100 ? '<p class="ig-note">Showing the first 100 facts in each table. Export the flow for all recorded facts.</p>' : ""}`;
}
function renderStaticDependencyInventory(snapshot: WorkspaceSnapshot, query: string): string {
  const calls = snapshot.code?.apiDependencies?.filter((call) =>
    `${call.method} ${call.path} ${call.source.filePath} ${call.source.functionName ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (!calls?.length) return "";
  return `<section class="ig-card" id="static-api-dependencies"><h2>Static HTTP dependencies</h2><p class="ig-note">${calls.length} HTTP call sites. Showing the first ${Math.min(calls.length, 100)}. Includes callers with no discovered API entrypoint; telemetry is optional.</p>${table(
    ["Caller", "Enclosing APIs", "Provider API", "Static evidence", "Source"],
    calls
      .slice(0, 100)
      .map((call) => [
        `<code>${escape(call.source.functionName)}</code>`,
        renderConsumerApiLinks(snapshot, call.consumerEndpointIds),
        call.endpointId
          ? renderConsumerApiLinks(snapshot, [call.endpointId])
          : `<code>${escape(call.method)} ${escape(call.path)}</code>`,
        staticEvidence(call),
        source(call.source),
      ]),
  )}</section>`;
}
function contributions(fn: WorkspaceCodeFunction, snapshot: WorkspaceSnapshot): string {
  return `<details><summary>${fn.attributions.length} API flow${fn.attributions.length === 1 ? "" : "s"}</summary>${fn.attributions
    .map((row) => {
      const endpoint = snapshot.endpoints.find((endpoint) => endpoint.id === row.endpointId);
      return `<p><a href="/dashboard/api-usage?endpointId=${encodeURIComponent(row.endpointId)}&amp;tab=flow" data-action="endpoint" data-id="${escape(row.endpointId)}" data-tab="flow">${escape(endpoint?.method)} ${escape(endpoint?.path)}</a> · ${count(row.requestsInWindow)} attributed requests</p><p class="ig-note">${escape(row.source ?? "No current telemetry")} · ${escape(row.windowStart ?? "Unknown window")} → ${escape(row.windowEnd ?? "Unknown window")}${row.partial ? " · Partial source coverage" : ""}</p>`;
    })
    .join("")}</details>`;
}
function total(fn: WorkspaceCodeFunction): string {
  return `${count(fn.attributedRequestsInWindow)}${fn.countsPartial ? '<p class="ig-note">Partial or incomparable API coverage</p>' : ""}`;
}
function measured(fn: WorkspaceCodeFunction): string {
  const usage = fn.measuredUsage;
  if (!usage)
    return '<span class="ig-product-badge" data-tone="unknown">Unknown</span><p class="ig-note">Instrumentation not connected</p>';
  return `<span class="ig-product-badge" data-tone="measured">${count(usage.totalEntries)} measured entries</span><p class="ig-note">${escape(usage.quality.replaceAll("_", " "))}${usage.conditionalBranch ? " · conditional branch" : ""}${usage.repeatedExecution ? " · repeated execution" : ""}</p>`;
}

function buildTreeFallback(
  flow: WorkspaceApiFlow,
  code: WorkspaceCodeSnapshot,
  endpoint: WorkspaceEndpoint,
): ApiExecutionTreeNode {
  const byId = new Map(code.functions.map((fn) => [fn.id, fn]));
  const outgoing = new Map<string, IndexedFunctionCall[]>();
  for (const call of code.calls) {
    if (!flow.callIds.includes(call.id)) continue;
    outgoing.set(call.callerFunctionId, [...(outgoing.get(call.callerFunctionId) ?? []), call]);
  }
  const rootId = flow.entryFunctionIds[0] ?? flow.functionIds[0] ?? endpoint.id;
  const rootFn = byId.get(rootId);
  const rootNode: ApiExecutionTreeNode = {
    id: rootId,
    name: `${endpoint.method} ${endpoint.path}`,
    qualifiedName: rootFn?.qualifiedName ?? `${endpoint.method} ${endpoint.path}`,
    source: rootFn?.source ?? endpoint.source,
    kind: "entrypoint",
    execution: "sequential",
    conditional: false,
    repeated: false,
    step: 0,
    children: [],
  };

  const visited = new Set<string>([rootId]);
  function populate(parentId: string, parentNode: ApiExecutionTreeNode, depth: number) {
    if (depth > 8) return;
    const calls = outgoing.get(parentId) ?? [];
    let step = 1;
    for (const call of calls) {
      const execution = call.parallel ? "parallel" : "sequential";
      const outboundMatch = flow.outboundCalls.find(
        (o) =>
          o.callerFunctionId === parentId &&
          (o.functionCallId !== undefined
            ? o.functionCallId === call.id
            : o.source.filePath === call.source.filePath &&
              o.source.line === call.source.line &&
              o.source.column !== undefined &&
              o.source.column === call.source.column),
      );
      if (outboundMatch) {
        parentNode.children.push({
          id: `outbound:${call.id}`,
          name: `${outboundMatch.method} ${outboundMatch.path}`,
          qualifiedName: `Outbound API: ${outboundMatch.method} ${outboundMatch.path}`,
          source: call.source,
          kind: "outbound_api",
          execution,
          conditional: call.conditional,
          repeated: call.repeated,
          step: step++,
          children: [],
        });
      } else if (call.calleeFunctionId && byId.has(call.calleeFunctionId)) {
        const callee = byId.get(call.calleeFunctionId)!;
        const childNode: ApiExecutionTreeNode = {
          id: callee.id,
          name: callee.name,
          qualifiedName: callee.qualifiedName,
          source: callee.source,
          kind: "function",
          execution,
          conditional: call.conditional,
          repeated: call.repeated,
          step: step++,
          children: [],
        };
        parentNode.children.push(childNode);
        if (!visited.has(callee.id)) {
          visited.add(callee.id);
          populate(callee.id, childNode, depth + 1);
          visited.delete(callee.id);
        }
      } else if (call.modeled) {
        parentNode.children.push({
          id: `modeled:${call.id}`,
          name: call.targetName,
          qualifiedName: `Modeled operation: ${call.targetName}`,
          source: call.source,
          kind: "modeled",
          execution,
          conditional: call.conditional,
          repeated: call.repeated,
          step: step++,
          children: [],
        });
      } else if (call.resolution === "external") {
        parentNode.children.push({
          id: `ext:${call.id}`,
          name: call.targetName,
          qualifiedName: `External: ${call.targetName}`,
          source: call.source,
          kind: "external",
          execution,
          conditional: call.conditional,
          repeated: call.repeated,
          step: step++,
          children: [],
        });
      } else {
        const unresolvedNode: ApiExecutionTreeNode = {
          id: `unresolved:${call.id}`,
          name: call.targetName,
          qualifiedName: `Unresolved: ${call.targetName}`,
          source: call.source,
          kind: "unresolved",
          execution,
          conditional: call.conditional,
          repeated: call.repeated,
          step: step++,
          children: [],
        };
        parentNode.children.push(unresolvedNode);
        for (const candidateId of call.candidateFunctionIds ?? []) {
          const candidate = byId.get(candidateId);
          if (!candidate) continue;
          const candidateNode: ApiExecutionTreeNode = {
            id: candidate.id,
            name: candidate.name,
            qualifiedName: `Possible target: ${candidate.qualifiedName}`,
            source: candidate.source,
            kind: "function",
            certainty: "possible",
            execution,
            conditional: call.conditional,
            repeated: call.repeated,
            step: unresolvedNode.children.length + 1,
            children: [],
          };
          unresolvedNode.children.push(candidateNode);
          if (!visited.has(candidate.id)) {
            visited.add(candidate.id);
            populate(candidate.id, candidateNode, depth + 1);
            visited.delete(candidate.id);
          }
        }
      }
    }
  }
  populate(rootId, rootNode, 1);
  return rootNode;
}

function renderExecutionTreeNode(node: ApiExecutionTreeNode, isRoot = true): string {
  const executionBadge = !isRoot
    ? node.execution === "parallel"
      ? '<span class="ig-tree-badge ig-badge-parallel" title="Executed concurrently in parallel (e.g. Promise.all)">⚡ Parallel</span>'
      : '<span class="ig-tree-badge ig-badge-seq" title="Executed in sequential order">➔ Sequential</span>'
    : '<span class="ig-tree-badge ig-badge-root">API Entrypoint</span>';

  const modifiers = [
    node.conditional
      ? '<span class="ig-tree-badge ig-badge-cond" title="Conditional branch">? Branch</span>'
      : "",
    node.repeated
      ? '<span class="ig-tree-badge ig-badge-loop" title="Repeated execution in loop">↺ Loop</span>'
      : "",
    node.kind === "external"
      ? '<span class="ig-tree-badge ig-badge-ext" title="External library boundary">External</span>'
      : "",
    node.kind === "modeled"
      ? '<span class="ig-tree-badge ig-badge-ext" title="Known framework or language operation">Modeled</span>'
      : "",
    node.kind === "outbound_api"
      ? '<span class="ig-tree-badge ig-badge-api" title="Downstream HTTP call">Downstream API</span>'
      : "",
    node.kind === "unresolved"
      ? '<span class="ig-tree-badge ig-badge-unres" title="Dynamic / unresolved target">Unresolved</span>'
      : "",
    node.certainty === "possible"
      ? '<span class="ig-tree-badge ig-badge-cond" title="Conservative possible target">Possible</span>'
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stepBadge = node.step > 0 ? `<span class="ig-tree-step">#${node.step}</span>` : "";
  const sourceRef = node.source?.filePath
    ? `<span class="ig-tree-file"><code>${escape(node.source.filePath)}:${node.source.line}</code></span>`
    : "";

  const title = `<div class="ig-tree-node-row">${stepBadge}<span class="ig-tree-name"><code>${escape(node.name)}</code></span>${executionBadge}${modifiers}${sourceRef}</div>`;

  if (!node.children || node.children.length === 0) {
    return `<div class="ig-tree-leaf">${title}</div>`;
  }

  return `<details open class="ig-tree-branch"><summary class="ig-tree-summary">${title}</summary><div class="ig-tree-children">${node.children.map((child) => renderExecutionTreeNode(child, false)).join("")}</div></details>`;
}

function renderExecutionTreeSection(tree: ApiExecutionTreeNode): string {
  return `<section class="ig-card ig-tree-card" aria-label="API Execution Flow Tree"><div class="ig-tree-header"><h3>API Execution Flow Tree</h3><p class="ig-note">Hierarchical execution tree showing sequential (➔) and parallel (⚡) calls, branches, possible targets, and service boundaries.</p></div><div class="ig-tree-wrapper">${renderExecutionTreeNode(tree, true)}</div></section>`;
}

export function renderFunctionInventory(snapshot: WorkspaceSnapshot, query = "", page = 0): string {
  const code = snapshot.code;
  if (!code)
    return '<section class="ig-card" id="function-usage" aria-labelledby="function-usage-title"><h2 id="function-usage-title">Function usage</h2><p class="ig-note">Reindex repositories after the code observability update to populate function flows.</p></section>';
  const functions = code.functions.filter(
    (fn) =>
      fn.kind !== "module" &&
      `${fn.qualifiedName} ${fn.source.filePath} ${snapshot.services.find((service) => service.id === fn.serviceId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pageSize = 25;
  const currentPage = Math.max(
    0,
    Math.min(Math.trunc(page), Math.max(0, Math.ceil(functions.length / pageSize) - 1)),
  );
  const visible = functions.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const pagination = `<div class="ig-code-summary"><span>Showing ${functions.length ? currentPage * pageSize + 1 : 0}–${currentPage * pageSize + visible.length} of ${functions.length}</span><button type="button" class="ig-button ig-button-secondary" data-action="function-page" data-direction="previous" data-page="${currentPage - 1}" ${currentPage === 0 ? "disabled" : ""}>Previous</button><button type="button" class="ig-button ig-button-secondary" data-action="function-page" data-direction="next" data-page="${currentPage + 1}" ${(currentPage + 1) * pageSize >= functions.length ? "disabled" : ""}>Next</button></div>`;
  return `<section class="ig-card" id="function-usage" aria-labelledby="function-usage-title"><h2 id="function-usage-title">Function usage</h2><p class="ig-note">Static indexing maps possible function flows and HTTP dependencies without runtime connections. Connected telemetry adds API request counts; measured function entries require instrumentation.</p><div class="ig-filters"><input data-code-query aria-label="Search functions and source files" placeholder="Search functions and source files" value="${escape(query)}"></div><p class="ig-note">${functions.length} functions match${code.missingRepositoryIds.length ? ` · ${code.missingRepositoryIds.length} repositories need reindexing` : ""}</p>${pagination}${table(
    [
      "Function",
      "Service",
      "API-request attribution",
      "Observed function calls",
      "APIs / observation window",
      "Source",
    ],
    visible.map((fn) => [
      `<code>${escape(fn.qualifiedName)}</code>`,
      escape(snapshot.services.find((service) => service.id === fn.serviceId)?.name),
      total(fn),
      measured(fn),
      contributions(fn, snapshot),
      source(fn.source),
    ]),
  )}</section>${renderStaticDependencyInventory(snapshot, query)}`;
}

export function renderCodeFlow(snapshot: WorkspaceSnapshot, endpoint: WorkspaceEndpoint): string {
  const code = snapshot.code;
  const flow = code?.flows.find((flow) => flow.endpointId === endpoint.id);
  if (!code || !flow)
    return '<p class="ig-note">This repository has no persisted function flow yet. Reindex it from Repositories to build the flow at its current commit.</p>';
  const ids = new Set(flow.functionIds);
  const functions = code.functions.filter((fn) => ids.has(fn.id));
  const byId = new Map(code.functions.map((fn) => [fn.id, fn]));
  const calls = new Set(flow.callIds);
  const localCalls = code.calls.filter((call) => calls.has(call.id));
  const perApi = (fn: WorkspaceCodeFunction) =>
    count(fn.attributions.find((row) => row.endpointId === endpoint.id)?.requestsInWindow);
  const tree = flow.executionTree ?? buildTreeFallback(flow, code, endpoint);
  const treeHtml = renderExecutionTreeSection(tree);
  return `<div class="ig-code-summary"><strong>${functions.length} reachable functions</strong><span>${count(endpoint.runtimeCallsInWindow)} ${endpoint.runtimeRequestSource === "datadog" ? "indexed spans" : "API requests"} in the observation window</span><span>${escape(flow.status.replaceAll("_", " "))}</span><button type="button" class="ig-button ig-button-secondary" data-action="code-export" data-id="${escape(endpoint.id)}">Export code flow</button></div><p class="ig-note">Every reachable function receives this API's request count once. Branches, loops and callbacks describe possible execution; these are attributed requests, not measured function invocations.</p>${flow.notes.length ? `<ul class="ig-code-notes">${flow.notes.map((note) => `<li>${escape(note)}</li>`).join("")}</ul>` : ""}${renderInboundApis(snapshot, flow)}${renderConditionalAnalysis(snapshot, flow)}${treeHtml}${
    functions.length
      ? `<div class="ig-code-graph" data-code-flow="${escape(endpoint.id)}" role="group" aria-label="API function call graph"></div><p class="ig-note">Select a function for its source and API contributions. The tables below include all functions and call sites.${functions.length > 250 ? " The interactive graph shows the first 250 functions." : ""}</p><div data-code-inspector></div>${table(
          [
            "Function",
            "This API's requests",
            "All APIs' requests",
            "APIs / observation window",
            "Source",
          ],
          functions.map((fn) => [
            `<code>${escape(fn.qualifiedName)}</code>`,
            perApi(fn),
            total(fn),
            contributions(fn, snapshot),
            source(fn.source),
          ]),
        )}`
      : ""
  }<h3>Function calls and boundaries</h3>${
    localCalls.length
      ? table(
          ["From", "To", "Execution", "Source"],
          localCalls.map((call) => [
            `<code>${escape(byId.get(call.callerFunctionId)?.qualifiedName)}</code>`,
            `<code>${escape(call.calleeFunctionId ? byId.get(call.calleeFunctionId)?.qualifiedName : call.targetName)}</code>${call.candidateFunctionIds?.length ? `<p class="ig-note">Possible targets: ${call.candidateFunctionIds.map((id) => escape(byId.get(id)?.qualifiedName ?? id)).join(", ")}</p>` : ""}${call.modeled ? '<p class="ig-note">Modeled framework or language operation</p>' : call.resolution !== "resolved" ? `<p class="ig-note">${escape(call.resolution)} boundary</p>` : ""}`,
            escape(
              [
                call.kind,
                call.conditional ? "conditional" : "",
                call.repeated ? "may repeat" : "",
                call.parallel ? "parallel" : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ),
            source(call.source),
          ]),
        )
      : '<p class="ig-note">No function call sites were recorded for this flow.</p>'
  }${
    flow.outboundCalls.length
      ? `<h3>Downstream APIs</h3><p class="ig-note">Continue into the downstream provider flow. Its API telemetry supplies its function counts.</p>${table(
          ["Calling function", "API", "Evidence", "Source"],
          flow.outboundCalls.map((call) => [
            `<code>${escape(byId.get(call.callerFunctionId)?.qualifiedName)}</code>`,
            call.endpointId
              ? `<a href="/dashboard/api-usage?endpointId=${encodeURIComponent(call.endpointId)}&amp;tab=flow" data-action="endpoint" data-id="${escape(call.endpointId)}" data-tab="flow">${escape(call.method)} ${escape(call.path)} →</a>`
              : `<code>${escape(call.method)} ${escape(call.path)}</code>`,
            staticEvidence(call),
            source(call.source),
          ]),
        )}`
      : ""
  }${
    flow.callerFunctionIds.length
      ? `<h3>Functions calling this API</h3><p class="ig-note">Caller execution counts require the callers' own API flows or function telemetry.</p>${table(
          ["Function", "Source"],
          flow.callerFunctionIds
            .map((id) => byId.get(id))
            .filter((fn): fn is WorkspaceCodeFunction => !!fn)
            .map((fn) => [`<code>${escape(fn.qualifiedName)}</code>`, source(fn.source)]),
        )}`
      : ""
  }`;
}

export function mountCodeFlow(
  snapshot: WorkspaceSnapshot,
  container: HTMLElement,
  inspector: HTMLElement | null,
): cytoscape.Core | null {
  const code = snapshot.code;
  const flow: WorkspaceApiFlow | undefined = code?.flows.find(
    (flow) => flow.endpointId === container.dataset.codeFlow,
  );
  const endpoint = snapshot.endpoints.find((endpoint) => endpoint.id === flow?.endpointId);
  if (!code || !flow || !endpoint) return null;
  const byId = new Map(code.functions.map((fn) => [fn.id, fn]));
  const selected = flow.functionIds.slice(0, 250);
  const ids = new Set(selected);
  const apiId = `api:${endpoint.id}`;
  const elements: cytoscape.ElementDefinition[] = [
    { data: { id: apiId, label: `${endpoint.method} ${endpoint.path}`, kind: "api" } },
    ...selected.map((id) => ({
      data: {
        id,
        label: `${byId.get(id)?.name}\n${count(byId.get(id)?.attributedRequestsInWindow)} attributed requests`,
        kind: "function",
      },
    })),
  ];
  for (const id of flow.entryFunctionIds)
    if (ids.has(id)) elements.push({ data: { id: `${apiId}:${id}`, source: apiId, target: id } });
  const callIds = new Set(flow.callIds);
  const httpByCall = new Map(
    flow.outboundCalls
      .filter((call) => call.functionCallId)
      .map((call) => [call.functionCallId!, call]),
  );
  const httpByNode = new Map<string, WorkspaceOutboundCall>();
  for (const call of code.calls.filter(
    (call) => callIds.has(call.id) && ids.has(call.callerFunctionId),
  )) {
    const http = httpByCall.get(call.id);
    const provider = http?.endpointId
      ? snapshot.endpoints.find((endpoint) => endpoint.id === http.endpointId)
      : null;
    const target = http
      ? provider
        ? `provider:${provider.id}`
        : `http:${call.id}`
      : (call.calleeFunctionId ?? `boundary:${call.id}`);
    if (http) {
      if (!httpByNode.has(target))
        elements.push({
          data: {
            id: target,
            label: `${provider?.method ?? http.method} ${provider?.path ?? http.path}\n${provider ? "Downstream API" : http.resolution}`,
            kind: provider ? "api" : "boundary",
          },
        });
      httpByNode.set(target, http);
    } else if (!call.calleeFunctionId)
      elements.push({
        data: {
          id: target,
          label: `${call.targetName}\n${call.modeled ? "modeled" : call.resolution}`,
          kind: "boundary",
        },
      });
    if (http || !call.calleeFunctionId || ids.has(call.calleeFunctionId))
      elements.push({
        data: {
          id: call.id,
          source: call.callerFunctionId,
          target,
          conditional: call.conditional || call.repeated ? "yes" : "no",
          parallel: call.parallel ? "yes" : "no",
        },
      });
  }
  const graph = cytoscape({
    container,
    elements,
    layout: { name: "breadthfirst", directed: true, roots: [apiId], padding: 40 },
    minZoom: 0.15,
    maxZoom: 3,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-wrap": "wrap",
          "text-max-width": "150px",
          "background-color": "#2b3ac4",
          color: document.documentElement.dataset.theme === "dark" ? "#e8edf4" : "#191c1e",
          "font-size": 11,
          "text-valign": "bottom",
          "text-margin-y": 10,
          width: 26,
          height: 26,
        },
      },
      {
        selector: 'node[kind = "api"]',
        style: { "background-color": "#26825d", shape: "round-rectangle", width: 45 },
      },
      {
        selector: 'node[kind = "boundary"]',
        style: { "background-color": "#8896a6", shape: "diamond" },
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "#8896a6",
          "target-arrow-color": "#8896a6",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
        },
      },
      {
        selector: 'edge[parallel = "yes"]',
        style: { "line-style": "dashed", "line-color": "#06b6d4", "target-arrow-color": "#06b6d4" },
      },
      { selector: 'edge[conditional = "yes"]', style: { "line-style": "dashed" } },
    ],
  });
  graph.on("tap", "node", (event) => {
    const http = httpByNode.get(event.target.id());
    if (http && inspector) {
      inspector.innerHTML = `<div class="ig-card"><h3>Downstream HTTP dependency</h3>${http.endpointId ? renderConsumerApiLinks(snapshot, [http.endpointId]) : `<code>${escape(http.method)} ${escape(http.path)}</code>`}<p>${staticEvidence(http)}</p>${source(http.source)}</div>`;
      return;
    }
    const fn = byId.get(event.target.id());
    if (fn && inspector)
      inspector.innerHTML = `<div class="ig-card"><h3>${escape(fn.qualifiedName)}</h3><p>${total(fn)} attributed requests</p>${source(fn.source)}${contributions(fn, snapshot)}</div>`;
  });
  return graph;
}

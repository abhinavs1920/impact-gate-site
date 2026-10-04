import cytoscape from "cytoscape";
import type { WorkspaceCodeFunction, WorkspaceApiFlow, ApiExecutionTreeNode, WorkspaceCodeSnapshot, IndexedFunctionCall } from "../types/code";
import type { SourceReference, WorkspaceEndpoint, WorkspaceSnapshot } from "../types/workspace";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const count = (value: number | null | undefined) => value == null ? "Unknown" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
function source(ref: SourceReference): string {
  let href = "#";
  try { const parsed = new URL(ref.url); if (parsed.protocol === "https:" && !parsed.username && !parsed.password) href = parsed.href; } catch { /* Keep malformed evidence inert. */ }
  return `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer"><code>${escape(ref.filePath)}:${ref.line}</code></a><p class="ig-note">Commit ${escape(ref.sha.slice(0, 12))}</p>`;
}
function table(headers: string[], rows: string[][]): string {
  return `<div class="ig-live-table-wrap"><table class="ig-live-table"><thead><tr>${headers.map(label => `<th scope="col">${escape(label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td data-label="${escape(headers[i])}"><div class="ig-table-cell">${cell}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function contributions(fn: WorkspaceCodeFunction, snapshot: WorkspaceSnapshot): string {
  return `<details><summary>${fn.attributions.length} API flow${fn.attributions.length === 1 ? "" : "s"}</summary>${fn.attributions.map(row => {
    const endpoint = snapshot.endpoints.find(endpoint => endpoint.id === row.endpointId);
    return `<p><a href="/dashboard/api-usage?endpointId=${encodeURIComponent(row.endpointId)}&amp;tab=flow">${escape(endpoint?.method)} ${escape(endpoint?.path)}</a> · ${count(row.requestsInWindow)} attributed requests</p><p class="ig-note">${escape(row.source ?? "No current telemetry")} · ${escape(row.windowStart ?? "Unknown window")} → ${escape(row.windowEnd ?? "Unknown window")}${row.partial ? " · Partial source coverage" : ""}</p>`;
  }).join("")}</details>`;
}
function total(fn: WorkspaceCodeFunction): string {
  return `${count(fn.attributedRequestsInWindow)}${fn.countsPartial ? '<p class="ig-note">Partial or incomparable API coverage</p>' : ""}`;
}

function buildTreeFallback(
  flow: WorkspaceApiFlow,
  code: WorkspaceCodeSnapshot,
  endpoint: WorkspaceEndpoint,
): ApiExecutionTreeNode {
  const byId = new Map(code.functions.map(fn => [fn.id, fn]));
  const outgoing = new Map<string, IndexedFunctionCall[]>();
  for (const call of code.calls) {
    if (!flow.callIds.includes(call.id)) continue;
    outgoing.set(call.callerFunctionId, [...(outgoing.get(call.callerFunctionId) ?? []), call]);
  }
  const rootId = flow.entryFunctionIds[0] ?? (flow.functionIds[0] ?? endpoint.id);
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
      const outboundMatch = flow.outboundCalls.find(o => o.callerFunctionId === parentId && o.source.line === call.source.line);
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
        parentNode.children.push({
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
        });
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
    node.conditional ? '<span class="ig-tree-badge ig-badge-cond" title="Conditional branch">? Branch</span>' : "",
    node.repeated ? '<span class="ig-tree-badge ig-badge-loop" title="Repeated execution in loop">↺ Loop</span>' : "",
    node.kind === "external" ? '<span class="ig-tree-badge ig-badge-ext" title="External library boundary">External</span>' : "",
    node.kind === "outbound_api" ? '<span class="ig-tree-badge ig-badge-api" title="Downstream HTTP call">Downstream API</span>' : "",
    node.kind === "unresolved" ? '<span class="ig-tree-badge ig-badge-unres" title="Dynamic / unresolved target">Unresolved</span>' : "",
  ].filter(Boolean).join(" ");

  const stepBadge = node.step > 0 ? `<span class="ig-tree-step">#${node.step}</span>` : "";
  const sourceRef = node.source?.filePath
    ? `<span class="ig-tree-file"><code>${escape(node.source.filePath)}:${node.source.line}</code></span>`
    : "";

  const title = `<div class="ig-tree-node-row">${stepBadge}<span class="ig-tree-name"><code>${escape(node.name)}</code></span>${executionBadge}${modifiers}${sourceRef}</div>`;

  if (!node.children || node.children.length === 0) {
    return `<div class="ig-tree-leaf">${title}</div>`;
  }

  return `<details open class="ig-tree-branch"><summary class="ig-tree-summary">${title}</summary><div class="ig-tree-children">${node.children.map(child => renderExecutionTreeNode(child, false)).join("")}</div></details>`;
}

function renderExecutionTreeSection(tree: ApiExecutionTreeNode): string {
  return `<section class="ig-card ig-tree-card" aria-label="API Execution Flow Tree"><div class="ig-tree-header"><h3>API Execution Flow Tree</h3><p class="ig-note">Hierarchical execution tree showing sequential (➔) and parallel (⚡) calls, branches, and service boundaries.</p></div><div class="ig-tree-wrapper">${renderExecutionTreeNode(tree, true)}</div></section>`;
}

export function renderFunctionInventory(snapshot: WorkspaceSnapshot, query = "", page = 0): string {
  const code = snapshot.code;
  if (!code) return '<section class="ig-card" id="function-usage" aria-labelledby="function-usage-title"><h2 id="function-usage-title">Function usage</h2><p class="ig-note">Reindex repositories after the code observability update to populate function flows.</p></section>';
  const functions = code.functions.filter(fn => fn.kind !== "module" && `${fn.qualifiedName} ${fn.source.filePath} ${snapshot.services.find(service => service.id === fn.serviceId)?.name}`.toLowerCase().includes(query.toLowerCase()));
  const currentPage = Math.max(0, Math.min(Math.trunc(page), Math.max(0, Math.ceil(functions.length / 100) - 1)));
  const visible = functions.slice(currentPage * 100, (currentPage + 1) * 100);
  const pagination = `<div class="ig-code-summary"><span>Showing ${functions.length ? currentPage * 100 + 1 : 0}–${currentPage * 100 + visible.length} of ${functions.length}</span><button type="button" class="ig-button ig-button-secondary" data-action="function-page" data-direction="previous" data-page="${currentPage - 1}" ${currentPage === 0 ? "disabled" : ""}>Previous</button><button type="button" class="ig-button ig-button-secondary" data-action="function-page" data-direction="next" data-page="${currentPage + 1}" ${(currentPage + 1) * 100 >= functions.length ? "disabled" : ""}>Next</button></div>`;
  return `<section class="ig-card" id="function-usage" aria-labelledby="function-usage-title"><h2 id="function-usage-title">Function usage</h2><p class="ig-note">Request counts come from the APIs that can reach each function. Shared functions combine comparable API windows. Actual invocation counts require function telemetry.</p><div class="ig-filters"><input data-code-query aria-label="Search functions and source files" placeholder="Search functions and source files" value="${escape(query)}"></div><p class="ig-note">${functions.length} functions match${code.missingRepositoryIds.length ? ` · ${code.missingRepositoryIds.length} repositories need reindexing` : ""}</p>${pagination}${table(["Function", "Service", "Attributed requests", "APIs / observation window", "Source"], visible.map(fn => [`<code>${escape(fn.qualifiedName)}</code>`, escape(snapshot.services.find(service => service.id === fn.serviceId)?.name), total(fn), contributions(fn, snapshot), source(fn.source)]))}</section>`;
}

export function renderCodeFlow(snapshot: WorkspaceSnapshot, endpoint: WorkspaceEndpoint): string {
  const code = snapshot.code;
  const flow = code?.flows.find(flow => flow.endpointId === endpoint.id);
  if (!code || !flow) return '<p class="ig-note">This repository has no persisted function flow yet. Reindex it from Repositories to build the flow at its current commit.</p>';
  const ids = new Set(flow.functionIds);
  const functions = code.functions.filter(fn => ids.has(fn.id));
  const byId = new Map(code.functions.map(fn => [fn.id, fn]));
  const calls = new Set(flow.callIds);
  const localCalls = code.calls.filter(call => calls.has(call.id));
  const perApi = (fn: WorkspaceCodeFunction) => count(fn.attributions.find(row => row.endpointId === endpoint.id)?.requestsInWindow);
  const tree = flow.executionTree ?? buildTreeFallback(flow, code, endpoint);
  const treeHtml = renderExecutionTreeSection(tree);
  return `<div class="ig-code-summary"><strong>${functions.length} reachable functions</strong><span>${count(endpoint.runtimeCallsInWindow)} ${endpoint.runtimeRequestSource === "datadog" ? "indexed spans" : "API requests"} in the observation window</span><span>${escape(flow.status.replaceAll("_", " "))}</span><button type="button" class="ig-button ig-button-secondary" data-action="code-export" data-id="${escape(endpoint.id)}">Export code flow</button></div><p class="ig-note">Every reachable function receives this API's request count once. Branches, loops and callbacks describe possible execution; these are attributed requests, not measured function invocations.</p>${flow.notes.length ? `<ul class="ig-code-notes">${flow.notes.map(note => `<li>${escape(note)}</li>`).join("")}</ul>` : ""}${treeHtml}${functions.length ? `<div class="ig-code-graph" data-code-flow="${escape(endpoint.id)}" role="group" aria-label="API function call graph"></div><p class="ig-note">Select a function for its source and API contributions. The tables below include all functions and call sites.${functions.length > 250 ? " The interactive graph shows the first 250 functions." : ""}</p><div data-code-inspector></div>${table(["Function", "This API's requests", "All APIs' requests", "APIs / observation window", "Source"], functions.map(fn => [`<code>${escape(fn.qualifiedName)}</code>`, perApi(fn), total(fn), contributions(fn, snapshot), source(fn.source)]))}` : ""}<h3>Function calls and boundaries</h3>${localCalls.length ? table(["From", "To", "Execution", "Source"], localCalls.map(call => [`<code>${escape(byId.get(call.callerFunctionId)?.qualifiedName)}</code>`, `<code>${escape(call.calleeFunctionId ? byId.get(call.calleeFunctionId)?.qualifiedName : call.targetName)}</code>${call.resolution !== "resolved" ? `<p class="ig-note">${escape(call.resolution)} boundary</p>` : ""}`, escape([call.kind, call.conditional ? "conditional" : "", call.repeated ? "may repeat" : "", call.parallel ? "parallel" : ""].filter(Boolean).join(" · ")), source(call.source)])) : '<p class="ig-note">No function call sites were recorded for this flow.</p>'}${flow.outboundCalls.length ? `<h3>Downstream APIs</h3><p class="ig-note">Continue into the downstream provider flow. Its API telemetry supplies its function counts.</p>${table(["Calling function", "API", "Evidence", "Source"], flow.outboundCalls.map(call => [`<code>${escape(byId.get(call.callerFunctionId)?.qualifiedName)}</code>`, call.endpointId ? `<a href="/dashboard/api-usage?endpointId=${encodeURIComponent(call.endpointId)}&amp;tab=flow">${escape(call.method)} ${escape(call.path)} →</a>` : `<code>${escape(call.method)} ${escape(call.path)}</code>`, escape(call.resolution === "matched" ? "Possible static route match" : call.resolution), source(call.source)]))}` : ""}${flow.callerFunctionIds.length ? `<h3>Functions calling this API</h3><p class="ig-note">Caller execution counts require the callers' own API flows or function telemetry.</p>${table(["Function", "Source"], flow.callerFunctionIds.map(id => byId.get(id)).filter((fn): fn is WorkspaceCodeFunction => !!fn).map(fn => [`<code>${escape(fn.qualifiedName)}</code>`, source(fn.source)]))}` : ""}`;
}

export function mountCodeFlow(snapshot: WorkspaceSnapshot, container: HTMLElement, inspector: HTMLElement | null): cytoscape.Core | null {
  const code = snapshot.code;
  const flow: WorkspaceApiFlow | undefined = code?.flows.find(flow => flow.endpointId === container.dataset.codeFlow);
  const endpoint = snapshot.endpoints.find(endpoint => endpoint.id === flow?.endpointId);
  if (!code || !flow || !endpoint) return null;
  const byId = new Map(code.functions.map(fn => [fn.id, fn]));
  const selected = flow.functionIds.slice(0, 250);
  const ids = new Set(selected);
  const apiId = `api:${endpoint.id}`;
  const elements: cytoscape.ElementDefinition[] = [{ data: { id: apiId, label: `${endpoint.method} ${endpoint.path}`, kind: "api" } }, ...selected.map(id => ({ data: { id, label: `${byId.get(id)?.name}\n${count(byId.get(id)?.attributedRequestsInWindow)} attributed requests`, kind: "function" } }))];
  for (const id of flow.entryFunctionIds) if (ids.has(id)) elements.push({ data: { id: `${apiId}:${id}`, source: apiId, target: id } });
  const callIds = new Set(flow.callIds);
  for (const call of code.calls.filter(call => callIds.has(call.id) && ids.has(call.callerFunctionId))) {
    const target = call.calleeFunctionId ?? `boundary:${call.id}`;
    if (!call.calleeFunctionId) elements.push({ data: { id: target, label: `${call.targetName}\n${call.resolution}`, kind: "boundary" } });
    if (!call.calleeFunctionId || ids.has(call.calleeFunctionId)) elements.push({ data: { id: call.id, source: call.callerFunctionId, target, conditional: call.conditional || call.repeated ? "yes" : "no", parallel: call.parallel ? "yes" : "no" } });
  }
  const graph = cytoscape({ container, elements, layout: { name: "breadthfirst", directed: true, roots: [apiId], padding: 40 }, minZoom: 0.15, maxZoom: 3,
    style: [{ selector: "node", style: { label: "data(label)", "text-wrap": "wrap", "text-max-width": "150px", "background-color": "#2b3ac4", color: document.documentElement.dataset.theme === "dark" ? "#e8edf4" : "#191c1e", "font-size": 11, "text-valign": "bottom", "text-margin-y": 10, width: 26, height: 26 } },
      { selector: 'node[kind = "api"]', style: { "background-color": "#26825d", shape: "round-rectangle", width: 45 } },
      { selector: 'node[kind = "boundary"]', style: { "background-color": "#8896a6", shape: "diamond" } },
      { selector: "edge", style: { width: 1.5, "line-color": "#8896a6", "target-arrow-color": "#8896a6", "target-arrow-shape": "triangle", "curve-style": "bezier" } },
      { selector: 'edge[parallel = "yes"]', style: { "line-style": "dashed", "line-color": "#06b6d4", "target-arrow-color": "#06b6d4" } },
      { selector: 'edge[conditional = "yes"]', style: { "line-style": "dashed" } }] });
  graph.on("tap", "node", event => {
    const fn = byId.get(event.target.id());
    if (fn && inspector) inspector.innerHTML = `<div class="ig-card"><h3>${escape(fn.qualifiedName)}</h3><p>${total(fn)} attributed requests</p>${source(fn.source)}${contributions(fn, snapshot)}</div>`;
  });
  return graph;
}

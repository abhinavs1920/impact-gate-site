import { ImpactGateAuthClient, mountAuthPage, parseAuthConfig, signInDestination, safeReturnPath } from "../auth";
import { describeAuthError } from "../auth/errors";
import { WorkspaceApi, WorkspaceApiError } from "./api";
import { mountCodeFlow, renderCodeFlow, renderFunctionInventory } from "./code-flow";
import { overviewPanels } from "./overview";
import { emailHref, emails } from "../ui/contact";
import { providerIcon, uiIcon } from "../ui/icons";
import { runtimeConnectionsPanel, runtimeConnectionForm, runtimeConnectionBody, runtimeEndpointDetails, runtimeServiceReview, runtimeConnectionChanged, updateRuntimeConnectButton } from "./runtime";
import type { RuntimeServiceDiscovery } from "../types/runtime";
import type { InstallationRepository, SessionResponse, SourceReference, WorkspaceEndpoint, WorkspaceMembership, WorkspaceSettings, WorkspaceSnapshot } from "../types/workspace";
import cytoscape from "cytoscape";
import "./connected.css";
import "../auth/auth.css";
import { identifyAnalyticsUser, startWebsiteAnalytics, trackEvent } from "../analytics";

interface PublicConfig { github: { configured: boolean; installUrl: string | null } }
let reportedWorkspace: string | null = null;
let reportedSetup = false;
interface InstallationChoice { installationId: number; accountLogin: string; accountType: string }
const $ = <T extends HTMLElement = HTMLElement>(selector: string, scope: ParentNode = document): T | null => scope.querySelector<T>(selector);
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const route = (id: string) => `/api/v1/workspaces/${encodeURIComponent(id)}`;
const badge = (value: string, attribute = "status") => `<span class="ig-badge" data-${attribute}="${escape(value)}">${escape(value.replaceAll("_", " "))}</span>`;
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "Not available";
const url = (value: string) => { try { const parsed = new URL(value); return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "#"; } catch { return "#"; } };
const button = (action: string, label: string, extra = "", secondary = false) => `<button type="button" class="ig-button${secondary ? " ig-button-secondary" : ""}" data-action="${action}" ${extra}>${action === "connect-github" || action === "link-github" ? providerIcon("github") : action === "link-google" ? providerIcon("google") : ""}${label}</button>`;
const empty = (title: string, copy: string, action = "") => `<div class="ig-state"><h2>${escape(title)}</h2><p>${escape(copy)}</p>${action}</div>`;
function table(headers: string[], rows: string[][]): string {
  return `<div class="ig-live-table-wrap"><table class="ig-live-table"><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td data-label="${escape(headers[i])}"><div class="ig-table-cell">${cell}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function evidence(references: SourceReference[]): string {
  return references.length ? `<ul class="ig-evidence">${references.map(ref => `<li><a href="${escape(url(ref.url))}" target="_blank" rel="noopener noreferrer"><code>${escape(ref.filePath)}:${ref.line}</code></a>${ref.functionName ? `<p>${escape(ref.functionName)}</p>` : ""}<p class="ig-note">Commit ${escape(ref.sha.slice(0, 12))}</p></li>`).join("")}</ul>` : `<p class="ig-note">No source references were recorded for this finding.</p>`;
}

const main = $("#workspace-content") ?? $("#auth-root") ?? document.body;
const page = document.documentElement.dataset.page ?? "home";
let auth: ImpactGateAuthClient;
let api: WorkspaceApi;
let config: PublicConfig;
let session: SessionResponse | null = null;
let workspace: WorkspaceMembership | null = null;
let snapshot: WorkspaceSnapshot | null = null;
let available: InstallationRepository[] | null = null;
let selectedRepos = new Set<number>();
let query = "";
let filter = "";
let showAllFindings = false;
let selectedEndpoint: string | null = new URL(location.href).searchParams.get("endpointId");
let codeQuery = "";
let codePage = 0;
let initialFunctionUsageNavigation = location.hash === "#function-usage";
let endpointTab = new URL(location.href).searchParams.get("tab") === "flow" ? "flow" : "overview";
let graph: cytoscape.Core | null = null;
let codeGraph: cytoscape.Core | null = null;
let poll: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let disposed = false;
let loadingUid: string | null = null;
let cleanupAuthPage: (() => void) | undefined;
let errorMessage = "";
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let overlayFocus: HTMLElement | null = null;

function toast(message: string): void {
  const target = $(".ig-toast");
  if (!target) return;
  target.textContent = message; target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; }, 5000);
}
function state(title: string, message: string, retry = false): void {
  graph?.destroy(); graph = null;
  codeGraph?.destroy(); codeGraph = null;
  main.innerHTML = `<div class="ig-state" role="status"><h1>${escape(title)}</h1><p>${escape(message)}</p>${retry ? button("retry", "Try again") + `<p class="ig-state-help"><a href="${emailHref("support")}">${uiIcon("help")}Contact support</a><a href="/docs/troubleshooting">Troubleshooting guide</a></p>` : '<span class="ig-load-icon" aria-hidden="true"></span>'}</div>`;
}
function heading(title: string, description: string, actions = ""): string {
  const displayError = errorMessage || (["onboarding", "github-setup"].includes(page) && new URL(location.href).searchParams.get("githubError") === "authorization_denied" ? "GitHub authorization was canceled. Connect GitHub to try again." : "");
  return `<div class="ig-live-heading"><div><h1>${title}</h1><p>${escape(description)}</p></div><div class="ig-actions">${actions}</div></div>${displayError ? `<div class="ig-inline-error" role="alert">${escape(displayError)} ${button("retry", "Refresh", "", true)}</div>` : ""}${workspace?.role === "viewer" ? '<div class="ig-permission">You have view access. A workspace owner or admin can select repositories and change preferences.</div>' : ""}`;
}
function canWrite(): boolean { return workspace?.role !== "viewer" && Boolean(session?.user.emailVerified); }
function writeDisabled(): string { return canWrite() && !busy ? "" : "disabled"; }
function closeNavigation(): void {
  document.body.dataset.navOpen = "false"; $("[data-action=menu]")?.setAttribute("aria-expanded", "false");
  const backdrop = $(".ig-backdrop"); if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = ""; overlayFocus?.focus(); overlayFocus = null;
}
function renderShell(): void {
  syncThemeControls();
  if (!session) return;
  const account = session.user.name ?? session.user.email ?? "Account";
  const profile = $(".ig-profile");
  if (profile) profile.innerHTML = `<b>${escape(account.split(/\s+/).slice(0, 2).map(s => s[0]).join("").toUpperCase())}</b><span>${escape(account)}</span>`;
  const label = $(".ig-demo"); if (label) label.textContent = workspace?.name ?? "Set up workspace";
  const bottom = $(".ig-sidebar-bottom span"); if (bottom) bottom.textContent = workspace ? `${workspace.accountLogin} · ${workspace.role}` : "Connect GitHub";
  const footer = $(".ig-footer span"); if (footer) footer.textContent = snapshot ? `Updated ${date(snapshot.generatedAt)}` : "Authenticated workspace";
  for (const picker of document.querySelectorAll<HTMLSelectElement>("[data-workspace-picker]")) {
    picker.hidden = session.workspaces.length < 2;
    picker.innerHTML = session.workspaces.map(w => `<option value="${escape(w.id)}" ${w.id === workspace?.id ? "selected" : ""}>${escape(w.name)}</option>`).join("");
  }
  const addWorkspace = $<HTMLButtonElement>('[data-action="add-workspace"]');
  if (addWorkspace) addWorkspace.hidden = !config?.github.configured || !canWrite();
  const mobileSwitcher = $("[data-workspace-switcher]"); if (mobileSwitcher) mobileSwitcher.hidden = session.workspaces.length < 2;
}
function syncThemeControls(): void {
  const dark = document.documentElement.dataset.theme === "dark";
  for (const control of document.querySelectorAll<HTMLButtonElement>('[data-action="theme"]')) {
    control.innerHTML = uiIcon(dark ? "sun" : "moon");
    control.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
    control.title = `Switch to ${dark ? "light" : "dark"} theme`;
  }
}
function jobs(): string {
  if (!snapshot?.jobs.length) return "";
  const items = snapshot.jobs.slice(0, 12);
  return `<section class="ig-card"><h2>Analysis jobs</h2>${items.map(job => `<div class="ig-job"><strong>${escape(snapshot?.repositories.find(r => r.id === job.repositoryId)?.fullName ?? job.repositoryId)}</strong>${badge(job.status)}<span class="ig-note">${escape(job.phase)} · ${escape(job.type.replaceAll("_", " "))}</span><span>${Math.round(job.progress)}%</span><progress max="100" value="${Math.max(0, Math.min(100, job.progress))}" aria-label="${escape(job.phase)}"></progress>${job.error ? `<p>${escape(job.error)}</p>` : ""}</div>`).join("")}</section>`;
}
function renderHome(): string {
  const s = snapshot!;
  const open = s.findings.filter(f => f.status === "open");
  const details = open.map(finding => {
    const endpoint = s.endpoints.find(endpoint => endpoint.id === finding.endpointId);
    const repository = s.repositories.find(repository => repository.id === finding.repositoryId);
    const service = s.services.find(service => service.id === endpoint?.serviceId);
    return { finding, repository, name: service?.name ?? repository?.fullName ?? finding.endpoint };
  });
  const findings = details.filter(({ finding, repository, name }) =>
    (!filter || finding.risk === filter) &&
    `${name} ${repository?.fullName ?? ""} ${finding.endpoint} ${finding.consumerName} ${finding.changeKind} ${finding.explanation}`.toLowerCase().includes(query.toLowerCase()),
  ).sort((a, b) => Date.parse(b.finding.createdAt) - Date.parse(a.finding.createdAt));
  const visible = showAllFindings ? findings : findings.slice(0, 5);
  const rows = visible.map(({ finding: f, repository, name }) => [
    `<button type="button" data-action="finding" data-id="${escape(f.id)}" aria-label="Review finding for ${escape(f.endpoint)}"><strong>${escape(name)}</strong></button>${repository ? `<p class="ig-note">${escape(repository.fullName)}</p>` : ""}`,
    `<span class="ig-overview-change" title="${escape(f.endpoint)}">${escape(f.changeKind.replaceAll("_", " "))}</span>`,
    badge(f.risk, "risk"),
    '<span class="ig-overview-status">Open</span>',
    `<a class="ig-overview-pr" href="${escape(url(f.pullRequestUrl))}" target="_blank" rel="noopener noreferrer" aria-label="Open pull request ${f.pullRequestNumber} on GitHub">#${f.pullRequestNumber} ↗</a>`,
  ]);
  const count = `Showing ${visible.length} of ${findings.length}${query || filter ? " matching" : ""} findings`;
  const toggle = findings.length > 5 ? `<button type="button" class="ig-overview-all" data-action="toggle-findings" aria-controls="overview-findings-table" aria-expanded="${showAllFindings}">${showAllFindings ? "Show recent findings" : "View all findings →"}</button>` : "";
  const noFindings = query || filter
    ? empty("No matching findings", "Try another search or clear the filters.", button("clear-filters", "Clear filters", "", true))
    : empty("No open findings", s.repositories.length ? "Findings appear when a pull request changes an API contract." : "Connect your repositories to discover services, endpoints, and API changes.", s.repositories.length ? "" : '<a class="ig-button" href="/dashboard/repositories?import=1">Import repositories</a>');
  return `<div class="ig-overview">${heading("Engineering Overview", "Cross-repository API and code usage intelligence")}${overviewPanels(s)}
    <section class="ig-overview-findings" id="recent-findings" tabindex="-1" aria-labelledby="recent-findings-title">
      <header class="ig-overview-findings-header"><div class="ig-overview-findings-title"><h2 id="recent-findings-title">Recent Open Findings</h2><span class="ig-overview-findings-count">${count}</span></div>${toggle}</header>
      ${open.length ? filters("Search findings, services, and endpoints", [["high", "High severity"], ["medium", "Medium severity"], ["low", "Low severity"], ["none", "No risk"]]) : ""}
      <div id="overview-findings-table">${rows.length ? table(["Service / Repository", "Change", "Severity", "Status", "GitHub PR"], rows) : noFindings}</div>
    </section>
  </div>`;
}
function filters(placeholder: string, options: Array<[string, string]>): string {
  return `<div class="ig-filters"><input data-query aria-label="${escape(placeholder)}" placeholder="${escape(placeholder)}" value="${escape(query)}"><select data-filter aria-label="Filter records"><option value="">All</option>${options.map(([value, label]) => `<option value="${escape(value)}" ${filter === value ? "selected" : ""}>${escape(label)}</option>`).join("")}</select>${button("clear-filters", "Clear", "", true)}</div>`;
}
function coverage(endpoint: WorkspaceEndpoint): string { return endpoint.runtimeCoverage === "available" ? endpoint.runtimeCallsInWindow != null ? `${endpoint.runtimeCallsInWindow.toLocaleString(undefined, {maximumFractionDigits: 2})} ${endpoint.runtimeRequestSource === "datadog" ? "indexed spans" : "estimated requests"}` : "Traffic observed" : endpoint.runtimeCoverage === "not_connected" ? "Runtime not connected" : "No current observations"; }
function endpointPanel(endpoint: WorkspaceEndpoint): string {
  const s = snapshot!;
  const edges = s.edges.filter(edge => edge.endpointId === endpoint.id);
  const findings = s.findings.filter(f => f.endpointId === endpoint.id);
  let content: string;
  if (endpointTab === "callers") content = edges.length ? table(["Caller", "Evidence", "Confidence", "References"], edges.map(edge => [escape(s.services.find(service => service.id === edge.callerServiceId)?.name ?? edge.callerServiceId), badge(edge.evidence), badge(edge.confidence), evidence(edge.references)])) : empty("No known callers", "Static analysis has not identified a caller for this endpoint. This does not prove it is unused.");
  else if (endpointTab === "flow") content = renderCodeFlow(s, endpoint);
  else if (endpointTab === "history") content = findings.length ? findings.map(f => `<div class="ig-card"><strong>${escape(f.changeKind)} · ${escape(f.verdict)}</strong><p>${escape(f.explanation)}</p><a href="${escape(url(f.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">PR #${f.pullRequestNumber} ↗</a>${evidence(f.evidence)}</div>`).join("") : '<p class="ig-note">No analyzed contract changes have been recorded for this endpoint.</p>';
  else content = `<div class="ig-detail-grid"><dl><dt>Service</dt><dd>${escape(s.services.find(service => service.id === endpoint.serviceId)?.name)}</dd><dt>Static callers</dt><dd>${endpoint.staticCallerCount}</dd><dt>Runtime coverage</dt><dd>${coverage(endpoint)}</dd><dt>Last observed</dt><dd>${date(endpoint.lastObservedAt)}</dd><dt>Criticality / confidence</dt><dd>${escape(endpoint.criticality)} / ${escape(endpoint.confidence ?? "not established")}</dd></dl><div>${evidence([endpoint.source])}</div></div><h3>Runtime observation</h3>${runtimeEndpointDetails(endpoint)}${endpoint.requestSchema ? `<h3>Request schema</h3><pre class="ig-schema">${escape(JSON.stringify(endpoint.requestSchema, null, 2))}</pre>` : ""}${endpoint.responseSchema ? `<h3>Response schema</h3><pre class="ig-schema">${escape(JSON.stringify(endpoint.responseSchema, null, 2))}</pre>` : ""}`;
  return `<section class="ig-card"><div class="ig-live-heading"><h2><code>${escape(endpoint.method)} ${escape(endpoint.path)}</code></h2><div class="ig-actions">${["overview", "flow", "callers", "history"].map(tab => button("endpoint-tab", tab === "history" ? "Change history" : tab === "flow" ? "Code flow" : tab[0].toUpperCase() + tab.slice(1), `data-tab="${tab}" aria-pressed="${endpointTab === tab}"`, endpointTab !== tab)).join("")}</div></div>${content}</section>`;
}
function renderEndpoints(): string {
  const s = snapshot!;
  const endpoints = s.endpoints.filter(e => `${e.method} ${e.path} ${s.services.find(service => service.id === e.serviceId)?.name}`.toLowerCase().includes(query.toLowerCase()) && (!filter || e.serviceId === filter));
  const selected = s.endpoints.find(e => e.id === selectedEndpoint) ?? endpoints[0];
  return heading("API usage", "Explore discovered endpoints, static callers, source evidence, and available runtime coverage.") + `<section class="ig-card">${filters("Search APIs and services", s.services.map(service => [service.id, service.name]))}${endpoints.length ? table(["Method", "Endpoint", "Service", "Static callers", "Runtime", "Criticality"], endpoints.map(e => [badge(e.method), `<button data-action="endpoint" data-id="${escape(e.id)}"><code>${escape(e.path)}</code></button>`, escape(s.services.find(service => service.id === e.serviceId)?.name), String(e.staticCallerCount), escape(coverage(e)), badge(e.criticality, "risk")])) : empty("No endpoints to show", s.repositories.length ? "Wait for indexing, or adjust your filters. Coverage notes are available on the repositories page." : "Connect repositories to discover API endpoints.")}</section>${selected ? endpointPanel(selected) : ""}`;
}
function renderCandidates(): string {
  const s = snapshot!;
  const candidates = s.candidates.filter(c => { const endpoint = s.endpoints.find(e => e.id === c.endpointId); return `${endpoint?.method} ${endpoint?.path} ${c.reason}`.toLowerCase().includes(query.toLowerCase()) && (!filter || c.status === filter); });
  return heading("Deprecation candidates", "Review evidence before planning removal. Missing runtime observations do not establish that an API is unused.") + `<section class="ig-card">${filters("Search candidates", [["strong_candidate", "Strong candidate"], ["rare_caller", "Rare caller"], ["building_confidence", "Building confidence"], ["flagged", "Flagged"]])}${candidates.length ? table(["Endpoint", "Status", "Static callers", "Runtime", "Review", "Evidence"], candidates.map(c => { const e = s.endpoints.find(endpoint => endpoint.id === c.endpointId); return [`<code>${escape(e?.method)} ${escape(e?.path ?? c.endpointId)}</code><p class="ig-note">${escape(c.reason)}</p>`, badge(c.status), String(c.staticCallerCount), escape(e ? coverage(e) : c.runtimeCoverage), c.reviewedAt ? `Reviewed ${date(c.reviewedAt)}<p class="ig-note">${escape(c.reviewedSnapshotId === s.snapshotId ? "Current snapshot" : "Previous snapshot — review updated evidence")}</p>` : "Needs review", button("candidate", "Review evidence", `data-id="${escape(c.endpointId)}"`, true)]; })) : empty("No candidates to review", "Candidates appear when indexed endpoints have enough evidence for a review. Adjust your filters if needed.")}</section>`;
}
function renderRepositories(): string {
  const s = snapshot!;
  const repos = s.repositories.filter(r => r.fullName.toLowerCase().includes(query.toLowerCase()) && (!filter || r.status === filter));
  return heading("Repositories", "Manage GitHub App access, indexing, and parser coverage.", button("import", "Select repositories", writeDisabled()) + button("add-workspace", "Add account or organization", `${writeDisabled()}`, true)) + `<section class="ig-card">${filters("Search repositories", [["indexed", "Indexed"], ["queued", "Queued"], ["indexing", "Indexing"], ["partial", "Partial"], ["failed", "Failed"]])}${repos.length ? table(["Repository", "Branch", "Status", "Services", "Last index", "Actions"], repos.map(r => [`<strong>${escape(r.fullName)}</strong>${r.error ? `<p class="ig-note">${escape(r.error)}</p>` : ""}`, escape(r.defaultBranch), badge(r.status), String(r.serviceCount), date(r.indexedAt), `<div class="ig-actions">${button("repository", "Coverage", `data-id="${escape(r.id)}"`, true)}${button("reindex", "Re-index", `data-id="${escape(r.id)}" ${writeDisabled()} ${["queued", "indexing", "discovering"].includes(r.status) ? "disabled" : ""}`, true)}</div>`])) : empty("No repositories selected", "Choose repositories from the active GitHub account or organization. Add another connection to switch repository owners.", button("import", "Select repositories", writeDisabled()))}</section>${jobs()}`;
}
function renderSettings(): string {
  const s = snapshot!.settings;
  const providers = auth.currentUser?.providerData.map(p => p.providerId) ?? [];
  const methods = (["github", "google"] as const).filter(method => auth.isEnabled(method)).map(method => providers.includes(`${method}.com`)
    ? `<span class="ig-provider-connection">${providerIcon(method)}<strong>${method === "github" ? "GitHub" : "Google"}</strong><span>Connected</span></span>`
    : button(`link-${method}`, `Connect ${method === "github" ? "GitHub" : "Google"}`, "", true)).join("");
  return heading("Settings", "Manage your workspace, sign-in methods, and connected services.") + `<div class="ig-settings-grid">
    <section class="ig-card ig-settings-preferences"><h2>Workspace preferences</h2><p class="ig-note">Your changes are saved after the server confirms them.</p>${!session?.user.emailVerified ? '<p class="ig-permission">Your email must be verified before changing workspace settings. Sign in with a verified provider or use a passwordless email link.</p>' : ""}
      <form class="ig-form" data-settings-form>
        <label>Analysis mode<select name="analysisMode" disabled><option>Deterministic static analysis</option></select></label>
        <label class="ig-checkbox"><input type="checkbox" name="syncDefaultBranch" ${s.syncDefaultBranch ? "checked" : ""} ${writeDisabled()}> Sync default branch when code changes</label>
        <label class="ig-checkbox"><input type="checkbox" name="prCommentsEnabled" ${s.prCommentsEnabled ? "checked" : ""} ${writeDisabled()}> Publish findings as pull request comments</label>
        <label class="ig-checkbox"><input type="checkbox" name="externalModelsEnabled" ${s.externalModelsEnabled ? "checked" : ""} ${!session?.capabilities.externalModels ? "disabled" : writeDisabled()}> Allow external model analysis</label>
        ${!session?.capabilities.externalModels ? '<p class="ig-note">External model analysis is unavailable on this deployment.</p>' : ""}
        <label>History retention in days<input type="number" name="retentionDays" min="7" max="365" required value="${s.retentionDays}" ${writeDisabled()}></label>
        <p class="ig-note">Applies to job and pull request history and reviews. Current repository snapshots remain while selected.</p>
        <button class="ig-button" type="submit" ${writeDisabled()}>Save preferences</button><p data-save-status role="status" aria-live="polite"></p>
      </form>
    </section>
    <section class="ig-card"><h2>Sign-in methods</h2><p class="ig-note">Signed in as <strong>${escape(session?.user.email ?? "your account")}</strong>.</p><div class="ig-account-methods">${methods}</div><p class="ig-note">Passwordless email links are available from the sign-in page. Provider connections retain your current account.</p><a class="ig-settings-guide" href="/docs/sign-in">Account & sign-in guide →</a></section>
    <section class="ig-card"><h2>GitHub App</h2><p>${escape(workspace?.accountLogin)} · ${badge(workspace?.installationStatus ?? "unknown")}</p><p class="ig-note">Repository permissions are controlled by the GitHub App installation.</p>${button("connect-github", "Manage connection", "", true)}</section>
  </div>${runtimeConnectionsPanel(snapshot!, !!session?.capabilities.runtimeTelemetry, canWrite())}
  <section class="ig-card ig-settings-help"><div><h2>Help with your account</h2><p class="ig-note">Talk to the right person about your workspace or account.</p></div><nav aria-label="Account assistance"><a href="${emailHref("support")}">${uiIcon("help")}Product support</a><a href="${emailHref("billing")}">${uiIcon("mail")}Billing & invoices</a><a href="${emailHref("privacy")}">${uiIcon("mail")}Privacy & legal</a><a href="/contact">All contact options →</a></nav></section>`;
}
function renderGraph(): string {
  const s = snapshot!;
  return heading("Dependency graph", "Service relationships are derived from the current workspace evidence.") + `<section class="ig-card">${filters("Search services", [["static", "Static evidence"], ["runtime", "Runtime evidence"], ["both", "Static and runtime evidence"]])}<div class="ig-actions ig-graph-toolbar">${button("graph-fit", "Fit view", "", true)}${button("graph-export", "Export snapshot", "", true)}</div>${s.services.length ? '<div class="ig-connected-graph" role="group" aria-label="Service dependency graph"></div><div class="ig-graph-inspector" data-graph-inspector><p class="ig-note">Select a service to inspect its endpoints and callers. The table below provides keyboard accessible relationship details.</p></div>' : empty("No services indexed yet", "Connect a repository and complete indexing to map service relationships.")}<p class="ig-note">${s.services.length} services · ${s.edges.length} endpoint relationships</p>${s.edges.length ? table(["Caller", "Target service", "Endpoint", "Evidence", "Confidence"], s.edges.filter(edge => !filter || edge.evidence === filter).map(edge => { const endpoint = s.endpoints.find(e => e.id === edge.endpointId); return [escape(s.services.find(service => service.id === edge.callerServiceId)?.name), escape(s.services.find(service => service.id === endpoint?.serviceId)?.name), `<button data-action="endpoint-dialog" data-id="${escape(edge.endpointId)}"><code>${escape(endpoint?.method)} ${escape(endpoint?.path)}</code></button>`, badge(edge.evidence), badge(edge.confidence)]; })) : '<p class="ig-note">No cross-service callers were found in the current snapshot.</p>'}</section>`;
}
function mountGraph(): void {
  const container = $(".ig-connected-graph"); if (!container || !snapshot) return;
  const s = snapshot;
  const services = s.services.filter(service => service.name.toLowerCase().includes(query.toLowerCase()));
  const ids = new Set(services.map(service => service.id));
  graph = cytoscape({ container, elements: [...services.map(service => ({ data: { id: service.id, label: service.name } })), ...s.edges.filter(edge => { const target = s.endpoints.find(e => e.id === edge.endpointId)?.serviceId; return target && target !== edge.callerServiceId && ids.has(target) && ids.has(edge.callerServiceId) && (!filter || edge.evidence === filter); }).map(edge => ({ data: { id: edge.id, source: edge.callerServiceId, target: s.endpoints.find(e => e.id === edge.endpointId)!.serviceId, label: edge.evidence } }))], layout: { name: "breadthfirst", directed: true, padding: 35 }, style: [{ selector: "node", style: { "background-color": "#2b3ac4", label: "data(label)", color: document.documentElement.dataset.theme === "dark" ? "#e8edf4" : "#191c1e", "font-size": 11, "text-valign": "bottom", "text-margin-y": 10, width: 30, height: 30 } }, { selector: "edge", style: { width: 2, "line-color": "#8896a6", "target-arrow-color": "#8896a6", "target-arrow-shape": "triangle", "curve-style": "bezier" } }] });
  graph.on("tap", "node", event => { const service = s.services.find(item => item.id === event.target.id()); const inspector = $("[data-graph-inspector]"); if (!service || !inspector) return; inspector.innerHTML = `<h2>${escape(service.name)}</h2><p class="ig-note">${escape(service.rootPath)} · ${escape(service.criticality)} criticality</p>${table(["Method", "Endpoint", "Static callers"], s.endpoints.filter(e => e.serviceId === service.id).map(e => [escape(e.method), `<button data-action="endpoint-dialog" data-id="${escape(e.id)}">${escape(e.path)}</button>`, String(e.staticCallerCount)]))}`; });
}
function render(): void {
  if (disposed || !snapshot) return;
  graph?.destroy(); graph = null;
  codeGraph?.destroy(); codeGraph = null;
  main.innerHTML = ({ home: renderHome, "api-usage": renderEndpoints, "dependency-graph": renderGraph, "deprecation-candidates": renderCandidates, repositories: renderRepositories, settings: renderSettings, onboarding: renderOnboarding, "github-setup": renderOnboarding }[page] ?? renderHome)();
  main.setAttribute("aria-busy", "false"); renderShell(); if (page === "dependency-graph") mountGraph();
  if (page === "dependency-graph") {
    main.insertAdjacentHTML("beforeend", renderFunctionInventory(snapshot, codeQuery, codePage));
    if (initialFunctionUsageNavigation) {
      $("#function-usage")?.scrollIntoView?.();
      initialFunctionUsageNavigation = false;
    }
  }
  const flow = $<HTMLElement>("[data-code-flow]", main);
  if (flow) codeGraph = mountCodeFlow(snapshot, flow, $("[data-code-inspector]", main));
}

function renderOnboarding(): string {
  let steps: string;
  if (workspace) {
    steps = `<section class="ig-card"><h2>1. GitHub organization</h2><p><strong>${escape(workspace.accountLogin)}</strong> · ${badge(workspace.installationStatus)}</p>${button("connect-github", "Connect another installation", "", true)}</section>
      <section class="ig-card"><h2>2. Choose repositories</h2>${available ? repoSelection() : '<p class="ig-note">Loading repositories authorized by your installation…</p>'}</section>${jobs()}
      ${snapshot?.repositories.length ? '<section class="ig-card"><h2>3. Explore your workspace</h2><p class="ig-note">Indexing continues in the background. Open the dashboard to inspect progress and discovered services.</p><a class="ig-button" href="/dashboard">Open dashboard</a></section>' : ""}`;
  } else {
    steps = `<section class="ig-card"><h2>1. Connect GitHub</h2><p class="ig-note">Connect your GitHub organization to choose repositories. You can use any enabled sign-in method for your Impact Gate account.</p>${button("connect-github", "Connect GitHub", config.github?.configured ? "" : "disabled")}${config.github?.configured ? "" : '<p class="ig-note">The GitHub App connection is not configured yet.</p>'}</section>`;
  }
  return `<div class="ig-onboarding">${heading("Connect your workspace", "Choose repositories from your GitHub App installation, then start indexing.")}${steps}<aside class="ig-onboarding-help">${uiIcon("help")}<div><strong>Need help connecting your workspace?</strong><p>Read the <a href="/docs/connect-github">GitHub connection guide</a> or contact <a href="${emailHref("pilot")}">${emails.pilot}</a>. For technical issues, email <a href="${emailHref("support")}">${emails.support}</a>.</p></div></aside></div>`;
}
function repoSelection(): string {
  if (!available?.length) return empty("No repositories available", "Grant repository access to the Impact Gate GitHub App, then reconnect to refresh permissions.", button("connect-github", "Refresh GitHub access", "", true));
  return `<form data-repositories-form><p class="ig-note">Selected repositories will be indexed on their default branch. Deselecting a repository removes it from this workspace.</p><div class="ig-repo-options">${available.map(repo => `<label class="ig-repo-option"><input type="checkbox" name="repositoryIds" value="${repo.githubRepositoryId}" ${selectedRepos.has(repo.githubRepositoryId) ? "checked" : ""} ${writeDisabled()}><span><strong>${escape(repo.fullName)}</strong><small>${repo.private ? "Private" : "Public"} · ${escape(repo.language ?? "Language not detected")} · ${escape(repo.defaultBranch)}</small></span></label>`).join("")}</div><div class="ig-actions" style="margin-top:18px"><button type="submit" class="ig-button" ${writeDisabled()}>Save selection and start indexing</button></div><p data-save-status role="status"></p></form>`;
}
function modal(title: string, contents: string): HTMLDialogElement {
  const dialog = $<HTMLDialogElement>(".ig-dialog")!;
  overlayFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.innerHTML = `<h2 id="dialog-title">${escape(title)}</h2>${contents}<div class="ig-dialog-actions">${button("close-dialog", "Close", "", true)}</div>`;
  dialog.showModal(); return dialog;
}
async function loadAvailable(): Promise<void> {
  if (!workspace) return;
  const response = await api.request<{ repositories: InstallationRepository[] }>(`${route(workspace.id)}/repositories/available`);
  available = response.repositories; selectedRepos = new Set(available.filter(repo => repo.selected).map(repo => repo.githubRepositoryId));
}
async function discoverRuntimeServices(form: HTMLFormElement): Promise<void> {
  if (!workspace || !snapshot) return;
  const workspaceId = workspace.id;
  const revision = form.dataset.runtimeRevision;
  const status = $("[data-save-status]", form);
  trackEvent("runtime_discovery_start", { provider: form.dataset.provider });
  if (status) status.textContent = "Finding source services and matching APIs…";
  const result = await api.request<RuntimeServiceDiscovery>(`${route(workspaceId)}/runtime/${form.dataset.provider}/discover`, {method: "POST", body: runtimeConnectionBody(form, true)});
  if (!form.isConnected || !form.closest<HTMLDialogElement>("dialog")?.open || workspace?.id !== workspaceId) return;
  if (form.dataset.runtimeRevision !== revision) {
    if (status) status.textContent = "Settings changed while discovering. Find services again with the updated settings.";
    return;
  }
  const review = $("[data-runtime-review]", form);
  trackEvent("runtime_services_discovered", { provider: form.dataset.provider,
    service_count: result.services.length, matched_count: result.autoMatchedCount,
    unmatched_count: result.suggestedCount + result.unmatchedCount });
  if (review) review.innerHTML = runtimeServiceReview(snapshot, result);
  form.dataset.runtimePhase = result.services.length ? "review" : "source";
  updateRuntimeConnectButton(form);
  const again = $<HTMLButtonElement>("[data-action=runtime-discover]", form); if (again) again.hidden = !result.services.length;
  if (!result.services.length) {
    const advanced = $<HTMLDetailsElement>(".ig-runtime-advanced", form); if (advanced) advanced.open = true;
  }
  if (status) status.textContent = `${result.autoMatchedCount} matches ready · ${result.suggestedCount + result.unmatchedCount} to review. Nothing is saved until you connect.`;
  if (result.services.length) $<HTMLButtonElement>("[data-runtime-primary]", form)?.focus();
}
async function refresh(renderView = true): Promise<void> {
  if (!workspace) return;
  const next = await api.request<WorkspaceSnapshot>(`${route(workspace.id)}/snapshot`);
  if (next.version !== 1 || next.workspaceId !== workspace.id || !Array.isArray(next.endpoints)) throw new Error("The workspace response is incompatible.");
  snapshot = next; errorMessage = ""; if (renderView) render();
  if (reportedWorkspace !== workspace.id) {
    reportedWorkspace = workspace.id;
    identifyAnalyticsUser(auth.currentUser?.uid ?? null, workspace.role);
    trackEvent("workspace_view", { repository_count: next.repositories.length,
      service_count: next.services.length, endpoint_count: next.endpoints.length });
  }
  clearTimeout(poll);
  if (!disposed) poll = setTimeout(() => { if (document.hidden || busy || page === "settings" || $<HTMLDialogElement>(".ig-dialog")?.open) { schedulePoll(); return; } void refresh().catch(handleError); }, next.jobs.some(job => ["queued", "running"].includes(job.status)) ? 5000 : 30000);
}
function schedulePoll(): void {
  clearTimeout(poll);
  if (!disposed && workspace) poll = setTimeout(() => {
    // Preserve the settings version displayed to the user until an explicit save or refresh.
    if (document.hidden || busy || page === "settings" || $<HTMLDialogElement>(".ig-dialog")?.open) { schedulePoll(); return; }
    void refresh().catch(handleError);
  }, 5000);
}
function handleError(error: unknown): void {
  if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
  trackEvent("workspace_error", { error_type: error instanceof WorkspaceApiError
    ? error.status === 401 ? "authentication" : error.status >= 500 ? "server" : "request" : "network" });
  if (error instanceof WorkspaceApiError && error.status === 401) {
    clearSession(); state("Your session needs attention", "Sign in again to continue.", true);
    window.location.assign(signInDestination(`${location.pathname}${location.search}`, location.origin)); return;
  }
  errorMessage = error instanceof Error ? error.message : "The workspace could not be loaded.";
  if (snapshot) { toast(errorMessage); schedulePoll(); }
  else state("Workspace unavailable", errorMessage, true);
}
function clearSession(): void {
  identifyAnalyticsUser(null);
  reportedWorkspace = null; reportedSetup = false;
  codeGraph?.destroy(); codeGraph = null; codeQuery = ""; codePage = 0;
  api?.cancel(); clearTimeout(poll); snapshot = null; session = null; workspace = null; available = null; selectedRepos.clear(); graph?.destroy(); graph = null; query = ""; filter = ""; showAllFindings = false; errorMessage = "";
}
function chooseWorkspace(): void {
  const requested = new URL(location.href).searchParams.get("workspaceId");
  let remembered: string | null = null; try { remembered = sessionStorage.getItem("impact-gate-workspace"); } catch { /* Server membership remains authoritative. */ }
  workspace = session?.workspaces.find(w => w.id === requested || w.id === remembered) ?? session?.workspaces[0] ?? null;
  if (workspace) { try { sessionStorage.setItem("impact-gate-workspace", workspace.id); } catch { /* Nonessential preference. */ } }
}
async function bootstrap(): Promise<void> {
  session = await api.request<SessionResponse>("/api/v1/session"); chooseWorkspace(); renderShell();
  identifyAnalyticsUser(auth.currentUser?.uid ?? null, workspace?.role ?? null);
  if (!reportedSetup && ["onboarding", "github-setup"].includes(page)) {
    reportedSetup = true; trackEvent("setup_started");
  }
  const selection = new URL(location.href).searchParams.get("githubSelection");
  if (selection && ["onboarding", "github-setup"].includes(page)) { await chooseInstallation(selection); return; }
  if (!workspace) { main.innerHTML = renderOnboarding(); return; }
  if (["onboarding", "github-setup"].includes(page)) await loadAvailable();
  await refresh();
  if (new URL(location.href).searchParams.has("import") && page === "repositories") await importRepositories();
}
async function chooseInstallation(flow: string): Promise<void> {
  const result = await api.request<{ installations: InstallationChoice[]; installUrl: string | null }>(`/api/v1/github/connect/installations?${new URLSearchParams({ flow })}`);
  main.innerHTML = `<div class="ig-onboarding">${heading("Choose a GitHub account or organization", "Repositories are scoped to the account where the GitHub App is installed. Choose the owner of the repositories you want to use.")}<section class="ig-card">${result.installations.map(installation => `<div class="ig-choice"><div><strong>${escape(installation.accountLogin)}</strong><p class="ig-note">${escape(installation.accountType === "User" ? "Personal account" : installation.accountType)}</p></div>${button("finish-github", "Connect", `data-id="${installation.installationId}" data-flow="${escape(flow)}"`)}</div>`).join("") || '<p class="ig-note">No GitHub App installations are linked yet. Install the app for the personal account or organization that owns your repositories, then refresh this list.</p>'}${result.installUrl ? `<a class="ig-button" href="${escape(url(result.installUrl))}">Install GitHub App for an account or organization ↗</a>` : ""}${button("connect-github", "Refresh installations", "", true)}</section></div>`;
}
async function importRepositories(): Promise<void> {
  await loadAvailable(); modal("Select repositories", repoSelection());
}
async function mutate(action: () => Promise<void>, success?: string): Promise<void> {
  if (busy) return;
  busy = true;
  const controls = [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>("[data-settings-form] button,[data-repositories-form] button,[data-action=confirm-review],[data-action=reindex],[data-runtime-form] button,button[data-provider]")];
  const previous = controls.map(control => control.disabled); controls.forEach(control => { control.disabled = true; });
  try { await action(); if (success) toast(success); }
  catch (error) { handleError(error); const status = $("[data-save-status]", $<HTMLDialogElement>(".ig-dialog")?.open ? $(".ig-dialog")! : main); if (status) status.textContent = error instanceof Error ? error.message : "The change was not saved."; }
  finally { busy = false; controls.forEach((control, index) => { if (control.isConnected) control.disabled = previous[index]; }); }
}

document.addEventListener("input", event => {
  const runtimeForm = event.target instanceof Element ? event.target.closest<HTMLFormElement>("[data-runtime-form]") : null;
  if (runtimeForm && event.target instanceof Element) { runtimeConnectionChanged(runtimeForm, event.target); return; }
  if (event.target instanceof HTMLInputElement && event.target.matches("[data-code-query]")) {
    codeQuery = event.target.value; codePage = 0;
    const position = event.target.selectionStart;
    const card = event.target.closest(".ig-card");
    if (card && snapshot) card.outerHTML = renderFunctionInventory(snapshot, codeQuery);
    const field = $<HTMLInputElement>("[data-code-query]"); field?.focus(); field?.setSelectionRange(position, position);
    return;
  }
  const input = event.target; if (!(input instanceof HTMLInputElement)) return;
  if (input.matches("[data-query]")) { query = input.value; const position = input.selectionStart; render(); const replacement = $<HTMLInputElement>("[data-query]"); replacement?.focus(); replacement?.setSelectionRange(position, position); }
  if (input.name === "repositoryIds") { const id = Number(input.value); if (input.checked) selectedRepos.add(id); else selectedRepos.delete(id); }
});
document.addEventListener("change", event => {
  const runtimeForm = event.target instanceof Element ? event.target.closest<HTMLFormElement>("[data-runtime-form]") : null;
  if (runtimeForm && event.target instanceof Element) { runtimeConnectionChanged(runtimeForm, event.target); return; }
  const select = event.target; if (!(select instanceof HTMLSelectElement)) return;
  if (select.matches("[data-filter]")) { filter = select.value; render(); }
  if (select.matches("[data-workspace-picker]")) { const id = select.value; if (document.body.dataset.navOpen === "true") closeNavigation(); api.cancel(); clearTimeout(poll); snapshot = null; available = null; query = ""; filter = ""; showAllFindings = false; workspace = session?.workspaces.find(w => w.id === id) ?? null; try { sessionStorage.setItem("impact-gate-workspace", id); } catch { /* Preference only. */ } state("Loading workspace", "Fetching the selected organization’s data."); void refresh().catch(handleError); }
});
document.addEventListener("submit", event => {
  const form = event.target; if (!(form instanceof HTMLFormElement)) return;
  if (form.matches("[data-runtime-form]")) {
    event.preventDefault(); if (!form.reportValidity() || !workspace || !canWrite()) return;
    void mutate(async () => {
      if (form.dataset.runtimePhase !== "review" && !Object.keys(runtimeConnectionBody(form, true).config.serviceMappings).length) {
        await discoverRuntimeServices(form); return;
      }
      const connectionBody = runtimeConnectionBody(form);
      await api.request(`${route(workspace!.id)}/runtime/${form.dataset.provider}`, {method: "PUT", body: connectionBody});
      trackEvent("runtime_connection_saved", { provider: form.dataset.provider, service_count: Object.keys(connectionBody.config.serviceMappings).length });
      $<HTMLDialogElement>(".ig-dialog")?.close(); await refresh();
      toast("Runtime connection saved and evidence imported.");
    });
    return;
  }
  if (form.matches("[data-settings-form]")) {
    event.preventDefault(); if (!form.reportValidity() || !workspace || !snapshot || !canWrite()) return;
    const fields = new FormData(form); const body = { version: snapshot.settings.version, syncDefaultBranch: fields.has("syncDefaultBranch"), prCommentsEnabled: fields.has("prCommentsEnabled"), externalModelsEnabled: session?.capabilities.externalModels ? fields.has("externalModelsEnabled") : snapshot.settings.externalModelsEnabled, retentionDays: Number(fields.get("retentionDays")) };
    void mutate(async () => { const saved = await api.request<WorkspaceSettings>(`${route(workspace!.id)}/settings`, { method: "PATCH", body }); snapshot!.settings = saved; trackEvent("workspace_settings_saved"); render(); }, "Workspace preferences saved.");
  }
  if (form.matches("[data-repositories-form]")) {
    event.preventDefault(); if (!workspace || !canWrite()) return;
    const repositoryIds = [...new FormData(form).getAll("repositoryIds")].map(Number);
    void mutate(async () => { snapshot = await api.request<WorkspaceSnapshot>(`${route(workspace!.id)}/repositories`, { method: "PUT", body: { repositoryIds } }); trackEvent("repository_selection_saved", { repository_count: repositoryIds.length }); await loadAvailable(); $<HTMLDialogElement>(".ig-dialog")?.close(); render(); schedulePoll(); }, "Repository selection saved. Indexing jobs are queued.");
  }
});
document.addEventListener("click", event => {
  const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null; if (!trigger || trigger instanceof HTMLButtonElement && trigger.disabled) return;
  const action = trigger.dataset.action; const id = trigger.dataset.id;
  if (action === "runtime-apply-suggestions" || action === "runtime-fill-names") {
    const form = trigger.closest<HTMLFormElement>("[data-runtime-form]");
    if (!form || !canWrite() || busy) return;
    if (action === "runtime-apply-suggestions") {
      for (const select of form.querySelectorAll<HTMLSelectElement>("[data-runtime-source]"))
        if (!select.value && select.dataset.suggestedService) select.value = select.dataset.suggestedService;
    } else {
      for (const input of form.querySelectorAll<HTMLInputElement>("[data-runtime-service]"))
        if (!input.value) input.value = input.dataset.serviceName ?? "";
    }
    updateRuntimeConnectButton(form); return;
  }
  if (action === "function-page" && snapshot) {
    codePage = Math.max(0, Number(trigger.dataset.page) || 0);
    const direction = trigger.dataset.direction === "previous" ? "previous" : "next";
    const card = trigger.closest(".ig-card"); if (card) card.outerHTML = renderFunctionInventory(snapshot, codeQuery, codePage);
    const next = $<HTMLButtonElement>(`[data-action="function-page"][data-direction="${direction}"]`);
    (next?.disabled ? $<HTMLButtonElement>('[data-action="function-page"]:not(:disabled)') : next)?.focus(); return;
  }
  const runtimeProvider=trigger.dataset.provider;
  if ((runtimeProvider === "prometheus" || runtimeProvider === "datadog") && workspace && snapshot && canWrite()) {
    if (action === "runtime-connect") {modal(`Connect ${runtimeProvider === "prometheus" ? "Prometheus" : "Datadog"}`,runtimeConnectionForm(snapshot,runtimeProvider));return;}
    if (action === "runtime-discover") {
      const form = $<HTMLFormElement>("[data-runtime-form]"); if (!form || !form.reportValidity()) return;
      void mutate(() => discoverRuntimeServices(form)); return;
    }
    if (action === "runtime-test") {
      const form=$<HTMLFormElement>("[data-runtime-form]");if(!form || !form.reportValidity()) return;
      void mutate(async()=>{const result=await api.request<{observationCount:number;matchedEndpointCount:number;unmatchedObservationCount:number;warnings:string[]}>(`${route(workspace!.id)}/runtime/${runtimeProvider}/test`,{method:"POST",body:runtimeConnectionBody(form)});const status=$("[data-save-status]",form);if(status) status.textContent=`Connection reached. ${result.observationCount} source rows; ${result.matchedEndpointCount} endpoints with observed traffic; ${result.unmatchedObservationCount} unmatched rows. ${result.warnings.join(" ")}`;});return;
    }
    if (action === "runtime-sync") {void mutate(async()=>{await api.request(`${route(workspace!.id)}/runtime/${runtimeProvider}/sync`,{method:"POST"});trackEvent("runtime_sync_completed", { provider: runtimeProvider });await refresh();},"Runtime evidence refreshed.");return;}
    if (action === "runtime-disconnect") {modal("Disconnect runtime source",`<p>Remove the stored credentials and imported evidence for ${escape(runtimeProvider)} from this workspace? Reconnect the source to import its observations again.</p>${button("confirm-runtime-disconnect","Disconnect",`data-provider="${runtimeProvider}"`)}<p data-save-status role="status"></p>`);return;}
    if (action === "confirm-runtime-disconnect") {void mutate(async()=>{await api.request(`${route(workspace!.id)}/runtime/${runtimeProvider}`,{method:"DELETE"});trackEvent("runtime_connection_removed", { provider: runtimeProvider });$<HTMLDialogElement>(".ig-dialog")?.close();await refresh();},"Runtime source disconnected.");return;}
  }
  if (action === "theme") { const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = theme; syncThemeControls(); try { localStorage.setItem("impact-gate-theme", theme); } catch { /* Theme remains usable. */ } if (graph) { graph.destroy(); graph = null; mountGraph(); } return; }
  if (action === "menu") { const open = document.body.dataset.navOpen !== "true"; if (!open) { closeNavigation(); return; } overlayFocus = trigger; document.body.dataset.navOpen = "true"; trigger.setAttribute("aria-expanded", "true"); const backdrop = $(".ig-backdrop"); if (backdrop) backdrop.hidden = false; document.body.style.overflow = "hidden"; $(".ig-sidebar a")?.focus(); return; }
  if (action === "close-overlays") { closeNavigation(); return; }
  if (action === "close-dialog") { $<HTMLDialogElement>(".ig-dialog")?.close(); return; }
  if (action === "sign-out") { void mutate(async () => { trackEvent("sign_out"); clearSession(); await auth.signOut(); location.assign("/sign-in"); }); return; }
  if (action === "retry") { if (!auth) { location.reload(); return; } if (!auth.currentUser) { location.assign(signInDestination(location.pathname, location.origin)); return; } state("Loading workspace", "Fetching the latest data."); void bootstrap().catch(handleError); return; }
  if (action === "connect-github" || action === "add-workspace") { void mutate(async () => { const installation = new URL(location.href).searchParams.get("installation_id"); const result = await api.request<{ url: string }>("/api/v1/github/connect/start", { method: "POST", body: { returnTo: "/onboarding", ...(installation && /^\d+$/.test(installation) ? { installationId: Number(installation) } : {}) } }); const destination = new URL(result.url); if (destination.protocol !== "https:" || destination.hostname !== "github.com") throw new Error("The GitHub authorization URL is invalid."); trackEvent("github_connection_start", { provider: "github" }); location.assign(destination.href); }); return; }
  if (action === "finish-github" && id) { void mutate(async () => { const result = await api.request<{ workspace: WorkspaceMembership }>("/api/v1/github/connect/finish", { method: "POST", body: { flow: trigger.dataset.flow, installationId: Number(id) } }); try { sessionStorage.setItem("impact-gate-workspace", result.workspace.id); } catch { /* The new workspace remains available in the workspace picker. */ } trackEvent("github_connected", { provider: "github" }); history.replaceState(null, "", "/onboarding"); await bootstrap(); }, "GitHub account connected."); return; }
  if (action === "import") { void importRepositories().catch(handleError); return; }
  if (action === "clear-filters") { query = ""; filter = ""; render(); return; }
  if (action === "toggle-findings" && page === "home") { showAllFindings = !showAllFindings; render(); $('[data-action="toggle-findings"]')?.focus(); return; }
  if (action === "endpoint" && id) { selectedEndpoint = id; endpointTab = "overview"; render(); return; }
  if (action === "endpoint-tab") { endpointTab = trigger.dataset.tab ?? "overview"; render(); return; }
  if (action === "endpoint-dialog" && id) { const endpoint = snapshot?.endpoints.find(e => e.id === id); if (endpoint) modal(`${endpoint.method} ${endpoint.path}`, evidence([endpoint.source]) + `<p>${endpoint.staticCallerCount} static callers · ${escape(coverage(endpoint))}</p><a class="ig-button ig-button-secondary" href="/dashboard/api-usage?endpointId=${encodeURIComponent(endpoint.id)}">Inspect API and code flow</a>`); return; }
  if (action === "finding" && id) { const finding = snapshot?.findings.find(f => f.id === id); if (finding) modal(finding.endpoint, `<p>${badge(finding.risk, "risk")} ${escape(finding.verdict)}</p><p>${escape(finding.explanation)}</p><p><a href="${escape(url(finding.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">Open pull request #${finding.pullRequestNumber} ↗</a></p>${evidence(finding.evidence)}`); return; }
  if (action === "repository" && id) { const repository = snapshot?.repositories.find(r => r.id === id); if (repository) modal(repository.fullName, `<p>${badge(repository.status)} · ${escape(repository.defaultBranch)}</p><p>${repository.coverage.supportedFiles} supported files · ${repository.coverage.skippedFiles} skipped files · ${repository.coverage.openApiDocuments} OpenAPI documents</p><ul>${repository.coverage.notes.map(note => `<li>${escape(note)}</li>`).join("")}</ul>${repository.error ? `<p>${escape(repository.error)}</p>` : ""}<p class="ig-note">Indexed commit ${escape(repository.indexedSha ?? "not indexed")}</p>`); return; }
  if (action === "candidate" && id) { const candidate = snapshot?.candidates.find(c => c.endpointId === id); const endpoint = snapshot?.endpoints.find(e => e.id === id); if (candidate && endpoint) modal(`${endpoint.method} ${endpoint.path}`, `<p>${escape(candidate.reason)}</p><p>${candidate.staticCallerCount} static callers · ${escape(coverage(endpoint))}</p><p class="ig-note">Reviewing records your evidence review for this snapshot. Plan removals with your team and check unobserved consumers.</p>${evidence([endpoint.source, ...snapshot!.edges.filter(e => e.endpointId === id).flatMap(e => e.references)])}${button("confirm-review", candidate.reviewedAt && candidate.reviewedSnapshotId === snapshot?.snapshotId ? "Mark needs review" : "Mark reviewed for this snapshot", `data-id="${escape(id)}" data-reviewed="${!(candidate.reviewedAt && candidate.reviewedSnapshotId === snapshot?.snapshotId)}" ${writeDisabled()}`)}<p data-save-status role="status"></p>`); return; }
  if (action === "confirm-review" && id && canWrite()) { void mutate(async () => { snapshot = await api.request<WorkspaceSnapshot>(`${route(workspace!.id)}/candidates/${encodeURIComponent(id)}/review`, { method: "POST", body: { snapshotId: snapshot!.snapshotId, reviewed: trigger.dataset.reviewed === "true" } }); trackEvent("evidence_review_saved", { action: trigger.dataset.reviewed === "true" ? "reviewed" : "needs_review" }); $<HTMLDialogElement>(".ig-dialog")?.close(); render(); }, "Candidate review saved."); return; }
  if (action === "reindex" && id && canWrite()) { void mutate(async () => { await api.request(`${route(workspace!.id)}/repositories/${encodeURIComponent(id)}/index`, { method: "POST" }); trackEvent("repository_reindex_requested"); await refresh(); }, "Indexing job queued."); return; }
  if (action === "link-github" || action === "link-google") { void mutate(async () => { await auth.linkProvider(action === "link-github" ? "github" : "google"); session = await api.request<SessionResponse>("/api/v1/session"); render(); }, "Sign-in method connected."); return; }
  if (action === "graph-fit") { graph?.fit(undefined, 35); return; }
  if ((action === "graph-export" || action === "code-export") && snapshot) {
    const flow = action === "code-export" ? snapshot.code?.flows.find(flow => flow.endpointId === id) : null;
    const functions = flow ? snapshot.code?.functions.filter(fn => flow.functionIds.includes(fn.id)) : snapshot.code?.functions;
    const calls = flow ? snapshot.code?.calls.filter(call => flow.callIds.includes(call.id)) : snapshot.code?.calls;
    const data = action === "code-export" ? { snapshotId: snapshot.snapshotId, flow, functions, calls } : { snapshotId: snapshot.snapshotId, services: snapshot.services, endpoints: snapshot.endpoints, edges: snapshot.edges, code: snapshot.code };
    const download = document.createElement("a"); const blob = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); download.href = blob; download.download = action === "code-export" ? "impact-gate-code-flow.json" : "impact-gate-dependencies.json"; download.click(); setTimeout(() => URL.revokeObjectURL(blob), 1000); return;
  }
  if (action === "notifications") { modal("Recent jobs", snapshot?.jobs.length ? jobs() : '<p>No analysis jobs have been recorded yet.</p>'); }
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.dataset.navOpen === "true") closeNavigation();
  if (event.key !== "Tab" || document.body.dataset.navOpen !== "true") return;
  const focusable = [...document.querySelectorAll<HTMLElement>(".ig-sidebar a[href],.ig-sidebar button:not(:disabled),.ig-sidebar select:not(:disabled)")].filter(element => element.getClientRects().length > 0);
  const first = focusable[0], last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
$(".ig-dialog")?.addEventListener("close", () => {
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-runtime-form] input[type=password]")) input.value = "";
  overlayFocus?.focus(); overlayFocus = null;
});

async function start(): Promise<void> {
  syncThemeControls();
  if (location.hostname === "www.impactgate.in") { const canonical = new URL(location.href); canonical.hostname = "impactgate.in"; location.replace(canonical.href); return; }
  state("Loading your workspace", "Checking authentication configuration.");
  const response = await fetch("/api/v1/config", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Authentication is unavailable. Please try again shortly.");
  const publicConfig: unknown = await response.json(); config = publicConfig as PublicConfig;
  auth = new ImpactGateAuthClient(parseAuthConfig(publicConfig, location.origin)); api = new WorkspaceApi(auth);
  if (["sign-in", "sign-up", "email-link"].includes(page)) {
    cleanupAuthPage = mountAuthPage(main, auth, { mode: page === "sign-up" ? "sign-up" : "sign-in", onAuthenticated: async (_user, next) => { const current = await api.request<SessionResponse>("/api/v1/session"); const requested = safeReturnPath(next, location.origin); location.assign(current.workspaces.length ? requested : `/onboarding?${new URLSearchParams({ next: requested })}`); } });
    return;
  }
  auth.subscribe(current => {
    if (current.status === "signed-out") { clearSession(); location.replace(signInDestination(`${location.pathname}${location.search}`, location.origin)); }
    else if (current.status === "error") { clearSession(); state("Authentication unavailable", current.error.message, true); }
    else if (current.status === "signed-in" && current.user.uid !== loadingUid) { loadingUid = current.user.uid; clearSession(); state("Loading your workspace", "Fetching your authorized GitHub workspace."); void bootstrap().catch(handleError); }
  });
  await auth.ready;
}
window.addEventListener("pagehide", () => { disposed = true; cleanupAuthPage?.(); clearTimeout(poll); api?.cancel(); graph?.destroy(); auth?.dispose(); });
startWebsiteAnalytics();
void start().catch(error => { const info = describeAuthError(error); state("Sign-in unavailable", info.code === "auth/unknown" && error instanceof Error ? error.message : info.message, true); });

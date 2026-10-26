import {
  ImpactGateAuthClient,
  mountAuthPage,
  parseAuthConfig,
  signInDestination,
  safeReturnPath,
} from "../auth";
import { describeAuthError } from "../auth/errors";
import { WorkspaceApi, WorkspaceApiError } from "./api";
import {
  mountCodeFlow,
  renderCodeFlow,
  renderFunctionInventory,
  renderConsumerApiLinks,
} from "./code-flow";
import { emailHref } from "../ui/contact";
import { providerIcon, uiIcon } from "../ui/icons";
import {
  loadingFeedback,
  loadingIndicatorMarkup,
} from "../ui/loading-feedback";
import {
  runtimeConnectionsPanel,
  runtimeConnectionForm,
  runtimeConnectionBody,
  runtimeEndpointDetails,
  runtimeServiceReview,
  runtimeConnectionChanged,
  updateRuntimeConnectButton,
  kubernetesConnectionForm,
  artifactProvenanceForm,
  workloadLinkForm,
} from "./runtime";
import type { RuntimeServiceDiscovery } from "../types/runtime";
import type {
  InstallationRepository,
  ApiCoverageItem,
  SessionResponse,
  SourceReference,
  WorkspaceEndpoint,
  WorkspaceJob,
  WorkspaceMembership,
  WorkspaceSettings,
  WorkspaceSnapshot,
  WorkspaceOnboardingStatus,
  WorkspaceRepository,
  WorkspaceRepositoryCoverageDetails,
  ApiReviewRun,
} from "../types/workspace";
import type cytoscape from "cytoscape";
import type { MountedRepositoryGraph } from "./dependency-graph/mount";
import "./connected.css";
import "./overview.css";
import "../ui/loading-indicator.css";
import "../auth/auth.css";
import {
  identifyAnalyticsUser,
  startWebsiteAnalytics,
  trackEvent,
} from "../analytics";

interface PublicConfig {
  github: { configured: boolean; installUrl: string | null };
}
let reportedWorkspace: string | null = null;
let reportedSetup = false;
interface InstallationChoice {
  installationId: number;
  accountLogin: string;
  accountType: string;
}
const $ = <T extends HTMLElement = HTMLElement>(
  selector: string,
  scope: ParentNode = document,
): T | null => scope.querySelector<T>(selector);
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const route = (id: string) => `/api/v1/workspaces/${encodeURIComponent(id)}`;
const badge = (value: string, attribute = "status") =>
  `<span class="ig-badge" data-${attribute}="${escape(value)}">${escape(value.replaceAll("_", " "))}</span>`;
const productBadge = (label: string, tone = "mapped") =>
  `<span class="ig-product-badge" data-tone="${escape(tone)}">${escape(label)}</span>`;
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Not available";
const url = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.href
      : "#";
  } catch {
    return "#";
  }
};
const button = (action: string, label: string, extra = "", secondary = false) =>
  `<button type="button" class="ig-button${secondary ? " ig-button-secondary" : ""}" data-action="${action}" ${extra}>${action === "connect-github" || action === "link-github" ? providerIcon("github") : action === "link-google" ? providerIcon("google") : ""}${label}</button>`;
const empty = (title: string, copy: string, action = "") =>
  `<div class="ig-state"><h2>${escape(title)}</h2><p>${escape(copy)}</p>${action}</div>`;
function table(headers: string[], rows: string[][], sortable = false): string {
  return `<div class="ig-live-table-wrap"><table class="ig-live-table"><thead><tr>${headers.map((h, i) => `<th scope="col">${sortable ? `<button type="button" class="ig-sort-heading" data-action="api-sort" data-sort="${i}" aria-label="Sort by ${escape(h)}">${escape(h)}${apiSort === String(i) ? (apiSortDirection === "asc" ? " ↑" : " ↓") : ""}</button>` : escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<td data-label="${escape(headers[i])}"><div class="ig-table-cell">${cell}</div></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function evidence(references: SourceReference[]): string {
  return references.length
    ? `<ul class="ig-evidence">${references.map((ref) => `<li><a href="${escape(url(ref.url))}" target="_blank" rel="noopener noreferrer"><code>${escape(ref.filePath)}:${ref.line}</code></a>${ref.functionName ? `<p>${escape(ref.functionName)}</p>` : ""}<p class="ig-note">Commit ${escape(ref.sha.slice(0, 12))}</p></li>`).join("")}</ul>`
    : `<p class="ig-note">No source references were recorded for this finding.</p>`;
}

const main = $("#workspace-content") ?? $("#auth-root") ?? document.body;
const page = document.documentElement.dataset.page ?? "home";
let auth: ImpactGateAuthClient;
let api: WorkspaceApi;
let config: PublicConfig;
let session: SessionResponse | null = null;
let workspace: WorkspaceMembership | null = null;
let snapshot: WorkspaceSnapshot | null = null;
let activeGroupId: string | null = null;
function readGroupPreference(workspaceId: string): string | null {
  try {
    return sessionStorage.getItem(`impact-gate-group-${workspaceId}`);
  } catch {
    return null;
  }
}
function writeGroupPreference(
  workspaceId: string,
  groupId: string | null,
): void {
  try {
    if (groupId)
      sessionStorage.setItem(`impact-gate-group-${workspaceId}`, groupId);
    else sessionStorage.removeItem(`impact-gate-group-${workspaceId}`);
  } catch {
    /* Preference only. */
  }
}
let onboardingStatus: WorkspaceOnboardingStatus | null = null;
let available: InstallationRepository[] | null = null;
let selectedRepos = new Set<number>();
let repoSearchQuery = "";
let repoFilter: "all" | "selected" | "recommended" = "all";
let repoSelectionInitialized = false;
let query = "";
let filter = "";
let collectionPage = 1;
let apiServiceFilters = new Set<string>();
let apiSort = "1";
let apiSortDirection: "asc" | "desc" = "asc";
let retirementServiceFilter = "";
let retirementMethodFilter = "";
let retirementEvidenceFilter = "";
let retirementUsageFilter = "";
let retirementReviewFilter = "";
let filterRefresh: ReturnType<typeof setTimeout> | undefined;
let selectedEndpoint: string | null = new URL(location.href).searchParams.get(
  "endpointId",
);
let codeQuery = "";
let codePage = 0;
const reindexErrors = new Map<string, string>();
const initialTab = new URL(location.href).searchParams.get("tab");
let endpointTab = [
  "overview",
  "flow",
  "consumers",
  "changes",
  "retirement",
].includes(initialTab ?? "")
  ? initialTab!
  : "overview";
let graph: MountedRepositoryGraph | null = null;
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
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    target.hidden = true;
  }, 5000);
}
function state(title: string, message: string, retry = false): void {
  graph?.destroy();
  graph = null;
  codeGraph?.destroy();
  codeGraph = null;
  main.innerHTML = `<div class="ig-state" role="status"><h1>${escape(title)}</h1><p>${escape(message)}</p>${retry ? button("retry", "Try again") + `<p class="ig-state-help"><a href="${emailHref("support")}">${uiIcon("help")}Contact support</a><a href="/docs/troubleshooting">Troubleshooting guide</a></p>` : loadingIndicatorMarkup(message)}</div>`;
}
function heading(title: string, description: string, actions = ""): string {
  const displayError =
    errorMessage ||
    (["onboarding", "github-setup"].includes(page) &&
    new URL(location.href).searchParams.get("githubError") ===
      "authorization_denied"
      ? "GitHub authorization was canceled. Connect GitHub to try again."
      : "");
  return `<div class="ig-live-heading"><div><h1>${title}</h1><p>${escape(description)}</p></div><div class="ig-actions">${actions}</div></div>${displayError ? `<div class="ig-inline-error" role="alert">${escape(displayError)} ${button("retry", "Refresh", "", true)}</div>` : ""}${workspace?.role === "viewer" ? '<div class="ig-permission">You have view access. A workspace owner or admin can select repositories and change preferences.</div>' : ""}`;
}
function canWrite(): boolean {
  return workspace?.role !== "viewer" && Boolean(session?.user.emailVerified);
}
function writeDisabled(): string {
  return canWrite() ? "" : "disabled";
}
function closeNavigation(): void {
  document.body.dataset.navOpen = "false";
  $("[data-action=menu]")?.setAttribute("aria-expanded", "false");
  const backdrop = $(".ig-backdrop");
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = "";
  overlayFocus?.focus();
  overlayFocus = null;
}
function renderShell(): void {
  syncThemeControls();
  if (page === "api-usage") {
    const titleEl = $(".ig-page-title");
    if (selectedEndpoint && snapshot) {
      const ep = snapshot.endpoints.find((e) => e.id === selectedEndpoint);
      if (ep) {
        if (titleEl) titleEl.textContent = `${ep.method} ${ep.path}`;
        document.title = `${ep.method} ${ep.path} | Impact Gate`;
      }
    } else {
      if (titleEl) titleEl.textContent = "APIs";
      document.title = "APIs | Impact Gate";
    }
  }
  if (!session) return;
  const account = session.user.name ?? session.user.email ?? "Account";
  const profile = $(".ig-profile");
  if (profile)
    profile.innerHTML = `<b>${escape(
      account
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase(),
    )}</b><span>${escape(account)}</span>`;
  const label = $(".ig-demo");
  if (label) label.textContent = workspace?.name ?? "Set up workspace";
  const bottom = $(".ig-sidebar-bottom span");
  if (bottom)
    bottom.textContent = workspace
      ? `${workspace.accountLogin} · ${workspace.role}`
      : "Connect GitHub";
  const footer = $(".ig-footer span");
  if (footer)
    footer.textContent = snapshot
      ? `Updated ${date(snapshot.generatedAt)}`
      : "Authenticated workspace";
  for (const picker of document.querySelectorAll<HTMLSelectElement>(
    "[data-workspace-picker]",
  )) {
    picker.hidden = session.workspaces.length < 2;
    picker.innerHTML = session.workspaces
      .map(
        (w) =>
          `<option value="${escape(w.id)}" ${w.id === workspace?.id ? "selected" : ""}>${escape(w.name)}</option>`,
      )
      .join("");
  }
  const groups = snapshot?.groups ?? [];
  for (const picker of document.querySelectorAll<HTMLSelectElement>(
    "[data-group-picker]",
  )) {
    picker.hidden = !groups.length;
    picker.innerHTML =
      `<option value="">All repositories</option>` +
      groups
        .map(
          (group) =>
            `<option value="${escape(group.id)}" ${group.id === activeGroupId ? "selected" : ""}>${escape(group.name)} (${group.repositoryIds.length})</option>`,
        )
        .join("");
  }
  const addWorkspace = $<HTMLButtonElement>('[data-action="add-workspace"]');
  if (addWorkspace)
    addWorkspace.hidden = !config?.github.configured || !canWrite();
  const mobileSwitcher = $("[data-workspace-switcher]");
  if (mobileSwitcher) mobileSwitcher.hidden = session.workspaces.length < 2;
}
function syncThemeControls(): void {
  const dark = document.documentElement.dataset.theme === "dark";
  for (const control of document.querySelectorAll<HTMLButtonElement>(
    '[data-action="theme"]',
  )) {
    control.innerHTML = uiIcon(dark ? "sun" : "moon");
    control.setAttribute(
      "aria-label",
      `Switch to ${dark ? "light" : "dark"} theme`,
    );
    control.title = `Switch to ${dark ? "light" : "dark"} theme`;
  }
}
function jobs(): string {
  if (!snapshot?.jobs.length) return "";
  const items = snapshot.jobs.slice(0, 12);
  return `<details class="ig-card ig-jobs"><summary>Previous analysis jobs <span>${items.length}</span></summary><div class="ig-jobs-list">${items.map((job) => `<div class="ig-job"><strong>${escape(snapshot?.repositories.find((r) => r.id === job.repositoryId)?.fullName ?? job.repositoryId)}</strong>${badge(job.status)}<span class="ig-note">${escape(job.phase)} · ${escape(job.type.replaceAll("_", " "))}</span><span>${Math.round(job.progress)}%</span><progress max="100" value="${Math.max(0, Math.min(100, job.progress))}" aria-label="${escape(job.phase)}"></progress>${job.error ? `<p>${escape(job.error)}</p>` : ""}</div>`).join("")}</div></details>`;
}

function coverageBanner(s: WorkspaceSnapshot): string {
  const connected =
    s.runtimeConnections?.some(
      (connection) => connection.status === "connected",
    ) ?? false;
  const observed = s.endpoints.filter(
    (endpoint) => endpoint.runtimeCoverage === "available",
  ).length;
  return `<aside class="ig-coverage-banner" data-connected="${connected}" role="status"><div><strong>${connected ? "Runtime data is connected." : "Runtime data is not connected."}</strong><p>${connected ? `${observed} API${observed === 1 ? " has" : "s have"} current observations; ${Math.max(0, s.endpoints.length - observed)} remain runtime-unknown.` : "Static API flows are available. Request volume and inactivity remain unknown."}</p></div><a class="ig-button ig-button-secondary" href="/dashboard/settings#runtime-connections">${connected ? "Review runtime coverage" : "Connect runtime data"} →</a></aside>`;
}
function renderDemoTraffic(): string {
  return `<section class="ig-card ig-demo-traffic" data-demo-traffic aria-labelledby="demo-traffic-title"><header><div><h2 id="demo-traffic-title">Live demo traffic</h2><p class="ig-note">Real read-only requests are measured from the shared Petclinic Prometheus counter. Shared background traffic is included.</p></div><button type="button" class="ig-button ig-button-secondary" data-action="demo-traffic-refresh">Refresh traffic</button></header><p class="ig-demo-traffic-status" data-demo-traffic-status role="status">Loading observed counters…</p><div class="ig-live-table-wrap"><table class="ig-live-table"><thead><tr><th>Endpoint</th><th>Method</th><th>Observed counter</th><th>Sampled at</th></tr></thead><tbody data-demo-traffic-rows><tr><td colspan="4">Fetching the current observation window…</td></tr></tbody></table></div><p class="ig-note">No current observation is not the same as zero usage. Counters may reset when the demo service restarts.</p></section>`;
}
async function refreshDemoTraffic(container: HTMLElement): Promise<void> {
  const status = $<HTMLElement>("[data-demo-traffic-status]", container);
  const rows = $<HTMLElement>("[data-demo-traffic-rows]", container);
  const stopLoading = loadingFeedback.begin("Refreshing demo traffic…", 1);
  try {
    const response = await fetch("/sandbox/traffic", { cache: "no-store" });
    if (!response.ok)
      throw new Error("Observed traffic is temporarily unavailable.");
    const result = (await response.json()) as {
      rows?: Array<{
        path: string;
        method: string;
        count: number;
        sampleAt: string;
      }>;
      description?: string;
    };
    if (!rows) return;
    rows.innerHTML = result.rows?.length
      ? result.rows
          .map(
            (row) =>
              `<tr><td><code>${escape(row.path)}</code></td><td>${escape(row.method)}</td><td><strong>${row.count.toLocaleString()}</strong></td><td>${escape(date(row.sampleAt))}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="4">No current observation is available.</td></tr>';
    if (status)
      status.textContent = result.description ?? "Observed counters updated.";
  } catch (error) {
    if (status)
      status.textContent =
        error instanceof Error
          ? error.message
          : "Observed traffic is temporarily unavailable.";
    if (rows)
      rows.innerHTML =
        '<tr><td colspan="4">Connect to the demo service and refresh to retry.</td></tr>';
  } finally {
    stopLoading();
  }
}

function workflowCard(
  key: string,
  title: string,
  badgeLabel: string,
  badgeTone: string,
  value: string,
  unit: string,
  visual: string,
  copy: string,
  href: string,
  action: string,
): string {
  return `<a class="ig-workflow-card" data-workflow="${key.toLowerCase()}" href="${href}"><span class="ig-workflow-key">${key}</span><div class="ig-workflow-title"><h2>${title}</h2>${productBadge(badgeLabel, badgeTone)}</div><div class="ig-workflow-metric"><strong>${escape(value)}</strong><span>${escape(unit)}</span></div>${visual}<p>${escape(copy)}</p><span class="ig-workflow-link">${escape(action)} <span aria-hidden="true">→</span></span></a>`;
}
function workflowBar(
  ariaLabel: string,
  segments: Array<{ label: string; count: number; color: string }>,
  total: number,
  emptyLabel: string,
): string {
  const visible = segments.filter((segment) => segment.count > 0);
  const bar = visible
    .map(
      (segment) =>
        `<span data-segment="${escape(segment.label)}" style="width:${total ? (segment.count / total) * 100 : 0}%;--ig-workflow-segment:${segment.color}"></span>`,
    )
    .join("");
  const legend = segments
    .filter((segment) => segment.count > 0)
    .map(
      (segment) =>
        `<span><i style="--ig-workflow-segment:${segment.color}" aria-hidden="true"></i>${escape(segment.label)} <strong>${segment.count}</strong></span>`,
    )
    .join("");
  return `<div class="ig-workflow-visual"${ariaLabel ? ` role="img" aria-label="${escape(ariaLabel)}"` : ""}><div class="ig-workflow-bar" aria-hidden="true">${total ? bar : ""}</div><div class="ig-workflow-legend">${legend || `<span>${escape(emptyLabel)}</span>`}</div></div>`;
}

function evidenceState(
  candidate: WorkspaceSnapshot["candidates"][number],
  endpoint?: WorkspaceEndpoint,
): { label: string; tone: string; action: string } {
  if (
    endpoint?.runtimeCoverage === "available" &&
    endpoint.runtimeCallsInWindow === 0
  )
    return {
      label: "0 calls in observation window",
      tone: "possible",
      action: "Review observation window",
    };
  if (
    candidate.evidenceState === "measured_usage_observed" ||
    endpoint?.runtimeCoverage === "available"
  )
    return {
      label: "Measured usage observed",
      tone: "measured",
      action: "Review observation window",
    };
  if (
    candidate.evidenceState === "static_callers_found" ||
    (endpoint?.staticCallerCount ?? 0) > 0
  )
    return {
      label: "Static callers found",
      tone: "mapped",
      action: "Review static callers",
    };
  if (endpoint?.runtimeCoverage === "not_connected")
    return {
      label: "Needs runtime coverage",
      tone: "unknown",
      action: "Connect runtime data",
    };
  if (candidate.evidenceState === "no_known_caller_selected_repositories")
    return {
      label: "No known caller in selected repositories",
      tone: "unknown",
      action: "Check external consumers",
    };
  return {
    label: "Unknown external usage",
    tone: "unknown",
    action: "Check external consumers",
  };
}
function hasConfirmedMonthOfZeroCalls(
  s: WorkspaceSnapshot,
  candidate: WorkspaceSnapshot["candidates"][number],
  endpoint: WorkspaceEndpoint,
): boolean {
  const source = endpoint.runtimeRequestSource;
  const connection = source
    ? s.runtimeConnections?.find(
        (item) => item.provider === source && item.status === "connected",
      )
    : undefined;
  const windowStart = Date.parse(endpoint.runtimeWindowStart ?? "");
  const windowEnd = Date.parse(endpoint.runtimeWindowEnd ?? "");
  return (
    candidate.zeroCallsOver30Days === true &&
    endpoint.runtimeCoverage === "available" &&
    endpoint.runtimeRequestSource === "prometheus" &&
    connection?.provider === "prometheus" &&
    connection.config.windowHours >= 720 &&
    endpoint.runtimeCallsInWindow === 0 &&
    endpoint.runtimePartial === false &&
    Number.isFinite(windowStart) &&
    Number.isFinite(windowEnd) &&
    windowEnd - windowStart >= 30 * 24 * 60 * 60 * 1000
  );
}
function renderHome(): string {
  const s = snapshot!;
  const open = s.findings.filter((f) => f.status === "open");
  const details = open.map((finding) => {
    const endpoint = s.endpoints.find(
      (endpoint) => endpoint.id === finding.endpointId,
    );
    const repository = s.repositories.find(
      (repository) => repository.id === finding.repositoryId,
    );
    const service = s.services.find(
      (service) => service.id === endpoint?.serviceId,
    );
    return {
      finding,
      repository,
      name: service?.name ?? repository?.fullName ?? finding.endpoint,
    };
  });
  const findings = details
    .filter(
      ({ finding, repository, name }) =>
        (!filter || finding.risk === filter) &&
        `${name} ${repository?.fullName ?? ""} ${finding.endpoint} ${finding.consumerName} ${finding.changeKind} ${finding.explanation}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Date.parse(b.finding.createdAt) - Date.parse(a.finding.createdAt),
    );
  const overviewPage = {
    page: collectionPage,
    pageSize: 10,
    total: findings.length,
    hasNext: collectionPage * 10 < findings.length,
  };
  const visible = findings.slice(
    (collectionPage - 1) * 10,
    collectionPage * 10,
  );
  const rows = visible.map(({ finding: f, repository, name }) => [
    `<button type="button" data-action="finding" data-id="${escape(f.id)}" aria-label="Review finding for ${escape(f.endpoint)}"><strong>${escape(name)}</strong></button>${repository ? `<p class="ig-note">${escape(repository.fullName)}</p>` : ""}`,
    `<span class="ig-overview-change" title="${escape(f.endpoint)}">${escape(f.changeKind.replaceAll("_", " "))}</span>`,
    badge(f.risk, "risk"),
    '<span class="ig-overview-status">Open</span>',
    `<a class="ig-overview-pr" href="${escape(url(f.pullRequestUrl))}" target="_blank" rel="noopener noreferrer" aria-label="Open pull request ${f.pullRequestNumber} on GitHub">#${f.pullRequestNumber} ↗</a>`,
  ]);
  const start = findings.length ? (collectionPage - 1) * 10 + 1 : 0;
  const end = Math.min(findings.length, collectionPage * 10);
  const count = `Showing ${start}–${end} of ${findings.length}${query || filter ? " matching" : ""} findings`;
  const noFindings =
    query || filter
      ? empty(
          "No matching findings",
          "Try another search or clear the filters.",
          button("clear-api-filters", "Clear filters", "", true),
        )
      : empty(
          "No open findings",
          s.repositories.length
            ? "Findings appear when a pull request changes an API contract."
            : "Connect your repositories to discover services, endpoints, and API changes.",
          s.repositories.length
            ? ""
            : '<a class="ig-button" href="/dashboard/repositories?import=1">Import repositories</a>',
        );
  const flowByEndpoint = new Map(
    (s.code?.flows ?? []).map((flow) => [flow.endpointId, flow]),
  );
  const flowCounts = {
    mapped: s.endpoints.filter((endpoint) =>
      ["indexed", "partial"].includes(
        flowByEndpoint.get(endpoint.id)?.status ?? "",
      ),
    ).length,
    partial: s.endpoints.filter(
      (endpoint) => flowByEndpoint.get(endpoint.id)?.status === "partial",
    ).length,
    noEntrypoint: s.endpoints.filter(
      (endpoint) =>
        flowByEndpoint.get(endpoint.id)?.status === "entrypoint_not_found",
    ).length,
  };
  const fullyMapped = flowCounts.mapped - flowCounts.partial;
  const notIndexed = s.code
    ? Math.max(
        0,
        s.endpoints.length - flowCounts.mapped - flowCounts.noEntrypoint,
      )
    : 0;
  const mappedFlows = s.code ? flowCounts.mapped : null;
  const mappingBadgeLabel =
    mappedFlows === null
      ? "Needs indexing"
      : !s.endpoints.length
        ? "No APIs yet"
        : mappedFlows === s.endpoints.length
          ? "Fully mapped"
          : "Mapping coverage";
  const mappingBadgeTone =
    mappedFlows === null || !s.endpoints.length
      ? "unknown"
      : mappedFlows === s.endpoints.length
        ? "measured"
        : "mapped";
  const retirementCandidates = s.candidates.flatMap((candidate) => {
    const endpoint = s.endpoints.find(
      (item) => item.id === candidate.endpointId,
    );
    return endpoint && hasConfirmedMonthOfZeroCalls(s, candidate, endpoint)
      ? [{ candidate, endpoint }]
      : [];
  });
  const zeroCallReviewed = retirementCandidates.filter(
    ({ candidate }) => candidate.reviewState === "reviewed_current_snapshot",
  ).length;
  const zeroCallNeedingReview = retirementCandidates.length - zeroCallReviewed;
  const reviewVerb = zeroCallNeedingReview === 1 ? "needs" : "need";
  const pullRequests = new Set(
    open.map(
      (finding) => `${finding.repositoryId}:${finding.pullRequestNumber}`,
    ),
  ).size;
  const mappingVisual = s.code
    ? workflowBar(
        `API flow mapping: ${fullyMapped} fully mapped, ${flowCounts.partial} partially mapped, ${flowCounts.noEntrypoint} without an entry point, ${notIndexed} not indexed, out of ${s.endpoints.length} APIs`,
        [
          {
            label: "Mapped",
            count: fullyMapped,
            color: "var(--ig-chart-used)",
          },
          {
            label: "Partial",
            count: flowCounts.partial,
            color: "var(--ig-chart-medium)",
          },
          {
            label: "No entry point",
            count: flowCounts.noEntrypoint,
            color: "var(--ig-chart-high)",
          },
          {
            label: "Not indexed",
            count: notIndexed,
            color: "var(--ig-chart-unknown)",
          },
        ],
        s.endpoints.length,
        "No APIs discovered",
      )
    : workflowBar(
        "API code-flow mapping is not indexed yet",
        [],
        0,
        s.endpoints.length
          ? "Code-flow index unavailable"
          : "No APIs discovered",
      );
  const severityCounts = [
    {
      label: "High",
      count: open.filter((finding) => finding.risk === "high").length,
      color: "var(--ig-chart-high)",
    },
    {
      label: "Medium",
      count: open.filter((finding) => finding.risk === "medium").length,
      color: "var(--ig-chart-medium)",
    },
    {
      label: "Low",
      count: open.filter((finding) => finding.risk === "low").length,
      color: "var(--ig-chart-low)",
    },
    {
      label: "No risk",
      count: open.filter((finding) => finding.risk === "none").length,
      color: "var(--ig-chart-unknown)",
    },
  ];
  const reviewVisual = workflowBar(
    `Among ${retirementCandidates.length} ${retirementCandidates.length === 1 ? "API" : "APIs"} with a complete 30-day zero-call counter, ${zeroCallNeedingReview} ${reviewVerb} review and ${zeroCallReviewed} have a current-snapshot review`,
    [
      {
        label: "Needs review",
        count: zeroCallNeedingReview,
        color: "var(--ig-chart-candidate)",
      },
      {
        label: "Reviewed now",
        count: zeroCallReviewed,
        color: "var(--ig-chart-used)",
      },
    ],
    retirementCandidates.length,
    "No confirmed 30-day zero-call APIs",
  );
  const retirementBadgeLabel = zeroCallNeedingReview
    ? "Review zero-call APIs"
    : "No review queue";
  return `<div class="ig-overview">${heading("Overview", "API Change Intelligence across your connected repositories")}
    <div class="ig-summary-line"><strong>${s.repositories.length} repositories</strong><span>·</span><strong>${s.endpoints.length} APIs</strong><span>·</span><strong>${mappedFlows === null ? "Code flows not indexed" : `${mappedFlows} mapped flows`}</strong><span>·</span><strong>${open.length} open PR findings</strong></div>
    ${coverageBanner(s)}
    <section class="ig-workflow-grid" aria-label="Product workflows">
      ${workflowCard("MAP", "API Flows", mappingBadgeLabel, mappingBadgeTone, mappedFlows === null ? "—" : String(mappedFlows), mappedFlows === null ? "API code flows indexed" : `of ${s.endpoints.length} APIs mapped`, mappingVisual, "See how each API reaches its implementation.", "/dashboard/api-usage", "View API flows")}
      ${workflowCard("GUARD", "PR Impact", severityCounts[0].count ? "High risk" : open.length ? "Open findings" : "Clear", severityCounts[0].count ? "possible" : open.length ? "mapped" : "measured", String(open.length), `open findings · ${pullRequests} PR${pullRequests === 1 ? "" : "s"}`, workflowBar(`Open PR findings by severity: ${severityCounts.map((segment) => `${segment.count} ${segment.label.toLowerCase()}`).join(", ")}`, severityCounts, open.length, "No open findings"), "Prioritize the changes most likely to break consumers.", "/dashboard/pr-impact", "Review PR impact")}
      ${workflowCard("RETIRE", "Retirement Radar", retirementBadgeLabel, zeroCallNeedingReview ? "possible" : "unknown", String(retirementCandidates.length), "APIs · 0 calls over 30 days", reviewVisual, "Only complete, connected Prometheus counters qualify. Other candidates stay in the full evidence inventory.", "/dashboard/deprecation-candidates", "View all candidates")}
    </section>
    <section class="ig-card ig-overview-findings" id="recent-findings" tabindex="-1" aria-labelledby="recent-findings-title">
      <header class="ig-overview-findings-header"><div class="ig-overview-findings-title"><h2 id="recent-findings-title">Recent PR Impact</h2><span class="ig-overview-findings-count">${count}</span></div><a class="ig-overview-all" href="/dashboard/pr-impact">View PR Impact →</a></header>
      ${
        open.length
          ? filters("Search findings, services, and endpoints", [
              ["high", "High severity"],
              ["medium", "Medium severity"],
              ["low", "Low severity"],
              ["none", "No risk"],
            ])
          : ""
      }
      <div id="overview-findings-table">${rows.length ? table(["Service / Repository", "Change", "Severity", "Status", "GitHub PR"], rows) : noFindings}</div>
      ${paginationControls(overviewPage, "pr")}
    </section>
    <section class="ig-card ig-evidence-legend"><div><h2>Evidence states</h2><p class="ig-note">Measured usage, mapped code, possible relationships, and unknown coverage remain distinct.</p></div><div class="ig-evidence-state-list">${productBadge("MEASURED", "measured")}<span>Runtime telemetry shows API request counts and observed function calls attributed to each API.</span>${productBadge("MAPPED", "mapped")}<span>Static analysis plus refinement maps possible function flows.</span>${productBadge("POSSIBLE", "possible")}<span>The relationship is plausible but not fully proven.</span>${productBadge("UNKNOWN", "unknown")}<span>Coverage, dynamic behavior, or telemetry is incomplete.</span></div></section>
  </div>`;
}
function filters(
  placeholder: string,
  options: Array<[string, string]>,
  selectedValue = filter,
): string {
  return `<div class="ig-filters"><input data-query aria-label="${escape(placeholder)}" placeholder="${escape(placeholder)}" value="${escape(query)}"><select data-filter aria-label="Filter records"><option value="">All</option>${options.map(([value, label]) => `<option value="${escape(value)}" ${selectedValue === value ? "selected" : ""}>${escape(label)}</option>`).join("")}</select>${button("clear-filters", "Clear", "", true)}</div>`;
}
function coverage(endpoint: WorkspaceEndpoint): string {
  return endpoint.runtimeCoverage === "available"
    ? endpoint.runtimeCallsInWindow != null
      ? `${endpoint.runtimeCallsInWindow.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${endpoint.runtimeRequestSource === "datadog" ? "indexed spans" : "estimated requests"}`
      : "Traffic observed"
    : endpoint.runtimeCoverage === "not_connected"
      ? "Runtime not connected"
      : "No current observations";
}
function renderEndpointDetailScreen(endpoint: WorkspaceEndpoint): string {
  const s = snapshot!;
  const service = s.services.find((svc) => svc.id === endpoint.serviceId);
  const edges = s.edges.filter((edge) => edge.endpointId === endpoint.id);
  const findings = s.findings.filter((f) => f.endpointId === endpoint.id);
  const candidate = s.candidates.find(
    (item) => item.endpointId === endpoint.id,
  );
  const state = candidate
    ? hasConfirmedMonthOfZeroCalls(s, candidate, endpoint)
      ? {
          label: "0 calls in 30 days",
          tone: "possible",
          action: "Review zero-call evidence",
        }
      : evidenceState(candidate, endpoint)
    : { label: "Needs review", tone: "unknown", action: "Review evidence" };
  let content: string;
  if (endpointTab === "consumers")
    content = edges.length
      ? table(
          [
            "Consumer",
            "Evidence",
            "Confidence",
            "Runtime correlation",
            "Source evidence",
          ],
          edges.map((edge) => [
            `${escape(s.services.find((svc) => svc.id === edge.callerServiceId)?.name ?? edge.callerServiceId)}${
              s.code?.flows.find((flow) => flow.endpointId === endpoint.id)
                ?.inboundCalls
                ? renderConsumerApiLinks(s, [
                    ...new Set(
                      s.code.flows
                        .find((flow) => flow.endpointId === endpoint.id)!
                        .inboundCalls!.filter(
                          (call) =>
                            call.callerServiceId === edge.callerServiceId,
                        )
                        .flatMap((call) => call.consumerEndpointIds ?? []),
                    ),
                  ])
                : ""
            }`,
            badge(edge.evidence),
            badge(edge.confidence),
            edge.runtimeCorrelation === "service_route"
              ? "Aggregate service/route; not proof of this call site"
              : edge.evidence === "static"
                ? "No runtime observation"
                : "Not recorded",
            evidence(edge.references),
          ]),
        )
      : empty(
          "No known callers",
          "Static analysis has not identified a caller for this endpoint. This does not prove it is unused.",
        );
  else if (endpointTab === "flow") content = renderCodeFlow(s, endpoint);
  else if (endpointTab === "changes")
    content = findings.length
      ? findings
          .map(
            (f) =>
              `<div class="ig-card"><strong>${escape(f.changeKind)} · ${escape(f.verdict)}</strong><p>${escape(f.explanation)}</p><a href="${escape(url(f.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">PR #${f.pullRequestNumber} ↗</a>${evidence(f.evidence)}</div>`,
          )
          .join("")
      : '<p class="ig-note">No analyzed contract changes have been recorded for this endpoint.</p>';
  else if (endpointTab === "retirement") {
    const retirementState =
      candidate && hasConfirmedMonthOfZeroCalls(s, candidate, endpoint)
        ? {
            label: "0 calls in 30 days",
            tone: "possible",
            action: "Review zero-call evidence",
          }
        : state;
    content = `<div class="ig-retirement-callout">${productBadge(retirementState.label, retirementState.tone)}<strong>${escape(retirementState.action)}</strong><p>Missing runtime evidence is not proof of zero usage. Review static callers, observation windows, API request counts, attributed function calls, and unknown external consumers together.</p></div>${
      candidate
        ? table(
            ["Evidence", "Value"],
            [
              ["Static callers", String(candidate.staticCallerCount)],
              ["Runtime status", coverage(endpoint)],
              [
                "Observed function calls",
                endpoint.measuredFunctionEntriesInWindow == null
                  ? "Unknown — runtime data not connected"
                  : endpoint.measuredFunctionEntriesInWindow.toLocaleString(),
              ],
              [
                "Review state",
                candidate.reviewState?.replaceAll("_", " ") ?? "Not reviewed",
              ],
              ["Snapshot", s.snapshotId ?? "Not available"],
            ],
          )
        : empty(
            "No retirement record",
            "This endpoint has not entered the retirement evidence inventory.",
          )
    }`;
  } else
    content = `<div class="ig-detail-grid"><dl><dt>Service</dt><dd>${escape(service?.name ?? "Unknown")}</dd><dt>API definition</dt><dd>${escape(endpoint.definitionSource === "both" ? "Contract and implemented route" : endpoint.definitionSource === "code" ? "Implemented route; no contract schema" : endpoint.definitionSource === "contract" ? "OpenAPI contract" : "Definition source not recorded; reindex")}</dd><dt>Static callers</dt><dd>${endpoint.staticCallerCount}</dd><dt>API requests</dt><dd>${coverage(endpoint)}</dd><dt>Observed function calls</dt><dd>${endpoint.measuredFunctionEntriesInWindow == null ? "Unknown" : endpoint.measuredFunctionEntriesInWindow.toLocaleString()}</dd><dt>Release / source SHA</dt><dd>${escape(endpoint.releaseId ?? endpoint.source.sha.slice(0, 12))}</dd><dt>Criticality / confidence</dt><dd>${escape(endpoint.criticality)} / ${escape(endpoint.confidence ?? "not established")}</dd></dl><div>${evidence([endpoint.source, ...(endpoint.implementationSources ?? [])])}</div></div><h3>Runtime observation</h3>${runtimeEndpointDetails(endpoint)}${endpoint.requestSchema ? `<h3>Request schema</h3><pre class="ig-schema">${escape(JSON.stringify(endpoint.requestSchema, null, 2))}</pre>` : ""}${endpoint.responseSchema ? `<h3>Response schema</h3><pre class="ig-schema">${escape(JSON.stringify(endpoint.responseSchema, null, 2))}</pre>` : ""}`;

  const backButton = `<button type="button" class="ig-button ig-button-secondary ig-screen-back-btn" data-action="back-to-apis" aria-label="Back to APIs list"><svg class="ig-ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>Back to APIs</span></button>`;
  const tabButtons = ["overview", "flow", "consumers", "changes", "retirement"]
    .map((tab) =>
      button(
        "endpoint-tab",
        tab[0].toUpperCase() + tab.slice(1),
        `data-tab="${tab}" role="tab" aria-selected="${endpointTab === tab}" aria-pressed="${endpointTab === tab}"`,
        endpointTab !== tab,
      ),
    )
    .join("");

  return `<div class="ig-screen-detail-view" data-endpoint-detail-screen tabindex="-1">
    <div class="ig-detail-toolbar">
      <div class="ig-detail-breadcrumb">
        <button type="button" class="ig-breadcrumb-btn" data-action="back-to-apis">← Back to APIs</button>
        <span class="ig-breadcrumb-sep" aria-hidden="true">/</span>
        <span class="ig-breadcrumb-current"><code><span class="ig-method-badge ig-method-${endpoint.method.toLowerCase()}">${escape(endpoint.method)}</span> ${escape(endpoint.path)}</code></span>
      </div>
      <div class="ig-actions">
        ${backButton}
      </div>
    </div>
    <section class="ig-card ig-detail-hero">
      <div class="ig-live-heading ig-detail-header">
        <div class="ig-endpoint-info">
          <div class="ig-endpoint-title">
            <span class="ig-method-badge ig-method-${endpoint.method.toLowerCase()}">${escape(endpoint.method)}</span>
            <h2><code>${escape(endpoint.path)}</code></h2>
          </div>
          <p class="ig-endpoint-summary">${escape(endpoint.summary ?? "API operation")}</p>
        </div>
        <div class="ig-actions ig-detail-tablist" role="tablist" aria-label="API detail tabs">
          ${tabButtons}
        </div>
      </div>
      <div class="ig-endpoint-meta-tags">
        <span class="ig-meta-tag"><strong>Service:</strong> ${escape(service?.name ?? "Unknown")}</span>
        <span class="ig-meta-tag"><strong>Static callers:</strong> ${endpoint.staticCallerCount}</span>
        <span class="ig-meta-tag"><strong>Runtime traffic:</strong> ${escape(coverage(endpoint))}</span>
        <span class="ig-meta-tag"><strong>Attributed function calls:</strong> ${endpoint.measuredFunctionEntriesInWindow == null ? "Unknown" : endpoint.measuredFunctionEntriesInWindow.toLocaleString()}</span>
        <span class="ig-meta-tag"><strong>Release / SHA:</strong> ${escape(endpoint.releaseId ?? endpoint.source.sha.slice(0, 12))}</span>
        <span class="ig-meta-tag"><strong>Retirement:</strong> ${productBadge(state.label, state.tone)}</span>
      </div>
    </section>
    <section class="ig-card ig-detail-body">
      ${content}
    </section>
  </div>`;
}

function renderEndpoints(): string {
  const s = snapshot!;
  const selected = selectedEndpoint
    ? s.endpoints.find((e) => e.id === selectedEndpoint)
    : null;
  if (selected) {
    return renderEndpointDetailScreen(selected);
  }
  if (selectedEndpoint) {
    selectedEndpoint = null;
  }
  const serviceNames = new Map(
    s.services.map((service) => [service.id, service.name]),
  );
  const servicesByRepository = s.repositories
    .map((repository) => ({
      repository,
      services: s.services.filter(
        (service) => service.repositoryId === repository.id,
      ),
    }))
    .filter((group) => group.services.length > 0);
  const allEndpoints = s.pagination?.endpoints
    ? s.endpoints
    : s.endpoints.filter(
        (e) =>
          `${e.method} ${e.path} ${serviceNames.get(e.serviceId) ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!apiServiceFilters.size || apiServiceFilters.has(e.serviceId)),
      );
  const endpoints = s.pagination?.endpoints
    ? allEndpoints
    : allEndpoints.slice((collectionPage - 1) * 50, collectionPage * 50);
  const values = (e: WorkspaceEndpoint): Array<string | number> => {
    const candidate = s.candidates.find((item) => item.endpointId === e.id);
    const implementation =
      e.implementationSources?.[0] ??
      (e.definitionSource === "code" ? e.source : null);
    return [
      e.method + " " + e.path,
      serviceNames.get(e.serviceId) ?? "",
      endpointRouteType(e).label,
      implementation?.functionName ?? "",
      e.staticCallerCount,
      e.runtimeCallsInWindow ?? -1,
      e.measuredFunctionEntriesInWindow ?? -1,
      s.findings.filter((f) => f.endpointId === e.id && f.status === "open")
        .length,
      candidate ? evidenceState(candidate, e).label : "Needs review",
    ];
  };
  endpoints.sort((a, b) => {
    const left = values(a)[Number(apiSort)] ?? "";
    const right = values(b)[Number(apiSort)] ?? "";
    const comparison =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return comparison * (apiSortDirection === "asc" ? 1 : -1);
  });
  const noResults =
    query || apiServiceFilters.size
      ? empty(
          "No matching endpoints",
          "Try another search or clear the filters.",
          button("clear-filters", "Clear filters", "", true),
        )
      : s.repositories.length
        ? empty(
            "No endpoints discovered yet",
            "Check repository indexing and OpenAPI coverage. Consumer repositories can still contribute caller evidence.",
            '<a class="ig-button ig-button-secondary" href="/dashboard/repositories">Check repository coverage</a>',
          )
        : empty(
            "Connect repositories to discover APIs",
            "Choose an API repository and the applications that call it to build your first impact view.",
            '<a class="ig-button" href="/onboarding">Connect repositories</a>',
          );

  const apiRows = endpoints.map((e) => {
    const candidate = s.candidates.find((item) => item.endpointId === e.id);
    const state = candidate
      ? evidenceState(candidate, e)
      : { label: "Needs review", tone: "unknown" };
    const routeType = endpointRouteType(e);
    const implementation =
      e.implementationSources?.[0] ??
      (e.definitionSource === "code" ? e.source : null);
    return [
      `<button type="button" class="ig-endpoint-btn" data-action="endpoint" data-id="${escape(e.id)}"><code><span class="ig-method-badge ig-method-${e.method.toLowerCase()}">${escape(e.method)}</span> ${escape(e.path)}</code></button>`,
      escape(serviceNames.get(e.serviceId) ?? "Unknown service"),
      `${productBadge(routeType.label, routeType.tone)}<p class="ig-note">${escape(routeType.reason)}</p>`,
      implementation
        ? `<button type="button" class="ig-endpoint-btn" data-action="endpoint" data-id="${escape(e.id)}" data-tab="flow"><strong>${escape(implementation.functionName ?? "Open code flow")}</strong></button><p class="ig-note">${escape(implementation.filePath)}:${implementation.line}</p>`
        : `<span class="ig-note">${e.definitionSource === "contract" ? "No implementation matched" : "Handler not mapped"}</span>`,
      String(e.staticCallerCount),
      escape(coverage(e)),
      e.measuredFunctionEntriesInWindow == null
        ? productBadge("Unknown", "unknown")
        : productBadge(
            e.measuredFunctionEntriesInWindow.toLocaleString(),
            "measured",
          ),
      String(
        s.findings.filter((f) => f.endpointId === e.id && f.status === "open")
          .length,
      ),
      productBadge(state.label, state.tone),
    ];
  });
  const page = s.pagination?.endpoints ?? {
    page: collectionPage,
    pageSize: 50,
    total: allEndpoints.length,
    hasNext: collectionPage * 50 < allEndpoints.length,
  };
  return (
    heading(
      "APIs",
      "Explore APIs, filter by module, and sort evidence from the column headings.",
    ) +
    `<section class="ig-card ig-apis-catalog-screen"><div class="ig-api-toolbar"><input data-query aria-label="Search APIs and services" placeholder="Search APIs and services" value="${escape(query)}"><details class="ig-api-module-filter" ${apiServiceFilters.size ? "open" : ""}><summary>Modules${apiServiceFilters.size ? ` (${apiServiceFilters.size})` : ""}</summary><div class="ig-api-module-menu"><label><input type="checkbox" data-api-service-all ${apiServiceFilters.size === 0 ? "checked" : ""}> All modules</label>${servicesByRepository.map(({ repository, services }) => `<details class="ig-api-repository-group" ${services.some((service) => apiServiceFilters.has(service.id)) ? "open" : ""}><summary><span>${escape(repository.fullName)}</span><small>${services.length} module${services.length === 1 ? "" : "s"}</small></summary>${services.map((service) => `<label><input type="checkbox" data-api-service="${escape(service.id)}" ${apiServiceFilters.has(service.id) ? "checked" : ""}> ${escape(service.name)}</label>`).join("")}</details>`).join("")}</div></details>${button("clear-api-filters", "Clear", "", true)}</div>${endpoints.length ? table(["Method / path", "Service", "Route type", "Handler / flow", "Static callers", "API requests", "Attributed function calls", "Open findings", "Retirement state"], apiRows, true) : noResults}<p class="ig-note">Route type is inferred from source and route metadata. It does not confirm deployment or current usage.</p>${paginationControls(page, "api")}</section>`
  );
}

function endpointRouteType(endpoint: WorkspaceEndpoint): {
  label: string;
  tone: "mapped" | "possible" | "unknown";
  reason: string;
} {
  const file = (
    endpoint.implementationSources?.[0]?.filePath ?? endpoint.source.filePath
  )
    .replaceAll("\\", "/")
    .toLowerCase();
  const route = endpoint.path.toLowerCase();
  if (
    /(^|\/)(?:scripts\/)?ui(?:\.[^/]+)?$/.test(file) ||
    /(^|\/)(?:frontend|ui|demo)(\/|[-_.])/.test(file)
  )
    return {
      label: "UI / demo",
      tone: "possible",
      reason: "Route is defined in a UI or demo source file.",
    };
  if (
    /^\/(?:api\/)?(?:healthz|readyz|health|livez|metrics)(?:\/|$)/.test(route)
  )
    return {
      label: "System",
      tone: "unknown",
      reason: "Health or operational route.",
    };
  if (/^\/webhooks?(?:\/|$)/.test(route))
    return {
      label: "Webhook",
      tone: "unknown",
      reason: "Inbound integration route.",
    };
  return {
    label: "API route",
    tone: "mapped",
    reason: "Application route; inspect the handler flow for behavior.",
  };
}
function renderCandidatesLegacy(): string {
  const s = snapshot!;
  const candidates = s.candidates.filter((c) => {
    const endpoint = s.endpoints.find((e) => e.id === c.endpointId);
    return (
      `${endpoint?.method} ${endpoint?.path} ${c.reason} ${c.evidenceState ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || (c.evidenceState ?? c.status) === filter)
    );
  });
  const noResults =
    query || filter
      ? empty(
          "No matching candidates",
          "Try another search or clear the filters.",
          button("clear-filters", "Clear filters", "", true),
        )
      : empty(
          "No retirement records to review yet",
          "This is not evidence that an API is unused. Index provider and consumer repositories, and connect runtime data if available, to build review evidence.",
          '<a class="ig-button ig-button-secondary" href="/dashboard/api-usage">Explore APIs</a> <a class="ig-button ig-button-secondary" href="/dashboard/repositories">Check repository coverage</a>',
        );
  return (
    heading(
      "Retirement Radar",
      "Review APIs using evidence before planning removal. Unknown or missing telemetry is never treated as zero usage.",
    ) +
    `<section class="ig-card"><div class="ig-retirement-intro"><div><h2>Full evidence inventory <span class="ig-overview-findings-count">${candidates.length} of ${s.candidates.length} candidates</span></h2><p class="ig-note">All candidates remain listed, including active usage, missing telemetry, and incomplete windows. Only complete Prometheus counters with 0 calls across 30 days are highlighted on Overview. Datadog spans may be sampled, so missing spans remain unknown.</p></div><a class="ig-button ig-button-secondary" href="/dashboard/settings#runtime-connections">Review telemetry connection</a></div>${filters(
      "Search APIs and evidence",
      [
        ["needs_runtime_coverage", "Needs runtime coverage"],
        ["static_callers_found", "Static callers found"],
        ["measured_usage_observed", "Measured usage observed"],
        [
          "no_known_caller_selected_repositories",
          "No known caller in selected repositories",
        ],
        ["unknown_external_usage", "Unknown external usage"],
      ],
    )}${
      candidates.length
        ? table(
            [
              "API / target",
              "Evidence state",
              "Static callers",
              "Runtime status",
              "Measured function usage",
              "Review state",
              "Next action",
            ],
            candidates.map((c) => {
              const e = s.endpoints.find(
                (endpoint) => endpoint.id === c.endpointId,
              );
              const state =
                e && hasConfirmedMonthOfZeroCalls(s, c, e)
                  ? {
                      label: "0 calls in 30 days",
                      tone: "possible",
                      action: "Review zero-call evidence",
                    }
                  : evidenceState(c, e);
              return [
                `<button data-action="endpoint" data-id="${escape(c.endpointId)}"><code>${escape(e?.method)} ${escape(e?.path ?? c.endpointId)}</code></button><p class="ig-note">${escape(c.reason)}</p>`,
                productBadge(state.label, state.tone),
                String(c.staticCallerCount),
                escape(e ? coverage(e) : c.runtimeCoverage),
                e?.measuredFunctionEntriesInWindow == null
                  ? productBadge("Unknown", "unknown")
                  : productBadge(
                      e.measuredFunctionEntriesInWindow.toLocaleString(),
                      "measured",
                    ),
                c.reviewState === "reviewed_current_snapshot"
                  ? "Reviewed for this snapshot"
                  : c.reviewState === "reviewed_previous_snapshot"
                    ? "Reviewed previous snapshot"
                    : "Not reviewed",
                button(
                  "candidate",
                  state.action,
                  `data-id="${escape(c.endpointId)}"`,
                  true,
                ),
              ];
            }),
          )
        : noResults
    }</section>`
  );
}

function renderPRImpactContentLegacy(): string {
  const s = snapshot!;
  const findings = s.findings.filter(
    (finding) =>
      (!filter || finding.risk === filter) &&
      `${finding.endpoint} ${finding.consumerName} ${finding.changeKind} ${finding.explanation}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const prs = new Map<string, typeof findings>();
  for (const finding of findings) {
    const key = `${finding.repositoryId}:${finding.pullRequestNumber}`;
    prs.set(key, [...(prs.get(key) ?? []), finding]);
  }
  const noResults =
    query || filter
      ? empty(
          "No matching PR impact",
          "Try another search or clear the filters.",
          button("clear-filters", "Clear filters", "", true),
        )
      : empty(
          "No eligible PR analyses yet",
          "Impact Gate reviews eligible API-change pull requests in selected repositories. Connect repositories and open a supported contract change to create the first analysis.",
          '<a class="ig-button" href="/dashboard/repositories">Review repositories</a>',
        );
  return (
    heading(
      "PR Impact",
      "Review downstream break risk before an eligible API-change pull request merges.",
      '<span class="ig-warn-only">Warn-only · human merge decisions remain in control</span>',
    ) +
    `<section class="ig-card ig-pr-impact"><div class="ig-pr-summary"><div><strong>${prs.size}</strong><span>pull requests with analyses</span></div><div><strong>${findings.length}</strong><span>open findings in scope</span></div><div><strong>${new Set(findings.flatMap((finding) => finding.evidence.map((ref) => ref.repositoryId))).size}</strong><span>repositories with source evidence</span></div></div>${filters(
      "Search PRs, consumers, and API changes",
      [
        ["high", "High severity"],
        ["medium", "Medium severity"],
        ["low", "Low severity"],
        ["none", "No risk"],
      ],
    )}${
      prs.size
        ? [...prs.values()]
            .map((rows) => {
              const first = rows[0]!;
              const repository = s.repositories.find(
                (repo) => repo.id === first.repositoryId,
              );
              return `<article class="ig-pr-card"><header><div><a href="${escape(url(first.pullRequestUrl))}" target="_blank" rel="noopener noreferrer"><strong>${escape(repository?.fullName ?? first.repositoryId)} #${first.pullRequestNumber} ↗</strong></a><p class="ig-note">Head SHA ${escape(first.headSha.slice(0, 12))} · ${rows.length} finding${rows.length === 1 ? "" : "s"}</p></div>${productBadge(first.risk === "high" ? "Needs attention" : "Review evidence", first.risk === "high" ? "unknown" : "possible")}</header>${table(
                ["Changed API", "Consumer", "Finding", "Evidence"],
                rows.map((finding) => [
                  `<code>${escape(finding.endpoint)}</code><p class="ig-note">${escape(finding.changeKind.replaceAll("_", " "))}</p>`,
                  `${escape(finding.consumerName)}${renderConsumerApiLinks(s, finding.consumerEndpointIds)}`,
                  `${badge(finding.risk, "risk")}<p>${escape(finding.explanation)}</p>`,
                  evidence(finding.evidence),
                ]),
              )}<footer><span>Coverage gaps remain visible; unresolved or unindexed consumers may be unknown.</span><a href="${escape(url(first.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">Open GitHub report ↗</a></footer></article>`;
            })
            .join("")
        : noResults
    }</section>`
  );
}
function renderPRImpactLegacy(): string {
  return (
    `<p class="ig-note">Learn how to interpret this view in the <a href="/docs/pull-request-reports">pull request report guide</a> or review the <a href="/docs/detect-breaking-api-changes-in-pull-requests">breaking-change checklist</a>.</p>` +
    renderPRImpactContentLegacy()
  );
}

function paginationControls(
  page: { page: number; pageSize: number; total: number; hasNext: boolean },
  collection: "api" | "pr" | "retirement",
): string {
  const start = page.total ? (page.page - 1) * page.pageSize + 1 : 0;
  const end = Math.min(page.total, page.page * page.pageSize);
  return `<div class="ig-pagination" role="navigation" aria-label="${collection} pagination"><span>Showing ${start}–${end} of ${page.total}</span><button type="button" class="ig-button ig-button-secondary" data-action="collection-page" data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>Previous</button><button type="button" class="ig-button ig-button-secondary" data-action="collection-page" data-page="${page.page + 1}" ${page.hasNext ? "" : "disabled"}>Next</button></div>`;
}

function renderCandidates(): string {
  const s = snapshot!;
  const page = s.pagination?.candidates ?? {
    page: collectionPage,
    pageSize: 10,
    total: s.candidates.length,
    hasNext: collectionPage * 10 < s.candidates.length,
  };
  const candidates = s.candidates;
  const serviceOptions = s.services.map(
    (service) => [service.id, service.name] as [string, string],
  );
  const methodOptions = [
    ...new Set(s.endpoints.map((endpoint) => endpoint.method.toUpperCase())),
  ]
    .sort()
    .map((method) => [method, method]);
  const rows = candidates.map((candidate) => {
    const endpoint = s.endpoints.find(
      (item) => item.id === candidate.endpointId,
    );
    const state =
      endpoint && hasConfirmedMonthOfZeroCalls(s, candidate, endpoint)
        ? {
            label: "0 calls in 30 days",
            tone: "possible",
            action: "Review zero-call evidence",
          }
        : evidenceState(candidate, endpoint);
    return [
      `<button type="button" data-action="candidate" data-id="${escape(candidate.endpointId)}"><code>${escape(endpoint?.method)} ${escape(endpoint?.path ?? candidate.endpointId)}</code></button><p class="ig-note">${escape(candidate.reason)}</p>`,
      productBadge(state.label, state.tone),
      String(candidate.staticCallerCount),
      escape(endpoint ? coverage(endpoint) : candidate.runtimeCoverage),
      endpoint?.measuredFunctionEntriesInWindow == null
        ? productBadge("Unknown", "unknown")
        : productBadge(
            endpoint.measuredFunctionEntriesInWindow.toLocaleString(),
            "measured",
          ),
      candidate.reviewState?.replaceAll("_", " ") ?? "Not reviewed",
      escape(state.action),
    ];
  });
  const noResults = page.total
    ? empty(
        "No candidates match",
        "Try another filter or clear the filters.",
        button("clear-filters", "Clear filters", "", true),
      )
    : empty(
        "No retirement records to review yet",
        "Index provider and consumer repositories, and connect runtime data if available, to build review evidence.",
        '<a class="ig-button ig-button-secondary" href="/dashboard/api-usage">Explore APIs</a>',
      );
  return (
    heading(
      "Retirement Radar",
      "Review APIs using evidence before planning removal. Connected telemetry is shown first; APIs without current runtime coverage stay visible below.",
    ) +
    `<section class="ig-card"><div class="ig-retirement-intro"><div><h2>Full evidence inventory <span class="ig-overview-findings-count">${page.total} candidates</span></h2><p class="ig-note">All candidates remain listed. Filter by service, usage, method, evidence, and review state. No runtime data is treated as proof of zero usage.</p></div><a class="ig-button ig-button-secondary" href="/dashboard/settings#runtime-connections">Review telemetry connection</a></div><div class="ig-filters"><input data-query aria-label="Search APIs and evidence" placeholder="Search APIs and evidence" value="${escape(query)}"><select data-retirement-service aria-label="Filter by service"><option value="">All services</option>${serviceOptions.map(([value, label]) => `<option value="${escape(value)}" ${retirementServiceFilter === value ? "selected" : ""}>${escape(label)}</option>`).join("")}</select><select data-retirement-usage aria-label="Filter by usage"><option value="">All usage</option><option value="connected" ${retirementUsageFilter === "connected" ? "selected" : ""}>Connected</option><option value="not_connected" ${retirementUsageFilter === "not_connected" ? "selected" : ""}>Not connected</option></select><select data-retirement-method aria-label="Filter by method"><option value="">All methods</option>${methodOptions.map(([value, label]) => `<option value="${escape(value)}" ${retirementMethodFilter === value ? "selected" : ""}>${escape(label)}</option>`).join("")}</select><select data-retirement-evidence aria-label="Filter by evidence"><option value="">All evidence</option>${["needs_runtime_coverage", "static_callers_found", "measured_usage_observed", "no_known_caller_selected_repositories", "unknown_external_usage"].map((value) => `<option value="${value}" ${retirementEvidenceFilter === value ? "selected" : ""}>${escape(value.replaceAll("_", " "))}</option>`).join("")}</select><select data-retirement-review aria-label="Filter by review state"><option value="">All review states</option>${["not_reviewed", "reviewed_current_snapshot", "reviewed_previous_snapshot"].map((value) => `<option value="${value}" ${retirementReviewFilter === value ? "selected" : ""}>${escape(value.replaceAll("_", " "))}</option>`).join("")}</select>${button("clear-filters", "Clear", "", true)}</div>${rows.length ? table(["API / target", "Evidence state", "Static callers", "Runtime status", "Measured function usage", "Review state", "Next action"], rows) : noResults}${paginationControls(page, "retirement")}</section>`
  );
}

function renderPRImpactContent(): string {
  const s = snapshot!;
  const page = s.pagination?.findings ?? {
    page: collectionPage,
    pageSize: 10,
    total: s.findings.length,
    hasNext: collectionPage * 10 < s.findings.length,
  };
  const findings = s.findings.filter((finding) => finding.status === "open");
  const prs = new Map<string, typeof findings>();
  for (const finding of findings) {
    const key = `${finding.repositoryId}:${finding.pullRequestNumber}`;
    prs.set(key, [...(prs.get(key) ?? []), finding]);
  }
  const noResults = page.total
    ? empty(
        "No matching PR impact",
        "Try another search or clear the filters.",
        button("clear-filters", "Clear filters", "", true),
      )
    : empty(
        "No eligible PR analyses yet",
        "Impact Gate reviews eligible API-change pull requests in selected repositories.",
        '<a class="ig-button" href="/dashboard/repositories">Review repositories</a>',
      );
  return (
    heading(
      "PR Impact",
      "Review downstream break risk before an eligible API-change pull request merges. Your current selection stays open while background indexing runs.",
      '<span class="ig-warn-only">Warn-only · human merge decisions remain in control</span>',
    ) +
    `<section class="ig-card ig-pr-impact"><div class="ig-pr-summary"><div><strong>${prs.size}</strong><span>pull requests with analyses</span></div><div><strong>${findings.length}</strong><span>open findings in scope</span></div><div><strong>${new Set(findings.flatMap((finding) => finding.evidence.map((ref) => ref.repositoryId))).size}</strong><span>repositories with source evidence</span></div></div>${filters(
      "Search PRs, consumers, APIs, or #PR number",
      [
        ["high", "High severity"],
        ["medium", "Medium severity"],
        ["low", "Low severity"],
        ["none", "No risk"],
      ],
    )}${
      prs.size
        ? [...prs.values()]
            .map((rows) => {
              const first = rows[0]!;
              const repository = s.repositories.find(
                (repo) => repo.id === first.repositoryId,
              );
              return `<article class="ig-pr-card"><header><div><a href="${escape(url(first.pullRequestUrl))}" target="_blank" rel="noopener noreferrer"><strong>${escape(repository?.fullName ?? first.repositoryId)} #${first.pullRequestNumber} ↗</strong></a><p class="ig-note">Head SHA ${escape(first.headSha.slice(0, 12))} · ${rows.length} finding${rows.length === 1 ? "" : "s"}</p></div>${productBadge(first.risk === "high" ? "Needs attention" : "Review evidence", first.risk === "high" ? "unknown" : "possible")}</header>${table(
                ["Changed API", "Consumer", "Finding", "Evidence"],
                rows.map((finding) => [
                  `<code>${escape(finding.endpoint)}</code><p class="ig-note">${escape(finding.changeKind.replaceAll("_", " "))}</p>`,
                  `${escape(finding.consumerName)}${renderConsumerApiLinks(s, finding.consumerEndpointIds)}`,
                  `${badge(finding.risk, "risk")}<p>${escape(finding.explanation)}</p>`,
                  evidence(finding.evidence),
                ]),
              )}<footer><span>Coverage gaps remain visible; unresolved or unindexed consumers may be unknown.</span><a href="${escape(url(first.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">Open PR #${first.pullRequestNumber} ↗</a></footer></article>`;
            })
            .join("")
        : noResults
    }${paginationControls(page, "pr")}</section>`
  );
}

function renderPRImpact(): string {
  return (
    `<p class="ig-note">Learn how to interpret this view in the <a href="/docs/pull-request-reports">pull request report guide</a> or review the <a href="/docs/detect-breaking-api-changes-in-pull-requests">breaking-change checklist</a>.</p>` +
    renderPRImpactContent()
  );
}
void renderCandidatesLegacy;
void renderPRImpactLegacy;
function renderRepositories(): string {
  const s = snapshot!;
  const repos = s.repositories.filter(
    (r) =>
      r.fullName.toLowerCase().includes(query.toLowerCase()) &&
      (!filter || r.status === filter),
  );
  return (
    `<div class="ig-repositories-page">${heading(
      "Repositories",
      "Manage GitHub App access, indexing, and parser coverage.",
      button("import", "Select repositories", writeDisabled()) +
        button("manage-groups", "Manage groups", `${writeDisabled()}`, true) +
        button(
          "add-workspace",
          "Add account or organization",
          `${writeDisabled()}`,
          true,
        ),
    )}` +
    `<section class="ig-card">${filters("Search repositories", [
      ["indexed", "Indexed"],
      ["queued", "Queued"],
      ["indexing", "Indexing"],
      ["partial", "Partial"],
      ["failed", "Failed"],
    ])}${
      repos.length
        ? table(
            [
              "Repository",
              "Branch",
              "Status",
              "Services",
              "Last index",
              "Actions",
            ],
            repos.map((r) => {
              const activeIndexJob = s.jobs
                .filter(
                  (job) =>
                    job.repositoryId === r.id &&
                    job.type === "index_repository" &&
                    ["queued", "running"].includes(job.status),
                )
                .sort((left, right) =>
                  right.updatedAt.localeCompare(left.updatedAt),
                )[0];
              const indexing =
                ["queued", "discovering", "indexing"].includes(r.status) ||
                Boolean(activeIndexJob);
              const progress = activeIndexJob
                ? `Re-index job · ${escape(activeIndexJob.phase.replaceAll("_", " "))} · ${Math.round(activeIndexJob.progress)}%`
                : indexing
                  ? `Repository ${escape(r.status)} · waiting for job progress`
                  : "";
              const status = `${badge(r.status)}${progress ? `<p class="ig-note" role="status">${progress}</p>` : ""}${reindexErrors.has(r.id) ? `<p class="ig-inline-error" role="alert">${escape(reindexErrors.get(r.id))}</p>` : ""}`;
              return [
                `<strong>${escape(r.fullName)}</strong>${r.error ? `<p class="ig-note">${escape(r.error)}</p>` : ""}`,
                escape(r.defaultBranch),
                status,
                String(r.serviceCount),
                date(r.indexedAt),
                `<div class="ig-actions">${button("repository", "Coverage", `data-id="${escape(r.id)}"`, true)}${button("reindex", indexing ? "Indexing…" : "Re-index", `data-id="${escape(r.id)}" ${writeDisabled()} ${indexing ? "disabled" : ""}`, true)}</div>`,
              ];
            }),
          )
        : empty(
            "No repositories selected",
            "Choose repositories from the active GitHub account or organization. Add another connection to switch repository owners.",
            button("import", "Select repositories", writeDisabled()),
          )
    }</section>${jobs()}</div>`
  );
}
function renderSettings(): string {
  const s = snapshot!.settings;
  const providers =
    auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
  const methods = (["github", "google"] as const)
    .filter((method) => auth.isEnabled(method))
    .map((method) =>
      providers.includes(`${method}.com`)
        ? `<span class="ig-provider-connection">${providerIcon(method)}<strong>${method === "github" ? "GitHub" : "Google"}</strong><span>Connected</span></span>`
        : button(
            `link-${method}`,
            `Connect ${method === "github" ? "GitHub" : "Google"}`,
            "",
            true,
          ),
    )
    .join("");
  return (
    heading(
      "Settings",
      "Manage your workspace, sign-in methods, and connected services.",
    ) +
    `<div class="ig-settings-grid">
    <section class="ig-card ig-settings-preferences"><h2>Workspace preferences</h2><p class="ig-note">Your changes are saved after the server confirms them.</p>${!session?.user.emailVerified ? '<p class="ig-permission">Your email must be verified before changing workspace settings. Sign in with a verified provider or use a passwordless email link.</p>' : ""}
      <form class="ig-form" data-settings-form>
        <label>Analysis mode<select name="analysisMode" disabled><option>Deterministic static analysis</option></select></label>
        <label class="ig-checkbox"><input type="checkbox" name="syncDefaultBranch" ${s.syncDefaultBranch ? "checked" : ""} ${writeDisabled()}> Sync default branch when code changes</label>
         <label class="ig-checkbox"><input type="checkbox" name="prCommentsEnabled" ${s.prCommentsEnabled ? "checked" : ""} ${writeDisabled()}> Publish findings as pull request comments</label>
         <label class="ig-checkbox"><input type="checkbox" name="externalModelsEnabled" ${s.externalModelsEnabled ? "checked" : ""} ${!session?.capabilities.externalModels ? "disabled" : writeDisabled()}> Allow external model analysis</label>
         <label class="ig-checkbox"><input type="checkbox" name="aiSummaryEnabled" ${s.aiSummaryEnabled ? "checked" : ""} ${!session?.capabilities.externalModels ? "disabled" : writeDisabled()}> Add optional model summary to PR comments</label>
         ${!session?.capabilities.externalModels ? `${button("external-model-info", "Why is this unavailable?", "", true)}<p class="ig-note">External model analysis is unavailable on this deployment; deterministic analysis remains active.</p>` : ""}
         ${session?.capabilities.externalModels ? '<p class="ig-note">Optional model summaries explain the deterministic report only. They cannot change the tier, findings, or evidence.</p>' : ""}
        <label>History retention in days<input type="number" name="retentionDays" min="7" max="365" required value="${s.retentionDays}" ${writeDisabled()}></label>
        <p class="ig-note">Applies to job and pull request history and reviews. Current repository snapshots remain while selected.</p>
        <button class="ig-button" type="submit" ${writeDisabled()}>Save preferences</button><p data-save-status role="status" aria-live="polite"></p>
      </form>
    </section>
    <section class="ig-card"><h2>Sign-in methods</h2><p class="ig-note">Signed in as <strong>${escape(session?.user.email ?? "your account")}</strong>.</p><div class="ig-account-methods">${methods}</div><p class="ig-note">Passwordless email links are available from the sign-in page. Provider connections retain your current account.</p><a class="ig-settings-guide" href="/docs/sign-in">Account & sign-in guide →</a></section>
    <section class="ig-card"><h2>GitHub App</h2><p>${escape(workspace?.accountLogin)} · ${badge(workspace?.installationStatus ?? "unknown")}</p><p class="ig-note">Repository permissions are controlled by the GitHub App installation.</p>${button("connect-github", "Manage connection", "", true)}</section>
  </div>${runtimeConnectionsPanel(snapshot!, !!session?.capabilities.runtimeTelemetry, canWrite())}
  <section class="ig-card ig-settings-help"><div><h2>Help with your account</h2><p class="ig-note">Talk to the right person about your workspace or account.</p></div><nav aria-label="Account assistance"><a href="${emailHref("support")}">${uiIcon("help")}Product support</a><a href="${emailHref("billing")}">${uiIcon("mail")}Billing & invoices</a><a href="${emailHref("privacy")}">${uiIcon("mail")}Privacy & legal</a><a href="/contact">All contact options →</a></nav></section>`
  );
}
function renderGraph(): string {
  return (
    heading(
      "Dependency graph",
      "Explore GitHub repositories, their modules, and the relationships backed by indexed evidence.",
    ) +
    '<section data-repository-graph aria-label="Repository dependency graph"></section>'
  );
}
function mountGraph(): void {
  const container = $("[data-repository-graph]");
  if (!container || !snapshot) return;
  container.innerHTML =
    '<p class="ig-note" role="status">Loading repository explorer…</p>';
  void import("./dependency-graph/mount")
    .then(({ mountDependencyGraph }) => {
      if (!disposed && container.isConnected && snapshot)
        graph = mountDependencyGraph(container, snapshot);
    })
    .catch(() => {
      if (container.isConnected)
        container.innerHTML = empty(
          "Graph could not load",
          "Refresh to try again.",
          button("retry", "Try again"),
        );
    });
}
function renderFunctionUsage(): string {
  return `<div class="ig-function-usage">${heading("Function usage", "Search indexed functions, API request attribution, and measured runtime entries.")}${renderFunctionInventory(snapshot!, codeQuery, codePage)}</div>`;
}

function focusEndpointScreen(): void {
  try {
    if (typeof window.scrollTo === "function")
      window.scrollTo({ top: 0, behavior: "instant" });
  } catch {
    /* Scroll fallback */
  }
  const runFocus = () => {
    const backBtn = document.querySelector<HTMLElement>(
      '[data-action="back-to-apis"]',
    );
    const screen = document.querySelector<HTMLElement>(
      "[data-endpoint-detail-screen]",
    );
    (backBtn ?? screen)?.focus();
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(runFocus);
  } else {
    setTimeout(runFocus, 0);
  }
}
function focusEndpointTab(tab: string): void {
  const runFocus = () => {
    document
      .querySelector<HTMLElement>(
        `[data-action="endpoint-tab"][data-tab="${tab}"]`,
      )
      ?.focus();
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(runFocus);
  } else {
    setTimeout(runFocus, 0);
  }
}
function render(): void {
  if (disposed || !snapshot) return;
  if (page === "dependency-graph" && graph) {
    graph.update(snapshot);
    renderShell();
    return;
  }
  graph?.destroy();
  graph = null;
  codeGraph?.destroy();
  codeGraph = null;
  main.innerHTML = (
    {
      home: renderHome,
      "api-usage": renderEndpoints,
      "dependency-graph": renderGraph,
      "function-usage": renderFunctionUsage,
      "deprecation-candidates": renderCandidates,
      "pr-impact": renderPRImpact,
      repositories: renderRepositories,
      settings: renderSettings,
      onboarding: renderOnboarding,
      "github-setup": renderOnboarding,
    }[page] ?? renderHome
  )();
  if (
    (page === "home" || (page === "api-usage" && !selectedEndpoint)) &&
    workspace?.accountLogin === "impact-gate" &&
    snapshot?.services.some((service) => service.name === "ig-lab-petclinic")
  ) {
    const panel = document.createElement("div");
    panel.innerHTML = renderDemoTraffic();
    main.append(panel);
    const traffic = panel.firstElementChild as HTMLElement | null;
    if (traffic) void refreshDemoTraffic(traffic);
  }
  main.setAttribute("aria-busy", "false");
  renderShell();
  if (page === "dependency-graph") mountGraph();
  const flow = $<HTMLElement>("[data-code-flow]", main);
  if (flow)
    codeGraph = mountCodeFlow(snapshot, flow, $("[data-code-inspector]", main));
}

function renderOnboarding(): string {
  if (onboardingStatus && !onboardingStatus.stage) {
    onboardingStatus = {
      ...onboardingStatus,
      stage: "choose_api",
    } as WorkspaceOnboardingStatus;
  }
  let steps: string;
  const selectedCount = selectedRepos.size;
  const indexedRepositories =
    snapshot?.repositories.filter(
      (repository) => repository.status === "indexed",
    ).length ?? 0;
  const totalRepositories = snapshot?.repositories.length ?? 0;
  const reportAvailable = Boolean(snapshot?.findings.length);
  const providerCount = onboardingStatus?.providerRepositories.length ?? 0;
  const consumerCount =
    onboardingStatus?.recommendedConsumerRepositories.length ?? 0;
  const availableCount = available?.length ?? 0;
  const setupSteps = `<ol class="ig-setup-steps" aria-label="Workspace setup progress">
    <li data-complete="${Boolean(workspace)}" ${workspace ? "" : 'aria-current="step"'}><strong>1. Connect GitHub</strong><span>${workspace ? `Connected to ${escape(workspace.accountLogin)}` : "Authorize the GitHub account that owns your repositories."}</span></li>
    <li data-complete="${selectedCount > 0}" ${workspace && selectedCount === 0 ? 'aria-current="step"' : ""}><strong>2. Choose an API</strong><span>${selectedCount ? `${selectedCount} recommended repositories selected. ` : ""}Start with the provider contract and recommended consumers. Runtime data is optional.</span></li>
    <li data-complete="${reportAvailable}" ${workspace && selectedCount > 0 && !reportAvailable ? 'aria-current="step"' : ""}><strong>3. Build the first map</strong><span>${totalRepositories ? `${indexedRepositories} of ${totalRepositories} repositories indexed. ` : ""}Open your first API flow when indexing completes.</span></li>
  </ol>`;
  if (workspace) {
    const discoveryTitle =
      providerCount || consumerCount
        ? `We found ${providerCount} repositories with OpenAPI contracts and ${consumerCount} likely API consumers.`
        : availableCount
          ? `Choose from ${availableCount} repositories to build your first API map.`
          : "No repositories are ready to map yet.";

    const discoveryRepos: Array<{
      id: number;
      fullName: string;
      isProvider: boolean;
    }> = [];
    if (
      onboardingStatus?.providerRepositories?.length ||
      onboardingStatus?.recommendedConsumerRepositories?.length
    ) {
      for (const r of onboardingStatus.providerRepositories ?? []) {
        discoveryRepos.push({
          id: r.id,
          fullName: r.fullName,
          isProvider: true,
        });
      }
      for (const r of onboardingStatus.recommendedConsumerRepositories ?? []) {
        if (!discoveryRepos.some((d) => d.id === r.id)) {
          discoveryRepos.push({
            id: r.id,
            fullName: r.fullName,
            isProvider: false,
          });
        }
      }
    } else if (available?.length) {
      for (const r of available.slice(0, 3)) {
        discoveryRepos.push({
          id: r.githubRepositoryId,
          fullName: r.fullName,
          isProvider: true,
        });
      }
    }

    const quickCount = selectedRepos.size;
    const quickstartLabel =
      quickCount === 0
        ? "Start with recommended repositories"
        : quickCount === 1
          ? "Start with 1 selected repository"
          : `Start with ${quickCount} selected repositories`;

    const choiceChips =
      discoveryRepos
        .map((repo) => {
          const isSel = selectedRepos.has(repo.id);
          return `<button type="button" class="ig-repo-chip ${isSel ? "is-selected" : ""}" data-action="toggle-discovery-repo" data-id="${repo.id}" data-selected="${isSel ? "true" : "false"}" aria-pressed="${isSel}">
        <span class="ig-repo-chip-check">${isSel ? "✓" : "+"}</span>
        <span class="ig-repo-chip-name">${escape(repo.fullName)}</span>
        <span class="ig-repo-chip-badge ${repo.isProvider ? "provider" : "consumer"}">${repo.isProvider ? "OpenAPI Contract" : "Consumer"}</span>
      </button>`;
        })
        .join("") || "<span>No OpenAPI repositories discovered yet</span>";

    steps = `<section class="ig-card ig-onboarding-discovery"><div class="ig-onboarding-discovery-heading"><div><span class="ig-eyebrow">Discovery</span><h2>${discoveryTitle}</h2></div><span class="ig-onboarding-stage">${escape(onboardingStatus?.stage.replaceAll("_", " ") ?? "choose api")}</span></div><p class="ig-note">Choose a small starting scope. Impact Gate indexes the provider and recommended consumer repositories immediately; runtime data can be added after the first map.</p><section class="ig-api-choice"><div class="ig-api-choice-header"><strong>Which API should we map first?</strong>${discoveryRepos.length > 1 ? `<div class="ig-api-choice-actions"><button type="button" class="ig-button-link" data-action="discovery-select-all">Select all (${discoveryRepos.length})</button><span class="ig-sep">·</span><button type="button" class="ig-button-link" data-action="discovery-clear-all">Clear</button></div>` : ""}</div><p class="ig-note" style="margin:2px 0 8px 0;font-size:12px">Choose one or more repositories to map. Impact Gate analyzes contracts and consumer call paths immediately.</p><div class="ig-api-choice-chips">${choiceChips}</div></section><div class="ig-actions"><button type="button" class="ig-button" data-action="quickstart" ${writeDisabled()} ${quickCount === 0 && !discoveryRepos.length ? "disabled" : ""}>${quickstartLabel}</button>${button("import", "Choose repositories manually", "", true)}</div></section>
      <section class="ig-card"><h2>1. GitHub organization</h2><p><strong>${escape(workspace.accountLogin)}</strong> · ${badge(workspace.installationStatus)}</p>${button("connect-github", "Connect another installation", "", true)}</section>
      <section class="ig-card"><h2>2. Choose repositories</h2><p class="ig-note">Include the repository that owns the OpenAPI contract and the consumer repositories whose callers you want to review. You can start with a small set; runtime connections are optional.</p>${available ? repoSelection() : '<p class="ig-note">Loading repositories authorized by your installation…</p>'}</section>${jobs()}
      ${snapshot?.repositories.length ? `<section class="ig-card"><h2>3. Review your first result</h2><p class="ig-note">${indexedRepositories} of ${snapshot.repositories.length} selected repositories indexed. Indexing continues in the background; check each repository’s coverage before relying on a report.</p><a class="ig-button" href="/dashboard">Open engineering overview</a> <a class="ig-button ig-button-secondary" href="/dashboard/repositories">Review repository coverage</a></section>` : ""}`;
  } else {
    steps = `<section class="ig-card"><h2>1. Connect GitHub</h2><p class="ig-note">Connect the GitHub account or organization that owns your API and consumer repositories. You can use any enabled sign-in method for your Impact Gate account.</p>${button("connect-github", "Connect GitHub", config.github?.configured ? "" : "disabled")}${config.github?.configured ? "" : '<p class="ig-note">The GitHub App connection is not configured yet.</p>'}<p class="ig-note">You’ll need permission to authorize the GitHub App for the repositories you want to analyze. If an organization admin must approve it, ask them to complete installation and return here.</p><a href="/docs/quickstart">See setup requirements and the first-report walkthrough</a></section>`;
  }
  return `<div class="ig-onboarding">${heading("Connect your workspace", "Get to your first API map in under five minutes. Runtime setup is an optional enhancement.")}${setupSteps}${steps}<aside class="ig-onboarding-help">${uiIcon("help")}<div><strong>What happens next?</strong><p>Impact Gate requests repository read access, PR checks/comments, and no source execution. You control the repository scope. Missing runtime data remains unknown rather than zero usage.</p></div></aside></div>`;
}
function getRecommendedRepoIds(): Set<number> {
  const ids = new Set<number>();
  if (onboardingStatus) {
    for (const r of onboardingStatus.providerRepositories ?? []) ids.add(r.id);
    for (const r of onboardingStatus.recommendedConsumerRepositories ?? [])
      ids.add(r.id);
  }
  return ids;
}
function getProviderRepoIds(): Set<number> {
  const ids = new Set<number>();
  if (onboardingStatus) {
    for (const r of onboardingStatus.providerRepositories ?? []) ids.add(r.id);
  }
  return ids;
}
function syncRecommendedRepos(): void {
  if (!repoSelectionInitialized && available?.length) {
    repoSelectionInitialized = true;
    if (selectedRepos.size === 0) {
      const rec = getRecommendedRepoIds();
      for (const r of available) {
        if (rec.has(r.githubRepositoryId))
          selectedRepos.add(r.githubRepositoryId);
      }
    }
  }
}
function updateRepoListFiltering(form: HTMLFormElement): void {
  const q = repoSearchQuery.toLowerCase().trim();
  const options = form.querySelectorAll<HTMLElement>(".ig-repo-option");
  const recommendedIds = getRecommendedRepoIds();
  let visibleCount = 0;
  options.forEach((option) => {
    const name = option.dataset.repoName ?? "";
    const lang = option.dataset.repoLang ?? "";
    const id = Number(option.dataset.repoId);
    const matchesQuery = !q || name.includes(q) || lang.includes(q);
    let matchesFilter = true;
    if (repoFilter === "selected") {
      matchesFilter = selectedRepos.has(id);
    } else if (repoFilter === "recommended") {
      matchesFilter = recommendedIds.has(id);
    }
    const isVisible = matchesQuery && matchesFilter;
    option.style.display = isVisible ? "" : "none";
    if (isVisible) visibleCount++;
  });
  const emptyFilterEl = form.querySelector<HTMLElement>(
    "[data-repo-empty-filter]",
  );
  if (emptyFilterEl) {
    emptyFilterEl.style.display = visibleCount === 0 ? "" : "none";
  }
}
function updateRepoSelectionUI(): void {
  const count = selectedRepos.size;
  const total = available?.length ?? 0;

  document
    .querySelectorAll<HTMLFormElement>("[data-repositories-form]")
    .forEach((form) => {
      form
        .querySelectorAll<HTMLInputElement>("input[name='repositoryIds']")
        .forEach((input) => {
          const id = Number(input.value);
          const isChecked = selectedRepos.has(id);
          input.checked = isChecked;
          const label = input.closest<HTMLElement>(".ig-repo-option");
          if (label) {
            label.classList.toggle("is-selected", isChecked);
            label.dataset.selected = isChecked ? "true" : "false";
          }
        });

      const countEl = form.querySelector<HTMLElement>("[data-repo-count]");
      if (countEl) {
        countEl.innerHTML = `<strong>${count}</strong> of ${total} selected`;
      }

      const tabSelectedCount = form.querySelector<HTMLElement>(
        "[data-tab-selected-count]",
      );
      if (tabSelectedCount) {
        tabSelectedCount.textContent = String(count);
      }

      const submitBtn = form.querySelector<HTMLButtonElement>(
        "button[type='submit']",
      );
      if (submitBtn) {
        submitBtn.textContent = `Save selection (${count} ${count === 1 ? "repository" : "repositories"}) and start indexing`;
      }

      if (repoFilter === "selected") {
        updateRepoListFiltering(form);
      }
    });

  document
    .querySelectorAll<HTMLElement>("[data-action='toggle-discovery-repo']")
    .forEach((chip) => {
      const id = Number(chip.dataset.id);
      const isSelected = selectedRepos.has(id);
      chip.classList.toggle("is-selected", isSelected);
      chip.setAttribute("aria-pressed", isSelected ? "true" : "false");
      chip.dataset.selected = isSelected ? "true" : "false";
      const checkEl = chip.querySelector(".ig-repo-chip-check");
      if (checkEl) checkEl.textContent = isSelected ? "✓" : "+";
    });

  const quickstartBtn = document.querySelector<HTMLButtonElement>(
    "[data-action='quickstart']",
  );
  if (quickstartBtn) {
    quickstartBtn.disabled = count === 0;
    quickstartBtn.textContent =
      count === 0
        ? "Select at least 1 repository"
        : count === 1
          ? "Start with 1 selected repository"
          : `Start with ${count} selected repositories`;
  }
}
function repoSelection(): string {
  if (!available?.length)
    return empty(
      "No repositories available",
      "Grant repository access to the Impact Gate GitHub App, then reconnect to refresh permissions.",
      button("connect-github", "Refresh GitHub access", "", true),
    );
  const recommendedIds = getRecommendedRepoIds();
  const providerIds = getProviderRepoIds();
  const totalCount = available.length;
  const selectedCount = selectedRepos.size;
  const recommendedCount = available.filter((r) =>
    recommendedIds.has(r.githubRepositoryId),
  ).length;

  return `<form data-repositories-form class="ig-repo-form">
    <p class="ig-note">Selected repositories will be indexed on their default branch. Deselecting a repository removes it from this workspace.</p>
    <div class="ig-repo-toolbar">
      <div class="ig-repo-search-wrap">
        <input type="search" data-repo-search placeholder="Search repositories by name or language…" value="${escape(repoSearchQuery)}" aria-label="Search repositories" autocomplete="off">
      </div>
      <div class="ig-repo-bulk-actions">
        <button type="button" class="ig-button ig-button-secondary ig-button-sm" data-action="repo-select-all">Select all (${totalCount})</button>
        <button type="button" class="ig-button ig-button-secondary ig-button-sm" data-action="repo-deselect-all">Clear</button>
        ${recommendedCount > 0 ? `<button type="button" class="ig-button ig-button-secondary ig-button-sm" data-action="repo-select-recommended">Select recommended (${recommendedCount})</button>` : ""}
      </div>
    </div>
    <div class="ig-repo-status-bar">
      <span class="ig-repo-count" data-repo-count><strong>${selectedCount}</strong> of ${totalCount} selected</span>
      <div class="ig-repo-filter-tabs">
        <button type="button" class="ig-repo-tab ${repoFilter === "all" ? "active" : ""}" data-action="repo-filter" data-filter="all">All (${totalCount})</button>
        <button type="button" class="ig-repo-tab ${repoFilter === "selected" ? "active" : ""}" data-action="repo-filter" data-filter="selected">Selected (<span data-tab-selected-count>${selectedCount}</span>)</button>
        ${recommendedCount > 0 ? `<button type="button" class="ig-repo-tab ${repoFilter === "recommended" ? "active" : ""}" data-action="repo-filter" data-filter="recommended">Recommended (${recommendedCount})</button>` : ""}
      </div>
    </div>
    <div class="ig-repo-options" data-repo-list>
      ${available
        .map((repo) => {
          const isSelected = selectedRepos.has(repo.githubRepositoryId);
          const isRec = recommendedIds.has(repo.githubRepositoryId);
          const isProvider = providerIds.has(repo.githubRepositoryId);
          const q = repoSearchQuery.toLowerCase().trim();
          const matchesQuery =
            !q ||
            repo.fullName.toLowerCase().includes(q) ||
            (repo.language ?? "").toLowerCase().includes(q);
          let matchesTab = true;
          if (repoFilter === "selected") matchesTab = isSelected;
          else if (repoFilter === "recommended") matchesTab = isRec;
          const visible = matchesQuery && matchesTab;
          return `<label class="ig-repo-option ${isSelected ? "is-selected" : ""}" data-repo-id="${repo.githubRepositoryId}" data-repo-name="${escape(repo.fullName.toLowerCase())}" data-repo-lang="${escape((repo.language ?? "").toLowerCase())}" data-is-rec="${isRec ? "true" : "false"}" ${visible ? "" : 'style="display:none"'}>
          <input type="checkbox" name="repositoryIds" value="${repo.githubRepositoryId}" ${isSelected ? "checked" : ""} ${writeDisabled()}>
          <div class="ig-repo-option-body">
            <div class="ig-repo-option-header">
              <strong class="ig-repo-name">${escape(repo.fullName)}</strong>
              ${isProvider ? '<span class="ig-repo-badge ig-repo-badge-provider">OpenAPI Contract</span>' : isRec ? '<span class="ig-repo-badge ig-repo-badge-rec">Recommended</span>' : ""}
            </div>
            <div class="ig-repo-meta">
              <span>${repo.private ? "Private" : "Public"}</span>
              <span class="ig-repo-dot">·</span>
              <span>${escape(repo.language ?? "Language not detected")}</span>
              <span class="ig-repo-dot">·</span>
              <span class="ig-repo-branch">${escape(repo.defaultBranch)}</span>
            </div>
          </div>
        </label>`;
        })
        .join("")}
    </div>
    <div class="ig-repo-empty-filter" data-repo-empty-filter style="display:none">
      <p class="ig-note">No repositories match the current search or filter.</p>
    </div>
    <div class="ig-actions" style="margin-top:18px">
      <button type="submit" class="ig-button" data-repo-submit ${writeDisabled()} ${selectedCount === 0 ? "disabled" : ""}>Save selection (${selectedCount} ${selectedCount === 1 ? "repository" : "repositories"}) and start indexing</button>
    </div>
    <p data-save-status role="status"></p>
  </form>`;
}
function modal(title: string, contents: string): HTMLDialogElement {
  const dialog = $<HTMLDialogElement>(".ig-dialog")!;
  overlayFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  dialog.innerHTML = `<h2 id="dialog-title">${escape(title)}</h2>${contents}<div class="ig-dialog-actions">${button("close-dialog", "Close", "", true)}</div>`;
  const runtimeForm = dialog.querySelector<HTMLFormElement>(
    "[data-runtime-form]",
  );
  if (runtimeForm) {
    const actions = document.createElement("div");
    actions.className = "ig-runtime-form-actions";
    const provider = runtimeForm.dataset.provider as "prometheus" | "datadog";
    actions.innerHTML = `<button type="button" class="ig-button ig-button-secondary" data-action="runtime-test" data-provider="${provider}">Test connection</button><button type="submit" class="ig-button" data-runtime-primary>Find and match services</button><p data-save-status role="status" aria-live="polite"></p>`;
    runtimeForm.append(actions);
    updateRuntimeConnectButton(runtimeForm);
  }
  dialog.showModal();
  return dialog;
}
function showRepositoryCoverage(
  repository: WorkspaceRepository,
  pageNumber = 1,
  diagnosticPage = 1,
  statusFilter = "",
  reasonFilter = "",
): void {
  if (!workspace) return;
  const workspaceId = workspace.id;
  const dialog = modal(
    repository.fullName,
    '<p role="status">Loading coverage details…</p>',
  );
  const params = new URLSearchParams({
    page: String(pageNumber),
    limit: "20",
    repo: repository.id,
  });
  if (statusFilter) params.set("status", statusFilter);
  if (reasonFilter) params.set("reason", reasonFilter);
  const diagnosticParams = new URLSearchParams({
    page: String(diagnosticPage),
    limit: "20",
  });
  void Promise.allSettled([
    api.request<{ coverage: WorkspaceRepositoryCoverageDetails }>(
      `${route(workspaceId)}/repositories/${encodeURIComponent(repository.id)}/coverage?${diagnosticParams}`,
    ),
    api.request<{
      items: ApiCoverageItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
      };
      counts: {
        byStatus: Record<string, number>;
        byReason: Record<string, number>;
        removed: number;
      };
      discoveryIncomplete: boolean;
      failedAttempts: WorkspaceJob[];
    }>(`${route(workspaceId)}/api-coverage?${params}`),
    api.request<{ runs: ApiReviewRun[] }>(
      `${route(workspaceId)}/api-reviews?limit=20`,
    ),
  ])
    .then(([detailsResult, coverageResult, reviewResult]) => {
      if (detailsResult.status !== "fulfilled" || coverageResult.status !== "fulfilled") {
        throw detailsResult.status === "rejected"
          ? detailsResult.reason
          : coverageResult.status === "rejected"
            ? coverageResult.reason
            : new Error("Coverage response was unavailable");
      }
      const { coverage: details } = detailsResult.value;
      const apiCoverage = coverageResult.value;
      const reviewResponse = reviewResult.status === "fulfilled" ? reviewResult.value : { runs: [] as ApiReviewRun[] };
      if (!dialog.open || workspace?.id !== workspaceId) return;
      const rows = apiCoverage.items.map((item) => [
        `${item.status === "removed" ? "Removed · " : ""}${escape(item.method ?? item.kind)} ${escape(item.path ?? "")}`,
        item.stages
          .map(
            (stage) =>
              `${escape(stage.stage.replaceAll("_", " "))}: ${badge(stage.status)}`,
          )
          .join("<br>") +
          item.stages
            .filter((stage) => stage.reason)
            .map((stage) => `<p class="ig-note">${escape(stage.reason)}</p>`)
            .join("") +
          (item.suggestedAction
            ? `<p class="ig-note">${escape(item.suggestedAction)}</p>`
            : ""),
        `<a href="${escape(url(item.source.url))}" target="_blank" rel="noopener noreferrer"><code>${escape(item.source.filePath)}:${item.source.line}</code></a>`,
        item.status === "removed" && item.removedInCommitSha
          ? `${escape(item.commitSha.slice(0, 12))} → ${escape(item.removedInCommitSha.slice(0, 12))}`
          : escape(item.commitSha.slice(0, 12)),
      ]);
      const reasons = Object.entries(apiCoverage.counts.byReason)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([reason, count]) =>
            `<option value="${escape(reason)}" ${reasonFilter === reason ? "selected" : ""}>${escape(reason.replaceAll("_", " "))} (${count})</option>`,
        )
        .join("");
      const failedAttempts = apiCoverage.failedAttempts
        .filter((job) => job.repositoryId === repository.id)
        .map(
          (job) =>
            `<li>${escape(job.phase)} · ${escape(job.error ?? "Index attempt failed")} · ${escape(date(job.updatedAt))}</li>`,
        )
        .join("");
      const partialAttempts = details.partialAttempts
        .map(
          (job) =>
            `<li>Partial attempt at <code>${escape(job.partialAttempt?.commitSha || "unknown commit")}</code> · ${job.partialAttempt?.coverage.skippedFiles ?? 0} skipped files · ${job.partialAttempt?.coverage.diagnostics?.total ?? 0} diagnostics · ${escape(date(job.updatedAt))}</li>`,
        )
        .join("");
      dialog.innerHTML = `<h2 id="dialog-title">${escape(repository.fullName)} API coverage</h2>
        <p>${details.supportedFiles} supported files · ${details.fullyParsedFiles ?? "unknown"} fully parsed · ${details.parsedWithErrorsFiles ?? 0} parsed with errors · ${details.skippedFiles} skipped files · ${details.openApiDocuments} OpenAPI documents</p>
        <p class="ig-note">Last successful commit: <code>${escape(details.lastSuccessfulCommit ?? "none")}</code></p>
        <p role="status">${details.discoveryIncomplete ? "Analysis incomplete: skipped or partially analyzed files may contain APIs that were never discovered." : "No skipped files are recorded for this successful analysis; static extraction still does not prove exhaustive API discovery."}</p>
        <section><h3>Async analyzer improvement review</h3>${
          reviewResponse.runs
            .filter((run) => run.repositoryId === repository.id)
            .map(
              (run) =>
                `<p><strong>${escape(run.status)}</strong> · commit <code>${escape(run.commitSha.slice(0, 12))}</code> · ${run.eligibleCount} eligible · ${run.ruleCount} deterministic · ${run.modelCount} model · ${run.reusedCount} reused · ${run.cannotTellCount} cannot tell</p>`,
            )
            .join("") ||
          "<p>No review run is recorded. Enable API improvement reviews for future completed indexes.</p>"
        }<p class="ig-note">Advisory metadata only; coverage statuses and source code are never changed automatically.</p></section>
        <section><h3>Discovered API items</h3><p>Mapped ${apiCoverage.counts.byStatus.mapped ?? 0} · Partial ${apiCoverage.counts.byStatus.partial ?? 0} · Unresolved ${apiCoverage.counts.byStatus.unresolved ?? 0}. Counts are current items by their least-resolved stage. ${apiCoverage.counts.removed} removed items are historical and excluded from current counts.</p>
        <div class="ig-filters"><select data-api-coverage-status data-id="${escape(repository.id)}" aria-label="Filter API status"><option value="">All current statuses</option>${["mapped", "partial", "unresolved", "removed"].map((value) => `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${value}</option>`).join("")}</select><select data-api-coverage-reason data-id="${escape(repository.id)}" aria-label="Filter API reason"><option value="">All reasons</option>${reasons}</select></div>
        ${rows.length ? table(["API item", "Stage status and reason", "Location", "Commit"], rows) : "<p>No stored API coverage records match this filter.</p>"}
        <p>Showing page ${apiCoverage.pagination.page} · ${apiCoverage.pagination.total} matching records</p>${button("api-coverage-page", "Previous items", `data-id="${escape(repository.id)}" data-page="${Math.max(1, pageNumber - 1)}" data-diagnostic-page="${diagnosticPage}" data-status="${escape(statusFilter)}" data-reason="${escape(reasonFilter)}" ${pageNumber <= 1 ? "disabled" : ""}`, true)} ${button("api-coverage-page", "Next items", `data-id="${escape(repository.id)}" data-page="${pageNumber + 1}" data-diagnostic-page="${diagnosticPage}" data-status="${escape(statusFilter)}" data-reason="${escape(reasonFilter)}" ${apiCoverage.pagination.hasNext ? "" : "disabled"}`, true)}</section>
        <section><h3>File analysis diagnostics</h3><p>${details.diagnostics.total} file-level diagnostic records. Skipped files remain diagnostics; they are not counted as unresolved APIs.</p>${
          details.diagnostics.records.length
            ? table(
                ["Reason", "Stage", "File / location", "Detail"],
                details.diagnostics.records.map((item) => [
                  escape(item.code.replaceAll("_", " ")),
                  escape(item.stage.replaceAll("_", " ")),
                  `${escape(item.filePath)}${item.line ? `:${item.line}` : ""}`,
                  escape(item.message),
                ]),
              )
            : "<p>No file diagnostics are recorded.</p>"
        }${button("api-coverage-page", "Previous file diagnostics", `data-id="${escape(repository.id)}" data-page="${pageNumber}" data-diagnostic-page="${Math.max(1, diagnosticPage - 1)}" data-status="${escape(statusFilter)}" data-reason="${escape(reasonFilter)}" ${diagnosticPage <= 1 ? "disabled" : ""}`, true)} ${button("api-coverage-page", "Next file diagnostics", `data-id="${escape(repository.id)}" data-page="${pageNumber}" data-diagnostic-page="${diagnosticPage + 1}" data-status="${escape(statusFilter)}" data-reason="${escape(reasonFilter)}" ${details.diagnostics.hasNext ? "" : "disabled"}`, true)}</section>
        ${failedAttempts ? `<section><h3>Failed latest attempts</h3><ul>${failedAttempts}</ul><p class="ig-note">Failed attempts do not replace the last successful commit.</p></section>` : ""}
        ${partialAttempts ? `<section><h3>Partial indexing attempts</h3><ul>${partialAttempts}</ul><p class="ig-note">Partial attempts remain separate from current coverage.</p></section>` : ""}
        <div class="ig-dialog-actions">${button("close-dialog", "Close", "", true)}</div>`;
    })
    .catch((error) => {
      if (dialog.open && workspace?.id === workspaceId) {
        dialog.innerHTML = `<h2 id="dialog-title">${escape(repository.fullName)}</h2><p role="alert">Coverage details could not be loaded. Close this dialog and try again.</p><div class="ig-dialog-actions">${button("close-dialog", "Close", "", true)}</div>`;
      }
      handleError(error);
    });
}
async function loadAvailable(): Promise<void> {
  if (!workspace) return;
  const response = await api.request<{
    repositories: InstallationRepository[];
  }>(`${route(workspace.id)}/repositories/available`);
  available = response.repositories;
  selectedRepos = new Set(
    available
      .filter((repo) => repo.selected)
      .map((repo) => repo.githubRepositoryId),
  );
  syncRecommendedRepos();
}
async function discoverRuntimeServices(form: HTMLFormElement): Promise<void> {
  if (!workspace || !snapshot) return;
  const workspaceId = workspace.id;
  const revision = form.dataset.runtimeRevision;
  const status = $("[data-save-status]", form);
  trackEvent("runtime_discovery_start", { provider: form.dataset.provider });
  if (status) status.textContent = "Finding source services and matching APIs…";
  const result = await api.request<RuntimeServiceDiscovery>(
    `${route(workspaceId)}/runtime/${form.dataset.provider}/discover`,
    { method: "POST", body: runtimeConnectionBody(form, true) },
  );
  if (
    !form.isConnected ||
    !form.closest<HTMLDialogElement>("dialog")?.open ||
    workspace?.id !== workspaceId
  )
    return;
  if (form.dataset.runtimeRevision !== revision) {
    if (status)
      status.textContent =
        "Settings changed while discovering. Find services again with the updated settings.";
    return;
  }
  const review = $("[data-runtime-review]", form);
  trackEvent("runtime_services_discovered", {
    provider: form.dataset.provider,
    service_count: result.services.length,
    matched_count: result.autoMatchedCount,
    unmatched_count: result.suggestedCount + result.unmatchedCount,
  });
  if (review) review.innerHTML = runtimeServiceReview(snapshot, result);
  form.dataset.runtimePhase = result.services.length ? "review" : "source";
  updateRuntimeConnectButton(form);
  const again = $<HTMLButtonElement>("[data-action=runtime-discover]", form);
  if (again) again.hidden = !result.services.length;
  if (!result.services.length) {
    const advanced = $<HTMLDetailsElement>(".ig-runtime-advanced", form);
    if (advanced) advanced.open = true;
  }
  if (status)
    status.textContent = `${result.autoMatchedCount} matches ready · ${result.suggestedCount + result.unmatchedCount} to review. Nothing is saved until you connect.`;
  if (result.services.length)
    $<HTMLButtonElement>("[data-runtime-primary]", form)?.focus();
}
function snapshotView(): string {
  if (page === "api-usage") {
    return selectedEndpoint && endpointTab === "flow"
      ? "api-flow"
      : "api-usage";
  }
  if (page === "function-usage") return "function-usage";
  if (page === "deprecation-candidates") return "retirement";
  if (page === "repositories") return "repositories";
  if (page === "dependency-graph") return "dependency-graph";
  if (page === "pr-impact") return "pr-impact";
  if (page === "settings") return "settings";
  if (page === "onboarding" || page === "github-setup") return "onboarding";
  return "overview";
}
function snapshotPageParams(search: URLSearchParams): void {
  if (page === "api-usage") {
    search.set("page", String(collectionPage));
    search.set("limit", "50");
    if (query) search.set("q", query);
    if (apiServiceFilters.size)
      search.set("services", [...apiServiceFilters].join(","));
  } else if (page === "pr-impact") {
    search.set("page", String(collectionPage));
    search.set("limit", "10");
    if (query) search.set("q", query);
    if (filter) search.set("risk", filter);
  } else if (page === "deprecation-candidates") {
    search.set("page", String(collectionPage));
    search.set("limit", "10");
    if (query) search.set("q", query);
    if (retirementServiceFilter) search.set("service", retirementServiceFilter);
    if (retirementMethodFilter) search.set("method", retirementMethodFilter);
    if (retirementEvidenceFilter)
      search.set("evidence", retirementEvidenceFilter);
    if (retirementUsageFilter) search.set("usage", retirementUsageFilter);
    if (retirementReviewFilter) search.set("review", retirementReviewFilter);
  }
}
async function refresh(renderView = true, showLoading = true): Promise<void> {
  if (!workspace) return;
  const workspaceId = workspace.id;
  if (activeGroupId === null) activeGroupId = readGroupPreference(workspaceId);
  const search = new URLSearchParams({ view: snapshotView() });
  if (activeGroupId) search.set("group", activeGroupId);
  snapshotPageParams(search);
  const load = () =>
    api.request<WorkspaceSnapshot>(`${route(workspaceId)}/snapshot?${search}`, {
      loading: showLoading,
    });
  let next: WorkspaceSnapshot;
  try {
    next = await load();
  } catch (error) {
    // A remembered group may have been deleted; fall back to the full workspace.
    if (
      activeGroupId &&
      error instanceof WorkspaceApiError &&
      error.status === 404
    ) {
      activeGroupId = null;
      writeGroupPreference(workspaceId, null);
      next = await load();
    } else throw error;
  }
  if (
    next.version !== 1 ||
    next.workspaceId !== workspace.id ||
    !Array.isArray(next.endpoints)
  )
    throw new Error("The workspace response is incompatible.");
  const previous = snapshot;
  snapshot = next;
  errorMessage = "";
  if (renderView) {
    if (snapshotContentChanged(previous, next)) render();
    else renderShell();
  }
  if (reportedWorkspace !== workspace.id) {
    reportedWorkspace = workspace.id;
    identifyAnalyticsUser(auth.currentUser?.uid ?? null, workspace.role);
    trackEvent("workspace_view", {
      repository_count: next.repositories.length,
      service_count: next.services.length,
      endpoint_count: next.endpoints.length,
    });
  }
  clearTimeout(poll);
  if (
    page === "pr-impact" ||
    page === "deprecation-candidates" ||
    (page === "api-usage" && selectedEndpoint)
  )
    return;
  if (!disposed)
    poll = setTimeout(
      () => {
        if (
          document.hidden ||
          busy ||
          page === "settings" ||
          $<HTMLDialogElement>(".ig-dialog")?.open
        ) {
          schedulePoll();
          return;
        }
        void refresh(true, false).catch(handleError);
      },
      next.jobs.some((job) => ["queued", "running"].includes(job.status))
        ? 5000
        : 30000,
    );
}

/** Ignore the server's per-response timestamp so unchanged polls do not rebuild the UI. */
function snapshotContentChanged(
  previous: WorkspaceSnapshot | null,
  next: WorkspaceSnapshot,
): boolean {
  if (!previous) return true;
  return (
    JSON.stringify({ ...previous, generatedAt: null }) !==
    JSON.stringify({ ...next, generatedAt: null })
  );
}

function scheduleCollectionRefresh(): void {
  clearTimeout(filterRefresh);
  filterRefresh = setTimeout(() => {
    void refresh().catch(handleError);
  }, 180);
}
function schedulePoll(): void {
  clearTimeout(poll);
  if (
    !disposed &&
    workspace &&
    page !== "pr-impact" &&
    page !== "deprecation-candidates" &&
    !(page === "api-usage" && selectedEndpoint)
  )
    poll = setTimeout(() => {
      // Preserve the settings version displayed to the user until an explicit save or refresh.
      if (
        document.hidden ||
        busy ||
        page === "settings" ||
        $<HTMLDialogElement>(".ig-dialog")?.open
      ) {
        schedulePoll();
        return;
      }
      void refresh(true, false).catch(handleError);
    }, 5000);
}
function handleError(error: unknown): void {
  if (
    disposed ||
    (error instanceof DOMException && error.name === "AbortError")
  )
    return;
  trackEvent("workspace_error", {
    error_type:
      error instanceof WorkspaceApiError
        ? error.status === 401
          ? "authentication"
          : error.status >= 500
            ? "server"
            : "request"
        : "network",
  });
  if (error instanceof WorkspaceApiError && error.status === 401) {
    clearSession();
    state("Your session needs attention", "Sign in again to continue.", true);
    window.location.assign(
      signInDestination(
        `${location.pathname}${location.search}`,
        location.origin,
      ),
    );
    return;
  }
  errorMessage =
    error instanceof Error
      ? error.message
      : "The workspace could not be loaded.";
  if (snapshot) {
    toast(errorMessage);
    schedulePoll();
  } else state("Workspace unavailable", errorMessage, true);
}
function clearSession(): void {
  identifyAnalyticsUser(null);
  reportedWorkspace = null;
  reportedSetup = false;
  reindexErrors.clear();
  codeGraph?.destroy();
  codeGraph = null;
  codeQuery = "";
  codePage = 0;
  api?.cancel();
  clearTimeout(poll);
  snapshot = null;
  session = null;
  workspace = null;
  available = null;
  selectedRepos.clear();
  repoSearchQuery = "";
  repoFilter = "all";
  repoSelectionInitialized = false;
  graph?.destroy();
  graph = null;
  query = "";
  filter = "";
  errorMessage = "";
}
function chooseWorkspace(): void {
  const requested = new URL(location.href).searchParams.get("workspaceId");
  let remembered: string | null = null;
  try {
    remembered = sessionStorage.getItem("impact-gate-workspace");
  } catch {
    /* Server membership remains authoritative. */
  }
  workspace =
    session?.workspaces.find(
      (w) => w.id === requested || w.id === remembered,
    ) ??
    session?.workspaces[0] ??
    null;
  if (workspace) {
    try {
      sessionStorage.setItem("impact-gate-workspace", workspace.id);
    } catch {
      /* Nonessential preference. */
    }
  }
}
async function bootstrap(): Promise<void> {
  session = await api.request<SessionResponse>("/api/v1/session");
  chooseWorkspace();
  renderShell();
  identifyAnalyticsUser(auth.currentUser?.uid ?? null, workspace?.role ?? null);
  if (!reportedSetup && ["onboarding", "github-setup"].includes(page)) {
    reportedSetup = true;
    trackEvent("setup_started");
  }
  const selection = new URL(location.href).searchParams.get("githubSelection");
  if (selection && ["onboarding", "github-setup"].includes(page)) {
    await chooseInstallation(selection);
    return;
  }
  if (!workspace) {
    main.innerHTML = renderOnboarding();
    return;
  }
  if (["onboarding", "github-setup"].includes(page)) {
    await loadAvailable();
    await refresh(false);
    onboardingStatus = await api.request<WorkspaceOnboardingStatus>(
      `${route(workspace.id)}/onboarding`,
    );
    syncRecommendedRepos();
    render();
  } else {
    await refresh();
  }
  if (
    new URL(location.href).searchParams.has("import") &&
    page === "repositories"
  )
    await importRepositories();
}
async function chooseInstallation(flow: string): Promise<void> {
  const result = await api.request<{
    installations: InstallationChoice[];
    installUrl: string | null;
  }>(`/api/v1/github/connect/installations?${new URLSearchParams({ flow })}`);
  main.innerHTML = `<div class="ig-onboarding">${heading("Choose a GitHub account or organization", "Repositories are scoped to the account where the GitHub App is installed. Choose the owner of the repositories you want to use.")}<section class="ig-card">${result.installations.map((installation) => `<div class="ig-choice"><div><strong>${escape(installation.accountLogin)}</strong><p class="ig-note">${escape(installation.accountType === "User" ? "Personal account" : installation.accountType)}</p></div>${button("finish-github", "Connect", `data-id="${installation.installationId}" data-flow="${escape(flow)}"`)}</div>`).join("") || '<p class="ig-note">No GitHub App installations are linked yet. Install the app for the personal account or organization that owns your repositories, then refresh this list.</p>'}${result.installUrl ? `<a class="ig-button" href="${escape(url(result.installUrl))}">Install GitHub App for an account or organization ↗</a>` : ""}${button("connect-github", "Refresh installations", "", true)}</section></div>`;
}
async function importRepositories(): Promise<void> {
  await loadAvailable();
  modal("Select repositories", repoSelection());
}

function groupManager(full: WorkspaceSnapshot): string {
  const groups = full.groups ?? [];
  const repoOptions = (selected: string[]) =>
    full.repositories
      .map(
        (repo) =>
          `<label class="ig-note" style="display:block"><input type="checkbox" name="repositoryIds" value="${escape(repo.id)}" ${selected.includes(repo.id) ? "checked" : ""}> ${escape(repo.fullName)}</label>`,
      )
      .join("");
  const existing = groups
    .map(
      (
        group,
      ) => `<form data-group-form data-id="${escape(group.id)}" style="border-top:1px solid var(--ig-border, #ddd); padding-top:12px; margin-top:12px">
      <h3>${escape(group.name)}</h3>
      ${full.repositories.length ? repoOptions(group.repositoryIds) : '<p class="ig-note">No repositories are selected in this workspace yet.</p>'}
      <div class="ig-actions" style="margin-top:8px"><button type="submit" class="ig-button" ${writeDisabled()}>Save ${escape(group.name)}</button><button type="button" class="ig-button ig-button-secondary" data-action="group-delete" data-id="${escape(group.id)}" ${writeDisabled()}>Delete group</button></div>
      <p data-save-status role="status"></p>
    </form>`,
    )
    .join("");
  return `<form data-group-create>
      <div class="ig-actions"><input name="name" required maxlength="60" placeholder="New group name" aria-label="New group name" style="flex:1"><button type="submit" class="ig-button" ${writeDisabled()}>Create group</button></div>
      <p class="ig-note">Groups scope the APIs, services, and jobs shown across the dashboard to the repositories you pick.</p>
      <p data-save-status role="status"></p>
    </form>${existing}`;
}
async function manageGroups(): Promise<void> {
  if (!workspace) return;
  const full = await api.request<WorkspaceSnapshot>(
    `${route(workspace.id)}/snapshot?view=repositories`,
  );
  modal("Repository groups", groupManager(full));
}

async function mutate(
  action: () => Promise<void>,
  success?: string,
  onError?: (error: unknown) => void,
): Promise<boolean> {
  if (busy) return false;
  busy = true;
  const stopLoading = loadingFeedback.begin(
    success ? "Saving your changes…" : "Working on it…",
    2,
  );
  const controls = [
    ...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "[data-settings-form] button,[data-repositories-form] button,[data-action=confirm-review],[data-action=reindex],[data-runtime-form] button,button[data-provider]",
    ),
  ];
  const previous = controls.map((control) => control.disabled);
  controls.forEach((control) => {
    control.disabled = true;
  });
  try {
    await action();
    if (success) toast(success);
    return true;
  } catch (error) {
    onError?.(error);
    handleError(error);
    const status = $(
      "[data-save-status]",
      $<HTMLDialogElement>(".ig-dialog")?.open ? $(".ig-dialog")! : main,
    );
    if (status)
      status.textContent =
        error instanceof Error ? error.message : "The change was not saved.";
    return false;
  } finally {
    stopLoading();
    busy = false;
    controls.forEach((control, index) => {
      if (control.isConnected) control.disabled = previous[index];
    });
  }
}

document.addEventListener("input", (event) => {
  const runtimeForm =
    event.target instanceof Element
      ? event.target.closest<HTMLFormElement>("[data-runtime-form]")
      : null;
  if (runtimeForm && event.target instanceof Element) {
    runtimeConnectionChanged(runtimeForm, event.target);
    return;
  }
  if (
    event.target instanceof HTMLInputElement &&
    event.target.matches("[data-code-query]")
  ) {
    codeQuery = event.target.value;
    codePage = 0;
    const position = event.target.selectionStart;
    const card = event.target.closest(".ig-card");
    if (card && snapshot)
      card.outerHTML = renderFunctionInventory(snapshot, codeQuery);
    const field = $<HTMLInputElement>("[data-code-query]");
    field?.focus();
    field?.setSelectionRange(position, position);
    return;
  }
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.matches("[data-query]")) {
    query = input.value;
    collectionPage = 1;
    if (["api-usage", "pr-impact", "deprecation-candidates"].includes(page))
      scheduleCollectionRefresh();
    else {
      const position = input.selectionStart;
      render();
      const replacement = $<HTMLInputElement>("[data-query]");
      replacement?.focus();
      replacement?.setSelectionRange(position, position);
    }
  }
  if (input.matches("[data-repo-search]")) {
    repoSearchQuery = input.value;
    const form = input.closest<HTMLFormElement>("[data-repositories-form]");
    if (form) updateRepoListFiltering(form);
    return;
  }
  if (input.name === "repositoryIds") {
    const id = Number(input.value);
    if (input.checked) selectedRepos.add(id);
    else selectedRepos.delete(id);
    updateRepoSelectionUI();
  }
});
document.addEventListener("change", (event) => {
  const runtimeForm =
    event.target instanceof Element
      ? event.target.closest<HTMLFormElement>("[data-runtime-form]")
      : null;
  if (runtimeForm && event.target instanceof Element) {
    runtimeConnectionChanged(runtimeForm, event.target);
    return;
  }
  const select = event.target;
  if (
    event.target instanceof HTMLInputElement &&
    event.target.matches("[data-api-service], [data-api-service-all]")
  ) {
    const checkbox = event.target;
    if (checkbox.matches("[data-api-service-all]")) apiServiceFilters.clear();
    else if (checkbox.dataset.apiService) {
      if (checkbox.checked) apiServiceFilters.add(checkbox.dataset.apiService);
      else apiServiceFilters.delete(checkbox.dataset.apiService);
    }
    collectionPage = 1;
    scheduleCollectionRefresh();
    return;
  }
  if (!(select instanceof HTMLSelectElement)) return;
  if (
    select.matches("[data-api-coverage-status], [data-api-coverage-reason]")
  ) {
    const repository = snapshot?.repositories.find(
      (item) => item.id === select.dataset.id,
    );
    if (repository)
      showRepositoryCoverage(
        repository,
        1,
        1,
        select.matches("[data-api-coverage-status]")
          ? select.value
          : ($<HTMLSelectElement>(
              "[data-api-coverage-status]",
              select.closest("dialog")!,
            )?.value ?? ""),
        select.matches("[data-api-coverage-reason]")
          ? select.value
          : ($<HTMLSelectElement>(
              "[data-api-coverage-reason]",
              select.closest("dialog")!,
            )?.value ?? ""),
      );
    return;
  }
  if (select.matches("[data-filter]")) {
    collectionPage = 1;
    if (page === "api-usage") {
      apiServiceFilters = select.value ? new Set([select.value]) : new Set();
      scheduleCollectionRefresh();
    } else if (page === "pr-impact") {
      filter = select.value;
      scheduleCollectionRefresh();
    } else {
      filter = select.value;
      render();
    }
  }
  if (select.matches("[data-retirement-service]")) {
    retirementServiceFilter = select.value;
    collectionPage = 1;
    scheduleCollectionRefresh();
  }
  if (select.matches("[data-retirement-method]")) {
    retirementMethodFilter = select.value;
    collectionPage = 1;
    scheduleCollectionRefresh();
  }
  if (select.matches("[data-retirement-evidence]")) {
    retirementEvidenceFilter = select.value;
    collectionPage = 1;
    scheduleCollectionRefresh();
  }
  if (select.matches("[data-retirement-usage]")) {
    retirementUsageFilter = select.value;
    collectionPage = 1;
    scheduleCollectionRefresh();
  }
  if (select.matches("[data-retirement-review]")) {
    retirementReviewFilter = select.value;
    collectionPage = 1;
    scheduleCollectionRefresh();
  }
  if (select.matches("[data-group-picker]")) {
    activeGroupId = select.value || null;
    if (workspace) writeGroupPreference(workspace.id, activeGroupId);
    void refresh().catch(handleError);
  }
  if (select.matches("[data-workspace-picker]")) {
    activeGroupId = null;
    const id = select.value;
    if (document.body.dataset.navOpen === "true") closeNavigation();
    api.cancel();
    clearTimeout(poll);
    snapshot = null;
    available = null;
    selectedRepos.clear();
    repoSearchQuery = "";
    repoFilter = "all";
    repoSelectionInitialized = false;
    query = "";
    filter = "";
    workspace = session?.workspaces.find((w) => w.id === id) ?? null;
    try {
      sessionStorage.setItem("impact-gate-workspace", id);
    } catch {
      /* Preference only. */
    }
    state("Loading workspace", "Fetching the selected organization’s data.");
    void refresh().catch(handleError);
  }
});
document.addEventListener("submit", (event) => {
  const groupForm = event.target;
  if (
    groupForm instanceof HTMLFormElement &&
    groupForm.matches("[data-group-create]")
  ) {
    event.preventDefault();
    if (!groupForm.reportValidity() || !workspace || !canWrite()) return;
    const name = String(new FormData(groupForm).get("name") ?? "").trim();
    void mutate(async () => {
      await api.request(`${route(workspace!.id)}/groups`, {
        method: "POST",
        body: { name },
      });
      await refresh();
      await manageGroups();
    }, "Group created.");
    return;
  }
  if (
    groupForm instanceof HTMLFormElement &&
    groupForm.matches("[data-group-form]")
  ) {
    event.preventDefault();
    if (!workspace || !canWrite()) return;
    const groupId = groupForm.dataset.id!;
    const repositoryIds = new FormData(groupForm)
      .getAll("repositoryIds")
      .map(String);
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/groups/${encodeURIComponent(groupId)}/repositories`,
        { method: "PUT", body: { repositoryIds } },
      );
      await refresh();
      await manageGroups();
    }, "Group saved.");
    return;
  }

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.matches("[data-artifact-form]")) {
    event.preventDefault();
    if (!form.reportValidity() || !workspace || !canWrite()) return;
    const fields = new FormData(form);
    const repositoryId = String(fields.get("repositoryId"));
    const selected = [
      ...form.querySelectorAll<HTMLOptionElement>("option"),
    ].find((option) => option.value === repositoryId);
    const githubRepositoryId = Number(selected?.dataset.githubId);
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/deployment-identity/artifacts`,
        {
          method: "POST",
          body: {
            repositoryId,
            githubRepositoryId,
            commitSha: fields.get("commitSha"),
            imageDigest: fields.get("imageDigest"),
            componentPath: fields.get("componentPath") || null,
            artifactReference: fields.get("artifactReference") || null,
          },
        },
      );
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
      toast("Build provenance saved.");
    });
    return;
  }
  if (form.matches("[data-workload-link-form]")) {
    event.preventDefault();
    if (!form.reportValidity() || !workspace || !canWrite()) return;
    const fields = new FormData(form);
    void mutate(async () => {
      await api.request(`${route(workspace!.id)}/deployment-identity/links`, {
        method: "POST",
        body: {
          repositoryId: fields.get("repositoryId"),
          clusterId: form.dataset.cluster,
          namespace: form.dataset.namespace,
          workloadKind: form.dataset.kind,
          workloadName: form.dataset.workload,
          componentPath: fields.get("componentPath") || null,
          evidence: ["reviewed_operator_association"],
        },
      });
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
      toast("Repository association saved.");
    });
    return;
  }
  if (form.matches("[data-kubernetes-form]")) {
    event.preventDefault();
    if (!form.reportValidity() || !workspace || !canWrite()) return;
    const fields = new FormData(form);
    const namespaces = String(fields.get("namespaces") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const bearerToken = String(fields.get("bearerToken") ?? "");
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/deployment-identity/kubernetes`,
        {
          method: "POST",
          body: {
            clusterId: fields.get("clusterId"),
            displayName: fields.get("displayName"),
            apiServerUrl: fields.get("apiServerUrl"),
            environment: fields.get("environment"),
            namespaces,
            bearerToken,
          },
        },
      );
      form.querySelector<HTMLInputElement>("[name=bearerToken]")!.value = "";
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
      toast("Kubernetes inventory imported.");
    });
    return;
  }
  if (form.matches("[data-runtime-form]")) {
    event.preventDefault();
    if (!form.reportValidity() || !workspace || !canWrite()) return;
    void mutate(async () => {
      if (
        form.dataset.runtimePhase !== "review" &&
        !Object.keys(runtimeConnectionBody(form, true).config.serviceMappings)
          .length
      ) {
        await discoverRuntimeServices(form);
        return;
      }
      const connectionBody = runtimeConnectionBody(form);
      await api.request(
        `${route(workspace!.id)}/runtime/${form.dataset.provider}`,
        {
          method: "PUT",
          body: connectionBody,
        },
      );
      trackEvent("runtime_connection_saved", {
        provider: form.dataset.provider,
        service_count: Object.keys(connectionBody.config.serviceMappings)
          .length,
      });
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
      toast("Runtime connection saved and evidence imported.");
    });
    return;
  }
  if (form.matches("[data-settings-form]")) {
    event.preventDefault();
    if (!form.reportValidity() || !workspace || !snapshot || !canWrite())
      return;
    const fields = new FormData(form);
    const body = {
      version: snapshot.settings.version,
      syncDefaultBranch: fields.has("syncDefaultBranch"),
      prCommentsEnabled: fields.has("prCommentsEnabled"),
      externalModelsEnabled: session?.capabilities.externalModels
        ? fields.has("externalModelsEnabled")
        : snapshot.settings.externalModelsEnabled,
      aiSummaryEnabled: session?.capabilities.externalModels
        ? fields.has("aiSummaryEnabled")
        : snapshot.settings.aiSummaryEnabled,
      retentionDays: Number(fields.get("retentionDays")),
    };
    void mutate(async () => {
      const saved = await api.request<WorkspaceSettings>(
        `${route(workspace!.id)}/settings`,
        {
          method: "PATCH",
          body,
        },
      );
      snapshot!.settings = saved;
      trackEvent("workspace_settings_saved");
      render();
    }, "Workspace preferences saved.");
  }
  if (form.matches("[data-repositories-form]")) {
    event.preventDefault();
    if (!workspace || !canWrite()) return;
    const formIds = [...new FormData(form).getAll("repositoryIds")].map(Number);
    const repositoryIds = formIds.length ? formIds : [...selectedRepos];
    void mutate(async () => {
      snapshot = await api.request<WorkspaceSnapshot>(
        `${route(workspace!.id)}/repositories`,
        {
          method: "PUT",
          body: { repositoryIds },
        },
      );
      trackEvent("repository_selection_saved", {
        repository_count: repositoryIds.length,
      });
      await loadAvailable();
      $<HTMLDialogElement>(".ig-dialog")?.close();
      render();
      schedulePoll();
    }, "Repository selection saved. Indexing jobs are queued.");
  }
});
document.addEventListener("click", (event) => {
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>("a")
      : null;
  if (link && page === "api-usage" && selectedEndpoint) {
    try {
      const targetUrl = new URL(link.href, location.origin);
      if (
        targetUrl.pathname === "/dashboard/api-usage" &&
        !targetUrl.searchParams.has("endpointId")
      ) {
        event.preventDefault();
        const prevId = selectedEndpoint;
        selectedEndpoint = null;
        endpointTab = "overview";
        try {
          history.pushState({ endpointId: null }, "", "/dashboard/api-usage");
        } catch {
          /* History fallback */
        }
        render();
        try {
          if (typeof window.scrollTo === "function")
            window.scrollTo({ top: 0, behavior: "instant" });
        } catch {
          /* Scroll fallback */
        }
        if (prevId) {
          const restoreFocus = () => {
            document
              .querySelector<HTMLElement>(
                `[data-action="endpoint"][data-id="${prevId}"]`,
              )
              ?.focus();
          };
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(restoreFocus);
          } else {
            setTimeout(restoreFocus, 0);
          }
        }
        return;
      }
    } catch {
      /* Link fallback */
    }
  }
  const trigger =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-action]")
      : null;
  if (!trigger || (trigger instanceof HTMLButtonElement && trigger.disabled))
    return;
  const action = trigger.dataset.action;
  const id = trigger.dataset.id;
  if (action === "api-coverage-page" && id) {
    const repository = snapshot?.repositories.find((item) => item.id === id);
    if (repository)
      showRepositoryCoverage(
        repository,
        Number(trigger.dataset.page ?? 1),
        Number(trigger.dataset.diagnosticPage ?? 1),
        trigger.dataset.status ?? "",
        trigger.dataset.reason ?? "",
      );
    return;
  }
  if (action === "kubernetes-connect" && workspace && canWrite()) {
    modal("Connect Kubernetes", kubernetesConnectionForm());
    return;
  }
  if (action === "artifact-provenance" && snapshot && canWrite()) {
    modal("Add build provenance", artifactProvenanceForm(snapshot));
    return;
  }
  if (action === "workload-associate" && workspace && snapshot && canWrite()) {
    modal(
      "Associate workload with repository",
      workloadLinkForm(snapshot, {
        clusterId: trigger.dataset.cluster ?? "",
        namespace: trigger.dataset.namespace ?? "",
        kind: trigger.dataset.kind ?? "",
        name: trigger.dataset.workload ?? "",
      }),
    );
    return;
  }
  if (action === "kubernetes-sync" && workspace && canWrite()) {
    const cluster = trigger.dataset.cluster;
    if (!cluster) return;
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/deployment-identity/kubernetes/${encodeURIComponent(cluster)}/sync`,
        { method: "POST" },
      );
      await refresh();
    }, "Kubernetes inventory refreshed.");
    return;
  }
  if (action === "kubernetes-disconnect" && workspace && canWrite()) {
    const cluster = trigger.dataset.cluster;
    if (!cluster) return;
    modal(
      "Disconnect Kubernetes cluster",
      `<p>Remove the saved cluster credentials and workload inventory for ${escape(cluster)}?</p>${button("confirm-kubernetes-disconnect", "Disconnect", `data-cluster="${escape(cluster)}"`)}<p data-save-status role="status"></p>`,
    );
    return;
  }
  if (action === "confirm-kubernetes-disconnect" && workspace && canWrite()) {
    const cluster = trigger.dataset.cluster;
    if (!cluster) return;
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/deployment-identity/kubernetes/${encodeURIComponent(cluster)}`,
        { method: "DELETE" },
      );
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
    }, "Kubernetes cluster disconnected.");
    return;
  }
  if (
    action === "runtime-apply-suggestions" ||
    action === "runtime-fill-names"
  ) {
    const form = trigger.closest<HTMLFormElement>("[data-runtime-form]");
    if (!form || !canWrite() || busy) return;
    if (action === "runtime-apply-suggestions") {
      for (const select of form.querySelectorAll<HTMLSelectElement>(
        "[data-runtime-source]",
      ))
        if (!select.value && select.dataset.suggestedService)
          select.value = select.dataset.suggestedService;
    } else {
      for (const input of form.querySelectorAll<HTMLInputElement>(
        "[data-runtime-service]",
      ))
        if (!input.value) input.value = input.dataset.serviceName ?? "";
    }
    updateRuntimeConnectButton(form);
    return;
  }
  if (action === "collection-page") {
    const requested = Math.max(1, Number(trigger.dataset.page) || 1);
    collectionPage = requested;
    void refresh().catch(handleError);
    return;
  }
  if (action === "api-sort") {
    const requested = trigger.dataset.sort;
    if (requested && /^\d+$/.test(requested)) {
      if (apiSort === requested)
        apiSortDirection = apiSortDirection === "asc" ? "desc" : "asc";
      else {
        apiSort = requested;
        apiSortDirection = "asc";
      }
      render();
    }
    return;
  }
  if (action === "function-page" && snapshot) {
    codePage = Math.max(0, Number(trigger.dataset.page) || 0);
    const direction =
      trigger.dataset.direction === "previous" ? "previous" : "next";
    const card = trigger.closest(".ig-card");
    if (card)
      card.outerHTML = renderFunctionInventory(snapshot, codeQuery, codePage);
    const next = $<HTMLButtonElement>(
      `[data-action="function-page"][data-direction="${direction}"]`,
    );
    (next?.disabled
      ? $<HTMLButtonElement>('[data-action="function-page"]:not(:disabled)')
      : next
    )?.focus();
    return;
  }
  const runtimeProvider = trigger.dataset.provider;
  if (
    (runtimeProvider === "prometheus" || runtimeProvider === "datadog") &&
    workspace &&
    snapshot &&
    canWrite()
  ) {
    if (action === "runtime-connect") {
      modal(
        `Connect ${runtimeProvider === "prometheus" ? "Prometheus" : "Datadog"}`,
        runtimeConnectionForm(snapshot, runtimeProvider),
      );
      return;
    }
    if (action === "runtime-discover") {
      const form = $<HTMLFormElement>("[data-runtime-form]");
      if (!form || !form.reportValidity()) return;
      void mutate(() => discoverRuntimeServices(form));
      return;
    }
    if (action === "runtime-test") {
      const form = $<HTMLFormElement>("[data-runtime-form]");
      if (!form || !form.reportValidity()) return;
      void mutate(async () => {
        const result = await api.request<{
          observationCount: number;
          matchedEndpointCount: number;
          unmatchedObservationCount: number;
          warnings: string[];
        }>(`${route(workspace!.id)}/runtime/${runtimeProvider}/test`, {
          method: "POST",
          body: runtimeConnectionBody(form, true),
        });
        const status = $("[data-save-status]", form);
        if (status)
          status.textContent = `Connection reached. ${result.observationCount} source rows; ${result.matchedEndpointCount} endpoints with observed traffic; ${result.unmatchedObservationCount} unmatched rows. ${result.warnings.join(" ")}`;
      });
      return;
    }
    if (action === "runtime-sync") {
      void mutate(async () => {
        await api.request(
          `${route(workspace!.id)}/runtime/${runtimeProvider}/sync`,
          {
            method: "POST",
          },
        );
        trackEvent("runtime_sync_completed", { provider: runtimeProvider });
        await refresh();
      }, "Runtime evidence refreshed.");
      return;
    }
    if (action === "runtime-disconnect") {
      modal(
        "Disconnect runtime source",
        `<p>Remove the stored credentials and imported evidence for ${escape(runtimeProvider)} from this workspace? Reconnect the source to import its observations again.</p>${button("confirm-runtime-disconnect", "Disconnect", `data-provider="${runtimeProvider}"`)}<p data-save-status role="status"></p>`,
      );
      return;
    }
    if (action === "confirm-runtime-disconnect") {
      void mutate(async () => {
        await api.request(
          `${route(workspace!.id)}/runtime/${runtimeProvider}`,
          {
            method: "DELETE",
          },
        );
        trackEvent("runtime_connection_removed", { provider: runtimeProvider });
        $<HTMLDialogElement>(".ig-dialog")?.close();
        await refresh();
      }, "Runtime source disconnected.");
      return;
    }
  }
  if (action === "theme") {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    syncThemeControls();
    try {
      localStorage.setItem("impact-gate-theme", theme);
    } catch {
      /* Theme remains usable. */
    }
    // The graph observes theme changes without resetting its viewport.
    return;
  }
  if (action === "menu") {
    const open = document.body.dataset.navOpen !== "true";
    if (!open) {
      closeNavigation();
      return;
    }
    overlayFocus = trigger;
    document.body.dataset.navOpen = "true";
    trigger.setAttribute("aria-expanded", "true");
    const backdrop = $(".ig-backdrop");
    if (backdrop) backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    $(".ig-sidebar a")?.focus();
    return;
  }
  if (action === "close-overlays") {
    closeNavigation();
    return;
  }
  if (action === "close-dialog") {
    $<HTMLDialogElement>(".ig-dialog")?.close();
    return;
  }
  if (action === "external-model-info") {
    modal(
      "External model analysis",
      '<p>This workspace is configured for deterministic analysis only. No external model credentials or model provider are connected, so this setting cannot be enabled here.</p><p class="ig-note">Your contract diffs, static code paths, and runtime evidence remain available without a model provider.</p>',
    );
    return;
  }
  if (action === "sign-out") {
    void mutate(async () => {
      trackEvent("sign_out");
      clearSession();
      await auth.signOut();
      location.assign("/sign-in");
    });
    return;
  }
  if (action === "retry") {
    if (!auth) {
      location.reload();
      return;
    }
    if (!auth.currentUser) {
      location.assign(signInDestination(location.pathname, location.origin));
      return;
    }
    state("Loading workspace", "Fetching the latest data.");
    void bootstrap().catch(handleError);
    return;
  }
  if (action === "connect-github" || action === "add-workspace") {
    void mutate(async () => {
      const installation = new URL(location.href).searchParams.get(
        "installation_id",
      );
      const result = await api.request<{ url: string }>(
        "/api/v1/github/connect/start",
        {
          method: "POST",
          body: {
            returnTo: "/onboarding",
            ...(installation && /^\d+$/.test(installation)
              ? { installationId: Number(installation) }
              : {}),
          },
        },
      );
      const destination = new URL(result.url);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "github.com"
      )
        throw new Error("The GitHub authorization URL is invalid.");
      trackEvent("github_connection_start", { provider: "github" });
      location.assign(destination.href);
    });
    return;
  }
  if (action === "finish-github" && id) {
    void mutate(async () => {
      const result = await api.request<{ workspace: WorkspaceMembership }>(
        "/api/v1/github/connect/finish",
        {
          method: "POST",
          body: { flow: trigger.dataset.flow, installationId: Number(id) },
        },
      );
      try {
        sessionStorage.setItem("impact-gate-workspace", result.workspace.id);
      } catch {
        /* The new workspace remains available in the workspace picker. */
      }
      trackEvent("github_connected", { provider: "github" });
      history.replaceState(null, "", "/onboarding");
      await bootstrap();
    }, "GitHub account connected.");
    return;
  }
  if (action === "import") {
    void importRepositories().catch(handleError);
    return;
  }
  if (action === "manage-groups") {
    void manageGroups().catch(handleError);
    return;
  }
  if (action === "group-delete" && id) {
    void mutate(async () => {
      await api.request(
        `${route(workspace!.id)}/groups/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      if (activeGroupId === id) {
        activeGroupId = null;
        writeGroupPreference(workspace!.id, null);
      }
      $<HTMLDialogElement>(".ig-dialog")?.close();
      await refresh();
    }, "Group deleted.");
    return;
  }
  if (action === "repo-select-all") {
    const form = trigger.closest<HTMLFormElement>("[data-repositories-form]");
    if (form) {
      const isFiltered =
        Boolean(repoSearchQuery.trim()) || repoFilter !== "all";
      form.querySelectorAll<HTMLElement>(".ig-repo-option").forEach((opt) => {
        if (!isFiltered || opt.style.display !== "none") {
          const id = Number(opt.dataset.repoId);
          if (id) selectedRepos.add(id);
        }
      });
    } else if (available) {
      available.forEach((r) => selectedRepos.add(r.githubRepositoryId));
    }
    updateRepoSelectionUI();
    return;
  }
  if (action === "repo-deselect-all") {
    const form = trigger.closest<HTMLFormElement>("[data-repositories-form]");
    if (form) {
      const isFiltered =
        Boolean(repoSearchQuery.trim()) || repoFilter !== "all";
      if (isFiltered) {
        form.querySelectorAll<HTMLElement>(".ig-repo-option").forEach((opt) => {
          if (opt.style.display !== "none") {
            const id = Number(opt.dataset.repoId);
            if (id) selectedRepos.delete(id);
          }
        });
      } else {
        selectedRepos.clear();
      }
    } else {
      selectedRepos.clear();
    }
    updateRepoSelectionUI();
    return;
  }
  if (action === "repo-select-recommended") {
    const recIds = getRecommendedRepoIds();
    recIds.forEach((id) => selectedRepos.add(id));
    updateRepoSelectionUI();
    return;
  }
  if (action === "repo-filter") {
    const requestedFilter = trigger.dataset.filter as
      "all" | "selected" | "recommended";
    if (["all", "selected", "recommended"].includes(requestedFilter)) {
      repoFilter = requestedFilter;
      const form = trigger.closest<HTMLFormElement>("[data-repositories-form]");
      if (form) {
        form.querySelectorAll<HTMLElement>(".ig-repo-tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.filter === repoFilter);
        });
        updateRepoListFiltering(form);
      }
    }
    return;
  }
  if (action === "toggle-discovery-repo") {
    const id = Number(trigger.dataset.id);
    if (id) {
      if (selectedRepos.has(id)) selectedRepos.delete(id);
      else selectedRepos.add(id);
      updateRepoSelectionUI();
    }
    return;
  }
  if (action === "discovery-select-all") {
    const recIds = getRecommendedRepoIds();
    if (recIds.size) {
      recIds.forEach((id) => selectedRepos.add(id));
    } else if (available) {
      available
        .slice(0, 3)
        .forEach((r) => selectedRepos.add(r.githubRepositoryId));
    }
    updateRepoSelectionUI();
    return;
  }
  if (action === "discovery-clear-all") {
    selectedRepos.clear();
    updateRepoSelectionUI();
    return;
  }
  if (action === "quickstart" && workspace && canWrite()) {
    let ids: number[] = [];
    if (selectedRepos.size > 0) {
      ids = [...selectedRepos];
    } else {
      ids = (onboardingStatus?.providerRepositories ?? [])
        .concat(onboardingStatus?.recommendedConsumerRepositories ?? [])
        .map((repo) => repo.id);
      if (!ids.length && available?.length) {
        ids = available.slice(0, 3).map((r) => r.githubRepositoryId);
      }
    }
    if (!ids.length) {
      toast("No repositories selected. Please select at least one repository.");
      return;
    }
    void mutate(async () => {
      snapshot = await api.request<WorkspaceSnapshot>(
        `${route(workspace!.id)}/quickstart?view=onboarding`,
        { method: "POST", body: { repositoryIds: [...new Set(ids)] } },
      );
      onboardingStatus = await api.request<WorkspaceOnboardingStatus>(
        `${route(workspace!.id)}/onboarding`,
      );
      await loadAvailable();
      render();
    }, "Your API map is building.");
    return;
  }
  if (action === "clear-filters") {
    query = "";
    filter = "";
    apiServiceFilters.clear();
    retirementServiceFilter = "";
    retirementMethodFilter = "";
    retirementEvidenceFilter = "";
    retirementUsageFilter = "";
    retirementReviewFilter = "";
    collectionPage = 1;
    if (["api-usage", "pr-impact", "deprecation-candidates"].includes(page))
      void refresh().catch(handleError);
    else render();
    return;
  }
  if (action === "clear-api-filters") {
    query = "";
    apiServiceFilters.clear();
    collectionPage = 1;
    void refresh().catch(handleError);
    return;
  }
  if (action === "demo-traffic-refresh") {
    const traffic = trigger.closest<HTMLElement>("[data-demo-traffic]");
    if (traffic) void refreshDemoTraffic(traffic);
    return;
  }
  if (action === "endpoint" && id) {
    $<HTMLDialogElement>(".ig-dialog")?.close();
    if (page !== "api-usage") {
      const tabParam = trigger.dataset.tab
        ? `&tab=${encodeURIComponent(trigger.dataset.tab)}`
        : "";
      location.assign(
        `/dashboard/api-usage?endpointId=${encodeURIComponent(id)}${tabParam}`,
      );
      return;
    }
    selectedEndpoint = id;
    const requestedTab = trigger.dataset.tab;
    if (
      requestedTab &&
      ["overview", "flow", "consumers", "changes", "retirement"].includes(
        requestedTab,
      )
    ) {
      endpointTab = requestedTab;
    } else {
      endpointTab = "overview";
    }
    try {
      const nextUrl = new URL(location.href);
      nextUrl.pathname = "/dashboard/api-usage";
      nextUrl.searchParams.set("endpointId", id);
      if (endpointTab !== "overview")
        nextUrl.searchParams.set("tab", endpointTab);
      else nextUrl.searchParams.delete("tab");
      history.pushState(
        { endpointId: id, tab: endpointTab },
        "",
        nextUrl.toString(),
      );
    } catch {
      /* Navigation fallback */
    }
    const needsCode = endpointTab === "flow" && !snapshot?.code;
    render();
    if (needsCode) void refresh().catch(handleError);
    focusEndpointScreen();
    return;
  }
  if (action === "endpoint-tab") {
    endpointTab = trigger.dataset.tab ?? "overview";
    try {
      const nextUrl = new URL(location.href);
      if (endpointTab !== "overview")
        nextUrl.searchParams.set("tab", endpointTab);
      else nextUrl.searchParams.delete("tab");
      history.replaceState(
        { endpointId: selectedEndpoint, tab: endpointTab },
        "",
        nextUrl.toString(),
      );
    } catch {
      /* History fallback */
    }
    const needsCode = endpointTab === "flow" && !snapshot?.code;
    render();
    if (needsCode) void refresh().catch(handleError);
    focusEndpointTab(endpointTab);
    return;
  }
  if (action === "back-to-apis") {
    const prevId = selectedEndpoint;
    selectedEndpoint = null;
    endpointTab = "overview";
    try {
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.delete("endpointId");
      nextUrl.searchParams.delete("tab");
      history.pushState({ endpointId: null }, "", nextUrl.toString());
    } catch {
      /* History fallback */
    }
    render();
    try {
      if (typeof window.scrollTo === "function")
        window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      /* Scroll fallback */
    }
    if (prevId) {
      const restoreFocus = () => {
        const returnTrigger = document.querySelector<HTMLElement>(
          `[data-action="endpoint"][data-id="${prevId}"]`,
        );
        returnTrigger?.focus();
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreFocus);
      } else {
        setTimeout(restoreFocus, 0);
      }
    }
    return;
  }
  if (action === "endpoint-dialog" && id) {
    const endpoint = snapshot?.endpoints.find((e) => e.id === id);
    if (endpoint)
      modal(
        `${endpoint.method} ${endpoint.path}`,
        evidence([endpoint.source, ...(endpoint.implementationSources ?? [])]) +
          `<p>${endpoint.staticCallerCount} static callers · ${escape(coverage(endpoint))}</p><button type="button" class="ig-button ig-button-secondary" data-action="endpoint" data-id="${escape(endpoint.id)}">Inspect API and code flow</button>`,
      );
    return;
  }

  if (action === "finding" && id) {
    const finding = snapshot?.findings.find((f) => f.id === id);
    if (finding)
      modal(
        finding.endpoint,
        `<p>${badge(finding.risk, "risk")} ${escape(finding.verdict)}</p><p>${escape(finding.explanation)}</p><p><a href="${escape(url(finding.pullRequestUrl))}" target="_blank" rel="noopener noreferrer">Open pull request #${finding.pullRequestNumber} ↗</a></p>${finding.consumerEndpointIds ? `<h3>Possible affected consumer APIs</h3>${renderConsumerApiLinks(snapshot!, finding.consumerEndpointIds)}` : ""}${evidence(finding.evidence)}`,
      );
    return;
  }
  if (action === "repository" && id) {
    const repository = snapshot?.repositories.find((r) => r.id === id);
    if (repository) showRepositoryCoverage(repository);
    return;
  }
  if (action === "candidate" && id) {
    const candidate = snapshot?.candidates.find((c) => c.endpointId === id);
    const endpoint = snapshot?.endpoints.find((e) => e.id === id);
    if (candidate && endpoint)
      modal(
        `${endpoint.method} ${endpoint.path}`,
        `<p>${escape(candidate.reason)}</p><p>${candidate.staticCallerCount} static callers · ${escape(coverage(endpoint))}</p><p class="ig-note">Reviewing records your evidence review for this snapshot. Plan removals with your team and check unobserved consumers.</p>${evidence([endpoint.source, ...snapshot!.edges.filter((e) => e.endpointId === id).flatMap((e) => e.references)])}${button("confirm-review", candidate.reviewedAt && candidate.reviewedSnapshotId === snapshot?.snapshotId ? "Mark needs review" : "Mark reviewed for this snapshot", `data-id="${escape(id)}" data-reviewed="${!(candidate.reviewedAt && candidate.reviewedSnapshotId === snapshot?.snapshotId)}" ${writeDisabled()}`)}<p data-save-status role="status"></p>`,
      );
    return;
  }
  if (action === "confirm-review" && id && canWrite()) {
    void mutate(async () => {
      snapshot = await api.request<WorkspaceSnapshot>(
        `${route(workspace!.id)}/candidates/${encodeURIComponent(id)}/review?view=retirement`,
        {
          method: "POST",
          body: {
            snapshotId: snapshot!.snapshotId,
            reviewed: trigger.dataset.reviewed === "true",
          },
        },
      );
      trackEvent("evidence_review_saved", {
        action:
          trigger.dataset.reviewed === "true" ? "reviewed" : "needs_review",
      });
      $<HTMLDialogElement>(".ig-dialog")?.close();
      render();
    }, "Candidate review saved.");
    return;
  }
  if (action === "reindex" && id && canWrite()) {
    reindexErrors.delete(id);
    if (trigger instanceof HTMLButtonElement) trigger.disabled = true;
    trigger.textContent = "Queueing…";
    void mutate(
      async () => {
        const result = await api.request<{ job: WorkspaceJob }>(
          `${route(workspace!.id)}/repositories/${encodeURIComponent(id)}/index`,
          { method: "POST" },
        );
        if (
          !result.job ||
          result.job.type !== "index_repository" ||
          result.job.repositoryId !== id ||
          !["queued", "running"].includes(result.job.status)
        )
          throw new Error(
            "The server did not confirm the repository indexing job.",
          );
        trackEvent("repository_reindex_requested");
      },
      "Indexing job queued.",
      (error) => {
        reindexErrors.set(
          id,
          error instanceof Error
            ? error.message
            : "The repository could not be queued for indexing.",
        );
      },
    ).then(async (queued) => {
      if (!queued) {
        render();
        return;
      }
      try {
        await refresh();
      } catch (error) {
        handleError(error);
      }
    });
    return;
  }
  if (action === "link-github" || action === "link-google") {
    void mutate(async () => {
      await auth.linkProvider(action === "link-github" ? "github" : "google");
      session = await api.request<SessionResponse>("/api/v1/session");
      render();
    }, "Sign-in method connected.");
    return;
  }
  if (action === "code-export" && snapshot) {
    const flow =
      action === "code-export"
        ? snapshot.code?.flows.find((flow) => flow.endpointId === id)
        : null;
    const functions = flow
      ? snapshot.code?.functions.filter((fn) =>
          flow.functionIds.includes(fn.id),
        )
      : snapshot.code?.functions;
    const calls = flow
      ? snapshot.code?.calls.filter((call) => flow.callIds.includes(call.id))
      : snapshot.code?.calls;

    const data = { snapshotId: snapshot.snapshotId, flow, functions, calls };
    const download = document.createElement("a");
    const blob = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    download.href = blob;
    download.download = "impact-gate-code-flow.json";
    download.click();
    setTimeout(() => URL.revokeObjectURL(blob), 1000);
    return;
  }
  if (action === "notifications") {
    modal(
      "Recent jobs",
      snapshot?.jobs.length
        ? jobs()
        : "<p>No analysis jobs have been recorded yet.</p>",
    );
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.dataset.navOpen === "true")
    closeNavigation();
  if (event.key !== "Tab" || document.body.dataset.navOpen !== "true") return;
  const focusable = [
    ...document.querySelectorAll<HTMLElement>(
      ".ig-sidebar a[href],.ig-sidebar button:not(:disabled),.ig-sidebar select:not(:disabled)",
    ),
  ].filter((element) => element.getClientRects().length > 0);
  const first = focusable[0],
    last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
$(".ig-dialog")?.addEventListener("close", () => {
  for (const input of document.querySelectorAll<HTMLInputElement>(
    ".ig-dialog input[type=password]",
  ))
    input.value = "";
  overlayFocus?.focus();
  overlayFocus = null;
});

async function start(): Promise<void> {
  syncThemeControls();
  if (location.hostname === "www.impactgate.in") {
    const canonical = new URL(location.href);
    canonical.hostname = "impactgate.in";
    location.replace(canonical.href);
    return;
  }
  state("Loading your workspace", "Checking authentication configuration.");
  const stopConfigLoading = loadingFeedback.begin("Starting Impact Gate…", 1);
  let response: Response;
  try {
    response = await fetch("/api/v1/config", {
      cache: "no-store",
      credentials: "same-origin",
    });
  } finally {
    stopConfigLoading();
  }
  if (!response.ok)
    throw new Error("Authentication is unavailable. Please try again shortly.");
  const publicConfig: unknown = await response.json();
  config = publicConfig as PublicConfig;
  auth = new ImpactGateAuthClient(
    parseAuthConfig(publicConfig, location.origin),
  );
  api = new WorkspaceApi(auth, () =>
    loadingFeedback.begin("Loading your data…", 1),
  );
  if (
    page === "sign-in" &&
    new URLSearchParams(location.search).get("demo") === "1"
  ) {
    state(
      "Opening the live demo",
      "Signing you in to a read-only demo workspace.",
    );
    const stopDemoLoading = loadingFeedback.begin("Opening the live demo…", 2);
    let demo: Response;
    try {
      demo = await fetch("/api/v1/demo/session", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });
    } finally {
      stopDemoLoading();
    }
    if (!demo.ok)
      throw new Error(
        "The live demo is unavailable right now. Please try again shortly.",
      );
    const { token } = (await demo.json()) as { token: string };
    await auth.ready;
    await auth.signInWithDemoToken(token);
    location.assign("/dashboard");
    return;
  }
  if (["sign-in", "sign-up", "email-link"].includes(page)) {
    cleanupAuthPage = mountAuthPage(main, auth, {
      mode: page === "sign-up" ? "sign-up" : "sign-in",
      onAuthenticated: async (_user, next) => {
        const current = await api.request<SessionResponse>("/api/v1/session");
        const requested = safeReturnPath(next, location.origin);
        location.assign(
          current.workspaces.length
            ? requested
            : `/onboarding?${new URLSearchParams({ next: requested })}`,
        );
      },
    });
    return;
  }
  let attemptingDemo = false;
  auth.subscribe(async (current) => {
    if (current.status === "signed-out") {
      clearSession();
      if (!attemptingDemo && !["onboarding", "github-setup"].includes(page)) {
        attemptingDemo = true;
        const stopDemoLoading = loadingFeedback.begin(
          "Opening the live demo…",
          2,
        );
        try {
          state("Opening the live demo", "Loading read-only demo workspace.");
          const demo = await fetch("/api/v1/demo/session", {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
          });
          if (demo.ok) {
            const { token } = (await demo.json()) as { token: string };
            await auth.signInWithDemoToken(token);
            return;
          }
        } catch {
          /* Fall through to sign-in on demo failure */
        } finally {
          stopDemoLoading();
        }
      }
      location.replace(
        signInDestination(
          `${location.pathname}${location.search}`,
          location.origin,
        ),
      );
    } else if (current.status === "error") {
      clearSession();
      state("Authentication unavailable", current.error.message, true);
    } else if (
      current.status === "signed-in" &&
      current.user.uid !== loadingUid
    ) {
      loadingUid = current.user.uid;
      clearSession();
      state(
        "Loading your workspace",
        "Fetching your authorized GitHub workspace.",
      );
      void bootstrap().catch(handleError);
    }
  });
  await auth.ready;
}
window.addEventListener("popstate", () => {
  if (page === "api-usage") {
    try {
      const params = new URL(location.href).searchParams;
      const newEndpointId = params.get("endpointId");
      const rawTab = params.get("tab");
      const newTab = [
        "overview",
        "flow",
        "consumers",
        "changes",
        "retirement",
      ].includes(rawTab ?? "")
        ? rawTab!
        : "overview";
      if (newEndpointId !== selectedEndpoint || newTab !== endpointTab) {
        const returningToList = selectedEndpoint && !newEndpointId;
        const prevId = selectedEndpoint;
        selectedEndpoint = newEndpointId;
        endpointTab = newTab;
        const needsCode = endpointTab === "flow" && !snapshot?.code;
        render();
        if (needsCode) void refresh().catch(handleError);
        if (selectedEndpoint) {
          focusEndpointScreen();
        } else if (returningToList && prevId) {
          const restoreFocus = () => {
            document
              .querySelector<HTMLElement>(
                `[data-action="endpoint"][data-id="${prevId}"]`,
              )
              ?.focus();
          };
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(restoreFocus);
          } else {
            setTimeout(restoreFocus, 0);
          }
        }
      }
    } catch {
      /* Popstate fallback */
    }
  }
});
window.addEventListener("pagehide", () => {
  disposed = true;
  cleanupAuthPage?.();
  clearTimeout(poll);
  api?.cancel();
  graph?.destroy();
  auth?.dispose();
});
startWebsiteAnalytics();
void start().catch((error) => {
  const info = describeAuthError(error);
  state(
    "Sign-in unavailable",
    info.code === "auth/unknown" && error instanceof Error
      ? error.message
      : info.message,
    true,
  );
});

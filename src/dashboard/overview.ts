import type { WorkspaceSnapshot } from "../types/workspace";
import "./overview.css";

interface ChartSegment {
  label: string;
  count: number;
  color: string;
}

const icons = {
  repositories: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  services: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  endpoints: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  findings: '<path d="m10.3 3.9-8.5 14a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3l-8.5-14a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  candidates: '<circle cx="12" cy="12" r="10"/><path d="m5 5 14 14"/>',
};

interface CardDestination {
  href: string;
  label: string;
}

const destinations = {
  repositories: { href: "/dashboard/repositories", label: "View repositories" },
  services: { href: "/dashboard/dependency-graph", label: "View dependency graph" },
  endpoints: { href: "/dashboard/api-usage", label: "View API usage" },
  findings: { href: "#recent-findings", label: "Review findings" },
  candidates: { href: "/dashboard/deprecation-candidates", label: "Review candidates" },
} satisfies Record<keyof typeof icons, CardDestination>;

function metric(label: string, value: number, detail: string, icon: keyof typeof icons): string {
  const destination = destinations[icon];
  return `<a class="ig-overview-metric" data-metric="${icon}" href="${destination.href}" aria-label="${label}: ${value}. ${destination.label}">
    <div class="ig-overview-metric-top"><span>${label}</span><span class="ig-overview-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</svg></span></div>
    <strong class="ig-overview-value">${value}</strong><span class="ig-overview-metric-detail">${detail}</span>
    <span class="ig-overview-card-action">${destination.label}<span aria-hidden="true">→</span></span>
  </a>`;
}

function donut(segments: ChartSegment[], label: string): string {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  let offset = 0;
  const arcs = segments.filter(segment => segment.count > 0).map(segment => {
    const share = segment.count / total * 100;
    const arc = `<circle cx="60" cy="60" r="48" pathLength="100" fill="none" stroke="${segment.color}" stroke-width="11" stroke-dasharray="${share.toFixed(4)} ${(100 - share).toFixed(4)}" stroke-dashoffset="${(-offset).toFixed(4)}"/>`;
    offset += share;
    return arc;
  }).join("");
  return `<div class="ig-overview-donut-body">
    <div class="ig-overview-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-90 60 60)"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--ig-muted)" stroke-width="11"/>${arcs}</g></svg><div class="ig-overview-ring-label"><strong>${total}</strong><span>${label}</span></div></div>
    <ul class="ig-overview-legend">${segments.map(segment => `<li><span class="ig-overview-legend-label"><i style="background:${segment.color}" aria-hidden="true"></i>${segment.label}</span><strong>${segment.count}</strong></li>`).join("")}</ul>
  </div>`;
}

function panel(title: string, context: string, chart: string, note: string, destination: CardDestination): string {
  return `<section class="ig-overview-panel"><header><h2>${title}</h2><span>${context}</span></header>${chart}
    <footer class="ig-overview-panel-footer"><p class="ig-overview-chart-note">${note}</p><a class="ig-overview-card-action ig-overview-panel-link" href="${destination.href}" aria-label="${title}. ${destination.label}">${destination.label}<span aria-hidden="true">→</span></a></footer>
  </section>`;
}

/** Aggregate only the current authenticated snapshot; never insert illustrative records. */
export function overviewPanels(snapshot: WorkspaceSnapshot): string {
  const open = snapshot.findings.filter(finding => finding.status === "open");
  const severity: ChartSegment[] = [
    { label: "High", count: open.filter(finding => finding.risk === "high").length, color: "var(--ig-chart-high)" },
    { label: "Medium", count: open.filter(finding => finding.risk === "medium").length, color: "var(--ig-chart-medium)" },
    { label: "Low", count: open.filter(finding => finding.risk === "low").length, color: "var(--ig-chart-low)" },
  ];
  const noRisk = open.filter(finding => finding.risk === "none").length;
  if (noRisk) severity.push({ label: "No risk", count: noRisk, color: "var(--ig-secondary)" });

  const candidates: ChartSegment[] = [
    { label: "Strong candidate", count: snapshot.candidates.filter(candidate => candidate.status === "strong_candidate").length, color: "var(--ig-chart-candidate)" },
    { label: "Rare caller — verify", count: snapshot.candidates.filter(candidate => candidate.status === "rare_caller").length, color: "var(--ig-chart-medium)" },
    { label: "Building confidence", count: snapshot.candidates.filter(candidate => candidate.status === "building_confidence").length, color: "var(--ig-chart-low)" },
  ];
  const flagged = snapshot.candidates.filter(candidate => candidate.status === "flagged").length;
  if (flagged) candidates.push({ label: "Flagged for review", count: flagged, color: "var(--ig-chart-high)" });

  const indexed = snapshot.repositories.filter(repository => repository.status === "indexed").length;
  const pending = snapshot.repositories.length - indexed;
  const repositoryDetail = snapshot.repositories.length ? `${indexed} indexed${pending ? ` · ${pending} awaiting index` : ""}` : "Connect your GitHub repositories";
  const candidateDetail = `${candidates[0].count} strong · ${candidates[1].count} rare · ${candidates[2].count} building${flagged ? ` · ${flagged} flagged` : ""}`;
  const metrics = [
    metric("Repositories", snapshot.repositories.length, repositoryDetail, "repositories"),
    metric("Services", snapshot.services.length, "Across selected repositories", "services"),
    metric("APIs / Endpoints", snapshot.endpoints.length, "Discovered API inventory", "endpoints"),
    metric("Open Findings", open.length, "Current open pull request findings", "findings"),
    metric("Deprecation Candidates", snapshot.candidates.length, candidateDetail, "candidates"),
  ].join("");

  // Exact caller counts avoid implying traffic bands or runtime observations.
  const callerCounts = snapshot.endpoints.map(endpoint => endpoint.staticCallerCount);
  const usage: ChartSegment[] = [
    { label: "3+ callers", count: callerCounts.filter(count => count >= 3).length, color: "var(--ig-chart-used)" },
    { label: "2 callers", count: callerCounts.filter(count => count === 2).length, color: "var(--ig-chart-low)" },
    { label: "1 caller", count: callerCounts.filter(count => count === 1).length, color: "var(--ig-chart-light)" },
    { label: "No known callers", count: callerCounts.filter(count => count === 0).length, color: "var(--ig-secondary)" },
  ];
  const maximum = Math.max(1, ...usage.map(segment => segment.count));
  const bars = `<div class="ig-overview-bars" role="list" aria-label="Endpoints grouped by known static caller count">${usage.map(segment => `<div class="ig-overview-bar-item" role="listitem"><strong>${segment.count}</strong><div class="ig-overview-bar-track" aria-hidden="true"><span style="height:${segment.count / maximum * 100}%;background:${segment.color}"></span></div><span class="ig-overview-bar-label">${segment.label}</span></div>`).join("")}</div>`;
  const runtimeAvailable = snapshot.endpoints.some(endpoint => endpoint.runtimeCoverage === "available");
  const usageNote = snapshot.endpoints.length ? `Indexed caller evidence · ${runtimeAvailable ? "traffic may differ" : "runtime usage unknown"}` : "Caller evidence appears after indexing";

  return `<div class="ig-overview-metrics" aria-label="Workspace summary">${metrics}</div><div class="ig-overview-panels">
    ${panel("Findings by Severity", "Triage priority", donut(severity, "Open findings"), "Current open pull request findings", destinations.findings)}
    ${panel("API Usage Distribution", "Static callers", bars, usageNote, destinations.endpoints)}
    ${panel("Deprecation Candidates", "Evidence review", donut(candidates, "Candidates"), "Verify runtime coverage before removal", destinations.candidates)}
  </div>`;
}

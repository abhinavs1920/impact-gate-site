import type {
  ApiReviewRun,
  CallResolutionCase,
  WorkspaceSettings,
} from "../types/workspace";
import type { WorkspaceApi } from "./api";

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const statuses = [
  "pending",
  "static_resolved",
  "inferred",
  "external",
  "unresolved",
  "failed",
  "disabled",
  "superseded",
  "deferred_budget",
  "provider_unavailable",
  "needs_deeper_analysis",
];
const notReady = new Set([
  "pending",
  "failed",
  "disabled",
  "superseded",
  "deferred_budget",
  "provider_unavailable",
  "needs_deeper_analysis",
]);

export function renderPostIndexSettings(
  settings: WorkspaceSettings,
  available: boolean,
  disabled: string,
): string {
  const locked = !available ? "disabled" : disabled;
  return `<fieldset><legend>Post-index investigation</legend>
    <label class="ig-checkbox"><input type="checkbox" name="postIndexAnalysisEnabled" ${settings.postIndexAnalysisEnabled ? "checked" : ""} ${locked}> Investigate unresolved calls after indexing</label>
    <label class="ig-checkbox"><input type="checkbox" name="shareResolutionSource" ${settings.sourceEvidencePolicy === "source_excerpts" ? "checked" : ""} ${locked}> Allow relevant source excerpts to be sent to configured AI providers</label>
    <p class="ig-note">Both settings are required for source investigation. Accepted AI and static mappings have equal weight in API flows and normal or draft pull request impact; each relationship shows its origin.</p>
    <label class="ig-checkbox"><input type="checkbox" name="apiReviewEnabled" ${settings.apiReviewEnabled ? "checked" : ""} ${locked}> Generate advisory analyzer-improvement suggestions from indexing metadata</label>
    ${!available ? '<p class="ig-note">Post-index investigation is unavailable on this deployment. Existing evidence remains visible.</p>' : ""}
  </fieldset>`;
}

export function callResolutionOrigin(
  item: CallResolutionCase,
): "Static" | "AI" | "Static + AI" | "Unspecified" {
  if (
    item.decision &&
    (item.observation.origin === "static" ||
      item.observation.origin === "mixed")
  )
    return "Static + AI";
  if (item.status === "static_resolved" || item.observation.origin === "static")
    return "Static";
  return item.decision ? "AI" : "Unspecified";
}

export function renderCallResolution(item: CallResolutionCase): string {
  const observation = item.observation;
  const unreviewed =
    item.decision?.status === "inferred" &&
    item.decision?.sourceReview?.verdict !== "supported";
  const ambiguous =
    item.status === "inferred" &&
    !unreviewed &&
    (!item.decision?.targetSetComplete || item.decision.targetIds.length !== 1);
  const state = ambiguous
    ? "Ambiguous"
    : unreviewed
      ? "Not ready"
      : item.status === "inferred" || item.status === "static_resolved"
        ? "Resolved"
        : notReady.has(item.status)
          ? "Not ready"
          : item.status.replaceAll("_", " ");
  const target =
    observation.staticCall?.targetName ??
    `${observation.apiItem?.method ?? ""} ${observation.apiItem?.path ?? observation.kind}`;
  return `<tr><td><code>${escape(target)}</code><br>${escape(observation.source.filePath)}:${observation.source.line}</td>
    <td>${callResolutionOrigin(item)}</td><td>${escape(state)}${notReady.has(item.status) ? `<br><small>${escape((item.error ?? item.status).replaceAll("_", " "))}</small>` : ""}</td>
    <td>${escape(item.decision?.reason ?? observation.reason)}${unreviewed ? "<br><small>AI proposal is awaiting source review and is not included in impact.</small>" : ""}<br><button type="button" class="ig-button ig-button-secondary" data-resolution-detail="${escape(item.id)}">Why this outcome?</button></td></tr>`;
}

export function renderCallResolutionDetail(item: CallResolutionCase): string {
  const decision = item.decision;
  const evidence = new Map(item.evidence?.map((entry) => [entry.id, entry]));
  return `<h4>Decision explanation</h4>${item.observation.origin === "static" && decision ? `<h5>Static analysis</h5><p>${escape(item.observation.reason)}</p>` : ""}<h5>${decision ? "AI proposal" : "Static result"}</h5><p>${escape(decision?.reason ?? item.observation.reason)}</p>
    ${
      decision
        ? `<p>${escape(decision.relationship.explanation)}</p><p>Supported targets: ${escape(decision.targetIds.join(", ") || "none")}. Target set ${decision.targetSetComplete ? "complete for this observation" : "incomplete"}.</p>
      <p>Uncertainty: ${escape(decision.uncertainty)}</p>${decision.neededEvidence.length ? `<p>Needed evidence: ${escape(decision.neededEvidence.join("; "))}</p>` : ""}
      ${
        decision.sourceReview
          ? `<section><h4>Second-pass source review: ${decision.sourceReview.verdict === "supported" ? "supported" : "rejected"}</h4><p>${escape(decision.sourceReview.relationshipExplanation)}</p><p>${escape(decision.sourceReview.rationale)}</p><p>Link evidence IDs: ${escape(decision.sourceReview.linkEvidenceIds.join(", "))}</p>${decision.sourceReview.evidence
              .map((citation) => {
                const entry = evidence.get(citation.evidenceId);
                return `<figure><figcaption>${entry ? `${escape(entry.source.filePath)}:${entry.source.line} · ${escape(entry.source.sha.slice(0, 12))}` : escape(citation.evidenceId)}</figcaption><pre><code>${escape(citation.quote)}</code></pre></figure>`;
              })
              .join("")}</section>`
          : decision.status === "inferred"
            ? '<p class="ig-permission">This saved AI proposal has not passed source review. It is not used for impact analysis.</p>'
            : ""
      }
      ${decision.evidence
        .map((citation) => {
          const entry = evidence.get(citation.evidenceId);
          return `<figure><figcaption>${entry ? `${escape(entry.source.filePath)}:${entry.source.line} · ${escape(entry.source.sha.slice(0, 12))}` : escape(citation.evidenceId)}</figcaption><pre><code>${escape(citation.quote)}</code></pre>${entry?.truncated ? '<p class="ig-note">This excerpt is partial.</p>' : ""}</figure>`;
        })
        .join("")}`
        : ""
    }
    ${item.error ? `<p>Processing reason: ${escape(item.error.replaceAll("_", " "))}</p>` : ""}
    <p class="ig-note">${item.attempts} investigation requests · ${escape(item.inputTokens)} input tokens · ${escape(item.outputTokens)} output/reasoning tokens. Transport retries and spend are accounted separately in the run totals.</p>`;
}

/** Each mount owns its request generation; stale responses cannot replace a newer filter/page. */
export function mountCallResolutions(
  container: HTMLElement,
  api: Pick<WorkspaceApi, "request">,
  workspaceId: string,
  run: ApiReviewRun,
): void {
  const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/api-reviews/${encodeURIComponent(run.id)}/calls`;
  let offset = 0,
    status = "",
    origin = "",
    generation = 0,
    detailGeneration = 0;
  const summary = run.resolutionSummary;
  const count = (key: string) => Number(summary?.[key] ?? 0);
  const hasReviewSummary = Boolean(summary && "aiResolved" in summary);
  const aiResolved = hasReviewSummary ? count("aiResolved") : count("inferred");
  const summaryHtml = summary
    ? `<p>Static resolved ${count("staticResolved")} · ${hasReviewSummary ? "AI resolved" : "AI results"} ${aiResolved} · Static + AI ${count("mixedResolved")} · Unresolved ${count("unresolved")} · Pending ${count("pending")} · Not ready ${["failed", "disabled", "deferredBudget", "providerUnavailable", "needsDeeperAnalysis", "superseded"].reduce((total, key) => total + count(key), 0) + count("uncertifiedInferred")}</p>${count("uncertifiedInferred") ? `<p class="ig-permission">${count("uncertifiedInferred")} saved AI result(s) lack a current source-review certificate and are excluded from impact analysis.</p>` : ""}
    <p class="ig-note">${count("transportAttempts")} provider attempts · $${(count("chargedMicroUsd") / 1_000_000).toFixed(4)} charged or reserved · ${count("uncertainRequests")} requests with uncertain usage.</p>${(summary.analysisScope as { partial?: boolean } | undefined)?.partial ? '<p class="ig-permission">Partial indexing: undiscovered calls may remain in skipped or incomplete files.</p>' : ""}`
    : '<p class="ig-note">Investigation totals are not yet available for this run.</p>';
  container.innerHTML = `<h3>Call resolution and explanations</h3><p>Source commit <code>${escape(run.commitSha.slice(0, 12))}</code>. Accepted AI and static relationships have equal impact weight. Ambiguous targets remain alternatives.</p>${summaryHtml}
    <div class="ig-filters"><label>Outcome <select data-resolution-status><option value="">All outcomes</option>${statuses.map((value) => `<option value="${value}">${value.replaceAll("_", " ")}</option>`).join("")}</select></label>
    <label>Origin <select data-resolution-origin><option value="">All origins</option><option value="static">Static</option><option value="ai">AI</option><option value="mixed">Mixed</option><option value="unspecified">Unspecified</option></select></label></div>
    <div data-resolution-list role="status">Loading call outcomes…</div><div data-resolution-explanation aria-live="polite"></div>`;
  const list = container.querySelector<HTMLElement>("[data-resolution-list]")!;
  const detail = container.querySelector<HTMLElement>(
    "[data-resolution-explanation]",
  )!;
  async function load() {
    const current = ++generation;
    ++detailGeneration;
    detail.innerHTML = "";
    list.innerHTML = '<p role="status">Loading call outcomes…</p>';
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (status) params.set("status", status);
    if (origin) params.set("origin", origin);
    try {
      const page = await api.request<{
        calls: CallResolutionCase[];
        total: number;
        hasNext: boolean;
      }>(`${root}?${params}`);
      if (!container.isConnected || current !== generation) return;
      list.innerHTML = page.calls.length
        ? `<div class="ig-table-wrap"><table><thead><tr><th>Call</th><th>Origin</th><th>Outcome</th><th>Reason</th></tr></thead><tbody>${page.calls.map(renderCallResolution).join("")}</tbody></table></div>`
        : "<p>No call outcomes match this filter. Preparation may still be pending.</p>";
      list.insertAdjacentHTML(
        "beforeend",
        `<p>${page.total ? `${offset + 1}–${Math.min(offset + 20, page.total)}` : "0"} of ${page.total} calls</p><button type="button" class="ig-button ig-button-secondary" data-resolution-page="previous" ${offset === 0 ? "disabled" : ""}>Previous calls</button> <button type="button" class="ig-button ig-button-secondary" data-resolution-page="next" ${!page.hasNext ? "disabled" : ""}>Next calls</button>`,
      );
    } catch {
      if (container.isConnected && current === generation)
        list.innerHTML =
          '<p role="alert">Call explanations could not be loaded.</p><button type="button" class="ig-button" data-resolution-page="retry">Retry</button>';
    }
  }
  container.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.matches("[data-resolution-status]")) status = target.value;
    else if (target.matches("[data-resolution-origin]")) origin = target.value;
    else return;
    offset = 0;
    void load();
  });
  container.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!target || target.disabled) return;
    if (target.dataset.resolutionPage) {
      if (target.dataset.resolutionPage === "next") offset += 20;
      if (target.dataset.resolutionPage === "previous")
        offset = Math.max(0, offset - 20);
      void load();
    } else if (target.dataset.resolutionDetail) {
      const current = ++detailGeneration;
      const detailRoot = `${root}/${encodeURIComponent(target.dataset.resolutionDetail)}`;
      detail.innerHTML = '<p role="status">Loading decision evidence…</p>';
      void api
        .request<{ call: CallResolutionCase }>(detailRoot)
        .then(({ call }) => {
          if (!container.isConnected || current !== detailGeneration) return;
          detail.innerHTML = `${renderCallResolutionDetail(call)}<button type="button" class="ig-button ig-button-secondary" data-resolution-steps="${escape(call.id)}" data-step-offset="0">Show investigation history</button><div data-resolution-history></div>`;
        })
        .catch(() => {
          if (container.isConnected && current === detailGeneration)
            detail.innerHTML =
              '<p role="alert">Decision evidence could not be loaded.</p>';
        });
    } else if (target.dataset.resolutionSteps) {
      const current = detailGeneration;
      const history = detail.querySelector<HTMLElement>(
        "[data-resolution-history]",
      )!;
      const stepOffset = Number(target.dataset.stepOffset ?? 0);
      target.disabled = true;
      void api
        .request<{
          steps: Array<{
            sequence: number;
            event: { kind: string; details: Record<string, unknown> };
          }>;
          total: number;
          hasNext: boolean;
        }>(
          `${root}/${encodeURIComponent(target.dataset.resolutionSteps)}/steps?limit=20&offset=${stepOffset}`,
        )
        .then((page) => {
          if (!container.isConnected || current !== detailGeneration) return;
          history.insertAdjacentHTML(
            "beforeend",
            `<ol start="${stepOffset + 1}">${page.steps.map((step) => `<li>${escape(step.event.kind === "tool" ? `${String(step.event.details.action).replaceAll("_", " ")} ${JSON.stringify(step.event.details.arguments ?? {})}` : step.event.kind.replaceAll("_", " "))}</li>`).join("")}</ol>`,
          );
          target.dataset.stepOffset = String(stepOffset + page.steps.length);
          target.textContent = page.hasNext
            ? "More investigation history"
            : `All ${page.total} steps shown`;
          target.disabled = !page.hasNext;
        })
        .catch(() => {
          if (current === detailGeneration) {
            target.disabled = false;
            target.textContent = "Retry investigation history";
          }
        });
    }
  });
  void load();
}

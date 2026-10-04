import type {
  RuntimeConnectionConfig,
  RuntimeCredentials,
  RuntimeProvider,
  RuntimeServiceDiscovery,
  RuntimeServiceMatch,
} from "../types/runtime";
import type { WorkspaceSnapshot } from "../types/workspace";

const escape = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const name = (provider: RuntimeProvider): string =>
  provider === "prometheus" ? "Prometheus" : "Datadog";
const date = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "Not synced yet";
function sourceLink(config: RuntimeConnectionConfig): string {
  const url = new URL(
    config.provider === "prometheus"
      ? config.baseUrl
      : `https://app.${config.site}/apm/traces`,
  );
  if (config.provider === "datadog")
    url.searchParams.set("query", config.query);
  return `<a class="ig-button ig-button-secondary" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>`;
}
const button = (
  action: string,
  label: string,
  provider: RuntimeProvider,
  disabled: boolean,
): string =>
  `<button type="button" class="ig-button ig-button-secondary" data-action="${action}" data-provider="${provider}" ${disabled ? "disabled" : ""}>${label}</button>`;

export function runtimeConnectionsPanel(
  snapshot: WorkspaceSnapshot,
  enabled: boolean,
  canWrite: boolean,
): string {
  const connections = snapshot.runtimeConnections ?? [];
  return `<section class="ig-card" id="runtime-connections"><h2>Runtime observability connections</h2><p>Use your existing Prometheus metrics or Datadog APM to see traffic for the APIs in your repositories.</p><p class="ig-note">Enter source access, find and review service matches, then connect. Imports refresh every 15 minutes. No traffic in a query does not establish that an API is unused.</p><a href="/docs/runtime-observability">Connection guide and instrumentation requirements →</a>${!enabled ? '<p class="ig-permission">Runtime connections are unavailable on this deployment.</p>' : !snapshot.services.length ? '<p class="ig-permission">Index a provider repository before connecting a source.</p>' : ""}<div class="ig-runtime-providers">${(
    ["prometheus", "datadog"] as const
  )
    .map((provider) => {
      const connection = connections.find((item) => item.provider === provider);
      const disabled = !enabled || !canWrite || !snapshot.services.length;
      return `<section class="ig-runtime-provider"><h3>${name(provider)}</h3><p>${connection ? `${connection.status === "connected" ? "Connected" : "Sync error"} · ${connection.matchedEndpointCount} endpoints with observed traffic` : "Not connected"}</p>${connection ? `<p class="ig-note">Last successful import: ${escape(date(connection.lastSyncedAt))}<br>Window: ${escape(date(connection.windowStart))} – ${escape(date(connection.windowEnd))}<br>${connection.observationCount} source rows · ${connection.unmatchedObservationCount} unmatched rows</p>${connection.error ? `<p class="ig-permission" role="status">${escape(connection.error)}</p>` : ""}${connection.lastSyncedAt && Date.now() - new Date(connection.lastSyncedAt).getTime() > 45 * 60000 ? '<p class="ig-permission">Observations are stale. Sync the source to restore current coverage.</p>' : ""}${connection.warnings.length ? `<ul class="ig-note">${connection.warnings.map((warning) => `<li>${escape(warning)}</li>`).join("")}</ul>` : ""}` : `<p class="ig-note">${provider === "prometheus" ? "Import request counter increases by service, HTTP method, and route." : "Import indexed APM spans by service and route. Counts may be sampled."}</p>`}<div class="ig-actions">${button("runtime-connect", connection ? "Edit connection" : `Connect ${name(provider)}`, provider, disabled)}${connection ? button("runtime-sync", "Sync now", provider, !canWrite) + button("runtime-disconnect", "Disconnect", provider, !canWrite) + sourceLink(connection.config) : ""}</div></section>`;
    })
    .join(
      "",
    )}</div><p class="ig-note">Connection credentials are stored encrypted and are never returned to your browser. Owners and admins can manage connections; viewers can inspect coverage.</p></section>`;
}

export function runtimeServiceReview(snapshot: WorkspaceSnapshot, result: RuntimeServiceDiscovery, saved = false): string {
  const row = (match: RuntimeServiceMatch): string => {
    const candidates = new Set(match.candidates.map(candidate => candidate.serviceId));
    const ordered = [...snapshot.services].sort((a, b) => Number(candidates.has(b.id)) - Number(candidates.has(a.id)) || a.name.localeCompare(b.name));
    const selected = match.confidence === "high" ? match.suggestedServiceId : null;
    return `<label class="ig-runtime-match" data-confidence="${match.confidence}"><span><code>${escape(match.sourceService)}</code><small>${escape(match.roles.length ? match.roles.join(" + ") : "Saved service")}${match.routeCount ? ` · ${match.routeCount} API routes` : ""}</small></span><span><select data-runtime-source="${escape(match.sourceService)}" data-suggested-service="${escape(match.suggestedServiceId ?? "")}" aria-label="Map ${escape(match.sourceService)} to an indexed service"><option value="">Skip / choose a service</option>${ordered.map(service => `<option value="${escape(service.id)}" ${service.id === selected ? "selected" : ""}>${escape(service.name)} · ${escape(snapshot.repositories.find(repo => repo.id === service.repositoryId)?.fullName.split("/").at(-1) ?? service.rootPath)}</option>`).join("")}</select><small>${escape(match.reason)}</small></span></label>`;
  };
  const ready = result.services.filter(service => service.confidence === "high");
  const review = result.services.filter(service => service.confidence !== "high");
  const suggestions = review.filter(service => service.suggestedServiceId);
  return `<div class="ig-runtime-summary" role="status"><strong>${saved ? `${result.services.length} saved mappings` : `${result.services.filter(service => service.roles.length).length} source services found`} · ${ready.length} matches ready</strong><p>Review the matches, then connect. Leave services you do not want to import unselected.</p></div>${!result.services.length ? '<p class="ig-permission">No services were found in this query window. Check the query and labels in Advanced settings, widen the window, or use manual mapping for a service with no observations.</p>' : ""}${review.length ? `<div class="ig-runtime-review-heading"><h4>${review.length} services to review</h4>${suggestions.length ? '<button type="button" class="ig-button ig-button-secondary" data-action="runtime-apply-suggestions">Use all suggested matches</button>' : ""}</div>${review.map(row).join("")}` : ""}${ready.length ? `<details class="ig-runtime-ready"><summary>${ready.length} matches ready to connect · review matches</summary>${ready.map(row).join("")}</details>` : ""}${result.warnings.length ? `<details class="ig-runtime-notes"><summary>Source coverage notes</summary><ul class="ig-note">${result.warnings.map(warning => `<li>${escape(warning)}</li>`).join("")}</ul></details>` : ""}`;
}

export function updateRuntimeConnectButton(form: HTMLFormElement): void {
  const primary = form.querySelector<HTMLButtonElement>("[data-runtime-primary]");
  if (!primary) return;
  let count: number;
  try { count = Object.keys(runtimeConnectionBody(form, true).config.serviceMappings).length; }
  catch (error) {
    const status = form.querySelector("[data-save-status]");
    if (status) status.textContent = error instanceof Error ? error.message : "Review the service mappings.";
    form.dataset.mappingError = "true";
    primary.textContent = "Review service mappings"; return;
  }
  if (form.dataset.mappingError) {
    delete form.dataset.mappingError;
    const status = form.querySelector("[data-save-status]"); if (status) status.textContent = "";
  }
  primary.textContent = form.dataset.runtimePhase === "review" || count > 0
    ? `${form.dataset.existing === "true" ? "Save connection" : "Connect"}${count ? ` · ${count} services` : ""}`
    : "Find and match services";
}

export function runtimeConnectionChanged(form: HTMLFormElement, target: Element): void {
  if (target.matches("[data-runtime-auth]")) {
    const auth = form.querySelector<HTMLSelectElement>("[data-runtime-auth]")!.value;
    for (const group of form.querySelectorAll<HTMLElement>("[data-runtime-auth-fields]")) {
      const active = group.dataset.runtimeAuthFields === auth;
      group.hidden = !active;
      for (const input of group.querySelectorAll<HTMLInputElement>("input")) {
        input.disabled = !active; input.required = active;
      }
    }
  }
  if (target.matches("[data-runtime-source],[data-runtime-service]")) {
    updateRuntimeConnectButton(form); return;
  }
  if (!target.matches("input,select,textarea")) return;
  form.dataset.runtimeRevision = String(Number(form.dataset.runtimeRevision ?? 0) + 1);
  if (form.dataset.runtimePhase === "review") {
    form.dataset.runtimePhase = "source";
    const review = form.querySelector("[data-runtime-review]");
    if (review) review.innerHTML = '<p class="ig-note">Source settings changed. Find services again to update the matches.</p>';
    const status = form.querySelector("[data-save-status]"); if (status) status.textContent = "";
    updateRuntimeConnectButton(form);
  }
}

export function runtimeConnectionForm(snapshot: WorkspaceSnapshot, provider: RuntimeProvider): string {
  const existing = snapshot.runtimeConnections?.find(item => item.provider === provider);
  const config = existing?.config;
  const input = (key: string, label: string, value: string, required = true): string =>
    `<label>${label}<input name="${key}" value="${escape(value)}" ${required ? "required" : ""} maxlength="2048"></label>`;
  const settings = { query: provider === "prometheus" ? 'sum by (service, method, route) (increase(http_requests_total{route!=""}[{{window}}]))' : "env:production", serviceLabel: "service", methodLabel: "method", routeLabel: "route", callerLabel: "", serviceFacet: "service", methodFacet: "@http.method", routeFacet: "resource_name", callerFacet: "", ...config };
  const source = provider === "prometheus"
    ? `<label>Prometheus URL<input type="url" name="baseUrl" value="${escape(config?.provider === "prometheus" ? config.baseUrl : "")}" placeholder="https://metrics.example.com" required maxlength="2048"></label><label>Authentication<select name="authentication" data-runtime-auth>${existing ? '<option value="saved" selected>Keep saved credentials</option>' : ""}<option value="none">No authentication</option><option value="bearer">Bearer token</option><option value="basic">Username and password</option></select></label><div data-runtime-auth-fields="bearer" hidden><label>Bearer token<input type="password" name="bearerToken" autocomplete="new-password" maxlength="4096" disabled></label></div><div data-runtime-auth-fields="basic" hidden><label>Username<input name="username" autocomplete="username" maxlength="4096" disabled></label><label>Password or access token<input type="password" name="password" autocomplete="new-password" maxlength="4096" disabled></label></div><p class="ig-note">Use a query server reachable from Impact Gate. Private servers require network access configured by your deployment owner.</p>`
    : `<label>Datadog site<select name="site">${["datadoghq.com", "us3.datadoghq.com", "us5.datadoghq.com", "datadoghq.eu", "ap1.datadoghq.com", "ap2.datadoghq.com", "uk1.datadoghq.com", "ddog-gov.com", "us2.ddog-gov.com"].map(site => `<option ${site === (config?.provider === "datadog" ? config.site : "datadoghq.com") ? "selected" : ""}>${site}</option>`).join("")}</select></label><label>API key<input type="password" name="apiKey" autocomplete="new-password" maxlength="4096" ${existing ? "" : "required"}></label><label>Application key with apm_read permission<input type="password" name="applicationKey" autocomplete="new-password" maxlength="4096" ${existing ? "" : "required"}></label>${existing ? '<p class="ig-note">Leave both keys blank to keep saved credentials.</p>' : ""}`;
  const advanced = provider === "prometheus"
    ? `${input("serviceLabel", "Service label", settings.serviceLabel)}${input("methodLabel", "HTTP method label", settings.methodLabel)}${input("routeLabel", "Route template label", settings.routeLabel)}${input("callerLabel", "Caller service label (optional)", settings.callerLabel ?? "", false)}`
    : `${input("serviceFacet", "Service facet", settings.serviceFacet)}${input("routeFacet", "Route facet", settings.routeFacet)}${input("methodFacet", "HTTP method facet", settings.methodFacet)}${input("callerFacet", "Caller service facet (optional)", settings.callerFacet ?? "", false)}`;
  const savedReview = existing ? runtimeServiceReview(snapshot, {
    provider, services: Object.entries(config!.serviceMappings).map(([sourceService, suggestedServiceId]) => ({ sourceService, suggestedServiceId, roles: [], routeCount: 0, confidence: "high", reason: "Your saved mapping is retained.", candidates: [{ serviceId: suggestedServiceId, matchedRouteCount: 0 }] })),
    observationCount: existing.observationCount, autoMatchedCount: Object.keys(config!.serviceMappings).length, suggestedCount: 0, unmatchedCount: 0,
    windowStart: existing.windowStart ?? "", windowEnd: existing.windowEnd ?? "", partial: existing.partial, warnings: [],
  }, true) : '<p class="ig-note">We will discover service names from your source and match them to the services in your indexed repositories.</p>';
  return `<form class="ig-form ig-runtime-form" data-runtime-form data-provider="${provider}" data-existing="${!!existing}" data-runtime-phase="${existing ? "review" : "source"}" data-runtime-revision="0"><ol class="ig-runtime-steps" aria-label="Connection steps"><li>1. Source access</li><li>2. Review matches</li><li>3. Connect</li></ol><section class="ig-runtime-source"><h3>Source access</h3>${source}</section><details class="ig-runtime-advanced"><summary>Advanced settings · query, labels and window</summary><div>${provider === "datadog" ? '<p class="ig-note">The default query uses env:production. Change it here if your account uses another environment.</p>' : '<p class="ig-note">The default query uses http_requests_total with service, method and route labels. Change these for your exporter.</p>'}<label>${provider === "prometheus" ? "PromQL counter increase query" : "APM search query"}<textarea name="query" required maxlength="4096" rows="4">${escape(settings.query)}</textarea></label>${advanced}<label>Observation window in hours<input type="number" name="windowHours" min="1" max="168" required value="${config?.windowHours ?? 24}"></label><p class="ig-note">${provider === "prometheus" ? 'Keep {{window}} inside increase(). Return counts and stable route templates.' : 'Use indexed server request spans and resource_name values such as GET /orders/{id}.'}</p></div></details><section><h3>Review service matches</h3><div data-runtime-review>${savedReview}</div></section><details class="ig-runtime-manual"><summary>Manual mapping · optional aliases or inactive services</summary><p class="ig-note">Add names for services that have no source observations, or use your repository service names as a starting point.</p><button type="button" class="ig-button ig-button-secondary" data-action="runtime-fill-names">Fill with repository names</button>${snapshot.services.map(service => `<label>${escape(service.name)}<small>${escape(snapshot.repositories.find(repo => repo.id === service.repositoryId)?.fullName ?? service.rootPath)}</small><input name="service-${escape(service.id)}" data-runtime-service="${escape(service.id)}" data-service-name="${escape(service.name)}" placeholder="Exact source name; comma-separated aliases" maxlength="1024"></label>`).join("")}</details><div class="ig-actions"><button type="submit" class="ig-button" data-runtime-primary>${existing ? `Save connection · ${Object.keys(config!.serviceMappings).length} services` : "Find and match services"}</button><button type="button" class="ig-button ig-button-secondary" data-action="runtime-discover" data-provider="${provider}" ${existing ? "" : "hidden"}>Find services again</button></div><p data-save-status role="status" aria-live="polite"></p><a href="/docs/runtime-observability" target="_blank" rel="noopener noreferrer">Setup guide ↗</a></form>`;
}

export function runtimeConnectionBody(form: HTMLFormElement, allowEmptyMappings = false): {
  config: RuntimeConnectionConfig;
  credentials?: RuntimeCredentials;
} {
  const fields = new FormData(form);
  const get = (key: string): string => String(fields.get(key) ?? "").trim();
  const provider = form.dataset.provider as RuntimeProvider;
  const serviceMappings: Record<string, string> = {};
  const add = (remote: string, serviceId: string): void => {
    if (!remote || !serviceId) return;
    if (["__proto__", "prototype", "constructor"].includes(remote)) throw new Error("Invalid service name.");
    if (Object.hasOwn(serviceMappings, remote) && serviceMappings[remote] !== serviceId)
      throw new Error(`The source service ${remote} is mapped twice.`);
    serviceMappings[remote] = serviceId;
  };
  for (const select of form.querySelectorAll<HTMLSelectElement>("[data-runtime-source]"))
    add(select.dataset.runtimeSource!, select.value);
  for (const input of form.querySelectorAll<HTMLInputElement>("[data-runtime-service]"))
    for (const remote of input.value.split(",").map(value => value.trim()).filter(Boolean))
      add(remote, input.dataset.runtimeService!);
  if (!allowEmptyMappings && !Object.keys(serviceMappings).length)
    throw new Error("Choose at least one matched service before connecting.");
  const shared = {
    windowHours: Number(get("windowHours")),
    serviceMappings,
    query: get("query"),
  };
  const config: RuntimeConnectionConfig =
    provider === "prometheus"
      ? {
          provider,
          ...shared,
          baseUrl: get("baseUrl"),
          serviceLabel: get("serviceLabel"),
          methodLabel: get("methodLabel"),
          routeLabel: get("routeLabel"),
          callerLabel: get("callerLabel") || null,
        }
      : {
          provider,
          ...shared,
          site: get("site"),
          serviceFacet: get("serviceFacet"),
          methodFacet: get("methodFacet"),
          routeFacet: get("routeFacet"),
          callerFacet: get("callerFacet") || null,
        };
  const existing = form.dataset.existing === "true";
  const authentication = get("authentication");
  const credentials: RuntimeCredentials | undefined = provider === "prometheus"
    ? authentication === "saved" ? undefined
      : authentication === "none" ? {}
      : authentication === "basic" ? { username: get("username"), password: get("password") }
      : { bearerToken: get("bearerToken") }
    : get("apiKey") || get("applicationKey") || !existing
      ? { apiKey: get("apiKey"), applicationKey: get("applicationKey") } : undefined;
  return { config, ...(credentials === undefined ? {} : { credentials }) };
}

export function runtimeEndpointDetails(
  endpoint: WorkspaceSnapshot["endpoints"][number],
): string {
  if (
    endpoint.runtimeCoverage !== "available" ||
    endpoint.runtimeCallsInWindow == null
  )
    return '<p class="ig-note">No current traffic observation is available for this endpoint. Check source connection, service mapping, route labels, query scope, and retention.</p>';
  return `<p><strong>${endpoint.runtimeCallsInWindow.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong> ${endpoint.runtimeRequestSource === "datadog" ? "indexed spans (sampled)" : "estimated requests from counter increases"} · ${escape(endpoint.runtimeRequestSource)}</p><p class="ig-note">Window: ${escape(date(endpoint.runtimeWindowStart ?? null))} – ${escape(date(endpoint.runtimeWindowEnd ?? null))}<br>${endpoint.runtimeCallerCount === null ? "Caller identity is not supplied by this source." : `${endpoint.runtimeCallerCount} observed caller service(s).`}<br>Query timestamps are not last request timestamps. Observation limits still apply.</p>`;
}

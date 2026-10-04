import type { Analytics } from "firebase/analytics";
import firebaseConfig from "./firebase-config.json";
import { publicPagePath, sanitizeAttribution, type LeadAttribution } from "./schema";
import { emails } from "../ui/contact";
import "./preferences.css";

export type AnalyticsEvent =
  | "page_view" | "navigation_click" | "cta_click" | "contact_click" | "section_view" | "scroll_depth"
  | "form_start" | "form_submit" | "form_error" | "generate_lead"
  | "docs_search" | "docs_search_result" | "docs_code_copy"
  | "sign_in_start" | "email_link_requested" | "login" | "sign_up" | "auth_error" | "sign_out"
  | "setup_started" | "github_connection_start" | "github_connected" | "repository_selection_saved"
  | "repository_reindex_requested" | "workspace_view" | "workspace_action" | "workspace_error"
  | "evidence_review_saved" | "workspace_settings_saved" | "runtime_discovery_start"
  | "runtime_services_discovered" | "runtime_connection_saved" | "runtime_sync_completed"
  | "runtime_connection_removed";

export interface AnalyticsParams {
  action?: string; placement?: string; target_page?: string; page_section?: string;
  contact_type?: string; provider?: string; method?: string; form_name?: string; error_type?: string;
  doc_slug?: string; search_topic?: string; content_type?: string; result_count?: number;
  repository_count?: number; endpoint_count?: number; service_count?: number; matched_count?: number;
  unmatched_count?: number; percentage?: number; query_length?: number; lead_id?: string;
}
type Sdk = typeof import("firebase/analytics");
const preferenceKey = "impact-gate-usage-analytics";
const attributionKey = "impact-gate-acquisition-v1";
const knownActions = new Set([
  "runtime-connect", "runtime-discover", "runtime-apply-suggestions", "runtime-fill-names",
  "runtime-sync", "runtime-disconnect", "confirm-runtime-disconnect", "endpoint", "endpoint-tab",
  "review", "confirm-review", "import", "reindex", "connect-github", "finish-github", "graph-export",
  "code-export", "function-page", "clear-filters", "link-github", "link-google", "retry",
]);
const publicSections = new Set(["how-it-works", "evidence", "changes", "limits", "pilot", "faq"]);
let sdk: Sdk | null = null;
let analytics: Analytics | null = null;
let initializing: Promise<void> | null = null;
let started = false;
let optedOut = false;
let unavailable = false;
let debug = false;
let currentUid: string | null = null;
let currentRole: string | null = null;
let attribution: LeadAttribution = {};
const queue: Array<{ name: AnalyticsEvent; params: Record<string, string | number | boolean>; at: number }> = [];

function browserBlocksAnalytics(): boolean {
  const browser = navigator as Navigator & { globalPrivacyControl?: boolean };
  return Boolean(browser.globalPrivacyControl || browser.doNotTrack === "1");
}

function allowed(): boolean {
  if (typeof window === "undefined" || optedOut || browserBlocksAnalytics()) return false;
  return ["impactgate.in", "www.impactgate.in"].includes(location.hostname) || debug;
}

function pageContext(): Record<string, string> {
  const path = publicPagePath(location.pathname);
  const area = path.startsWith("/docs") ? "docs" : path.startsWith("/dashboard") ? "workspace"
    : ["/sign-in", "/sign-up", "/auth/email-link"].includes(path) ? "authentication"
    : ["/onboarding", "/onboarding/github", "/github/setup"].includes(path) ? "setup" : "marketing";
  let referrer = "";
  try { if (document.referrer) referrer = new URL(document.referrer).origin + "/"; } catch { /* Empty referrer. */ }
  return { page_path: path, page_location: location.origin + path, page_title: "Impact Gate " + path,
    page_referrer: referrer, site_area: area };
}

function safeParams(input: AnalyticsParams): Record<string, string | number> {
  const clean: Record<string, string | number> = {};
  const numeric = new Set(["result_count", "repository_count", "endpoint_count", "service_count",
    "matched_count", "unmatched_count", "percentage", "query_length"]);
  const text = new Set(["action", "placement", "page_section", "contact_type", "provider", "method",
    "form_name", "error_type", "doc_slug", "search_topic", "content_type"]);
  for (const [key, value] of Object.entries(input)) {
    if (numeric.has(key) && typeof value === "number" && Number.isFinite(value))
      clean[key] = Math.max(0, Math.min(1000000, Math.floor(value)));
    else if (text.has(key) && typeof value === "string" && /^[a-z0-9_-]{1,64}$/i.test(value)) clean[key] = value;
    else if (key === "target_page" && typeof value === "string") clean[key] = publicPagePath(value);
    else if (key === "lead_id" && typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value)) clean[key] = value;
  }
  return clean;
}

export function trackEvent(name: AnalyticsEvent, params: AnalyticsParams = {}): void {
  if (!started || !allowed() || unavailable) return;
  const values = { ...pageContext(), ...safeParams(params), ...(debug ? { debug_mode: true } : {}) };
  if (analytics && sdk) {
    try { sdk.logEvent(analytics, name as string, values); } catch { /* Telemetry never interrupts an action. */ }
  } else if (queue.length < 80) queue.push({ name, params: values, at: Date.now() });
}

export function identifyAnalyticsUser(uid: string | null, role: string | null = null): void {
  currentUid = uid && /^[a-z0-9_-]{1,128}$/i.test(uid) ? uid : null;
  currentRole = role && ["owner", "admin", "viewer", "member"].includes(role) ? role : null;
  if (!analytics || !sdk || !allowed()) return;
  try {
    sdk.setUserId(analytics, currentUid);
    sdk.setUserProperties(analytics, { account_state: currentUid ? "signed_in" : "anonymous",
      workspace_role: currentRole });
  } catch { /* Telemetry never interrupts authentication. */ }
}

export function leadAttribution(): LeadAttribution {
  return allowed() ? { ...attribution } : {};
}

function captureAttribution(): void {
  const query = new URLSearchParams(location.search);
  let prior: unknown;
  try { prior = JSON.parse(sessionStorage.getItem(attributionKey) ?? "{}"); } catch { /* Memory only. */ }
  let referrer = "";
  try { if (document.referrer) referrer = new URL(document.referrer).hostname; } catch { /* Empty referrer. */ }
  const incoming = sanitizeAttribution({ source: query.get("utm_source"), medium: query.get("utm_medium"),
    campaign: query.get("utm_campaign"), content: query.get("utm_content") });
  attribution = Object.keys(incoming).length || !Object.keys(sanitizeAttribution(prior)).length
    ? { ...incoming, landing_path: publicPagePath(location.pathname), ...(referrer ? { referrer_host: referrer } : {}) }
    : sanitizeAttribution(prior);
  try { sessionStorage.setItem(attributionKey, JSON.stringify(attribution)); } catch { /* Memory only. */ }
}

function updatePreferences(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-analytics-toggle]")) {
    const label = "Usage analytics: " + (allowed() ? "on" : "off");
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute("aria-pressed", String(allowed()));
    button.disabled = browserBlocksAnalytics();
    button.title = button.disabled ? "Usage analytics is disabled by your browser privacy preference."
      : "Measure visits and product actions. Events exclude email, repository names, and typed text.";
  }
}

async function initialize(): Promise<void> {
  if (!allowed() || unavailable) return;
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      const [appSdk, analyticsSdk] = await Promise.all([import("firebase/app"), import("firebase/analytics")]);
      sdk = analyticsSdk;
      const supported = await sdk.isSupported();
      if (!allowed() || !supported) { unavailable = !supported; queue.length = 0; return; }
      const app = appSdk.getApps().find(app => app.name === "impact-gate-analytics")
        ?? appSdk.initializeApp(firebaseConfig, "impact-gate-analytics");
      sdk.setConsent({ analytics_storage: "granted", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied" });
      sdk.setDefaultEventParameters({ ...pageContext(), analytics_schema: "v1" });
      analytics = sdk.initializeAnalytics(app, { config: { ...pageContext(), send_page_view: false,
        allow_google_signals: false, allow_ad_personalization_signals: false,
        allow_enhanced_conversions: false, ads_data_redaction: true,
        cookie_expires: 60 * 60 * 24 * 90, cookie_flags: "SameSite=Lax;Secure",
        campaign_source: attribution.source, campaign_medium: attribution.medium,
        campaign_name: attribution.campaign, campaign_content: attribution.content } });
      if (!allowed()) { sdk.setAnalyticsCollectionEnabled(analytics, false); queue.length = 0; return; }
      identifyAnalyticsUser(currentUid, currentRole);
      for (const item of queue.splice(0)) if (Date.now() - item.at < 60000) sdk.logEvent(analytics, item.name as string, item.params);
    } catch { unavailable = true; queue.length = 0; }
    finally { updatePreferences(); }
  })();
  return initializing;
}

function placement(element: Element): string {
  if (element.closest("header")) return "header";
  if (element.closest("footer,.ig-sidebar-bottom")) return "footer";
  if (element.closest(".hero")) return "hero";
  if (element.closest(".docs-app")) return "docs";
  return "content";
}

function trackClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest<HTMLButtonElement>("button")?.disabled) return;
  const toggle = event.target.closest("[data-analytics-toggle]");
  if (toggle) {
    if (browserBlocksAnalytics()) return;
    optedOut = !optedOut;
    try { localStorage.setItem(preferenceKey, optedOut ? "off" : "on"); } catch { /* Current page only. */ }
    if (!allowed()) {
      queue.length = 0;
      attribution = {};
      try { sessionStorage.removeItem(attributionKey); } catch { /* Current page only. */ }
      try {
        if (analytics && sdk) { sdk.setAnalyticsCollectionEnabled(analytics, false);
          sdk.setConsent({ analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }); }
      } catch { /* Preference applies even if the SDK is unavailable. */ }
    } else {
      captureAttribution();
      try {
        if (analytics && sdk) { sdk.setConsent({ analytics_storage: "granted" });
          sdk.setAnalyticsCollectionEnabled(analytics, true); identifyAnalyticsUser(currentUid, currentRole); }
      } catch { /* Preference applies even if the SDK is unavailable. */ }
      void initialize();
      trackEvent("page_view");
    }
    updatePreferences(); return;
  }
  const control = event.target.closest<HTMLElement>("[data-action]");
  const action = control?.dataset.action;
  if (action && knownActions.has(action)) trackEvent("workspace_action", { action, placement: "workspace",
    ...(action === "endpoint-tab" && ["overview", "flow", "callers", "history"].includes(control?.dataset.tab ?? "")
      ? { content_type: control!.dataset.tab } : {}) });
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("mailto:")) {
    const recipient = href.slice(7).split("?")[0].toLowerCase();
    const purpose = Object.entries(emails).find(([, email]) => email === recipient)?.[0];
    if (purpose) trackEvent("contact_click", { contact_type: purpose, placement: placement(link) });
    return;
  }
  let destination: URL;
  try { destination = new URL(href, location.href); } catch { return; }
  if (destination.origin !== location.origin) {
    if (destination.hostname === "github.com") trackEvent("workspace_action", { action: "source_open", provider: "github" });
    return;
  }
  const path = publicPagePath(destination.pathname);
  const section = destination.hash.slice(1);
  const actionName = link.dataset.analyticsAction ?? (section === "pilot" ? "request_pilot"
    : link.classList.contains("header-cta") ? "sign_in" : "");
  if (actionName) trackEvent("cta_click", { action: actionName, target_page: path, placement: placement(link) });
  else if (path !== "/not-found" || publicSections.has(section))
    trackEvent("navigation_click", { target_page: path, ...(publicSections.has(section) ? { page_section: section } : {}),
      placement: placement(link) });
}

function observeContent(): void {
  const seen = new Set<string>();
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting && !seen.has(entry.target.id)) {
        seen.add(entry.target.id);
        trackEvent("section_view", { page_section: entry.target.id });
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.25 });
    for (const id of publicSections) { const section = document.getElementById(id); if (section) observer.observe(section); }
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }
  let scheduled = false;
  const depths = new Set<number>();
  const scroll = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const total = document.documentElement.scrollHeight - innerHeight;
      if (total < 200) return;
      const depth = (scrollY / total) * 100;
      for (const threshold of [25, 50, 75, 90]) if (depth >= threshold && !depths.has(threshold)) {
        depths.add(threshold); trackEvent("scroll_depth", { percentage: threshold });
      }
    });
  };
  window.addEventListener("scroll", scroll, { passive: true });
  window.addEventListener("pagehide", () => window.removeEventListener("scroll", scroll), { once: true });
}

export function startWebsiteAnalytics(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  try { optedOut = localStorage.getItem(preferenceKey) === "off";
    debug = sessionStorage.getItem("impact-gate-analytics-debug") === "true"; } catch { /* Use browser policy. */ }
  document.addEventListener("click", trackClick, { capture: true });
  const startedForms = new WeakSet<Element>();
  document.addEventListener("focusin", event => {
    const form = event.target instanceof Element ? event.target.closest("[data-waitlist-form]") : null;
    if (form && !startedForms.has(form)) { startedForms.add(form); trackEvent("form_start", { form_name: "pilot_request" }); }
  });
  document.addEventListener("invalid", event => {
    if (event.target instanceof Element && event.target.closest("[data-waitlist-form]"))
      trackEvent("form_error", { form_name: "pilot_request", error_type: "client_validation" });
  }, { capture: true });
  if (allowed()) { captureAttribution(); trackEvent("page_view"); void initialize(); }
  const preferences = new MutationObserver(changes => {
    if (changes.some(change => [...change.addedNodes].some(node => node instanceof Element
      && (node.matches("[data-analytics-toggle]") || node.querySelector("[data-analytics-toggle]")))))
      updatePreferences();
  });
  preferences.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => preferences.disconnect(), { once: true });
  const mounted = () => { updatePreferences(); observeContent(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mounted, { once: true });
  else setTimeout(mounted, 0);
}

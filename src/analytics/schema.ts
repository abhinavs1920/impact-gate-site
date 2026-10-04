/** Only public, fixed routes and campaign labels cross the analytics boundary. */
const publicPaths = new Set([
  "/", "/contact", "/sign-in", "/sign-up", "/auth/email-link", "/onboarding", "/onboarding/github", "/github/setup",
  "/dashboard", "/dashboard/api-usage", "/dashboard/dependency-graph",
  "/dashboard/deprecation-candidates", "/dashboard/repositories", "/dashboard/settings",
  "/review-desk", "/docs",
  ...["overview", "quickstart", "sign-in", "connect-github", "repositories", "pull-request-reports",
    "dashboard", "api-usage", "dependency-graph", "deprecation-review", "settings",
    "coverage-and-limitations", "permissions-and-data", "troubleshooting", "api-reference",
    "runtime-observability"].map(slug => "/docs/" + slug),
]);

export function publicPagePath(path: string): string {
  const normalized = path.replace(/\/+$/, "") || "/";
  return publicPaths.has(normalized) ? normalized : "/not-found";
}

export interface LeadAttribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  landing_path?: string;
  referrer_host?: string;
}

export function sanitizeAttribution(value: unknown): LeadAttribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const clean: LeadAttribution = {};
  for (const key of ["source", "medium", "campaign", "content"] as const) {
    const text = source[key];
    if (typeof text === "string" && /^[a-z0-9_-]{1,64}$/i.test(text)) clean[key] = text.toLowerCase();
  }
  if (typeof source.landing_path === "string") clean.landing_path = publicPagePath(source.landing_path);
  if (typeof source.referrer_host === "string" && /^[a-z0-9.-]{1,120}$/i.test(source.referrer_host))
    clean.referrer_host = source.referrer_host.toLowerCase();
  return clean;
}

/** Classify documentation intent without sending the visitor's search text. */
export function searchTopic(query: string): string {
  const topics: Array<[RegExp, string]> = [
    [/prometheus/i, "prometheus"], [/datadog/i, "datadog"], [/github|repo|index/i, "repository_setup"],
    [/sign.?in|login|email|auth/i, "sign_in"], [/runtime|trac|traffic|observ/i, "runtime"],
    [/code.?flow|function/i, "code_flow"], [/openapi|schema|contract|pull.?request/i, "api_contracts"],
    [/deprecat|remov|unused/i, "deprecation"], [/permission|privacy|secur/i, "permissions"],
    [/error|fail|trouble/i, "troubleshooting"], [/pilot|access/i, "pilot"], [/billing|price/i, "billing"],
  ];
  return topics.find(([pattern]) => pattern.test(query))?.[1] ?? "other";
}

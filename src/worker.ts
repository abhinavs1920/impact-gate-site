interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface EmailBinding {
  send(message: {
    to: string;
    from: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId: string }>;
}

interface WaitlistEnv {
  WAITLIST?: {
    put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ): Promise<void>;
  };
  EMAIL?: EmailBinding;
}

function apiFailure(status: number, message: string): Response {
  return Response.json({ error: { code: "api_unavailable", message } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** The upstream is operator configured; request parameters never select a destination. */
export async function proxyWorkspaceApi(request: Request, env: Record<string, unknown>): Promise<Response> {
  const incoming = new URL(request.url);
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)) return apiFailure(405, "Method not allowed.");
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== incoming.origin) return apiFailure(403, "Request origin is not allowed.");
    if (request.headers.get("Sec-Fetch-Site") === "cross-site") return apiFailure(403, "Request origin is not allowed.");
  }
  let upstream: URL;
  try {
    if (typeof env.IMPACT_GATE_API_ORIGIN !== "string") throw new Error("Missing API origin");
    upstream = new URL(env.IMPACT_GATE_API_ORIGIN);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname);
    if ((upstream.protocol !== "https:" && !(upstream.protocol === "http:" && local)) || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname !== "/" || upstream.origin === incoming.origin) throw new Error("Invalid API origin");
  } catch { return apiFailure(503, "The workspace API is not configured."); }
  const target = new URL(upstream.origin);
  target.pathname = incoming.pathname; target.search = incoming.search;
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["Authorization", "Content-Type", "If-Match"]) {
    const value = request.headers.get(name); if (value) headers.set(name, value);
  }
  // OAuth is the only browser cookie the API receives. Firebase identity stays in a bearer token.
  if (incoming.pathname === "/api/v1/github/callback") {
    const oauth = request.headers.get("Cookie")?.split(";").map(value => value.trim()).find(value => /^impact_gate_oauth=/.test(value));
    if (oauth) headers.set("Cookie", oauth);
  }
  headers.set("X-Forwarded-Proto", incoming.protocol.slice(0, -1));
  headers.set("X-Forwarded-Host", incoming.host);
  if (typeof env.IMPACT_GATE_PROXY_SECRET === "string" && env.IMPACT_GATE_PROXY_SECRET) headers.set("X-Impact-Gate-Proxy-Secret", env.IMPACT_GATE_PROXY_SECRET);
  let response: Response;
  try {
    response = await fetch(target.href, { method: request.method, headers, ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.body }), redirect: "manual", signal: request.signal });
  } catch { return apiFailure(502, "The workspace API could not be reached."); }
  const output = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of ["Content-Type", "Retry-After", "ETag", "Content-Security-Policy", "X-Demo-Request"]) { const value = response.headers.get(name); if (value) output.set(name, value); }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (incoming.pathname !== "/api/v1/github/callback" || !location) { await response.body?.cancel(); return apiFailure(502, "Unexpected API redirect."); }
    let destination: URL;
    try { destination = new URL(location, incoming.origin); } catch { await response.body?.cancel(); return apiFailure(502, "Invalid authorization redirect."); }
    if (destination.origin !== incoming.origin || destination.username || destination.password || destination.pathname !== "/onboarding") { await response.body?.cancel(); return apiFailure(502, "Invalid authorization redirect."); }
    output.set("Location", `${destination.pathname}${destination.search}`);
  }
  if (["/api/v1/github/connect/start", "/api/v1/github/callback"].includes(incoming.pathname)) {
    const cookies = response.headers.getSetCookie();
    for (const cookie of cookies) {
      if (!/^impact_gate_oauth=/.test(cookie) || /;\s*domain=/i.test(cookie)) continue;
      output.append("Set-Cookie", cookie);
    }
  }
  if ((incoming.pathname === "/sandbox" || incoming.pathname === "/sandbox/") && response.headers.get("Content-Type")?.includes("text/html")) {
    const html = await response.text();
    const mobileSafety = 'html,body{max-width:100%;overflow-x:hidden}main{box-sizing:border-box;width:min(900px,calc(100% - 2rem));max-width:100%}pre,code{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}';
    const rewritten = html.includes("</head>")
      ? html.replace("</head>", `<style>${mobileSafety}</style></head>`)
      : html.replace("</style>", `${mobileSafety}</style>`);
    return new Response(rewritten, { status: response.status, headers: output });
  }
  return new Response(response.body, { status: response.status, headers: output });
}

const AGENT_PATH_PREFIXES = ["/.well-known", "/oauth", "/mcp", "/healthz"];

/**
 * Public agent entrypoint (mcp.impactgate.in): forwards MCP + OAuth traffic to the API
 * origin. Unlike the workspace proxy this must let OAuth redirects and cookies pass, and
 * it rewrites the internal origin out of discovery metadata so clients only see the
 * public host. The upstream stays operator configured; request input never selects it.
 */
export async function proxyAgentApi(request: Request, env: Record<string, unknown>): Promise<Response> {
  const incoming = new URL(request.url);
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method))
    return apiFailure(405, "Method not allowed.");
  const allowed =
    incoming.pathname === "/" ||
    AGENT_PATH_PREFIXES.some(
      (prefix) => incoming.pathname === prefix || incoming.pathname.startsWith(`${prefix}/`),
    );
  if (!allowed) return apiFailure(404, "Not found.");
  let upstream: URL;
  try {
    if (typeof env.IMPACT_GATE_API_ORIGIN !== "string") throw new Error("Missing API origin");
    upstream = new URL(env.IMPACT_GATE_API_ORIGIN);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname);
    if (
      (upstream.protocol !== "https:" && !(upstream.protocol === "http:" && local)) ||
      upstream.username || upstream.password || upstream.search || upstream.hash ||
      upstream.pathname !== "/" || upstream.origin === incoming.origin
    ) throw new Error("Invalid API origin");
  } catch { return apiFailure(503, "The agent API is not configured."); }
  const target = new URL(upstream.origin);
  // The canonical public MCP endpoint is the host root; /mcp remains as an alias.
  target.pathname = incoming.pathname === "/" ? "/mcp" : incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers({ Accept: request.headers.get("Accept") ?? "*/*" });
  for (const name of ["Authorization", "Content-Type", "MCP-Session-Id", "MCP-Protocol-Version", "Last-Event-ID", "Cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Forwarded-Proto", incoming.protocol.slice(0, -1));
  headers.set("X-Forwarded-Host", incoming.host);
  let response: Response;
  try {
    response = await fetch(target.href, {
      method: request.method,
      headers,
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.body }),
      redirect: "manual",
      signal: request.signal,
    });
  } catch { return apiFailure(502, "The agent API could not be reached."); }
  const output = new Headers();
  for (const name of [
    "Content-Type", "Cache-Control", "Pragma", "Expires", "Retry-After", "ETag",
    "Content-Security-Policy", "WWW-Authenticate", "Location", "MCP-Session-Id",
    "MCP-Protocol-Version", "Access-Control-Allow-Origin", "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods", "Access-Control-Expose-Headers",
  ]) {
    const value = response.headers.get(name);
    if (value) output.set(name, value.split(upstream.origin).join(incoming.origin));
  }
  for (const cookie of response.headers.getSetCookie()) {
    if (/;\s*domain=/i.test(cookie)) continue; // never widen a cookie to another domain
    output.append("Set-Cookie", cookie.split(upstream.hostname).join(incoming.hostname));
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    const body = await response.text();
    const rewritten = body
      .split(upstream.origin).join(incoming.origin)
      .split(`"resource":"${incoming.origin}/mcp"`).join(`"resource":"${incoming.origin}/"`);
    return new Response(rewritten, { status: response.status, headers: output });
  }
  return new Response(response.body, { status: response.status, headers: output });
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const agentHost =
      typeof env.IMPACT_GATE_AGENT_HOST === "string" && env.IMPACT_GATE_AGENT_HOST
        ? env.IMPACT_GATE_AGENT_HOST.toLowerCase()
        : "mcp.impactgate.in";
    if (url.hostname.toLowerCase() === agentHost) return proxyAgentApi(request, env);
    if (pathname === "/sandbox" || pathname.startsWith("/sandbox/")) {
      if (request.method !== "GET") return apiFailure(405, "The sandbox supports read-only GET requests.");
      return proxyWorkspaceApi(request, env);
    }
    if (pathname.startsWith("/api/v1/")) return proxyWorkspaceApi(request, env);
    if (new URL(request.url).pathname === "/api/waitlist") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      const route = await import("./functions/api/waitlist");
      return route.onRequestPost({ request, env: env as WaitlistEnv });
    }
    if (env.ASSETS && typeof (env.ASSETS as AssetFetcher).fetch === "function") {
      return (env.ASSETS as AssetFetcher).fetch(request);
    }
    return new Response("Not found", { status: 404 });
  }
};


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
  for (const name of ["Content-Type", "Retry-After", "ETag"]) { const value = response.headers.get(name); if (value) output.set(name, value); }
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
  return new Response(response.body, { status: response.status, headers: output });
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/v1/")) return proxyWorkspaceApi(request, env);
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

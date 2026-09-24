interface AssetFetcher { fetch(request: Request): Promise<Response>; }
interface WaitlistEnv { WAITLIST?: { put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> }; }

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      const route = await import("./functions/api/waitlist");
      return route.onRequestPost({ request, env: env as WaitlistEnv });
    }
    return env.ASSETS && typeof (env.ASSETS as AssetFetcher).fetch === "function"
      ? (env.ASSETS as AssetFetcher).fetch(request)
      : new Response("Not found", { status: 404 });
  }
};

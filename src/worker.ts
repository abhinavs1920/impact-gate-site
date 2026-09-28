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

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
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

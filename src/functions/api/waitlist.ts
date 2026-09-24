interface Store { put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>; }
interface Env { WAITLIST?: Store; }
interface Payload { email?: string; repository?: string; notes?: string; website?: string; }

const json = (body: Record<string, string>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return json({ message: "Invalid request." }, 400); }
  if (payload.website) return json({ message: "Thanks." });
  if (!payload.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email) || !payload.repository) return json({ message: "Please provide a work email and repository." }, 400);
  if (env.WAITLIST) {
    const key = `waitlist:${crypto.randomUUID()}`;
    await env.WAITLIST.put(key, JSON.stringify({ email: payload.email, repository: payload.repository, notes: payload.notes ?? "" }), { expirationTtl: 60 * 60 * 24 * 90 });
  }
  return json({ message: "Thanks. Your waitlist request was received." });
}

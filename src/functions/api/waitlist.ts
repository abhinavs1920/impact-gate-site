import { sanitizeAttribution } from "../../analytics/schema";

interface Store {
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

interface EmailBinding {
  send(message: {
    to: string;
    from: string;
    replyTo: string;
    subject: string;
    text: string;
    html: string;
  } | unknown): Promise<{ messageId?: string } | void>;
}

interface Env {
  WAITLIST?: Store;
  EMAIL?: EmailBinding;
}

interface Payload {
  email?: unknown;
  repository?: unknown;
  notes?: unknown;
  website?: unknown;
  attribution?: unknown;
}

const OWNER_EMAIL = "abxh1920@gmail.com";
const SENDER_EMAIL = "pilot@impactgate.in";

const json = (body: Record<string, string | boolean>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid request." }, 400);
  }

  if (!isRecord(payload)) return json({ message: "Invalid request." }, 400);
  const form = payload as Payload;

  if (typeof form.website === "string" && form.website.trim()) {
    return json({ message: "Thanks. Your waitlist request was received.", accepted: false });
  }

  const email = typeof form.email === "string" ? form.email.trim() : "";
  const repository =
    typeof form.repository === "string" ? form.repository.trim() : "";
  const notes = typeof form.notes === "string" ? form.notes.trim() : "";

  if (
    email.length > 254 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    !repository ||
    repository.length > 500 ||
    notes.length > 2000
  ) {
    return json(
      { message: "Please provide a valid work email and repository." },
      400,
    );
  }

  const leadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const attribution = sanitizeAttribution(form.attribution);
  let saved = false;
  async function save(notificationStatus: string): Promise<void> {
    if (!env.WAITLIST) return;
    try {
      // KV permits one write per second per key. Keep the receipt and the
      // notification result under separate keys instead of racing two writes.
      const key = saved ? "waitlist-notification:" + leadId : "waitlist:" + leadId;
      const record = saved ? { leadId, notificationStatus, updatedAt: new Date().toISOString() }
        : { leadId, createdAt, email, repository, notes, attribution, notificationStatus,
          ...(notificationStatus === "pending" ? { notificationKey: "waitlist-notification:" + leadId } : {}) };
      await env.WAITLIST.put(key, JSON.stringify(record),
        { expirationTtl: 60 * 60 * 24 * 90 });
      saved = true;
    } catch { console.warn("Pilot lead persistence unavailable."); }
  }
  await save(env.EMAIL ? "pending" : "unavailable");
  const received = () => json({ message: "Thanks. Your pilot request was received.", accepted: true, leadId });

  if (!env.EMAIL) {
    console.error("Pilot request email binding is not configured.");
    if (saved) return received();
    return json(
      { message: "The pilot form is temporarily unavailable. Please try again later." },
      503,
    );
  }

  const text = [
    "A new Impact Gate pilot request was received.",
    "",
    `Work email: ${email}`,
    `GitHub organization or repository: ${repository}`,
    `Shared API context: ${notes || "(not provided)"}`,
    "",
    "Lead ID: " + leadId,
    "Received: " + createdAt,
    ...Object.entries(attribution).map(([key, value]) => key + ": " + value),
  ].join("\n");
  const html = [
    "<h1>New Impact Gate pilot request</h1>",
    `<p><strong>Work email:</strong> ${escapeHtml(email)}</p>`,
    `<p><strong>GitHub organization or repository:</strong> ${escapeHtml(repository)}</p>`,
    `<p><strong>Shared API context:</strong><br>${escapeHtml(notes || "(not provided)").replace(/\n/g, "<br>")}</p>`,
    "<p><strong>Lead ID:</strong> " + leadId + "<br><strong>Received:</strong> " + createdAt + "</p>",
    "<ul>" + Object.entries(attribution).map(([key, value]) => "<li>" + escapeHtml(key) + ": " + escapeHtml(value) + "</li>").join("") + "</ul>",
  ].join("");

  try {
    await env.EMAIL.send({
      to: OWNER_EMAIL,
      from: SENDER_EMAIL,
      replyTo: email,
      subject: "New Impact Gate pilot request",
      text,
      html,
    });
  } catch (structuredError) {
    console.warn("Structured pilot email send failed, attempting EmailMessage fallback.");
    try {
      const moduleName = "cloudflare:email";
      const { EmailMessage } = (await import(
        /* @vite-ignore */ moduleName
      )) as {
        EmailMessage: new (
          from: string,
          to: string,
          raw: string,
        ) => unknown;
      };
      const boundary = `boundary_${Date.now().toString(16)}`;
      const raw = [
        `From: Impact Gate Pilot <${SENDER_EMAIL}>`,
        `To: <${OWNER_EMAIL}>`,
        `Reply-To: <${email}>`,
        `Subject: New Impact Gate pilot request`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        text,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        html,
        ``,
        `--${boundary}--`,
        ``,
      ].join("\r\n");
      const message = new EmailMessage(SENDER_EMAIL, OWNER_EMAIL, raw);
      await env.EMAIL.send(message);
    } catch (fallbackError) {
      const code =
        typeof structuredError === "object" &&
        structuredError !== null &&
        "code" in structuredError &&
        typeof structuredError.code === "string"
          ? structuredError.code
          : "unknown";
      void fallbackError;
      console.error("Pilot request email delivery failed.", /^[a-z0-9_-]{1,64}$/i.test(code) ? code : "unknown");
      await save("failed");
      if (saved) return received();
      return json(
        { message: "We could not send your request. Please try again shortly." },
        502,
      );
    }
  }

  await save("sent");
  return json({ message: "Thanks. Your pilot request was emailed successfully.", accepted: true, leadId });
}

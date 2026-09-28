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
  }): Promise<{ messageId: string }>;
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
}

const OWNER_EMAIL = "abxh1920@gmail.com";
const SENDER_EMAIL = "pilot@impactgate.in";

const json = (body: Record<string, string>, status = 200) =>
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
    return json({ message: "Thanks. Your waitlist request was received." });
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

  if (!env.EMAIL) {
    console.error("Pilot request email binding is not configured.");
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
  ].join("\n");
  const html = [
    "<h1>New Impact Gate pilot request</h1>",
    `<p><strong>Work email:</strong> ${escapeHtml(email)}</p>`,
    `<p><strong>GitHub organization or repository:</strong> ${escapeHtml(repository)}</p>`,
    `<p><strong>Shared API context:</strong><br>${escapeHtml(notes || "(not provided)").replace(/\n/g, "<br>")}</p>`,
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
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "unknown";
    console.error("Pilot request email delivery failed.", code);
    return json(
      { message: "We could not send your request. Please try again shortly." },
      502,
    );
  }

  if (env.WAITLIST) {
    await env.WAITLIST.put(
      `waitlist:${crypto.randomUUID()}`,
      JSON.stringify({ email, repository, notes }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );
  }

  return json({ message: "Thanks. Your pilot request was emailed successfully." });
}

import type { ImpactGateAuthClient } from "../auth/client";

export class WorkspaceApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

/** One document owns one transport. Canceling a session invalidates every outstanding request. */
export class WorkspaceApi {
  private controller = new AbortController();
  private generation = 0;
  constructor(private readonly auth: Pick<ImpactGateAuthClient, "getIdToken" | "currentUser">) {}

  cancel(): void {
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
  }

  async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!path.startsWith("/api/v1/") || path.startsWith("//")) throw new Error("Invalid workspace API route.");
    const generation = this.generation;
    const signal = this.controller.signal;
    const uid = this.auth.currentUser?.uid;
    const assertCurrent = () => {
      if (signal.aborted || generation !== this.generation || !uid || this.auth.currentUser?.uid !== uid) {
        throw new DOMException("Session changed", "AbortError");
      }
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.auth.getIdToken(attempt === 1);
      assertCurrent();
      const response = await fetch(path, {
        method: init.method ?? "GET", credentials: "same-origin", cache: "no-store", signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      assertCurrent();
      if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
      const payload: unknown = await response.json().catch(() => null);
      assertCurrent();
      if (!response.ok) {
        const error = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "request_failed";
        const message = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : `Workspace request failed (${response.status}).`;
        throw new WorkspaceApiError(response.status, code, message);
      }
      if (!payload || typeof payload !== "object") throw new WorkspaceApiError(502, "invalid_response", "The workspace returned an invalid response.");
      return payload as T;
    }
    throw new WorkspaceApiError(401, "unauthorized", "Please sign in again.");
  }
}

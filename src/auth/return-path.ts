const destinations = ["/dashboard", "/onboarding", "/github/setup"];

/** Accept only application destinations. A URL from a query string is never trusted. */
export function safeReturnPath(
  value: string | null | undefined,
  origin: string,
  fallback = "/dashboard",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }
  try {
    const destination = new URL(value, origin);
    if (destination.origin !== new URL(origin).origin || destination.username || destination.password) return fallback;
    // Reject encoded separators and encoded control characters as well as literal ones.
    const decoded = decodeURIComponent(destination.pathname);
    if (decoded !== destination.pathname && /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    if (/%2f|%5c/i.test(destination.pathname)) return fallback;
    if (!destinations.some(path => destination.pathname === path || destination.pathname.startsWith(`${path}/`))) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function applicationOrigin(value: string): string {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && local))) {
    throw new Error("Authentication requires HTTPS or a local development origin.");
  }
  return url.origin;
}

export function emailLinkDestination(origin: string, next?: string | null): string {
  const url = new URL("/auth/email-link", applicationOrigin(origin));
  url.searchParams.set("next", safeReturnPath(next, url.origin));
  return url.href;
}

export function signInDestination(next: string, origin: string): string {
  return `/sign-in?${new URLSearchParams({ next: safeReturnPath(next, origin) })}`;
}

/** Remove one-time action credentials only after Firebase has consumed the link. */
export function consumedEmailLinkPath(origin: string, next?: string | null): string {
  return `/auth/email-link?${new URLSearchParams({ next: safeReturnPath(next, origin) })}`;
}

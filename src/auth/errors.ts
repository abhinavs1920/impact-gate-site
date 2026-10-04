export interface AuthErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

export class ImpactGateAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ImpactGateAuthError";
  }
}

export function authErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "auth/unknown";
}

/** Keep SDK diagnostics, provider responses, and tokens out of product error messages. */
export function describeAuthError(error: unknown): AuthErrorInfo {
  const code = authErrorCode(error);
  const messages: Record<string, string> = {
    "auth/account-exists-with-different-credential": "An account already uses this email. Sign in with your existing method, then link this provider.",
    "auth/credential-already-in-use": "This sign-in method belongs to another account. Sign in to that account to continue.",
    "auth/email-already-in-use": "This email belongs to another account. Sign in to that account to continue.",
    "auth/provider-already-linked": "This sign-in method is already linked to your account.",
    "auth/popup-closed-by-user": "Sign-in was closed. You can try again or use an email link.",
    "auth/cancelled-popup-request": "Another sign-in window is already open. Complete that window to continue.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow popups for this site or use an email link.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-action-code": "This email link is invalid or has already been used. Request a new link.",
    "auth/expired-action-code": "This email link has expired. Request a new link.",
    "auth/invalid-email-link": "This email link is invalid. Request a new link.",
    "auth/network-request-failed": "We could not reach the sign-in service. Check your connection and try again.",
    "auth/too-many-requests": "Too many sign-in attempts. Wait a little before trying again.",
    "auth/user-disabled": "This account is disabled. Contact your workspace owner.",
    "auth/operation-not-allowed": "This sign-in method is currently unavailable. Try another method.",
    "auth/method-disabled": "This sign-in method is currently unavailable. Try another method.",
    "auth/unauthorized-domain": "Sign-in is unavailable on this domain. Use impactgate.in.",
    "auth/not-signed-in": "Sign in before linking an account or opening your workspace.",
    "auth/not-ready": "Sign-in is still loading. Please try again in a moment.",
    "auth/pending-credential-expired": "The provider connection expired. Sign in with that provider again to link it.",
    "auth/collision-account-mismatch": "Sign in to the existing account for this email before linking the provider.",
    "auth/requires-recent-login": "Sign in again before changing your sign-in methods.",
    "auth/storage-unavailable": "Your browser could not retain this sign-in session. Allow site storage and try again.",
    "auth/client-disposed": "Reload this page to continue signing in.",
    "auth/workspace-unavailable": "You are signed in, but your workspace could not be opened. Try Continue again.",
  };
  return {
    code,
    message: messages[code] ?? "We could not complete sign-in. Please try again.",
    retryable: !["auth/user-disabled", "auth/unauthorized-domain", "auth/operation-not-allowed", "auth/method-disabled"].includes(code),
  };
}

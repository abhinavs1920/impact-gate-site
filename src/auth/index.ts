export { ImpactGateAuthClient, type AuthSession } from "./client";
export { parseAuthConfig, readInjectedAuthConfig, type AuthRuntimeConfig, type PublicFirebaseConfig, type AuthMethod, type SocialProvider } from "./config";
export { authErrorCode, describeAuthError, ImpactGateAuthError, type AuthErrorInfo } from "./errors";
export { mountAuthPage, type AuthPageOptions } from "./page";
export { safeReturnPath, signInDestination, emailLinkDestination } from "./return-path";

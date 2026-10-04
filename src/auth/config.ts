import type { FirebaseOptions } from "firebase/app";
import { applicationOrigin } from "./return-path";

export type SocialProvider = "github" | "google";
export type AuthMethod = SocialProvider | "email-link";
export type AuthPersistence = "local" | "session" | "memory";

export interface PublicFirebaseConfig extends FirebaseOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface AuthRuntimeConfig {
  firebase: PublicFirebaseConfig;
  methods: readonly AuthMethod[];
  persistence: AuthPersistence;
  origin: string;
}

const methods: readonly AuthMethod[] = ["github", "google", "email-link"];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Select public fields explicitly so server credentials cannot enter the SDK config. */
export function parseAuthConfig(value: unknown, origin: string): AuthRuntimeConfig {
  if (!object(value) || !object(value.firebase)) throw new Error("Authentication configuration is unavailable.");
  const source = value.firebase;
  for (const key of ["apiKey", "authDomain", "projectId", "appId"] as const) {
    if (typeof source[key] !== "string" || !source[key].trim()) throw new Error("Authentication configuration is incomplete.");
  }
  const firebase: PublicFirebaseConfig = {
    apiKey: String(source.apiKey),
    authDomain: String(source.authDomain),
    projectId: String(source.projectId),
    appId: String(source.appId),
  };
  if (!/^[a-z0-9.-]+$/i.test(firebase.authDomain)) throw new Error("Authentication domain is invalid.");
  for (const key of ["messagingSenderId", "measurementId", "storageBucket"] as const) {
    if (typeof source[key] === "string") firebase[key] = source[key];
  }
  let enabled: readonly AuthMethod[] = methods;
  if (value.methods !== undefined) {
    if (!Array.isArray(value.methods) || value.methods.length === 0 || !value.methods.every(method => methods.includes(method as AuthMethod))) {
      throw new Error("Authentication methods are invalid.");
    }
    enabled = [...new Set(value.methods as AuthMethod[])];
  }
  const persistence = value.persistence ?? "local";
  if (!["local", "session", "memory"].includes(String(persistence))) throw new Error("Authentication persistence is invalid.");
  return { firebase, methods: enabled, persistence: persistence as AuthPersistence, origin: applicationOrigin(origin) };
}

/** An optional build-time injection. Runtime configuration may instead be passed directly. */
export function readInjectedAuthConfig(document: Document = window.document): AuthRuntimeConfig {
  const node = document.getElementById("impact-gate-auth-config");
  if (!node?.textContent) throw new Error("Authentication configuration is unavailable.");
  return parseAuthConfig(JSON.parse(node.textContent) as unknown, window.location.origin);
}

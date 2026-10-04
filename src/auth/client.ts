import { getApps, initializeApp, type FirebaseError } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  inMemoryPersistence,
  isSignInWithEmailLink,
  linkWithCredential,
  linkWithPopup,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type Auth,
  type OAuthCredential,
  type User,
  type UserCredential,
} from "firebase/auth";
import type { AuthMethod, AuthRuntimeConfig, SocialProvider } from "./config";
import { authErrorCode, describeAuthError, ImpactGateAuthError, type AuthErrorInfo } from "./errors";
import { emailLinkDestination } from "./return-path";

export type AuthSession =
  | { status: "loading"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "signed-in"; user: User }
  | { status: "error"; user: null; error: AuthErrorInfo };

interface PendingProvider {
  provider: SocialProvider;
  credential: OAuthCredential;
  email?: string;
  createdAt: number;
}

const pendingLifetime = 10 * 60 * 1000;
const rememberedEmailLifetime = 24 * 60 * 60 * 1000;

function normalizedEmail(value: string): string {
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ImpactGateAuthError("auth/invalid-email", "Enter a valid email address.");
  }
  return email;
}

function providerFor(method: SocialProvider): GithubAuthProvider | GoogleAuthProvider {
  if (method === "github") {
    const provider = new GithubAuthProvider();
    // Repository authorization belongs to the GitHub App, not this login provider.
    provider.addScope("user:email");
    return provider;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export class ImpactGateAuthClient {
  readonly ready: Promise<User | null>;
  private readonly auth: Auth;
  private readonly listeners = new Set<(session: AuthSession) => void>();
  private readonly unsubscribeToken: () => void;
  private session: AuthSession = { status: "loading", user: null };
  private initialized = false;
  private disposed = false;
  private pending: PendingProvider | null = null;

  constructor(readonly config: AuthRuntimeConfig) {
    const name = "impact-gate-auth";
    const existing = getApps().find(app => app.name === name);
    if (existing && ["apiKey", "authDomain", "projectId", "appId"].some(key => existing.options[key as keyof typeof existing.options] !== config.firebase[key as keyof typeof config.firebase])) {
      throw new Error("Authentication configuration changed. Reload this page.");
    }
    const app = existing ?? initializeApp(config.firebase, name);
    this.auth = getAuth(app);
    this.auth.languageCode = "en";
    this.unsubscribeToken = onIdTokenChanged(this.auth, user => {
      if (this.initialized && !this.disposed) this.publish(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
    }, error => {
      if (!this.disposed) this.publish({ status: "error", user: null, error: describeAuthError(error) });
    });
    const persistence = {
      local: browserLocalPersistence,
      session: browserSessionPersistence,
      memory: inMemoryPersistence,
    }[config.persistence];
    this.ready = setPersistence(this.auth, persistence)
      .then(() => this.auth.authStateReady())
      .then(() => {
        this.assertUsable();
        this.initialized = true;
        const user = this.auth.currentUser;
        this.publish(user ? { status: "signed-in", user } : { status: "signed-out", user: null });
        return user;
      })
      .catch((error: unknown) => {
        if (!this.disposed) this.publish({ status: "error", user: null, error: describeAuthError(error) });
        throw error;
      });
  }

  get currentUser(): User | null { return this.auth.currentUser; }
  get currentSession(): AuthSession { return this.session; }
  isEnabled(method: AuthMethod): boolean { return this.config.methods.includes(method); }

  subscribe(listener: (session: AuthSession) => void): () => void {
    this.assertUsable();
    this.listeners.add(listener);
    listener(this.session);
    return () => { this.listeners.delete(listener); };
  }

  private publish(session: AuthSession): void {
    this.session = session;
    for (const listener of this.listeners) listener(session);
  }

  private assertUsable(): void {
    if (this.disposed) throw new ImpactGateAuthError("auth/client-disposed", "Reload to continue signing in.");
  }

  private assertReady(method?: AuthMethod): void {
    this.assertUsable();
    if (!this.initialized) throw new ImpactGateAuthError("auth/not-ready", "Authentication is still loading.");
    if (method && !this.isEnabled(method)) throw new ImpactGateAuthError("auth/method-disabled", "This sign-in method is unavailable.");
  }

  private requireUser(): User {
    this.assertReady();
    const user = this.currentUser;
    if (!user) throw new ImpactGateAuthError("auth/not-signed-in", "Sign in to continue.");
    return user;
  }

  /** Call after ready, directly from a click, so the popup retains the user gesture. */
  signIn(method: SocialProvider): Promise<UserCredential> {
    this.assertReady(method);
    return signInWithPopup(this.auth, providerFor(method)).catch((error: unknown) => {
      if (authErrorCode(error) === "auth/account-exists-with-different-credential") {
        const credential = method === "github"
          ? GithubAuthProvider.credentialFromError(error as FirebaseError)
          : GoogleAuthProvider.credentialFromError(error as FirebaseError);
        const custom = error && typeof error === "object" && "customData" in error ? error.customData : null;
        const email = custom && typeof custom === "object" && "email" in custom && typeof custom.email === "string" ? custom.email : undefined;
        if (credential) this.pending = { provider: method, credential, email, createdAt: Date.now() };
      }
      throw error;
    });
  }

  get pendingProvider(): SocialProvider | null {
    if (this.pending && Date.now() - this.pending.createdAt > pendingLifetime) this.pending = null;
    return this.pending?.provider ?? null;
  }

  cancelPendingLink(): void { this.pending = null; }

  /** Link only after signing in to the existing account and an explicit confirmation. */
  async linkPendingProvider(): Promise<UserCredential> {
    await this.ready;
    const user = this.requireUser();
    if (!this.pendingProvider || !this.pending) throw new ImpactGateAuthError("auth/pending-credential-expired", "The provider connection expired.");
    if (this.pending.email && ![user.email, ...user.providerData.map(provider => provider.email)].some(email => email?.toLowerCase() === this.pending?.email?.toLowerCase())) {
      throw new ImpactGateAuthError("auth/collision-account-mismatch", "Sign in to the existing account before linking.");
    }
    const result = await linkWithCredential(user, this.pending.credential);
    this.pending = null;
    await result.user.getIdToken(true);
    this.publish({ status: "signed-in", user: result.user });
    return result;
  }

  /** For explicit settings actions; a provider linked to another UID is never merged. */
  linkProvider(method: SocialProvider): Promise<UserCredential> {
    this.assertReady(method);
    return linkWithPopup(this.requireUser(), providerFor(method)).then(async result => {
      await result.user.getIdToken(true);
      this.publish({ status: "signed-in", user: result.user });
      return result;
    });
  }

  async getIdToken(forceRefresh = false): Promise<string> {
    await this.ready;
    return this.requireUser().getIdToken(forceRefresh);
  }

  async sendEmailLink(email: string, next?: string | null): Promise<{ email: string; remembered: boolean }> {
    await this.ready;
    this.assertReady("email-link");
    const address = normalizedEmail(email);
    await sendSignInLinkToEmail(this.auth, address, {
      url: emailLinkDestination(this.config.origin, next),
      handleCodeInApp: true,
    });
    let remembered = false;
    try {
      localStorage.setItem(this.emailStorageKey, JSON.stringify({ email: address, createdAt: Date.now() }));
      remembered = true;
    } catch { /* Completion asks for the email when browser storage is unavailable. */ }
    return { email: address, remembered };
  }

  private get emailStorageKey(): string { return `impact-gate-email-link-${this.config.firebase.projectId}`; }

  rememberedEmail(): string | null {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.emailStorageKey) ?? "null");
      if (value && typeof value === "object" && "email" in value && typeof value.email === "string" && "createdAt" in value && typeof value.createdAt === "number" && Date.now() >= value.createdAt && Date.now() - value.createdAt < rememberedEmailLifetime) {
        return normalizedEmail(value.email);
      }
      localStorage.removeItem(this.emailStorageKey);
    } catch { /* Email confirmation remains available on another device or with blocked storage. */ }
    return null;
  }

  private clearRememberedEmail(): void {
    try { localStorage.removeItem(this.emailStorageKey); } catch { /* No session credential is stored here. */ }
  }

  isEmailLink(href: string): boolean {
    try {
      const url = new URL(href, this.config.origin);
      return url.origin === this.config.origin && isSignInWithEmailLink(this.auth, url.href);
    } catch { return false; }
  }

  private requireEmailLink(href: string): string {
    if (!this.isEmailLink(href)) throw new ImpactGateAuthError("auth/invalid-email-link", "This email link is invalid.");
    return new URL(href, this.config.origin).href;
  }

  async completeEmailLink(email: string, href: string): Promise<UserCredential> {
    await this.ready;
    this.assertReady("email-link");
    const result = await signInWithEmailLink(this.auth, normalizedEmail(email), this.requireEmailLink(href));
    this.clearRememberedEmail();
    return result;
  }

  /** Settings may use this after explicitly confirming the currently signed-in account. */
  async linkEmailWithLink(email: string, href: string): Promise<UserCredential> {
    await this.ready;
    this.assertReady("email-link");
    const credential = EmailAuthProvider.credentialWithLink(normalizedEmail(email), this.requireEmailLink(href));
    const result = await linkWithCredential(this.requireUser(), credential);
    this.clearRememberedEmail();
    await result.user.getIdToken(true);
    this.publish({ status: "signed-in", user: result.user });
    return result;
  }

  async signOut(): Promise<void> {
    await this.ready;
    this.assertUsable();
    this.pending = null;
    this.clearRememberedEmail();
    await signOut(this.auth);
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    this.unsubscribeToken();
    this.listeners.clear();
  }
}

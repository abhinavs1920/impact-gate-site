import { getAdditionalUserInfo, type User, type UserCredential } from "firebase/auth";
import type { ImpactGateAuthClient } from "./client";
import type { SocialProvider } from "./config";
import { describeAuthError, ImpactGateAuthError } from "./errors";
import { consumedEmailLinkPath, safeReturnPath, signInDestination } from "./return-path";
import { emailHref, emails } from "../ui/contact";
import { providerIcon, uiIcon } from "../ui/icons";
import { identifyAnalyticsUser, trackEvent } from "../analytics";
import "./auth.css";

export interface AuthPageOptions {
  mode?: "sign-in" | "sign-up";
  next?: string | null;
  /** Bootstrap membership/onboarding through the backend before selecting the final route. */
  onAuthenticated?: (user: User, next: string) => Promise<void> | void;
}

const icons = {
  github: providerIcon("github"),
  google: providerIcon("google"),
};

/** A small DOM adapter usable by the static dashboard generator or the React site. */
export function mountAuthPage(container: HTMLElement, client: ImpactGateAuthClient, options: AuthPageOptions = {}): () => void {
  const mode = options.mode ?? "sign-in";
  const next = safeReturnPath(options.next ?? new URL(window.location.href).searchParams.get("next"), client.config.origin);
  // Keep the one-time link in memory until it is consumed; never copy it into another URL.
  const initialLink = window.location.href;
  let completingLink = client.isEmailLink(initialLink);
  let disposed = false;
  let ready = false;
  let busy = false;
  let signedInUser: User | null = null;

  container.innerHTML = `<main class="ig-auth">
    <header class="ig-auth-header"><a class="ig-auth-brand" href="/" aria-label="Impact Gate homepage"><img src="/favicon.svg" alt="" width="36" height="36"><strong>Impact Gate</strong></a><div class="ig-auth-header-actions"><a class="ig-auth-home ig-auth-docs" href="/docs">Docs</a><a class="ig-auth-home" href="/">Back to website <span aria-hidden="true">↗</span></a><button type="button" class="ig-auth-theme" data-auth-theme aria-label="Switch theme"></button></div></header>
    <div class="ig-auth-grid">
      <section class="ig-auth-context" aria-labelledby="auth-context-title"><span class="ig-auth-eyebrow">Your engineering workspace</span><h2 id="auth-context-title">Understand what your API changes affect.</h2><p>Connect your organization, map your services, and review the evidence behind each finding.</p><ol class="ig-auth-steps"><li><span aria-hidden="true">01</span><div><strong>Connect your GitHub organization</strong><p>Install the Impact Gate app with organization access.</p></div></li><li><span aria-hidden="true">02</span><div><strong>Choose repositories and services</strong><p>Select what to import and confirm detected service names.</p></div></li><li><span aria-hidden="true">03</span><div><strong>Start static analysis</strong><p>Track indexing and open your connected dashboard.</p></div></li></ol><p class="ig-auth-boundary">GitHub App access is managed separately from your sign-in method.</p></section>
      <section class="ig-auth-card" aria-labelledby="auth-title"><div class="ig-auth-card-heading"><span class="ig-auth-eyebrow">Impact Gate</span><h1 id="auth-title"></h1><p data-auth-description></p></div>
        <div data-auth-status class="ig-auth-status" role="status" aria-live="polite" aria-atomic="true" hidden></div>
        <div data-auth-methods><div class="ig-auth-providers"><button type="button" class="ig-auth-button ig-auth-provider" data-auth-provider="github">${icons.github}<span>Continue with GitHub</span></button><button type="button" class="ig-auth-button ig-auth-provider" data-auth-provider="google">${icons.google}<span>Continue with Google</span></button></div><div class="ig-auth-divider" data-email-divider><span>or use your email</span></div><form data-auth-email-form><label class="ig-auth-label" for="auth-email">Work email</label><input class="ig-auth-input" id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="you@company.com"><button class="ig-auth-button ig-auth-primary" type="submit">Send sign-in link</button><p class="ig-auth-helper">We’ll email you a link to sign in. No password needed.</p></form></div>
        <div data-auth-completion hidden><form data-auth-completion-form><label class="ig-auth-label" for="auth-confirm-email">Confirm your email</label><input class="ig-auth-input" id="auth-confirm-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="Email used to request this link"><button class="ig-auth-button ig-auth-primary" type="submit">Complete sign-in</button><p class="ig-auth-helper">Use the email address that received this sign-in link.</p></form><a class="ig-auth-text-link" data-new-link>Request a new sign-in link</a></div>
        <div data-auth-signed-in hidden><p class="ig-auth-account">Signed in as <strong data-auth-account></strong></p><div data-auth-pending hidden><p data-auth-pending-copy></p><button type="button" class="ig-auth-button ig-auth-provider" data-link-provider></button><button type="button" class="ig-auth-text-button" data-skip-link>Continue without linking</button></div><button type="button" class="ig-auth-button ig-auth-primary" data-auth-continue>Continue</button><button type="button" class="ig-auth-text-button" data-auth-sign-out>Use another account</button></div>
        <p class="ig-auth-footnote">Sign-in creates your account when you’re new. Repository access is confirmed during setup.</p>
        <p class="ig-auth-assistance">Need help? <a href="${emailHref("support")}">${emails.support}</a><br><a href="/docs/sign-in">Read the sign-in guide</a></p>
      </section>
    </div>
    <footer class="ig-auth-footer"><span>© 2026 Impact Gate</span><nav aria-label="Account help"><a href="/contact">Contact</a><a href="${emailHref("privacy")}">Privacy & legal</a><button type="button" data-analytics-toggle>Usage analytics</button><a href="${emailHref("security")}">Security</a></nav></footer>
  </main>`;

  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const node = container.querySelector<T>(selector);
    if (!node) throw new Error("Authentication page element is missing.");
    return node;
  };
  const title = find("#auth-title");
  const description = find("[data-auth-description]");
  const status = find("[data-auth-status]");
  const methodPanel = find("[data-auth-methods]");
  const completionPanel = find("[data-auth-completion]");
  const accountPanel = find("[data-auth-signed-in]");
  const emailForm = find<HTMLFormElement>("[data-auth-email-form]");
  const completionForm = find<HTMLFormElement>("[data-auth-completion-form]");
  const continueButton = find<HTMLButtonElement>("[data-auth-continue]");
  const pendingPanel = find("[data-auth-pending]");
  const linkButton = find<HTMLButtonElement>("[data-link-provider]");
  const controls = [...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input,button")].filter(control => !control.matches("[data-auth-theme],[data-analytics-toggle]"));
  const listeners: Array<() => void> = [];
  const listen = (node: HTMLElement, event: string, handler: EventListener) => {
    node.addEventListener(event, handler);
    listeners.push(() => node.removeEventListener(event, handler));
  };

  function message(text: string, error = false): void {
    if (disposed) return;
    status.textContent = text;
    status.hidden = !text;
    status.dataset.error = String(error);
    status.setAttribute("role", error ? "alert" : "status");
  }
  function setBusy(value: boolean): void {
    busy = value;
    container.setAttribute("aria-busy", String(value));
    controls.forEach(control => { control.disabled = value || !ready; });
  }
  function renderAccount(user: User): void {
    if (disposed) return;
    identifyAnalyticsUser(user.uid);
    signedInUser = user;
    methodPanel.hidden = true;
    completionPanel.hidden = true;
    accountPanel.hidden = false;
    title.textContent = "You’re signed in";
    description.textContent = "Continue to your workspace or finish connecting your sign-in methods.";
    find("[data-auth-account]").textContent = user.email ?? user.displayName ?? "your account";
    const provider = client.pendingProvider;
    pendingPanel.hidden = !provider;
    continueButton.hidden = Boolean(provider);
    if (provider) {
      const label = provider === "github" ? "GitHub" : "Google";
      find("[data-auth-pending-copy]").textContent = `Link ${label} to this account to use either sign-in method next time.`;
      linkButton.innerHTML = `${providerIcon(provider)}<span>Link ${label} to this account</span>`;
    }
  }
  function renderEntry(): void {
    if (disposed) return;
    identifyAnalyticsUser(null);
    signedInUser = null;
    methodPanel.hidden = completingLink;
    completionPanel.hidden = !completingLink;
    accountPanel.hidden = true;
    const incompleteLink = !completingLink && window.location.pathname.replace(/\/$/, "") === "/auth/email-link";
    title.textContent = completingLink ? "Finish signing in" : incompleteLink ? "Request a new sign-in link" : mode === "sign-up" ? "Create your account" : "Welcome back";
    description.textContent = completingLink ? "Confirm your email to open your Impact Gate workspace." : incompleteLink ? "Enter your email to receive a new link, or continue with a connected provider." : mode === "sign-up" ? "Choose a sign-in method to create your engineering workspace." : "Sign in to connect your services and review their API dependencies.";
  }
  async function continueToWorkspace(user: User): Promise<void> {
    if (disposed) return;
    message("Opening your workspace…");
    try {
      if (options.onAuthenticated) await options.onAuthenticated(user, next);
      else window.location.assign(next);
    } catch {
      throw new ImpactGateAuthError("auth/workspace-unavailable", "Your workspace could not be opened.");
    }
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (busy || disposed || !ready) return;
    setBusy(true);
    message("");
    try { await action(); }
    catch (error: unknown) { const info = describeAuthError(error); trackEvent("auth_error", { error_type: info.code.replace(/[^a-z0-9_-]/gi, "_") }); message(info.message, true); }
    finally { if (!disposed) setBusy(false); }
  }

  find<HTMLAnchorElement>("[data-new-link]").href = signInDestination(next, client.config.origin);
  const themeButton = find<HTMLButtonElement>("[data-auth-theme]");
  function syncTheme(): void {
    const dark = document.documentElement.dataset.theme === "dark";
    themeButton.innerHTML = uiIcon(dark ? "sun" : "moon");
    themeButton.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} theme`);
    themeButton.title = `Switch to ${dark ? "light" : "dark"} theme`;
  }
  syncTheme();
  function recordAuth(result: UserCredential, method: string): void {
    identifyAnalyticsUser(result.user.uid);
    trackEvent(getAdditionalUserInfo(result)?.isNewUser ? "sign_up" : "login", { method });
  }
  listen(themeButton, "click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("impact-gate-theme", theme); } catch { /* Theme remains available for this page. */ }
    syncTheme();
  });
  for (const button of container.querySelectorAll<HTMLButtonElement>("[data-auth-provider]")) {
    const provider = button.dataset.authProvider as SocialProvider;
    button.hidden = !client.isEnabled(provider);
    listen(button, "click", () => { void run(async () => {
      message(`Opening ${provider === "google" ? "Google" : "GitHub"} sign-in…`);
      trackEvent("sign_in_start", { method: provider });
      const result = await client.signIn(provider);
      recordAuth(result, provider);
      renderAccount(result.user);
      if (!client.pendingProvider) await continueToWorkspace(result.user);
    }); });
  }
  emailForm.hidden = !client.isEnabled("email-link");
  find("[data-email-divider]").hidden = !client.isEnabled("email-link") || !client.config.methods.some(method => method !== "email-link");
  listen(emailForm, "submit", event => {
    event.preventDefault();
    if (!emailForm.reportValidity()) return;
    const email = String(new FormData(emailForm).get("email") ?? "");
    void run(async () => {
      trackEvent("sign_in_start", { method: "email_link" });
      const sent = await client.sendEmailLink(email, next);
      trackEvent("email_link_requested", { method: "email_link" });
      message(`Check your inbox at ${sent.email}. Open the sign-in link to continue.${sent.remembered ? "" : " You’ll be asked to confirm your email when you open it."}`);
    });
  });
  async function complete(email: string): Promise<void> {
    const result = await client.completeEmailLink(email, initialLink);
    if (disposed) return;
    recordAuth(result, "email_link");
    window.history.replaceState(window.history.state, "", consumedEmailLinkPath(client.config.origin, next));
    completingLink = false;
    renderAccount(result.user);
    if (client.pendingProvider) message("Your email is confirmed. You can now link the other sign-in method.");
    else await continueToWorkspace(result.user);
  }
  listen(completionForm, "submit", event => {
    event.preventDefault();
    if (!completionForm.reportValidity()) return;
    const email = String(new FormData(completionForm).get("email") ?? "");
    void run(() => complete(email));
  });
  listen(continueButton, "click", () => { void run(async () => {
    const user = client.currentUser ?? signedInUser;
    if (!user) throw new ImpactGateAuthError("auth/not-signed-in", "Sign in to continue.");
    await continueToWorkspace(user);
  }); });
  listen(linkButton, "click", () => { void run(async () => {
    const result = await client.linkPendingProvider();
    renderAccount(result.user);
    message("Sign-in method linked to your account.");
    await continueToWorkspace(result.user);
  }); });
  listen(find("[data-skip-link]"), "click", () => { void run(async () => {
    client.cancelPendingLink();
    const user = client.currentUser;
    if (!user) throw new ImpactGateAuthError("auth/not-signed-in", "Sign in to continue.");
    renderAccount(user);
    await continueToWorkspace(user);
  }); });
  listen(find("[data-auth-sign-out]"), "click", () => { void run(async () => {
    await client.signOut();
    identifyAnalyticsUser(null);
    trackEvent("sign_out");
    renderEntry();
    message("Choose a sign-in method for your account.");
  }); });

  const unsubscribe = client.subscribe(session => {
    if (disposed) return;
    if (session.status === "error") message(session.error.message, true);
    // An action owns its view until it finishes; auth events may precede its promise.
    if (ready && !busy && session.status === "signed-out") renderEntry();
    if (ready && !busy && session.status === "signed-in" && !completingLink) renderAccount(session.user);
  });
  renderEntry();
  setBusy(true);
  message("Loading sign-in…");
  void client.ready.then(async user => {
    if (disposed) return;
    ready = true;
    setBusy(false);
    message("");
    if (completingLink) {
      const email = client.rememberedEmail();
      if (email) {
        find<HTMLInputElement>("#auth-confirm-email").value = email;
        await run(() => complete(email));
      } else find<HTMLInputElement>("#auth-confirm-email").focus();
    } else if (user) renderAccount(user);
    else if (window.location.pathname.replace(/\/$/, "") === "/auth/email-link") message("This sign-in link is incomplete. Request a new link to continue.", true);
  }).catch((error: unknown) => {
    if (disposed) return;
    setBusy(false);
    message(`${describeAuthError(error).message} Reload this page to try again.`, true);
  });

  return () => {
    disposed = true;
    unsubscribe();
    listeners.forEach(remove => remove());
  };
}

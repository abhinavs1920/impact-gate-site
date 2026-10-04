# Website authentication

## Integrated runtime

The account routes and all dashboard documents now bundle the existing auth modules with Firebase through esbuild. `src/dashboard/connected.ts` creates one auth client per document and fetches `/api/v1/config` for its public Firebase configuration. The three methods are enabled only when configured by the backend. Authenticated continuation checks `/api/v1/session` and opens onboarding when no authorized workspace exists.

The same-origin Worker forwards `/api/v1/*` to the fixed `IMPACT_GATE_API_ORIGIN` HTTPS origin. Configure the backend `PUBLIC_API_URL` and `PUBLIC_SITE_URL` as `https://impactgate.in`; the public OAuth callback is `https://impactgate.in/api/v1/github/callback`. OAuth start sets the host-only `impact_gate_oauth` HttpOnly/Secure/SameSite=Lax cookie. The proxy forwards only that cookie to the callback and permits callback redirects only to `/onboarding` on the site origin. Account routes on `www.impactgate.in` move to the canonical origin before authentication to preserve cookie and auth persistence continuity.

For a private backend API boundary, set Worker secret `IMPACT_GATE_PROXY_SECRET` and the matching backend `API_PROXY_SHARED_SECRET`; the Worker supplies `X-Impact-Gate-Proxy-Secret`. Bearer tokens, backend keys, and secrets are never injected into static HTML. API responses are marked `no-store` and redirects are never followed with credentials.

The backend callback returns an opaque, UID-bound installation flow. Onboarding retrieves its authorized installation choices, explicitly connects the selected installation, and saves the chosen allowed repository IDs. Every write is reauthorized by the backend.

The auth modules live in `src/auth/`. They implement website login with GitHub, Google, and passwordless email links. They do not authorize access to a GitHub App installation or grant workspace membership.

## Page plan

| Route | Behavior |
| --- | --- |
| `/sign-in` | GitHub and Google buttons, work-email link form, existing-session continuation |
| `/sign-up` | The same methods with account-creation copy; Firebase creates a user when needed |
| `/auth/email-link` | Consume the Firebase link, confirm the address when needed, then bootstrap the workspace |
| `/onboarding` | Backend-owned lifecycle: verify GitHub App access, choose repositories, review discovered services, start indexing |
| `/dashboard` and children | Wait for authentication, then fetch authorized backend data |

The auth page uses the homepage fonts and color tokens, indigo links, lime primary actions, and the existing light/dark preference. It renders with native DOM through `mountAuthPage`, so it can be used by the static dashboard generator or mounted from React. No illustrative workspace records appear on this page.

## Runtime configuration

Pass `parseAuthConfig(publicConfig, window.location.origin)` into `new ImpactGateAuthClient(config)`. The public shape is:

```ts
{
  firebase: { apiKey, authDomain, projectId, appId },
  methods: ["github", "google", "email-link"],
  persistence: "local" // "session" and "memory" are also supported
}
```

Optional Firebase fields are `messagingSenderId`, `measurementId`, and `storageBucket`. An alternative is an inert JSON element with ID `impact-gate-auth-config`, consumed by `readInjectedAuthConfig()`. When emitting JSON inside HTML, the generator must escape `<` and must not include backend credentials. Configuration may also come from a same-origin public-config endpoint.

Public Firebase configuration identifies the project; it is not a service-account credential. API authorization still requires token verification on the backend. Missing/invalid config must show an unavailable state rather than loading a demo workspace.

## Integration

1. Install the Firebase JavaScript SDK in the site repo and bundle the auth client with Vite. The dashboard generator currently copies `workspace.js`; that step cannot resolve npm SDK imports and must be replaced or supplemented with a bundle/manifest.
2. Emit `/sign-in`, `/sign-up`, and `/auth/email-link` documents using the auth entry bundle. Include the existing homepage font links and CSS tokens, plus the auth bundle CSS. The page adapter imports `auth.css`.
3. Create one client per document. Await `client.ready` before requesting a token or enabling popup actions. Invoke `signIn()` or `linkProvider()` directly from a user click after readiness.
4. Mount the auth page with `onAuthenticated(user, next)`. That callback must obtain `client.getIdToken()`, call the authenticated backend bootstrap, and choose onboarding or dashboard from server state. The helper's default continuation navigates to the validated `next` path only.
5. On dashboard documents, subscribe to the auth lifecycle and fetch real data after `signed-in`. For `signed-out`, cancel requests, clear cached workspace data, and navigate to `signInDestination(currentPath, origin)`. Authentication errors show an error state.
6. Send the Firebase ID token as a bearer token to the same-origin API proxy. The backend verifies the token and checks workspace membership for every request. Never use a client-provided tenant ID as authorization.
7. After `signOut()`, the integration must cancel requests and remove any in-memory workspace cache. Call the page cleanup function when unmounting; call `client.dispose()` when its whole lifecycle ends.

The client does not manually store ID tokens or provider access tokens. Firebase owns authentication persistence and token renewal. `getIdToken(true)` supports a single forced-refresh retry when an API request receives an authentication error; the transport must not loop on persistent failures.

## Provider linking

The Firebase UID remains the website identity when another provider is linked. On an account collision, the user signs in with the existing method and explicitly confirms `linkPendingProvider()`. Pending OAuth credentials remain in memory for at most ten minutes. Refreshing or opening another document discards them; after signing in, settings can restart an explicit `linkProvider()` action. The UI does not query a public list of providers for an email address.

Credentials attached to another Firebase UID are not automatically merged. `linkEmailWithLink()` is available for an explicit settings flow that confirms the currently signed-in account. Standard email-link completion signs in; it does not automatically turn into a settings-link action based on a query parameter.

## Passwordless completion

The client sends a web-only link with `handleCodeInApp: true` and a continuation URL at `/auth/email-link`. Only a validated internal return path is included. The email address is never put in the URL. A browser may remember the address for up to 24 hours to complete the link on the same device; this value is not a credential. If storage is blocked or the link opens elsewhere, the page asks for the email again. The Firebase SDK consumes and validates the one-time code.

After successful completion, the page removes the action parameters from browser history before opening the workspace. Invalid, expired, or used links show a request-new-link action. Return paths are restricted to dashboard, onboarding, or setup destinations; external URLs, protocol-relative URLs, encoded separators, and control characters are rejected.

Current web email-link setup is documented by [Firebase](https://firebase.google.com/docs/auth/web/email-link-auth). Enable the email provider and email-link method, authorize the website domain, and use HTTPS. No deprecated Dynamic Links configuration is used.

## GitHub App boundary

Firebase GitHub login requests email identity access, with no repository OAuth scope. The organization-wide GitHub App installation is a separate connection. Its setup callback and `installation_id` are untrusted input until the backend authenticates the GitHub user, confirms installation access, and binds it to the signed-in workspace. The browser selects which repositories from that authorized installation to import; the backend revalidates those repository IDs.

Google and email users follow the same GitHub App connection step. Firebase's GitHub identity token must not be treated as the GitHub App's user access token. App private keys, client secrets, webhook secrets, and installation tokens stay on the backend.

Provider linking is based on [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking). Popup sign-in is implemented initially. A redirect fallback requires the [Firebase redirect configuration](https://firebase.google.com/docs/auth/web/redirect-best-practices) to work with browser storage restrictions; it is not silently enabled by this module.

## Deployment setup still required

Configure the chosen Firebase project and three providers, the website's authorized domains, OAuth redirect handlers, the email sender/template, the backend's Firebase verification credentials, and the GitHub App connection endpoints. Provider configuration must reflect `methods` in the public config. No external provider or project settings are changed by adding these modules.

No tests or external resource changes were performed while preparing this module.

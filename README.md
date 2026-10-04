# Impact Gate teaser assembly

This folder contains a ground-truth record and an evidence-gated teaser plan. The current record says the required CLI and renderer commands could not run because `pnpm` was unavailable, so blocked screenshot steps must be completed before any product-text shot is published.

Assemble in this order:

1. Restore a working Node and pnpm environment, then capture the real CLI help, a real `--no-llm` analysis, and a real renderer output.
2. Reconcile those captures into `PRODUCT_TRUTH.md`; remove any blocked labels only when the evidence exists.
3. Capture the terminal and Markdown evidence as locked screen assets.
4. Produce only the text-free generated b-roll from `IMAGE_PROMPTS.md`.
5. Feed each locked capture or generated asset to Veo using the matching prompt in `VEO_PROMPTS.md`.
6. Assemble the clips outside these tools in a video editor with the voiceover, sound design, exact composited product text, and waitlist CTA.

Veo prompts alone do not produce a finished file containing mixed real footage, generated animation, and voiceover. The final assembly happens in an editor.

## Website development

The public site is a React/Vite application. The Cloudflare Worker in `src/worker.ts` serves the Vite `dist/` assets and handles `/api/waitlist`. Valid pilot requests are saved in private Cloudflare KV for 90 days and sent to `abxh1920@gmail.com` through Cloudflare Email Service; the reply-to address is set to the applicant. Campaign attribution and a random lead reference connect accepted requests with website conversion events.

The public homepage is indexable. `public/robots.txt` permits search and AI-answer crawlers while excluding the API, and `public/sitemap.xml` lists the canonical URL. The homepage includes canonical/social metadata and structured software and FAQ data. Indexing and search rankings are controlled by the search engines and are not guaranteed.

Before waitlist emails can be delivered, onboard `impactgate.in` under **Cloudflare Dashboard → Compute → Email Service → Email Sending**. Configure the DNS records Cloudflare provides and wait for sending-domain verification. The Worker binding is restricted to `pilot@impactgate.in` as sender and `abxh1920@gmail.com` as recipient.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm verify:site
```

GitHub Actions verifies pull requests and deploys pushes to `main` using Wrangler. Configure the repository variable `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_API_TOKEN` before enabling deployments. The token needs permission to deploy Workers and manage Worker routes.

## Website analytics and leads

Firebase Analytics is connected to the dedicated `impact-gate-prod` project and GA4 property `557166280`, using measurement ID `G-PDKMBG4FD8`. It records visits, marketing calls to action, pilot submission outcomes, documentation topics, sign-in, GitHub/repository setup, and successful workspace actions. Anonymous visitors remain pseudonymous; signing in associates events with the opaque Firebase UID. Form contents and private repository data are excluded from usage events.

Start with [Firebase Analytics](https://console.firebase.google.com/project/impact-gate-prod/analytics) or [GA4 Realtime](https://analytics.google.com/analytics/web/#/p557166280/realtime/overview). The [operator guide](docs/ANALYTICS.md) explains the event catalog, lead retrieval, campaign links, funnel reports, visitor controls, and remaining Analytics-console report settings. Visitor-facing guidance is published at [/docs/permissions-and-data#website-analytics](https://impactgate.in/docs/permissions-and-data#website-analytics).

## Connected application

The deployed application at `https://impactgate.in/sign-in` uses the dedicated Firebase project `impact-gate-prod`. The pilot enables Google and passwordless email links. GitHub identity sign-in is implemented and remains disabled until a dedicated identity OAuth provider is configured. GitHub repository authorization uses the organization-owned Impact Gate App.

After sign-in, `/onboarding` verifies GitHub organization ownership, links the installation, and selects repositories for indexing. All six `/dashboard` screens read persisted snapshots, jobs, findings, settings, and reviews. Missing runtime telemetry is shown as unknown. The existing shared shell and original design exports remain available; connected page content renders the real workspace instead of illustrative records.

The Cloudflare Worker proxies `/api/v1/*` to the fixed `IMPACT_GATE_API_ORIGIN`, currently `https://impact-gate-api.eastus.cloudapp.azure.com`. Set `IMPACT_GATE_PROXY_SECRET` as a Cloudflare secret matching the backend's `API_PROXY_SHARED_SECRET`; never put it in `vars` or bundled JavaScript. The browser OAuth callback is the same-origin `/api/v1/github/callback`, and the App setup path is `/onboarding/github`. Automatic invocation URL logs are disabled to protect authorization query parameters.

`pnpm build` produces the homepage, connected dashboard assets, and account routes. Deploy with `node node_modules/wrangler/bin/wrangler.js deploy` after the backend is ready. Runtime public Firebase configuration comes from `/api/v1/config`. See the backend repository's `deploy/README.md` and `docs/END_TO_END_INTEGRATION_PLAN.md` for deployment and actual acceptance status.

## Product documentation

API Usage includes a **Code flow** tab showing persisted handlers, reachable functions, call boundaries, immutable source evidence and API request attribution. The **Function usage** sidebar link opens `/dashboard/dependency-graph#function-usage`, a searchable function usage table; Dependency Graph exports the function graph with its snapshot. Shared functions combine comparable API observation windows; counters describe attributed requests, while actual function invocation counts require function telemetry. Reindex older repositories after deploying the backend code observability update to populate their flows.

Public customer documentation is available at `https://impactgate.in/docs`. The guides cover account setup, GitHub authorization, repository indexing, pull request reports, every workspace screen, runtime observability, permissions, website analytics, coverage, troubleshooting, and the website's workspace API.

- Edit guide text and section anchors in `src/docs/content.ts`. Keep instructions consistent with the connected application's labels and capabilities.
- `src/docs/DocsApp.tsx` renders navigation, article blocks, browser search, code copying, and screenshot previews. Styles are scoped in `src/docs/docs.css`.
- `scripts/prerender.mjs` produces static HTML for the docs home and every guide, including article metadata and a generated sitemap. `pnpm build` regenerates these pages.
- `public/docs/images/` contains three genuine product screenshots: public sign-in and a report from an Impact Gate lab PR. Use screenshots for steps that benefit from visual context; avoid private workspace data and sign-in credentials.

Documentation search runs in the browser and does not send queries to an external search service. Both the public site and authenticated workspace link to the docs. New guides need a unique slug, a description, and stable section IDs so existing deep links remain useful.
## Runtime observability connections

The connected Settings screen supports existing Prometheus and Datadog accounts. Enter source access, choose **Find and match services**, review preselected matches and dropdown suggestions, then **Connect**. **Use all suggested matches** applies proposed matches together; query/label/facet/window settings and manual aliases are optional collapsed sections. **Fill with repository names** handles inactive services without typing every name. Matching uses indexed service/repository names and API routes without an LLM. Saved connections support edit, sync, disconnect, and opening the provider console. Indexed API routes display imported request counts or indexed spans and their observation window. Caller relationships require explicit caller identity and service mapping. Credentials are sent through the authenticated API proxy and never returned to the browser or saved in browser storage.

The user guide is `/docs/runtime-observability`, authored in [runtime-observability.ts](src/docs/runtime-observability.ts). Backend integration and operator setup are documented in the analyzer's [runtime guide](../impact-gate/docs/runtime-observability.md). Deploy the updated backend/migration alongside the site. Older backends with `runtimeTelemetry: false` show the connection controls as unavailable.

First published October 1, 2026: [Settings](https://impactgate.in/dashboard/settings#runtime-connections) and [connection guide](https://impactgate.in/docs/runtime-observability), Cloudflare version `b102eb50-f3ad-4278-a789-3b368ed0817e`, with Azure release `runtime-20261001-d6781e57`.

The simplified discovery/review flow is live in Cloudflare version `a6b3620f-48d6-45f6-a942-b7681165fc06` and Azure API/worker release `runtime-easy-20261001-95549c13`. Backend/site type checks, the site build and deployment dry run passed. The API and worker are healthy; signed-out discovery requests return HTTP 401. The backend runtime guide records deployment and rollback details. Users supply their own source credentials through Settings to perform the actual provider import.

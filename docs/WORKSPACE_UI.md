# Dashboard workspace

## Connected product integration

The production dashboard now uses `src/dashboard/connected.ts` and `src/dashboard/api.ts`. The original six Stitch design files and illustrative `workspace.js` remain as source/reference artifacts; the production generator bundles the authenticated client and renders no sample records into dashboard documents.

All six dashboard routes call the authenticated session and workspace snapshot APIs. The overview, endpoint catalog and source inspector, service graph, deprecation evidence review, repository coverage/jobs, and workspace settings are derived from that snapshot. Repository selection, reindexing, preference saves, and candidate reviews use backend mutations. Success is shown only after the server confirms a write. Runtime coverage remains explicitly unavailable when no observations are connected.

The API inspector's **Code flow** tab reads `snapshot.code` and shows API → handler → reachable functions, unresolved/external boundaries, conditional/repeated call sites and downstream API links. Each function displays that API's attributed request count and its combined count across comparable API windows. The Function usage navigation link opens the searchable, paginated function usage table in Dependency Graph, and its JSON export includes the full code snapshot. Flows use immutable source commit links. Counts are derived from API traffic; actual invocation counts require function telemetry. Older snapshots render a reindex prompt while remaining readable.

Settings supports customer-owned Prometheus and Datadog connections through **Source access → Find and match services → Review → Connect**. The form discovers source service names and suggests repository matches. Clear matches are preselected in a collapsed group; exceptions use service dropdowns and **Use all suggested matches**. Advanced query/label/facet/window controls and optional manual aliases are collapsed. **Fill with repository names** supports inactive services without typing each name. Source changes invalidate pending suggestions, discovery saves nothing, and saved mappings/credentials can be reused on edits. The screen also provides sync, disconnect, source-console links and coverage diagnostics. API usage displays estimated counter increases or indexed spans with source/window and unknown caller identity where appropriate. Runtime dependency edges require a supplied caller mapped to an indexed service. Public snapshots contain no credentials; browser storage is not used for them. The guide is `/docs/runtime-observability`.

The dashboard home retains the Stitch overview: five linked summary cards, findings by severity, endpoint caller distribution, deprecation evidence breakdown, and a recent open findings table. Every total comes from the authenticated snapshot. Caller bands state their exact static caller counts and do not imply observed runtime traffic. Recent findings are sorted newest first and support search, severity filtering, expansion, evidence review, and GitHub pull request links. Indexing and analysis jobs are shown on the repository and onboarding screens.

Home cards show their navigation action and an arrow. Repository, service, endpoint, and candidate summary cards open Repositories, Dependency Graph, API Usage, and Deprecation Candidates respectively. The API usage and deprecation chart cards link across their entire surface to the same detail screens. Open Findings and Findings by Severity jump to the recent findings section on Home. All card links support keyboard focus and normal browser link behavior.

The shared shell uses local SVG action icons, explicit theme labels, responsive page titles, keyboard navigation, and a workspace picker in the mobile drawer. Settings groups workspace preferences, account providers, and GitHub access, with billing, support, and privacy contact links. Onboarding includes setup guidance and pilot/support email links. Sign-in uses Google's published gradient G artwork from `public/icons/google.png`, shared provider icons, a theme switch, and support links.

Public contact aliases are maintained in `src/data/contact-emails.json`. `/contact` lists all ten addresses by purpose. Marketing, authentication, docs, onboarding, and workspace screens use the relevant `mailto:` links; the pilot request form keeps its existing server submission. Forwarding destinations are not displayed in the UI. The contact page is prerendered with its own title, canonical URL, metadata, and sitemap entry. Fallback routes render a useful missing-page screen instead of hydrating the wrong document.

The additional account routes are `/sign-in`, `/sign-up`, `/auth/email-link`, `/onboarding`, and `/github/setup`. GitHub, Google, and passwordless email are displayed according to the backend's public auth configuration. Onboarding verifies the GitHub OAuth installation flow through the authenticated API, selects allowed repositories, starts indexing, and polls progress.

The transport requests Firebase bearer tokens per call, refreshes once after a 401, cancels pending requests on sign-out or account/workspace changes, and rejects responses from an earlier session. Workspace records remain in document memory. The selected workspace ID in session storage is only a preference and is always checked against server membership.

`pnpm test:workspace` verifies token renewal and cancellation, proxy credential and redirect boundaries, all six snapshot screens, and onboarding using controlled fixtures. Real provider authorization and installation verification still require the deployed providers and GitHub App.

Implemented on 2026-09-30 from the six desktop exports in Stitch project `15400796854764131602` (Impact Gate — NEW UI). Original exports are retained in `src/dashboard/designs/` as design sources. The deployed pages use the existing homepage fonts, indigo/lime palette, logo, and shared light/dark preference.

## Page plan and delivery

| Route | Delivered layout and behavior |
| --- | --- |
| `/dashboard` | Engineering overview, five snapshot summary cards, three charts, recent open findings and evidence review |
| `/dashboard/api-usage` | Search and service filters, endpoint selection, overview/code flow/callers/history tabs, source and runtime evidence |
| `/dashboard/dependency-graph` | Snapshot service graph, node inspector, search and evidence filters, fit, JSON export, searchable function inventory |
| `/dashboard/deprecation-candidates` | Status filters, search, evidence dialogs, server-confirmed snapshot reviews |
| `/dashboard/repositories` | Repository search/status filters, coverage dialogs, authorized repository selection, reindexing and jobs |
| `/dashboard/settings` | Server-confirmed workspace preferences, account providers, GitHub and runtime connections, account help links |

Shared navigation becomes a focus-managed drawer on smaller screens. Tables become labeled cards on phones. Dialogs, navigation, table selection and graph nodes support keyboard use. Reduced motion is respected.

## Build and routing

`pnpm build` builds the existing React marketing site and prerenders it, then runs `scripts/build-dashboard.mjs`. The dashboard generator reads the exported layouts, adds semantic action annotations and a shared shell, and compiles Tailwind locally. It emits six HTML documents and content-hashed CSS/JavaScript in `dist`. No Tailwind CDN JavaScript runs in production.

`vite.config.ts` serves these documents during `pnpm dev` and rebuilds them when the dashboard sources change. Cloudflare static assets serve the clean production routes from `dashboard.html` and `dashboard/*.html`. Existing `/dependency-graph` and `/deprecation-candidates` links redirect to the corresponding dashboard pages. `/review-desk` remains the illustrative finding detail screen. Dashboard documents are marked `noindex`.

Run `pnpm typecheck` for TypeScript validation. Deployment uses the existing `wrangler.jsonc` and email/asset bindings. A dry run is `pnpm exec wrangler deploy --dry-run` after building.

## Original illustrative preview boundary

This delivery implements the workspace UI. All counts, observations, graphs and findings are illustrative. Preview actions persist under `impact-gate-preview-*` in browser storage; theme uses the homepage's `impact-gate-theme` key. Storage failures are reported instead of claiming a saved change.

Repository selection does not start a real analysis job. GitHub installation management, sign-in/sign-up, service discovery, indexing progress, database synchronization and real notifications still require account/backend integration. No authenticated data or credentials are embedded in the static documents. Sample runtime observations do not establish current telemetry coverage, and reviewing a candidate does not deprecate an endpoint.

## Validation during implementation

Production build, TypeScript checking, JavaScript syntax checking and Wrangler deployment dry run completed successfully. The pages were reviewed in Chrome at desktop and phone widths, including filtering, endpoint selection, graph layout, the import review dialog, and Cloudflare's local clean routes and legacy redirects.

The October 1 UI pass traversed the homepage, contact directory, all 17 documentation pages, authentication/setup routes, all six dashboard screens, and Review Desk. Layouts were reviewed at 1440px and 390px, with core pages also reviewed at 320px in dark mode. The follow-up covered navigation, docs search, theme/workspace switching, and repository, runtime-connection, and evidence dialogs. Dashboard views used local sample data in a read-only preview; no provider sign-in or customer account mutations were performed.

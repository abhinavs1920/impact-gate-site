# Website analytics and leads

Impact Gate uses the Firebase web Analytics SDK and its linked Google Analytics 4 property. The integration records visitor intent and product journeys across the public website, documentation, account pages, onboarding, and connected workspace.

## Open the reports

| Setting | Value |
| --- | --- |
| Website | https://impactgate.in |
| Firebase project | `impact-gate-prod` |
| Firebase web app | `1:830832356407:web:cd9ce464c85b35f05e63b2` |
| GA4 property | `557166280` (`impact-gate-prod`) |
| Web data stream | `15967481167` |
| Measurement ID | `G-PDKMBG4FD8` |
| Lead store | Cloudflare KV `impact-gate-leads`, Worker binding `WAITLIST` |

- [Firebase Analytics](https://console.firebase.google.com/project/impact-gate-prod/analytics): events and audience activity for this project.
- [GA4 Realtime](https://analytics.google.com/analytics/web/#/p557166280/realtime/overview): recent visits and events.
- [GA4 reports](https://analytics.google.com/analytics/web/#/p557166280/reports/intelligenthome): acquisition, engagement, pages, and conversions.
- [Cloudflare lead store](https://dash.cloudflare.com/66c08ba47ddb8844d95ecb96649170cb/workers/kv/namespaces/ac3f7ca15a61471da2a376c1a1590c0e): submitted contact details, accessible with your Cloudflare account permissions.

Firebase Analytics was enabled and linked through the signed-in Firebase CLI account. A new property was created for Impact Gate in the existing Firebase-linked Analytics account `309879426`; events use the dedicated Impact Gate property. The website remains hosted on Cloudflare and its API remains on Azure.

Realtime and DebugView are useful for recent activity. Standard reports can take 24–48 hours to process incoming data. Collection starts with visits after deployment; historical website activity cannot be reconstructed. See [Google's reporting guidance](https://support.google.com/analytics/answer/9333790).

## What is recorded

All explicit events include a fixed public page path and `site_area` (`marketing`, `docs`, `authentication`, `setup`, or `workspace`). URLs omit query strings and fragments; unknown routes become `/not-found`. The adapter allows a small set of categorical fields and nonnegative counts.

| Events | Meaning and useful parameters |
| --- | --- |
| `page_view` | Entry and navigation between documents; `page_path`, `site_area`. |
| `navigation_click`, `cta_click` | Navigation and calls to action; `action`, `placement`, `target_page`, optional public `page_section`. |
| `section_view`, `scroll_depth` | Interest in homepage sections and 25/50/75/90% scroll milestones. |
| `contact_click` | Contact purpose, such as pilot or support; no email address. |
| `form_start`, `form_submit`, `form_error` | Pilot form engagement, submission attempts, and client validation/network/server failures. Native validation can emit an error for each invalid field. |
| `generate_lead` | Server accepted a pilot request after saving it or successfully notifying the team; `form_name`, random `lead_id`. Honeypot submissions do not generate leads. |
| `docs_search`, `docs_search_result`, `docs_code_copy` | Search intent category, query length/result count, chosen guide, and copied code language; no typed search text. |
| `sign_in_start`, `email_link_requested`, `login`, `sign_up`, `auth_error`, `sign_out` | Authentication steps and outcomes; provider/method and a sanitized error code. `sign_up` requires Firebase to identify a new account. |
| `setup_started`, `github_connection_start`, `github_connected` | Onboarding and GitHub authorization steps; success follows the authenticated API response. |
| `repository_selection_saved`, `repository_reindex_requested` | Successful selection and indexing requests; repository count only. |
| `workspace_view`, `workspace_action`, `workspace_error` | Workspace page use, supported button actions, code-flow tab choice, and broad error category. Views are emitted once per workspace on a page, rather than on each poll. |
| `evidence_review_saved`, `workspace_settings_saved` | Successful review or settings save; reviewed/needs-review category only. |
| `runtime_discovery_start`, `runtime_services_discovered` | Provider discovery and total/matched/unmatched service counts. |
| `runtime_connection_saved`, `runtime_sync_completed`, `runtime_connection_removed` | Successful Prometheus/Datadog connection operations; provider and mapped service count. |

`generate_lead`, `login`, and `sign_up` use [Google's recommended event names](https://developers.google.com/analytics/devguides/collection/ga4/reference/events). Workspace success events are emitted after API success. Button attempts are separate `workspace_action` events.

An anonymous visitor is represented by Analytics' pseudonymous browser identity. Signed-in events use the opaque Firebase UID, with `account_state` and an allowed workspace role. This helps understand return visits and setup progression; Analytics does not tell you an anonymous person's name or email address. Contact details come from an actual pilot request.

Usage events exclude names, email addresses, repository/service names, source code, endpoint paths, free-text notes, raw searches, credentials, authorization URLs, and backend responses. The private lead store contains the contact details needed for follow-up. Do not introduce these fields into future event parameters.

## Campaign attribution and pilot leads

Use public campaign links, for example:

```text
https://impactgate.in/?utm_source=linkedin&utm_medium=social&utm_campaign=private_pilot&utm_content=launch_post
```

Only `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` labels containing letters, digits, underscores, or hyphens (up to 64 characters) are retained, lowercased. Do not put personal details in campaign labels. Attribution stays in session storage across page navigation. A new labeled campaign replaces the current campaign; the public landing path and referring hostname are saved with an accepted request. The same labels configure Analytics' campaign fields.

The pilot form remains at `/#pilot`; contact details go to `/api/waitlist`. The Worker saves a private receipt before attempting the email notification. A successful response returns a random UUID `leadId`, and the browser sends that reference with `generate_lead`. The reference can connect a conversion event with a lead without sending its email to Analytics.

Each `waitlist:<leadId>` record contains the lead ID, UTC receipt time, work email, repository/organization, optional notes, sanitized attribution, and initial notification status. The record expires after 90 days. If a receipt starts as `pending`, its `notificationKey` points to `waitlist-notification:<leadId>`, containing the final `sent` or `failed` status and update time. Separate keys avoid Cloudflare KV's [one-write-per-second limit per key](https://developers.cloudflare.com/kv/platform/limits/). An `unavailable` receipt means no email binding was configured. A missing notification result means delivery was not confirmed by this invocation; the receipt still preserves the lead.

Email notifications continue to `abxh1920@gmail.com` from `pilot@impactgate.in`, with the applicant as reply-to. Notifications include campaign labels and the lead reference. If email delivery fails but the lead was saved, the visitor still receives an accepted response. If both storage and notification fail, the form shows an error. Mailbox copies follow separate mailbox retention.

Retrieve records through Cloudflare's KV dashboard or the signed-in Wrangler CLI:

```sh
node node_modules/wrangler/bin/wrangler.js kv key list --binding WAITLIST --remote --prefix 'waitlist:'
node node_modules/wrangler/bin/wrangler.js kv key get 'waitlist:<leadId>' --binding WAITLIST --remote --text
node node_modules/wrangler/bin/wrangler.js kv key get 'waitlist-notification:<leadId>' --binding WAITLIST --remote --text
```

Run these from the site repository. They print private lead details; keep exports within the team handling pilot requests. There is no public lead-list endpoint. KV is eventually consistent, so a newly accepted receipt may take time to appear in another region. KV expiration does not delete email copies or already collected Analytics events.

## Configure useful reports once

These account-level report settings require Analytics Editor access. The existing Firebase CLI refresh token lacks the `analytics.edit` OAuth scope, and Analytics Admin API requests return `ACCESS_TOKEN_SCOPE_INSUFFICIENT`. Website collection works without these report settings; they must be set in the Analytics console or with a separately authorized Analytics Admin token.

1. Select property `impact-gate-prod` / `557166280`.
2. Under **Admin → Data display → Events**, mark `generate_lead` as a key event. Consider `sign_up`, `github_connected`, and `runtime_connection_saved` for activation. Key events count measured visitors; the private lead store is the source for actual submissions, including visitors who opted out.
3. Under **Admin → Data display → Custom definitions**, add event-scoped dimensions for `site_area`, `action`, `placement`, `page_section`, `provider`, `method`, `error_type`, `search_topic`, and `doc_slug`. Add user-scoped dimensions for `account_state` and `workspace_role`. Optional event-scoped metrics include `repository_count`, `service_count`, `matched_count`, and `unmatched_count` with the Standard unit. Avoid registering the unique `lead_id` or Firebase UID as a custom dimension; they create high cardinality.
4. Under **Explore → Funnel exploration**, create these sequences. Use an open funnel where visitors can enter partway through:

| Funnel | Steps |
| --- | --- |
| Pilot interest | `page_view` → `cta_click` with `action=request_pilot` → `form_start` → `form_submit` → `generate_lead`. |
| Product activation | `sign_in_start` → `login` or `sign_up` → `setup_started` → `github_connected` → `repository_selection_saved` → `runtime_connection_saved`. |
| Runtime setup | `runtime_discovery_start` → `runtime_services_discovered` → `runtime_connection_saved` → `runtime_sync_completed`, split by `provider`. |

Compare channels, pages, and device types before changing the site. A large CTA-to-form drop suggests unclear pilot expectations; form errors suggest submission friction; failed authentication or repository setup highlights onboarding problems; unmatched discovery counts indicate naming/mapping friction. Use cohorts and repeated patterns instead of treating a single visitor as evidence.

### Keep collection settings aligned with the code

The published Google tag was inspected during implementation: its general automatic-event switches default to enabled, but its destination has no enhanced form/outbound/search/history rules. Those are separate settings. The application sends page views and intent events explicitly.

In **Admin → Data streams → Impact Gate Web**, keep Enhanced measurement off, especially automatic outbound clicks, form interactions, site search, and history page views. These can collect full link or form-destination URLs and can duplicate the explicit events. In the stream's **Configure tag settings**, turn off **Allow user-provided data capabilities** and leave property-level user-provided collection off. Do not link advertising products without reviewing these settings. See [enhanced measurement](https://support.google.com/analytics/answer/9216061) and [Google tag configuration](https://support.google.com/analytics/answer/12131703).

The code disables the default SDK page view, Google signals, enhanced conversions, and advertising personalization. Advertising storage, advertising user data, and advertising personalization consent are denied. Analytics storage is enabled only when this site's browser preferences allow collection. Check these account settings when changing the stream; remote tag settings can change SDK behavior independently of the deployed site.

## Visitor controls and development

The **Usage analytics: on/off** button appears in the marketing/docs/auth/setup footer and workspace navigation. Its choice persists in local storage for that browser. Global Privacy Control and Do Not Track override the site preference and keep collection off. With collection off, Analytics is not initialized and the Google tag is not requested on a fresh visit, no usage events are queued, and attribution is omitted from pilot submissions. The form and authenticated application still work.

Browsers with unsupported storage or blocked Google scripts skip collection without blocking product actions. Analytics cookies use a 90-day expiry; this is separate from property report retention. Turning collection off does not erase prior reports. Visitor-facing details are in [Permissions and data handling](https://impactgate.in/docs/permissions-and-data#website-analytics).

Development and preview hosts do not collect by default. For an intentional debug session, enable this session flag and reload:

```js
sessionStorage.setItem("impact-gate-analytics-debug", "true");
location.reload();
```

Then inspect [Firebase DebugView](https://console.firebase.google.com/project/impact-gate-prod/analytics/debugview). The browser privacy preference still applies. Remove the session flag and reload afterward. Debug activity uses the production stream; avoid fabricated lead submissions or private data. See [Firebase DebugView guidance](https://firebase.google.com/docs/analytics/debugview).

## Implementation and deployment

- `src/analytics/firebase-config.json`: public Firebase SDK identifiers, including the measurement ID. Firebase API keys identify a project; they are not server credentials. Firebase Authentication keeps its separate named app and backend-provided configuration.
- `src/analytics/index.ts`: lazy SDK loading, bounded event queue, sanitized parameters, campaign attribution, identity association, delegated navigation, section/scroll tracking, and browser controls.
- `src/analytics/schema.ts`: shared public-route and attribution sanitization, plus documentation intent classification.
- `src/App.tsx`, `src/docs/DocsApp.tsx`, `src/auth/page.ts`, `src/dashboard/connected.ts`: outcomes emitted at the actual interaction/API boundaries.
- `src/functions/api/waitlist.ts`: private lead receipts, notification results, and success/failure handling. `wrangler.jsonc` binds KV without exposing it to browser code.
- No Azure migration, backend secret, new API tracing agent, or Analytics service account is needed for this integration.

Build with `pnpm build` and type-check with `pnpm typecheck`. Deploy the built site with `node node_modules/wrangler/bin/wrangler.js deploy --keep-vars`; preserve the existing API proxy secret, email binding, API origin, and routes. Do not switch the public Firebase config to another project without linking its Analytics property first.

### Published release

- Published October 3, 2026 IST (`2026-10-02T22:53:49Z` UTC).
- Cloudflare Worker version: `044490e5-f388-48d2-8ba3-96311fca1bb3`, serving 100% of traffic on `impactgate.in` and `www.impactgate.in`.
- Build, TypeScript check, and Wrangler deployment dry run completed successfully. The deployment retained the API origin and email binding and added `WAITLIST` KV.
- Read-only inspection received HTTP 200 for the homepage, privacy guide, sign-in, onboarding, Settings, both published JavaScript bundles, and `/api/v1/config`. The public config still points to `impact-gate-prod`; both bundles contain `G-PDKMBG4FD8`.
- Firebase Management returned the linked GA4 property `557166280`, stream `15967481167`, and measurement ID `G-PDKMBG4FD8`.
- No fabricated Analytics events, pilot requests, or email notifications were submitted. Actual visitor-event receipt in Realtime and authenticated conversions have not been exercised during this release. Account-level key-event flags and custom definitions remain the console setup described above.
- Previous Worker version for rollback: `a6b3620f-48d6-45f6-a942-b7681165fc06`. The Firebase property and KV namespace remain separate resources if the website release is rolled back.

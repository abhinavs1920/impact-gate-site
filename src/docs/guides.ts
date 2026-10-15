import type { DocPage } from "./content";

const p = (text: string) => ({ type: "paragraph" as const, text });
const bullets = (items: string[]) => ({ type: "bullets" as const, items });
const steps = (items: Array<[string, string]>) => ({ type: "steps" as const, items: items.map(([title, text]) => ({ title, text })) });
const table = (headers: string[], rows: string[][]) => ({ type: "table" as const, headers, rows });
const links = (items: Array<{ label: string; href: string; description?: string }>) => ({ type: "links" as const, items });
const code = (language: string, value: string, filename?: string) => ({ type: "code" as const, language, value, ...(filename ? { filename } : {}) });
const note = (title: string, text: string) => ({ type: "callout" as const, tone: "note" as const, title, text });
const warning = (title: string, text: string) => ({ type: "callout" as const, tone: "warning" as const, title, text });

/** Practical guides for API change and deprecation work. Product statements match the connected docs. */
export const guidePages: DocPage[] = [
  {
    slug: "detect-breaking-api-changes-in-pull-requests",
    title: "Detect downstream microservice impact before merging a GitHub PR",
    description: "A practical workflow for checking an OpenAPI diff, finding affected consumers, and reading the evidence and coverage notes on a GitHub pull request.",
    group: "Guides",
    readingTime: 7,
    sections: [
      { id: "contract-vs-downstream-impact", title: "Contract change and downstream impact are different checks", blocks: [
        p("A pull request can change an API contract without changing any consumer repository. The contract diff answers what the provider changed; downstream impact asks which selected consumer code calls that interface and relies on the changed part. Review both before merging."),
        bullets(["Breaking examples include removing an endpoint, removing a response field, changing a field type, adding a required request field, removing a request enum value, or changing a documented success status.", "A response change matters to a consumer when its code reads, maps, or otherwise handles the changed value. A route change matters when the consumer actually calls the changed endpoint.", "A report with no confirmed affected consumer means none was confirmed in the analyzed scope. It does not certify every deployed or external consumer."]),
      ] },
      { id: "scope-the-pr", title: "Step 1: establish the PR and repository scope", blocks: [
        steps([
          ["Confirm the provider contract", "Identify the OpenAPI 3 document changed by the PR and make sure the implementation and published contract are intended to move together."],
          ["Select the consumer repositories", "Include every repository that may call the provider. A consumer-only repository can contribute caller evidence even when it does not contain an OpenAPI document."],
          ["Check the indexed snapshot", "Indexing reads a commit from each repository's default branch. Read the indexed commit and Coverage notes before treating an absence of evidence as meaningful."],
        ]),
        p("Impact Gate compares the PR's exact base and head contracts, then inspects the selected consumer snapshots. It does not infer coverage for repositories that were not selected, could not be indexed, or are outside your GitHub installation scope."),
      ] },
      { id: "diff-the-contract", title: "Step 2: identify the contract changes", blocks: [
        p("Compare the OpenAPI document at the PR base commit with the document at the head commit. Tools such as oasdiff can list contract and breaking-change rules in CI. This is the contract-diff part of the review: it tells you which paths, parameters, schemas, statuses, or values changed."),
        table(["Change area", "Questions for the reviewer"], [
          ["Endpoint or path", "Was a route added, removed, or changed in a way that alters the call?"],
          ["Request", "Did a required parameter, field, content type, constraint, or enum value change?"],
          ["Response", "Could a caller receive a different status, media type, field, type, nullability, or enum set?"],
          ["Contract coverage", "Did the implementation change without a corresponding OpenAPI change? If so, record the drift as a review gap."],
        ]),
      ] },
      { id: "inspect-consumer-evidence", title: "Step 3: inspect downstream evidence", blocks: [
        p("For each changed operation or field, follow the consumer evidence to the repository, file, line, commit, and relevant code path. Impact Gate recognizes supported HTTP client patterns in JavaScript, TypeScript, and Java, then uses deterministic source analysis to distinguish a verified relationship from a possible one or an unresolved relationship."),
        bullets(["A verified result has a supported call or field access tied to the changed contract and source evidence you can inspect.", "Possible or cannot_tell means the relationship or impact is plausible but the available source evidence cannot establish it completely. Host association, dynamic URLs, generated code, and opaque data flow can leave this result unresolved.", "Not affected is a bounded conclusion about the inspected code. It is not evidence that no other consumer exists.", "A coverage gap is part of the result. Read it as an instruction to investigate, not as a low-risk conclusion."]),
      ] },
      { id: "read-the-github-report", title: "Step 4: read the GitHub report before merge", blocks: [
        steps([
          ["Open the Impact Gate check", "Find the check on the PR and wait for analysis to finish. The check is advisory and does not block a merge."],
          ["Confirm the analyzed head", "Compare the report's analyzed PR head with the latest commit. A later push supersedes work for an older head."],
          ["Read the assessment and findings", "Review the contract change, consumer verdict, source references, suggested alternatives, and every coverage note."],
          ["Coordinate the change", "Ask the consumer owner to confirm the source evidence and choose a compatible migration, a coordinated consumer update, or an explicitly accepted review gap."],
        ]),
        p("If PR comments are enabled, the App updates its report comment for the PR. The dashboard provides the same evidence in more detail, but the GitHub check and report remain advisory rather than a compatibility certification."),
      ] },
      { id: "merge-decision", title: "A merge decision checklist", blocks: [
        bullets(["The provider contract diff is understood and implementation/contract drift has been considered.", "All relevant provider and consumer repositories are selected, indexed, and represented by the commits shown in Coverage.", "Every verified or possible consumer has an owner and a migration or review decision.", "Dynamic, generated, external, or unindexed consumers are recorded as gaps rather than treated as absent.", "The report corresponds to the latest PR head, and normal review, tests, and branch-protection rules have also been applied."]),
        warning("Warn-only by design", "Impact Gate posts review information and does not block a pull request. A successful check means the supported analysis completed; it does not establish compatibility with every consumer."),
      ] },
      { id: "worked-removed-field", title: "Worked example: a removed response field", blocks: [
        p("The repository's deterministic consumer fixture uses mutation VM24 to remove the `trackingNumber` response field. This is a reproducible testbed case rather than a hosted GitHub PR, so it has a mutation identifier instead of provider base/head commit SHAs. Production reports should show those exact SHAs for the PR being reviewed."),
        code("yaml", "mutation: VM24\nchange: remove response field trackingNumber\nfixture: testbed-v2/mutations/mutations.yaml", "testbed-v2/mutations/mutations.yaml"),
        table(["Consumer", "Source reference", "Observed fixture result"], [
          ["c03-shipment-tracker", "testbed-v2/consumers/c03-shipment-tracker/client.ts:16-17", "Failed: trackingNumber is missing"],
          ["c06-order-fulfillment", "testbed-v2/consumers/c06-order-fulfillment/client.ts:35-36", "Failed: shipment trackingNumber missing"],
          ["c12-shipment-status-default", "testbed-v2/consumers/c12-shipment-status-default/client.ts", "Passed; it does not require the removed field"],
        ]),
        p("The fixture demonstrates why a contract diff and consumer evidence answer different questions: the provider change is the same, but the observed outcome differs by consumer. The remaining consumers passing does not prove that every external or unselected consumer is unaffected."),
      ] },
      { id: "worked-added-enum", title: "Worked example: an added response enum value", blocks: [
        p("Mutation VM28 adds `ON_HOLD` to the shipment status response. The fixture includes strict clients that reject the new value and a tolerant client that maps an unknown value to its default branch."),
        code("yaml", "mutation: VM28\nchange: add response enum value ON_HOLD\nfixture: testbed-v2/mutations/mutations.yaml", "testbed-v2/mutations/mutations.yaml"),
        table(["Consumer", "Source reference", "Observed fixture result"], [
          ["c03-shipment-tracker", "testbed-v2/consumers/c03-shipment-tracker/client.ts:34-35", "Failed: unknown status ON_HOLD"],
          ["c06-order-fulfillment", "testbed-v2/consumers/c06-order-fulfillment/client.ts:52-53", "Failed: shipment status invalid"],
          ["c12-shipment-status-default", "testbed-v2/consumers/c12-shipment-status-default/client.ts:17-35", "Passed; unknown values use the default branch"],
        ]),
        note("What this proves", "The fixture proves that consumer behavior can differ for an added enum value. The report can identify the contract change and source evidence, but a production team should still run the relevant consumer test or runtime validation. This is not a claim that every contract-diff tool misses enum widening."),
      ] },
      { id: "where-impact-gate-fits", title: "Where Impact Gate fits", blocks: [
        p("Impact Gate combines supported OpenAPI contract comparison with selected cross-repository consumer evidence. It publishes source references, findings, and coverage limitations so the GitHub review can include both the shape of the change and the services that may depend on it."),
        links([
          { label: "Read the pull request report guide", href: "/docs/pull-request-reports", description: "Interpret tiers, verdicts, evidence chains, and incomplete analysis." },
          { label: "Troubleshoot consumer discovery", href: "/docs/find-who-consumes-your-api-before-you-change-it", description: "Resolve missing matches, stale indexes, and unknown callers." },
          { label: "Compare oasdiff and consumer impact analysis", href: "/docs/oasdiff-vs-api-consumer-impact-analysis", description: "See how contract diffing and downstream evidence fit together." },
        ]),
      ] },
    ],
  },
  {
    slug: "find-who-consumes-your-api-before-you-change-it",
    title: "How to find who consumes your API before you change it",
    description: "Find API consumers across repositories, troubleshoot missing matches, and understand what code and runtime evidence can and cannot prove.",
    group: "Guides",
    readingTime: 7,
    sections: [
      { id: "four-sources", title: "Four sources of consumer evidence", blocks: [
        p("Before you rename a field, remove an endpoint, or set a sunset date, build a caller list. No single source has every consumer, so use the sources together and label what each one actually proves."),
        steps([
          ["Code search across repositories", "Search for the path, client wrapper, generated operation name, field, and repository references. It is fast and useful for leads, but it misses dynamic URLs and code outside the search scope."],
          ["Contract-to-code tracing", "Start from the changed OpenAPI operation and follow supported HTTP client patterns into consumer code. Impact Gate performs this for selected, indexed JavaScript, TypeScript, and Java repositories."],
          ["Runtime metrics and APM", "Prometheus request counters or Datadog indexed APM spans show matched route activity. A caller relationship requires an explicitly recorded caller identity and a reviewed mapping to an indexed consumer."],
          ["Owner and external-consumer review", "Mobile apps, partner clients, scripts, generated clients, and repositories outside the workspace need an owner to confirm their use."],
        ]),
      ] },
      { id: "discovery-workflow", title: "A repeatable discovery workflow", blocks: [
        steps([
          ["Start with the provider operation", "Record the HTTP method, normalized route template, changed field or parameter, and the provider repository/commit."],
          ["Build the repository scope", "Select the provider and every known consumer repository. Include a consumer-only repository when it has caller code but no provider contract."],
          ["Index and inspect Coverage", "Wait for each repository to finish indexing. Check supported files, detected contracts, skipped files, and the indexed commit before reading the API inventory."],
          ["Follow each reference", "Open the consumer source at the recorded commit. Verify the call, the response field access or request construction, and the service identity with its owner."],
          ["Add runtime and owner evidence", "Connect Prometheus or Datadog when available, review route and caller coverage, then ask about consumers that cannot be represented in the index."],
        ]),
        p("The result is an evidence inventory, not a universal registry of every deployed caller. Keep the source commit, observation window, and unresolved questions alongside the change review."),
      ] },
      { id: "troubleshoot-discovery", title: "Troubleshoot missing consumer matches", blocks: [
        table(["Symptom", "What to check next"], [
          ["No consumer appears", "Confirm the repository is selected and indexed, then check Coverage and the indexed commit. Search the exact method/path and client wrapper in the indexed source."],
          ["The route is called but does not match", "Compare HTTP method and normalized route template. Explicit URL origins and OpenAPI server origins can help; a route-only match can remain possible when the deployment host is unverified."],
          ["A repository has no OpenAPI document", "Keep it selected as a consumer. A consumer repository can provide caller evidence without being an API provider."],
          ["Generated or dynamic client code is missing", "Check generated source and URL construction in the indexed commit. Dynamic evaluation, opaque reflection, unresolved string construction, and external consumers can remain unknown."],
          ["The index is old", "Read Last index and re-index after restoring access, adding a contract, or changing consumer code. A PR report may use the PR's base/head contract but still use the selected consumer snapshot."],
          ["Runtime shows traffic but no caller", "Route traffic establishes observed service/route activity. Add a trustworthy low-cardinality caller field and map its service to an indexed consumer, or keep the caller unknown."],
        ]),
      ] },
      { id: "reading-the-result", title: "How to read the result", blocks: [
        table(["Result", "What it means", "Action"], [
          ["Verified consumer evidence", "The inspected source establishes the relevant relationship or changed-field use within the analysis scope.", "Coordinate with the named consumer owner and review the migration."],
          ["Possible / cannot tell", "The relationship is plausible, but host identity, dynamic code, data flow, or another boundary prevents a complete conclusion.", "Inspect source and deployment metadata; keep it open until the ambiguity is resolved or accepted."],
          ["No static caller located", "No supported reference was found in the selected indexed repositories.", "Check runtime, external clients, generated code, and repository scope. Do not call this zero usage."],
          ["Runtime caller", "Telemetry supplied a caller identity and it was mapped to an indexed consumer.", "Compare with static evidence; runtime route activity does not prove a specific call site executed."],
        ]),
        warning("Unknown usage is not zero usage", "A missing code match, missing runtime row, sampled span, or unregistered repository is a coverage boundary. Write the boundary into the change or deprecation review."),
      ] },
      { id: "where-to-continue", title: "Continue the investigation", blocks: [
        links([
          { label: "Review runtime consumer evidence", href: "/docs/api-usage-observability-prometheus-datadog", description: "Match Prometheus or Datadog observations to provider and caller services." },
          { label: "Connect Prometheus or Datadog", href: "/docs/runtime-observability", description: "Configure source access, route fields, service mapping, and coverage checks." },
          { label: "Read repository scope and indexing", href: "/docs/repositories", description: "Understand selected repositories, immutable snapshots, and Coverage." },
        ]),
      ] },
    ],
  },
  {
    slug: "api-deprecation-impact-analysis-checklist",
    title: "Retirement Radar checklist: evidence before removing an API",
    description: "A step-by-step API deprecation checklist: discover consumers, publish a migration window, inspect runtime evidence, and record what remains unknown.",
    group: "Guides",
    readingTime: 8,
    sections: [
      { id: "checklist", title: "The deprecation checklist", blocks: [
        steps([
          ["Identify candidates", "Endpoints with few or no static callers, low observed traffic, or an old contract are starting points for review, not proof that removal is safe."],
          ["Find consumers", "Use repository indexing, contract-to-code tracing, runtime observations, and owner review. Include external, partner, mobile, generated, and scheduled consumers."],
          ["Choose the replacement and window", "Write down the replacement, migration steps, owners, and a window that gives every known consumer time to move."],
          ["Mark the contract deprecated", "Mark the operation as deprecated in OpenAPI. Send the Deprecation response header (RFC 9745) and, when you have a date, the Sunset header (RFC 8594), with a link to migration notes."],
          ["Watch traffic during the window", "Review route activity and caller identity where available. A positive observation means the endpoint is still receiving matched traffic; it does not identify every caller."],
          ["Re-check evidence", "Repeat static and runtime review after consumer migrations and before opening the removal PR. Capture the snapshot and observation windows used."],
          ["Remove in a separate pull request", "Review the removal PR's contract diff, consumer report, runtime coverage, and unresolved gaps. Keep rollback and owner communication in the normal delivery process."],
          ["Keep a record", "Record what repositories, telemetry, owners, and dates were reviewed. A Retirement Radar review acknowledges an evidence snapshot; it does not approve production removal."],
        ]),
      ] },
      { id: "evidence-matrix", title: "Use each evidence source for the question it answers", blocks: [
        table(["Evidence", "Can support", "Cannot establish by itself"], [
          ["Static consumer reference", "A supported call site, route use, or changed-field access in an indexed repository.", "Every deployed caller, external client, or runtime execution."],
          ["Prometheus positive count", "Matched request activity estimated from counter increases for the configured window.", "Caller identity, exact request count, or safe removal."],
          ["Prometheus explicit zero", "A complete counter series explicitly returned zero across the query window; at least 30 days is required for confirmed-zero Retirement Radar highlighting.", "That no external, scheduled, uninstrumented, or future caller exists."],
          ["Datadog indexed spans", "Matched activity among the indexed spans in the configured query and retention scope.", "Exhaustive traffic or zero usage; sampling and limits can omit spans."],
          ["Owner review", "Knowledge about external clients, migration obligations, and deployment context.", "A substitute for the source and runtime evidence that was not available."],
        ]),
      ] },
      { id: "read-retirement-evidence", title: "Read Retirement Radar evidence", blocks: [
        steps([
          ["Open the candidate", "Search by path or reason and read static callers, runtime status, measured function usage, review state, and next action."],
          ["Check the observation state", "Distinguish Runtime not connected, No current observations, positive estimated requests, indexed spans, and a complete 30-day Prometheus zero. Missing or stale data stays unknown."],
          ["Follow provider and caller references", "Open source at the recorded commit and verify the relationship with the service owner. Route-only relationships can remain possible when host association is unresolved."],
          ["Verify outside the workspace", "Ask about partner clients, mobile releases, jobs, scripts, generated clients, and consumers in repositories not selected for the workspace."],
          ["Record the snapshot review", "An owner or admin with a verified email can mark the evidence reviewed for the current snapshot. Revisit it when the snapshot changes."],
        ]),
      ] },
      { id: "confirmed-zero-boundary", title: "What a confirmed zero does and does not mean", blocks: [
        p("Retirement Radar highlights only connected, complete Prometheus counter results that explicitly report zero across at least 30 days. A missing series, failed import, old observation, sampled Datadog result, or unmatched route does not qualify. If both Prometheus and Datadog observe a route, the inventory prefers Prometheus for volume and does not add overlapping counts."),
        warning("No automatic removal decision", "A zero-call window is one piece of evidence. It does not classify an endpoint as safe to remove. Confirm static callers, external usage, migration ownership, contract/implementation consistency, and rollback procedures."),
      ] },
      { id: "where-impact-gate-fits", title: "Where Impact Gate fits", blocks: [
        p("Retirement Radar keeps the evidence state and next action visible for a particular workspace snapshot. Impact Gate helps organize static callers, runtime observations, measured function evidence, and review records; the service owners still decide whether and when to deprecate or remove an API."),
        links([
          { label: "Connect runtime evidence", href: "/docs/runtime-observability", description: "Set up Prometheus or Datadog and understand freshness and coverage." },
          { label: "Review the removal PR", href: "/docs/pull-request-reports", description: "Read the contract diff, consumer findings, and unresolved coverage." },
          { label: "Find consumers", href: "/docs/find-who-consumes-your-api-before-you-change-it", description: "Troubleshoot missing static and runtime consumer evidence." },
        ]),
      ] },
      { id: "faq", title: "Common questions", blocks: [
        p("What is the difference between the Deprecation and Sunset headers? Deprecation says a resource is or will be deprecated. Sunset gives the date it is expected to stop responding."),
        p("How long should the migration window be? It depends on your consumers, release cadence, and ownership. Agree it with them; there is no universal number."),
        p("Does marking a candidate reviewed approve removal? No. The review is tied to the current evidence snapshot and records that an owner inspected it."),
      ] },
    ],
  },
  {
    slug: "cross-repo-api-impact-analysis",
    title: "Cross-repository API change impact analysis",
    description: "Build a provider-to-consumer view across selected repositories, follow endpoint evidence, and coordinate changes with clear scope and coverage limits.",
    group: "Guides",
    readingTime: 8,
    sections: [
      { id: "why-cross-repository", title: "Why API review crosses repository boundaries", blocks: [
        p("The provider contract and its callers often live in different repositories. A provider PR can therefore be valid in isolation and still break a client that is released on another schedule. Cross-repository impact analysis connects the contract change to the consumer code that is in scope for review."),
        bullets(["Provider repositories contribute OpenAPI 3 contracts, endpoints, schemas, and PR contract comparisons.", "Consumer repositories contribute supported HTTP client references and source evidence, even when they do not contain a provider contract.", "The connected workspace keeps repository scope, source commits, endpoint relationships, and coverage notes visible so an edge is not mistaken for universal production knowledge."]),
      ] },
      { id: "build-the-scope", title: "Build a useful cross-repository scope", blocks: [
        steps([
          ["Connect the GitHub installation", "Use an installation with access to the provider and consumer repositories that should be analyzed."],
          ["Select providers and consumers", "Choose the repositories containing the API contracts and the applications that call them. Start with one provider and its known consumers, then expand."],
          ["Index each repository", "Indexing reads an immutable default-branch commit and records detected services, contracts, routes, source references, and coverage conditions."],
          ["Review the inventory", "Open APIs and Coverage to confirm the expected provider operations, consumer languages, supported files, and indexed commits are present."],
          ["Re-index after meaningful changes", "Refresh a consumer after adding a generated client, restoring access, or changing code on its default branch. An unmerged consumer branch is not automatically represented by the workspace index."],
        ]),
      ] },
      { id: "follow-an-edge", title: "Follow a provider-to-consumer relationship", blocks: [
        steps([
          ["Start with the changed operation", "Open the provider API and identify its method, route, changed parameter, request field, response field, status, or content type."],
          ["Inspect the consumer reference", "Open the linked file and line at its recorded commit. Verify the HTTP call, route construction, and how the changed value is used."],
          ["Check service identity", "Compare the provider and consumer service context. A unique path can suggest a relationship while deployment host association remains unverified."],
          ["Continue through code flow", "Use the API flow to inspect handlers, reachable functions, conditional paths, and downstream API boundaries. The flow shows mapped reachability and does not record actual request values or branch executions."],
          ["Export the snapshot when coordinating", "Export the dependency snapshot as JSON when a review needs to be shared. Keep its snapshot ID and source commits with the discussion."],
        ]),
        p("A graph edge is a useful investigation path, not an automatic production dependency assertion. Inspect the underlying source evidence and confidence before assigning migration work."),
      ] },
      { id: "coordinate-the-change", title: "Coordinate a change across repositories", blocks: [
        steps([
          ["Open the provider PR", "Read the contract diff at the exact base and head commits and identify the consumer relationships that may be affected."],
          ["Create or locate consumer work", "Ask owners to update consumers in their repositories, or decide on a backward-compatible provider transition."],
          ["Re-index and re-run review", "After consumer changes reach their indexed default branches, refresh the index and review the provider PR again. The PR report remains tied to its current head."],
          ["Record what remains out of scope", "List external clients, repositories not selected, dynamic or generated paths that were not resolved, and runtime sources not connected."],
        ]),
        table(["Evidence state", "Coordination meaning"], [
          ["Static", "A relationship came from supported indexed source code."],
          ["Runtime", "A source supplied matched route activity and, for a dependency edge, an explicit mapped caller identity."],
          ["Both", "Static and runtime evidence support the relationship; inspect their windows and commits separately."],
          ["Possible / unresolved", "The relationship needs owner or deployment review before it can guide a definitive migration decision."],
        ]),
      ] },
      { id: "cross-repository-boundaries", title: "Boundaries to keep visible", blocks: [
        bullets(["Only selected and accessible repositories are in scope. A repository outside the installation or workspace selection remains unobserved.", "Supported static analysis covers documented JavaScript, TypeScript, and Java HTTP client patterns. Dynamic URL construction, generated or opaque code, and non-HTTP channels can leave evidence unavailable.", "The current code flow follows mapped reachability and outbound HTTP boundaries. A downstream API has its own flow and telemetry; upstream functions do not inherit every request to it.", "Runtime route activity is aggregate service/route evidence. It does not prove that a particular source call site executed unless caller context is explicitly supplied.", "Provider implementation behavior that is not represented in the OpenAPI contract can drift without appearing as a contract difference. Record that as a review gap."]),
        warning("Scope is evidence, not a guarantee", "Cross-repository analysis makes the selected evidence easier to review. It does not turn an incomplete index, unresolved host, or missing external client into proof of no impact."),
      ] },
      { id: "related-guides", title: "Related workflows", blocks: [
        links([
          { label: "Assess a GitHub PR before merge", href: "/docs/detect-breaking-api-changes-in-pull-requests", description: "Apply the cross-repository evidence to the exact PR head." },
          { label: "Troubleshoot consumer discovery", href: "/docs/find-who-consumes-your-api-before-you-change-it", description: "Resolve missing references and stale scope." },
          { label: "Explore the dependency graph", href: "/docs/dependency-graph", description: "Inspect service and endpoint relationships in the workspace." },
        ]),
      ] },
    ],
  },
  {
    slug: "oasdiff-vs-api-consumer-impact-analysis",
    title: "oasdiff vs API consumer impact analysis: what each report tells you",
    description: "A grounded comparison of OpenAPI contract diffing and repository-level consumer impact analysis, including how to use both in a pull request review.",
    group: "Guides",
    readingTime: 9,
    sections: [
      { id: "two-review-questions", title: "They answer different review questions", blocks: [
        p("API compatibility review usually has two separate questions: what changed in the published contract, and which callers rely on the changed behavior? A contract diff and consumer impact analysis can be used together because they operate on different evidence."),
        table(["Review question", "Contract diff", "Consumer impact analysis"], [
          ["What changed between base and head?", "Compares the two OpenAPI documents and identifies contract differences.", "Uses the changed operation or schema as the starting point for tracing caller evidence."],
          ["Who may be affected?", "The diff alone does not identify the consumer repositories selected for review.", "Inspects selected, indexed consumer repositories and links findings to source references."],
          ["Which field or request assumption matters?", "Reports the changed contract location and before/after values when supported.", "Checks supported call sites, field reads, request construction, and related code paths."],
          ["What remains uncertain?", "Depends on the diff tool's output and the contract scope being compared.", "Reports coverage notes, possible/cannot_tell results, unresolved host association, and missing repository or runtime scope."],
        ]),
      ] },
      { id: "what-oasdiff-contributes", title: "What oasdiff contributes in this workflow", blocks: [
        p("The current site documentation describes oasdiff as an open-source tool that lists breaking-change rules and runs in CI. In that role, it is useful for the contract-diff step: compare the provider document at the PR base and head, then review the reported contract changes."),
        bullets(["It gives the team a contract-focused view of paths, parameters, responses, schemas, and other OpenAPI changes in the documents being compared.", "It can run as part of CI, so a provider repository can surface a contract difference during pull request checks.", "Its output is the starting point for the downstream review. The team still needs a way to identify callers, inspect their source, and account for consumers outside the contract repository."]),
        note("Claim boundary", "This comparison does not assess oasdiff's complete feature set, version-specific behavior, performance, or third-party outcomes. Those claims are not established by the current Impact Gate source or site documentation."),
      ] },
      { id: "what-consumer-analysis-contributes", title: "What consumer impact analysis contributes", blocks: [
        p("Impact Gate's consumer analysis starts with supported OpenAPI 3 contracts and selected GitHub repositories. It indexes provider and consumer snapshots, finds supported JavaScript, TypeScript, and Java HTTP client references, and publishes evidence tied to files, lines, and commits."),
        bullets(["It can connect a changed endpoint, request parameter, status, response field, type, enum, nullability, format, or constraint to a supported consumer reference.", "It distinguishes verified, possible/cannot_tell, not_affected, and unresolved coverage rather than treating an absent match as proof of no usage.", "It can combine static relationships with imported Prometheus request counts or Datadog indexed spans. A runtime dependency edge requires explicit caller identity and service mapping.", "It keeps the GitHub PR's exact base/head comparison separate from the indexed consumer snapshot, so the report can show both change commits and consumer evidence commits."]),
      ] },
      { id: "side-by-side-workflow", title: "A combined pull request workflow", blocks: [
        steps([
          ["Compare the provider contracts", "Run the contract diff on the PR's base and head OpenAPI documents. Record the changed operations and the exact contract locations."],
          ["Confirm Impact Gate scope", "Select the provider and relevant consumer repositories, wait for indexing, and inspect Coverage and indexed commit SHAs."],
          ["Trace downstream use", "Use the changed operation to inspect consumer calls, request construction, response field access, and service identity in source."],
          ["Add runtime context", "If connected, compare matched route activity and caller identity with static references. Treat missing, sampled, stale, or unmatched data as unknown."],
          ["Review and coordinate", "Use the GitHub report to assign owners, choose a compatibility or migration approach, and record repositories or clients that remain outside the evidence."],
          ["Re-run at the final head", "After pushing changes, confirm the report's analyzed PR head and review the remaining contract, consumer, and coverage findings before merge."],
        ]),
      ] },
      { id: "decision-guide", title: "Which should you use?", blocks: [
        table(["Situation", "Useful first step", "Then ask"], [
          ["The provider team needs a quick contract check", "Run a contract diff in CI.", "Which selected consumers call the changed interface?"],
          ["The provider has many separate client repositories", "Index the provider and known consumers for consumer evidence.", "Is the repository set complete, and what is the latest indexed commit?"],
          ["A field or status changed but the route still exists", "Read the contract diff location.", "Which callers read, map, send, or branch on that value?"],
          ["No static consumer was found", "Check Coverage and repository scope, then consult runtime and owners.", "Are generated, dynamic, external, scheduled, or unregistered clients missing?"],
          ["The change is a removal or deprecation", "Use the deprecation evidence checklist and runtime coverage.", "Has the migration window completed, and is the evidence fresh enough for a removal PR?"],
        ]),
      ] },
      { id: "limits-of-the-comparison", title: "Limits of the comparison", blocks: [
        bullets(["A contract diff cannot see behavior-only implementation changes when the OpenAPI document stays the same. Consumer analysis starts from the supported contract and can likewise miss undocumented behavior changes.", "Consumer analysis is limited by selected repositories, supported language/client patterns, readable source, route normalization, and service/host identity. Dynamic, opaque, external, or non-HTTP usage can remain unknown.", "Prometheus and Datadog evidence is aggregate runtime context: Prometheus reports estimated counter increases, while Datadog reports indexed spans. Neither replaces the contract diff or source review.", "Neither workflow is a compatibility certification. Impact Gate is warn-only, and merge decisions remain with the engineering team."]),
        warning("Use both outputs as evidence", "A contract-diff result tells you where to look. A consumer-impact result tells you what the selected evidence says about callers. Read their coverage boundaries before treating either result as complete."),
      ] },
      { id: "related-guides", title: "Continue with the implementation guides", blocks: [
        links([
          { label: "Assess downstream impact before merge", href: "/docs/detect-breaking-api-changes-in-pull-requests", description: "Apply the combined workflow to a GitHub pull request." },
          { label: "Cross-repository API impact analysis", href: "/docs/cross-repo-api-impact-analysis", description: "Set repository scope and follow source evidence." },
          { label: "Read pull request reports", href: "/docs/pull-request-reports", description: "Interpret findings, tiers, verdicts, and incomplete analysis." },
        ]),
      ] },
    ],
  },
  {
    slug: "api-usage-observability-prometheus-datadog",
    title: "Find API consumers with repository evidence and Prometheus or Datadog",
    description: "Match Prometheus and Datadog observations to API routes, distinguish traffic from caller identity, and use runtime evidence alongside static consumer analysis.",
    group: "Guides",
    readingTime: 7,
    sections: [
      { id: "why-runtime", title: "Why runtime evidence complements static analysis", blocks: [
        p("Static analysis shows supported callers it can find in selected repositories. Runtime evidence shows matched traffic observed by an existing Prometheus or Datadog source. They answer different questions and should be read together."),
        table(["Evidence", "What it contributes", "Important boundary"], [
          ["Static caller", "A source-level relationship in an indexed consumer repository.", "Does not measure traffic or capture every deployed consumer."],
          ["Prometheus route count", "Estimated request counts from counter increases for a configured provider, method, route, and window.", "Requires stable route labels; counts do not reveal caller identity unless it is recorded."],
          ["Datadog indexed span count", "Positive activity among indexed APM spans grouped by configured facets.", "Sampling, retention, group limits, and query scope can omit traffic; it never proves zero usage."],
          ["Runtime dependency edge", "A caller identity was supplied and mapped to an indexed consumer service.", "Route activity without caller context does not identify a source call site."],
        ]),
      ] },
      { id: "what-you-need", title: "What you need for consumer evidence", blocks: [
        bullets(["An indexed provider API with a stable HTTP method and route template, such as `/orders/{id}`. Full URLs containing customer IDs cannot be guessed into templates.", "Prometheus instrumentation with a cumulative request counter and labels for provider service, method, and route, or Datadog indexed server request spans with service and route/resource facets.", "A reviewed mapping between source service names and indexed provider services. For a runtime consumer edge, also provide a trustworthy low-cardinality caller identity and map it to an indexed consumer service.", "A query window and source scope that match the decision being reviewed. A current observation is aggregate evidence, not the timestamp of the last request."]),
        p("Impact Gate reads existing Prometheus or Datadog data and matches it to endpoints discovered in selected repositories. Prometheus needs a reachable query server and the configured authentication; Datadog needs an API key and an application key with `apm_read`."),
      ] },
      { id: "interpret-consumer-evidence", title: "Interpret runtime consumer evidence", blocks: [
        steps([
          ["Check the provider match", "Verify the mapped source service, HTTP method, and normalized route template. An unmatched row is not evidence for a different endpoint."],
          ["Read the observation state", "Positive Prometheus estimates or Datadog indexed spans show matched activity. Missing rows, failed imports, stale observations, and omitted spans leave usage unknown."],
          ["Check caller identity", "If the source includes a caller service and it is mapped to an indexed consumer, the graph can show runtime or combined evidence. Otherwise keep the caller unknown."],
          ["Compare with static evidence", "Follow the consumer source reference and compare its commit with the observation window. Runtime route activity can confirm service-level use without proving that a particular source line executed."],
        ]),
        warning("Do not turn missing telemetry into no usage", "A disconnected source, missing route label, sampled span, group limit, query timeout, or unmatched service is a coverage issue. Keep it visible in the PR or deprecation review."),
      ] },
      { id: "prometheus-and-datadog-differences", title: "Prometheus and Datadog evidence are not interchangeable", blocks: [
        table(["Source", "Current product representation", "Consumer-evidence use"], [
          ["Prometheus", "Estimated requests from `increase()` over a counter window. A complete explicit zero over at least 30 days can qualify for Retirement Radar's confirmed-zero highlighting.", "Use counts for route activity and an optional `caller_service` label for mapped runtime edges."],
          ["Datadog", "Counts of indexed APM spans from the configured aggregate query. The result can be sampled or limited.", "Use positive span activity and optional caller facets; never interpret missing or sampled spans as zero."],
          ["Both sources", "Prometheus is preferred for volume when both observe the same route; counts are not added together.", "Retain caller evidence available from either source and compare source windows separately."],
        ]),
      ] },
      { id: "next-actions", title: "Next actions when evidence is incomplete", blocks: [
        bullets(["If no endpoint matches, inspect service mapping, method, route template, exporter labels, Datadog facets, and the provider's indexed contract.", "If traffic is positive but no consumer is named, add or map caller identity or continue with static source references.", "If a route appears unused, check at least a full Prometheus 30-day window where possible, then review external and scheduled consumers before deprecation.", "If Datadog routes are missing, narrow the environment/provider query, check server request spans and searchable facets, and inspect the provider console for retention or sampling context."]),
        links([
          { label: "Follow the connection setup", href: "/docs/runtime-observability", description: "Configure Prometheus or Datadog source access and matching." },
          { label: "Find consumers across repositories", href: "/docs/find-who-consumes-your-api-before-you-change-it", description: "Combine runtime evidence with static and owner review." },
          { label: "Review deprecation evidence", href: "/docs/api-deprecation-impact-analysis-checklist", description: "Use runtime observations without treating them as approval to remove." },
        ]),
      ] },
    ],
  },
  {
    slug: "how-to-deprecate-a-repository",
    title: "How to deprecate a repository: a checklist",
    description: "Steps to retire a GitHub repository without breaking dependents: find dependents, announce, redirect, archive.",
    group: "Guides",
    readingTime: 3,
    sections: [
      { id: "checklist", title: "The checklist", blocks: [
        steps([
          ["Find dependents", "Use GitHub's dependency graph and code search for the package or repository name. Check CI and deploy configuration."],
          ["Choose a replacement", "Write the migration steps."],
          ["Announce", "Add a README banner, final release notes, and a package registry deprecation notice."],
          ["Stop new use", "Disable new issues or point them to the replacement."],
          ["Set a date and keep it", "Give dependents a clear window."],
          ["Archive the repository", "GitHub archiving makes it read-only. See GitHub Docs, Archiving repositories."],
          ["Leave a pointer", "Keep docs or a redirect that names the successor."],
        ]),
        note("If the repository exposes an API", "Run the API deprecation checklist first."),
      ] },
    ],
  },
];

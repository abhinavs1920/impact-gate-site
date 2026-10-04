import type { DocPage } from "./content";

const p = (text: string) => ({ type: "paragraph" as const, text });
const bullets = (items: string[]) => ({ type: "bullets" as const, items });
const steps = (items: Array<[string, string]>) => ({ type: "steps" as const, items: items.map(([title, text]) => ({ title, text })) });
const note = (title: string, text: string) => ({ type: "callout" as const, tone: "note" as const, title, text });

/** Practical guides for API change and deprecation work. Product statements match the connected docs. */
export const guidePages: DocPage[] = [
  {
    slug: "detect-breaking-api-changes-in-pull-requests",
    title: "How to detect breaking API changes in a pull request",
    description: "A practical checklist for catching breaking OpenAPI changes before merge, and why a contract diff alone does not show who is affected.",
    group: "Guides",
    readingTime: 4,
    sections: [
      { id: "what-counts-as-breaking", title: "What counts as a breaking change", blocks: [
        p("A breaking API change is any edit that makes an existing caller fail or behave differently. Most teams learn about one after a deploy. Two review steps catch many of them earlier: diff the contract, then check who calls what changed."),
        bullets(["Removing or renaming an endpoint or path.", "Removing a response field or changing its type.", "Adding a required request field or parameter.", "Making an optional field required.", "Narrowing allowed values, for example removing an enum value."]),
        p("Additive changes such as a new optional field are usually fine, but a client with strict parsing can still fail."),
      ] },
      { id: "diff-the-contract", title: "Step 1: diff the contract at base and head", blocks: [
        p("Compare the OpenAPI document on the pull request's base commit with the head commit. Open-source tools such as oasdiff list breaking-change rules and run in CI. This tells you what changed."),
      ] },
      { id: "find-who-is-affected", title: "Step 2: find who is affected", blocks: [
        p("A diff does not say which services call the changed field. List the consumer repositories, search for client calls to that path, and trace how the response is used. Doing this by hand across many repositories is slow, so teams often skip it."),
      ] },
      { id: "record-the-gaps", title: "Step 3: record what you could not verify", blocks: [
        p("Dynamic URLs, generated clients, and services outside your repositories hide callers. Write the gaps into the pull request instead of reading silence as proof."),
      ] },
      { id: "where-impact-gate-fits", title: "Where Impact Gate fits", blocks: [
        p("Impact Gate compares supported OpenAPI 3 contracts on a pull request, inspects the consumer repositories you selected, and posts an advisory report with source references and coverage notes. It recognizes supported HTTP client patterns in JavaScript, TypeScript, and Java. It does not block merges, and it reports when it cannot reach a conclusion."),
        note("Private pilot", "Impact Gate is in preparation for a private pilot. Questions: support@impactgate.in."),
      ] },
    ],
  },
  {
    slug: "find-who-consumes-your-api-before-you-change-it",
    title: "How to find who consumes your API before you change it",
    description: "Four ways to find API consumers across repositories, from code search to runtime metrics, and what each one misses.",
    group: "Guides",
    readingTime: 4,
    sections: [
      { id: "four-sources", title: "Four sources of consumer evidence", blocks: [
        p("Before you rename a field or retire an endpoint you need a list of callers. No single source has all of them, so combine these."),
        steps([
          ["Code search across repositories", "Search for the path and for client wrapper names. Fast, but it misses dynamic URLs and generated clients."],
          ["Contract-to-code tracing", "Start from the changed OpenAPI path and follow calls into consumer code. Impact Gate does this for supported HTTP client patterns in JavaScript, TypeScript, and Java in the repositories you select."],
          ["Runtime metrics", "Prometheus request counters or Datadog APM spans show which routes receive traffic. Caller identity appears only if your instrumentation records it."],
          ["Ask the owners", "Mobile apps, partners, and scripts outside your repositories will not appear in any of the sources above."],
        ]),
      ] },
      { id: "reading-the-result", title: "How to read the result", blocks: [
        p("Callers found: plan the migration with their owners. No callers found: you know only that none turned up in the scope you searched. Unknown usage is not zero usage."),
        bullets(["All repositories that might call the API are selected.", "Runtime traffic for the route has been checked.", "External consumers are listed and a migration window is agreed.", "Every gap is noted in the pull request description."]),
      ] },
    ],
  },
  {
    slug: "api-deprecation-impact-analysis-checklist",
    title: "API deprecation checklist: impact analysis before you remove an endpoint",
    description: "A step-by-step checklist for deprecating an API endpoint: find consumers, mark it deprecated, set a sunset date, watch traffic, then remove.",
    group: "Guides",
    readingTime: 5,
    sections: [
      { id: "checklist", title: "The checklist", blocks: [
        steps([
          ["Identify candidates", "Endpoints with few or no static callers and low traffic are starting points, not proof."],
          ["Find consumers", "Use code search, contract tracing, and runtime metrics. Include consumers outside your repositories."],
          ["Decide the replacement and window", "Write down the migration path, the window, and the owners."],
          ["Mark it deprecated", "Mark the operation as deprecated in the OpenAPI document. Send the Deprecation response header (RFC 9745) and, when you have a date, the Sunset header (RFC 8594), with a link to migration notes."],
          ["Watch traffic during the window", "Requests still arriving mean someone has not migrated."],
          ["Remove in a separate pull request", "Review that pull request's impact report and its coverage gaps."],
          ["Keep a record", "Note what evidence you reviewed and when."],
        ]),
      ] },
      { id: "where-impact-gate-fits", title: "Where Impact Gate fits", blocks: [
        p("Impact Gate lists deprecation candidates from static callers and imported Prometheus or Datadog evidence, lets an owner record an evidence review for a specific snapshot, and shows coverage gaps. A review does not approve a production removal."),
        note("Unknown usage is not zero usage", "No static caller located means none was found in the selected repositories. Check traffic and outside consumers before you remove anything."),
      ] },
      { id: "faq", title: "Common questions", blocks: [
        p("What is the difference between the Deprecation and Sunset headers? Deprecation says a resource is or will be deprecated. Sunset gives the date it is expected to stop responding."),
        p("How long should the window be? It depends on your consumers. Agree it with them; there is no universal number."),
      ] },
    ],
  },
  {
    slug: "cross-repo-api-impact-analysis",
    title: "Cross-repo API impact analysis",
    description: "See which services call an API you are changing, across the repositories you select, with source references and clear coverage limits.",
    group: "Guides",
    readingTime: 3,
    sections: [
      { id: "overview", title: "Across repositories", blocks: [
        p("Pick the repositories that hold your API contracts and the repositories that call them. Impact Gate indexes their default branches, builds a service and endpoint dependency graph from supported code references, and checks each pull request against it. You can export the snapshot as JSON for review."),
        bullets(["OpenAPI 3 contracts only.", "Supported HTTP client patterns only.", "Host association in the graph is unverified; inspect a reference before treating an edge as a production dependency."]),
      ] },
    ],
  },
  {
    slug: "api-usage-observability-prometheus-datadog",
    title: "API usage observability with Prometheus or Datadog",
    description: "How to match runtime request metrics to the endpoints in your OpenAPI contracts so you can see which routes are used and which are not.",
    group: "Guides",
    readingTime: 4,
    sections: [
      { id: "why-runtime", title: "Why static analysis alone leaves usage unknown", blocks: [
        p("Code analysis shows callers it can find. Runtime metrics show traffic that actually arrives. Together they give a fuller picture, and neither one proves an endpoint is unused."),
      ] },
      { id: "what-you-need", title: "What you need", blocks: [
        bullets(["A request counter with provider service, HTTP method, and a stable route template such as /orders/{id}. Full URLs with customer IDs cannot be matched.", "Prometheus gives estimated request counts from counter increases. Datadog gives counts of indexed APM spans.", "Caller identity is optional and present only if your source records it."]),
        p("Impact Gate reads your existing Prometheus or Datadog data and matches it to endpoints discovered in your repositories. Datadog needs an API key and an application key with apm_read. See the runtime observability guide for the setup steps."),
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

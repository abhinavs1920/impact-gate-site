import type { DocPage } from "./content";

export const runtimeObservabilityDoc: DocPage = {
  slug: "runtime-observability",
  title: "Connect Prometheus or Datadog",
  description:
    "Bring existing request metrics and APM observations into your repository API inventory.",
  group: "Connect & index",
  readingTime: 8,
  sections: [
    {
      id: "before-you-connect",
      title: "Before you connect",
      blocks: [
        {
          type: "paragraph",
          text: "Impact Gate reads your existing observability data and matches it to APIs discovered in your selected repositories. Continue using Prometheus for metrics and Datadog for full traces, dashboards, and alerts. Impact Gate adds runtime evidence to API Flows, PR Impact, and Retirement Radar.",
        },
        {
          type: "steps",
          items: [
            {
              title: "Index the API providers",
              text: "Connect GitHub and index repositories containing supported OpenAPI contracts. Confirm that the provider service and API paths appear in [APIs](/dashboard/api-usage).",
            },
            {
              title: "Instrument every provider you want to observe",
              text: "Use your existing Prometheus client/exporter or Datadog APM library. Each observation must identify the provider service, HTTP method, and a stable route template such as `/orders/{id}`. Full URLs or paths containing individual customer IDs will not be guessed into API templates.",
            },
            {
              title: "Prepare read credentials and access",
              text: "A workspace owner or admin with a verified identity can create the connection in [Settings](/dashboard/settings#runtime-connections). Prometheus must be reachable from the Impact Gate deployment. Datadog requires an API key and an application key with the `apm_read` permission.",
            },
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "Metrics and traces answer different questions",
          text: "Prometheus imports estimated request counts from counter increases. Datadog imports counts of indexed APM spans. Caller identities are optional and must be explicitly recorded by your source; an endpoint can have observed traffic while its callers remain unknown.",
        },
      ],
    },
    {
      id: "connect-prometheus",
      title: "Connect Prometheus",
      blocks: [
        {
          type: "steps",
          items: [
            {
              title: "Check the metric in Prometheus",
              text: "Find a cumulative HTTP request counter with labels for provider service, HTTP method, and route template. Common names include `http_requests_total` or a request duration histogram's `_count` series. Adapt the query and label names to your application's instrumentation.",
            },
            {
              title: "Open the connection form",
              text: "In Settings, choose **Connect Prometheus**. Enter the HTTPS query-server URL and select its authentication method. Enter a bearer token or username/password if required. The form starts with source access; it does not ask you to type every service name.",
            },
            {
              title: "Adjust the defaults when needed",
              text: "The defaults use `http_requests_total` with `service`, `method`, and `route` labels over 24 hours. Windows can be configured up to 720 hours. Use at least 720 hours (30 days) for Retirement Radar to confirm an explicit zero-call counter. Open **Advanced settings** if your exporter uses another counter or labels. Keep `{{window}}` inside `increase()`. The query must return an instant vector of request counts rather than a rate per second.",
            },
            {
              title: "Find and match services",
              text: "Choose **Find and match services**. Impact Gate reads service names from the source and compares them with indexed package names, repository names, deployment name variants, and API routes. Clear matches are preselected and grouped under **matches ready to connect**. Discovery does not save credentials or create a connection.",
            },
            {
              title: "Review exceptions and connect",
              text: "Choose the correct indexed service from a dropdown for uncertain matches. **Use all suggested matches** applies the available suggestions in one action after your review. Leave services outside this workspace unselected. Choose **Connect** to validate and save the selected mappings, then open APIs. **Manual mapping** supports inactive services, additional aliases, and **Fill with repository names** without requiring discovery.",
            },
          ],
        },
        {
          type: "code",
          language: "promql",
          value:
            'sum by (service, method, route) (increase(http_requests_total{route!=""}[{{window}}]))',
        },
        {
          type: "code",
          language: "text",
          value:
            'http_requests_total{service="catalog-api-prod",method="GET",route="/orders/{id}"} 1234',
        },
        {
          type: "paragraph",
          text: "For caller relationships, record a low-cardinality `caller_service` label when you have a trustworthy caller identity. Include it in `sum by (service, method, route, caller_service)` and set the optional **Caller service label**. Map the caller's service name too if you want a dependency edge to an indexed consumer.",
        },
        {
          type: "callout",
          tone: "note",
          title: "Private Prometheus",
          text: "Ask your deployment owner to provide a reachable private network path and allow the exact Prometheus origin. The connector rejects restricted network addresses by default. Do not publish an unauthenticated Prometheus server just to create this connection.",
        },
        {
          type: "links",
          items: [
            {
              label: "Prometheus instrumentation guidance",
              href: "https://prometheus.io/docs/practices/instrumentation/",
            },
            {
              label: "Prometheus HTTP query API",
              href: "https://prometheus.io/docs/prometheus/latest/querying/api/",
            },
          ],
        },
      ],
    },
    {
      id: "connect-datadog",
      title: "Connect Datadog APM",
      blocks: [
        {
          type: "steps",
          items: [
            {
              title: "Confirm request spans exist",
              text: "Use Datadog's existing APM instrumentation for each API provider. In Trace Explorer, check that the selected environment has indexed server request spans, with the correct `service` and a route resource such as `GET /orders/{id}`. Configure retention in Datadog when the traffic you need is not indexed.",
            },
            {
              title: "Create read credentials",
              text: "Create a Datadog API key and a scoped application key for an identity that can read APM (`apm_read`). In Settings, choose **Connect Datadog**, select your account's Datadog site, and enter both keys.",
            },
            {
              title: "Select the spans and route fields",
              text: "The defaults use `env:production`, `service`, and `resource_name`. Open **Advanced settings** to use the same environment/provider filter as Trace Explorer and restrict it to server request spans. If your account uses separate route fields, choose `@http.route` and `@http.method`; custom attributes must be configured as searchable APM facets.",
            },
            {
              title: "Discover, review, and connect",
              text: "Choose **Find and match services** to discover actual source names and preselect clear matches. Review the exceptions using dropdowns; use **Use all suggested matches** to apply the proposed matches together. Choose **Connect** to save. If a configured caller facet supplies consumer names, those names are discovered too. Saved imports are restricted to the selected source services within your configured query.",
            },
            {
              title: "Inspect full traces in Datadog",
              text: "Use **Open source** from the connection card to open Datadog APM. Reuse the configured search query and observation window to investigate individual traces, errors, and latency there. Impact Gate imports aggregate evidence and does not copy raw spans or request payloads.",
            },
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Indexed spans can be incomplete",
          text: "Datadog sampling, retention filters, missing facets, group limits, and query timeouts can omit traffic or routes. Counts represent indexed spans and must not be read as total request volume. A sampled or missing span is never evidence that an API has zero callers.",
        },
        {
          type: "links",
          items: [
            {
              label: "Datadog APM setup",
              href: "https://docs.datadoghq.com/tracing/trace_collection/",
            },
            {
              label: "Datadog API and application keys",
              href: "https://docs.datadoghq.com/account_management/api-app-keys/",
            },
            {
              label: "Datadog span aggregation API",
              href: "https://docs.datadoghq.com/api/latest/spans/aggregate-spans/",
            },
          ],
        },
      ],
    },
    {
      id: "read-your-coverage",
      title: "Read endpoint coverage",
      blocks: [
        {
          type: "table",
          headers: ["State", "Meaning", "Next action"],
          rows: [
            [
              "Runtime not connected",
              "No source is connected for this workspace.",
              "Connect a source from Settings.",
            ],
            [
              "No current observations",
              "No matched telemetry row is available, or its import failed or is stale. Missing rows are not interpreted as zero calls.",
              "Check source status, query scope, service mapping, route labels, instrumentation, and retention.",
            ],
            [
              "0 calls in 30 days",
              "A complete Prometheus counter series explicitly reported zero across a full 30-day window. Sampled Datadog spans and missing series do not qualify.",
              "Review static and external callers before planning removal; this is not approval to deprecate the API.",
            ],
            [
              "Estimated requests",
              "Positive counter increases matched the endpoint in Prometheus.",
              "Read the window and compare the query in Prometheus. Fractional values can result from counter extrapolation.",
            ],
            [
              "Indexed spans",
              "Positive indexed spans matched the endpoint in Datadog.",
              "Use Datadog APM to inspect sampled traces and retention coverage.",
            ],
            [
              "Runtime or both evidence",
              "A caller identity was supplied and mapped to an indexed service; both also has a static reference.",
              "Inspect the consumer and provider in Dependency graph.",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "Every indexed endpoint remains in the inventory, including endpoints with missing observations. In an endpoint's Overview, the Runtime observation section shows the source, request/span count, observation window, and whether caller identity is available. A query evaluation timestamp is not the last request timestamp, so Last observed can remain unavailable even when traffic counts are present. Retirement Radar highlights only connected, complete Prometheus counter results that explicitly report zero across at least 30 days; other candidates remain visible with their coverage and review state.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Keep retirement decisions explicit",
          text: "Connecting a source does not automatically approve an endpoint removal. Missing series, absent spans, incomplete indexing, and unobserved scheduled callers can leave usage unknown. Review application owners, callers, measured function coverage, and observation windows before changing a contract.",
        },
      ],
    },
    {
      id: "maintain-a-connection",
      title: "Refresh, edit, and disconnect",
      blocks: [
        {
          type: "bullets",
          items: [
            "Each connection becomes eligible for an automatic import every 15 minutes. Imports are bounded and processed in small batches; backlog can delay a refresh. Use Sync now in Settings to request an immediate import.",
            "Edit connection retains your saved mappings. Choose Find services again to discover new names. Changes to the source settings require discovery again, or manual mappings. For Prometheus choose Keep saved credentials; for Datadog leave both keys blank to retain them. Changing the origin/site requires fresh credentials. Choose No authentication only for a Prometheus source that permits unauthenticated reads.",
            "A failed import is shown as Sync error. Current endpoint coverage becomes unknown until a successful import. Observations older than 45 minutes are also excluded from current coverage.",
            "Disconnect removes the saved encrypted credentials and imported evidence for that source. Repositories and static evidence remain available. Disconnect does not modify your Prometheus or Datadog account; revoke an obsolete key in that provider as well.",
            "When both sources observe an endpoint, the inventory prefers Prometheus counter increases for volume and can use Datadog for caller evidence. Counts from the two sources are not added together.",
          ],
        },
      ],
    },
    {
      id: "kubernetes-identity",
      title: "Connect Kubernetes deployment identity",
      blocks: [
        {
          type: "paragraph",
          text: "Impact Gate links a GitHub repository to a running workload through build provenance or an explicit reviewed association. Repository, Deployment, Service, Prometheus, and Datadog names can all differ; name similarity alone never confirms identity.",
        },
        {
          type: "steps",
          items: [
            {
              title: "Create namespace-scoped read access",
              text: "Use a dedicated service account and a RoleBinding only in namespaces you want to inventory. The connector reads Deployment, StatefulSet, DaemonSet, ReplicaSet, Pod owner/image status, and Service metadata. It does not read Secrets, logs, or execute in containers.",
            },
            {
              title: "Connect the cluster in Settings",
              text: "Choose Connect cluster in the deployment identity panel. Enter an HTTPS API server origin, an environment, up to ten namespaces, and the read-only bearer token. Private API origins must be reachable from the backend and listed exactly in the operator's RUNTIME_ALLOWED_ORIGINS setting.",
            },
            {
              title: "Provide build provenance or review a link",
              text: "Add the GitHub repository ID, full source commit SHA, and immutable sha256 image digest for a build, or choose Associate repository on a workload. The exact digest join reflects the submitted record; Impact Gate does not verify operator-submitted provenance against signed CI. A running Pod imageID is joined to its Deployment through Kubernetes owner references; tag-only workload images are not treated as immutable digests.",
            },
            {
              title: "Review telemetry names separately",
              text: "Continue to map Prometheus and Datadog service names to indexed API services in each source connection. Kubernetes Service names and telemetry service names are not automatically treated as equivalent.",
            },
          ],
        },
        {
          type: "code",
          language: "yaml",
          value: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: impact-gate-inventory
  namespace: payments
rules:
  - apiGroups: [apps]
    resources: [deployments, statefulsets, daemonsets, replicasets]
    verbs: [get, list]
  - apiGroups: [""]
    resources: [pods, services]
    verbs: [get, list]`,
        },
        {
          type: "callout",
          tone: "warning",
          title: "Evidence and freshness",
          text: "Workload inventory refreshes every 15 minutes. A failed refresh leaves previous workload records marked stale. Conflicting artifact and operator evidence is shown as ambiguous. Runtime route traffic is service-level evidence and does not prove that a particular source call site executed.",
        },
      ],
    },
    {
      id: "troubleshoot-runtime",
      title: "Resolve connection and coverage problems",
      blocks: [
        {
          type: "table",
          headers: ["Problem", "What to check"],
          rows: [
            [
              "Credentials rejected",
              "Check the Prometheus bearer/basic credentials, or the Datadog site and API/application key pair with apm_read access.",
            ],
            [
              "Server unreachable or restricted",
              "Check TLS, DNS, and reachability from the Impact Gate backend. Ask the deployment owner about the exact private origin allowlist.",
            ],
            [
              "Source rows but no matched endpoints",
              "Match the telemetry service name to the correct indexed provider; compare the HTTP method and route template. Refresh indexing after an API contract change.",
            ],
            [
              "Invalid rows",
              "Use separate service/method/template labels, or a Datadog resource_name containing METHOD /route. Avoid raw URLs, query strings, malformed counts, and missing facets.",
            ],
            [
              "Rate limit, timeout, or too many series",
              "Narrow the environment, services, routes, or time window. Queries time out and imports accept at most 5,000 rows and 2 MiB. Datadog aggregation limits can omit groups even below the row limit.",
            ],
            [
              "No caller relationships",
              "Traffic counts do not imply caller identity. Add a trustworthy low-cardinality caller field and map its service names, or continue using static caller references.",
            ],
          ],
        },
      ],
    },
  ],
};

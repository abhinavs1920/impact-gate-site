import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import {
  evaluationDeprecationCandidate,
  evaluationGraphEdges,
  type EvaluationGraphEdge,
  type GraphConfidence,
} from "../data/product-screen-evaluation";

type Theme = "light" | "dark";
type ConfidenceFilter = "all" | "high" | "medium" | "low";

const confidenceNames: Record<GraphConfidence, string> = {
  high: "Both",
  medium: "Static-only",
  low: "Runtime-only",
};

const confidenceFilters: Array<[ConfidenceFilter, string]> = [
  ["all", "All tiers"],
  ["medium", "Static-only"],
  ["low", "Runtime-only"],
  ["high", "Both"],
];

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem("impact-gate-theme", nextTheme);
    } catch {
      // Keep the selection for the current page view.
    }
  }

  return { theme, toggleTheme };
}

function ScreenHeader({
  active,
  theme,
  onToggleTheme,
}: {
  active: "review" | "graph" | "deprecation";
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="product-screen-header">
      <a className="product-screen-brand" href="/" aria-label="Impact Gate home">
        <img className="product-screen-mark" src="/favicon.svg" width="32" height="32" alt="" />
        <span>Impact Gate</span>
      </a>
      <nav className="product-screen-nav" aria-label="Product screens">
        <a
          href="/review-desk"
          aria-current={active === "review" ? "page" : undefined}
        >
          Review Desk
        </a>
        <a
          href="/dependency-graph"
          aria-current={active === "graph" ? "page" : undefined}
        >
          Dependency Graph
        </a>
        <a
          href="/deprecation-candidates"
          aria-current={active === "deprecation" ? "page" : undefined}
        >
          Deprecation Candidates
        </a>
      </nav>
      <button
        className="product-theme-toggle"
        type="button"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </header>
  );
}

function getSearchPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("evaluation-preview") === "1";
}

function updatePreviewQuery(isPreview: boolean) {
  const url = new URL(window.location.href);
  if (isPreview) url.searchParams.set("evaluation-preview", "1");
  else url.searchParams.delete("evaluation-preview");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function ConfidenceKey() {
  return (
    <div className="graph-confidence-key" aria-label="Graph confidence">
      <span>
        <i className="confidence-dot both" aria-hidden="true" />
        Both
      </span>
      <span>
        <i className="confidence-dot static" aria-hidden="true" />
        Static-only
      </span>
      <span>
        <i className="confidence-dot runtime" aria-hidden="true" />
        Runtime-only
      </span>
    </div>
  );
}

function FindingState({ state }: { state: string }) {
  const allowed = [
    "verified",
    "possible",
    "usage_not_located",
    "not_affected",
  ];
  if (!allowed.includes(state)) return null;
  return (
    <span className={`finding-state finding-${state}`} data-state={state}>
      {state}
    </span>
  );
}

type GraphSelection =
  | { type: "service"; name: string }
  | { type: "endpoint"; edge: EvaluationGraphEdge }
  | null;

export function DependencyGraphScreen() {
  const { theme, toggleTheme } = useTheme();
  const [preview, setPreview] = useState(getSearchPreview);
  const [query, setQuery] = useState("");
  const [confidence, setConfidence] = useState<ConfidenceFilter>("all");
  const [service, setService] = useState("all");
  const [selection, setSelection] = useState<GraphSelection>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    document.title = "Dependency Graph | Impact Gate";
  }, []);

  const graphEdges = preview ? evaluationGraphEdges : [];
  const serviceNames = useMemo(
    () =>
      Array.from(
        new Set(graphEdges.flatMap((edge) => [edge.from, edge.to])),
      ).sort(),
    [graphEdges],
  );
  const deprecationService = preview
    ? evaluationDeprecationCandidate.service
    : null;

  useEffect(() => {
    if (!canvasRef.current || !graphEdges.length) {
      cyRef.current = null;
      return;
    }

    const providerNames = new Set(graphEdges.map((edge) => edge.to));
    const nodeNames = Array.from(
      new Set(graphEdges.flatMap((edge) => [edge.from, edge.to])),
    );
    const dark = theme === "dark";
    const cy = cytoscape({
      container: canvasRef.current,
      elements: {
        nodes: nodeNames.map((name) => {
          const provider = providerNames.has(name);
          return {
            data: {
              id: name,
              label: name,
              role: provider ? "provider" : "consumer",
              bgColor: provider
                ? dark
                  ? "#1c2d3d"
                  : "#e8eff8"
                : dark
                  ? "#1e2127"
                  : "#f2f4f6",
              borderColor: provider
                ? dark
                  ? "#58a6ff"
                  : "#3659a7"
                : dark
                  ? "#8b949e"
                  : "#697481",
              borderWidth: provider ? 2 : 1,
              textColor: dark ? "#e6edf3" : "#191c1e",
            },
          };
        }),
        edges: graphEdges.map((edge, index) => ({
          data: {
            id: `edge-${index}`,
            source: edge.from,
            target: edge.to,
            label: `${edge.method} ${edge.endpoint}`,
            confidence: edge.confidence,
            edgeColor:
              edge.confidence === "high"
                ? dark
                  ? "#3fb950"
                  : "#268447"
                : edge.confidence === "medium"
                  ? dark
                    ? "#d29922"
                    : "#9a7013"
                  : dark
                    ? "#f85149"
                    : "#bd3932",
          },
        })),
      },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(bgColor)",
            "border-color": "data(borderColor)",
            "border-width": "data(borderWidth)",
            color: "data(textColor)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "13px",
            "font-weight": "bold",
            padding: "12px",
            shape: "ellipse",
            width: "label",
            height: "label",
          },
        },
        {
          selector: 'node[role = "provider"]',
          style: { shape: "round-rectangle" },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.8,
          },
        },
        { selector: "edge:selected", style: { width: 3, opacity: 1 } },
        {
          selector: "node:selected",
          style: { "border-width": 3, "border-color": dark ? "#58a6ff" : "#2b3ac4" },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        nodeRepulsion: 8000,
        idealEdgeLength: 150,
        edgeElasticity: 100,
        gravity: 0.5,
        padding: 40,
      },
      minZoom: 0.25,
      maxZoom: 2,
    });
    cyRef.current = cy;

    cy.on("tap", "node", (event) => {
      setSelection({ type: "service", name: event.target.id() });
    });
    cy.on("tap", "edge", (event) => {
      const edgeIndex = Number(event.target.id().replace("edge-", ""));
      const edge = graphEdges[edgeIndex];
      if (edge) setSelection({ type: "endpoint", edge });
    });
    cy.on("tap", (event) => {
      if (event.target === cy) setSelection(null);
    });
    cy.one("layoutstop", () =>
      cy.fit(undefined, window.innerWidth <= 672 ? 52 : 48),
    );

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graphEdges, theme]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const normalizedQuery = query.trim().toLowerCase();
    const matches: string[] = [];

    cy.edges().forEach((edge) => {
      const edgeData = edge.data();
      const edgeConfidence = edgeData.confidence as GraphConfidence;
      const matchesConfidence =
        confidence === "all" || edgeConfidence === confidence;
      const matchesService =
        service === "all" ||
        edgeData.source === service ||
        edgeData.target === service;
      const matchesQuery =
        !normalizedQuery ||
        String(edgeData.source).toLowerCase().includes(normalizedQuery) ||
        String(edgeData.target).toLowerCase().includes(normalizedQuery) ||
        String(edgeData.label).toLowerCase().includes(normalizedQuery);
      const visible = matchesConfidence && matchesService && matchesQuery;
      edge.style("opacity", visible ? 0.8 : 0.08);
      if (visible) {
        matches.push(String(edgeData.source), String(edgeData.target));
      }
    });

    cy.nodes().forEach((node) => {
      const isVisible =
        (service === "all" || node.id() === service) &&
        (!normalizedQuery ||
          node.id().toLowerCase().includes(normalizedQuery) ||
          matches.includes(node.id()));
      node.style("opacity", isVisible ? 1 : 0.18);
    });

    if (normalizedQuery) {
      const matchingNode = cy.nodes().filter((node) =>
        node.id().toLowerCase().includes(normalizedQuery),
      )[0];
      if (matchingNode) cy.animate({ center: { eles: matchingNode }, duration: 250 });
      else {
        const matchingEdge = cy.edges().filter((edge) =>
          String(edge.data("label")).toLowerCase().includes(normalizedQuery),
        )[0];
        if (matchingEdge) cy.animate({ center: { eles: matchingEdge }, duration: 250 });
      }
    }
  }, [confidence, query, service, preview]);

  function togglePreview() {
    const next = !preview;
    setPreview(next);
    setSelection(null);
    setService("all");
    updatePreviewQuery(next);
  }

  const selectedService =
    selection?.type === "service" ? selection.name : selection?.edge.to;
  const callers = selectedService
    ? selection?.type === "endpoint"
      ? [selection.edge]
      : graphEdges.filter((edge) => edge.to === selectedService)
    : [];
  const selectedCandidate =
    selectedService === deprecationService ? evaluationDeprecationCandidate : null;
  const staticOnlySelection =
    selection?.type === "endpoint"
      ? selection.edge.confidence === "medium"
      : callers.length > 0 && callers.every((edge) => edge.confidence === "medium");
  const hasOpenFinding = callers.some(
    (edge) => edge.reviewState && edge.reviewState !== "not_affected",
  );

  return (
    <div className="product-screen product-graph-screen">
      <ScreenHeader active="graph" theme={theme} onToggleTheme={toggleTheme} />
      <main className="product-screen-main">
        <div className="product-screen-title">
          <div>
            <span className="eyebrow">Dependency Graph</span>
            <h1>Explore what connects to what.</h1>
          </div>
          <button
            className={`evaluation-toggle${preview ? " is-active" : ""}`}
            type="button"
            onClick={togglePreview}
            aria-pressed={preview}
          >
            {preview ? "Hide local evaluation data" : "View local evaluation data"}
          </button>
        </div>
        <div className="graph-toolbar" role="search">
          <label className="graph-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search services and endpoints</span>
            <input
              type="search"
              placeholder="Search services and endpoints"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filter by confidence</span>
            <select
              value={confidence}
              onChange={(event) =>
                setConfidence(event.target.value as ConfidenceFilter)
              }
            >
              {confidenceFilters.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by service</span>
            <select
              value={service}
              onChange={(event) => setService(event.target.value)}
            >
              <option value="all">All services</option>
              {serviceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {preview && (
            <span className="evaluation-label">Evaluation data · not live</span>
          )}
        </div>

        <section
          className={`graph-workspace${selection ? " has-selection" : ""}`}
          aria-label="Service dependency graph"
        >
          <div className="graph-canvas-wrap">
            {graphEdges.length ? (
              <div
                className="graph-canvas"
                ref={canvasRef}
                role="img"
                aria-label="Interactive service dependency graph"
              />
            ) : (
              <div className="graph-empty-state">
                <span className="graph-empty-mark" aria-hidden="true">
                  ↗
                </span>
                <h2>No graph data is connected to this screen yet.</h2>
                <p>
                  Connect repository and runtime data to explore service
                  dependencies here.
                </p>
              </div>
            )}
            {preview && (
              <span className="graph-evaluation-note">
                Local evaluation graph · not live
              </span>
            )}
            {!!graphEdges.length && <ConfidenceKey />}
            {!!graphEdges.length && (
              <div className="graph-controls" aria-label="Graph controls">
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Fit graph to screen"
                  onClick={() => cyRef.current?.fit(undefined, 48)}
                >
                  ⤢
                </button>
              </div>
            )}
          </div>
          {selection && (
            <aside className="graph-detail-panel" aria-label="Selected graph item">
              <button
                className="detail-close"
                type="button"
                onClick={() => setSelection(null)}
                aria-label="Close details"
              >
                ×
              </button>
              <span className="eyebrow">
                {selection.type === "endpoint" ? "Endpoint" : "Service"}
              </span>
              <h2>
                {selection.type === "endpoint"
                  ? selection.edge.endpoint
                  : selection.name}
              </h2>
              {selection.type === "endpoint" && (
                <p className="graph-detail-service">
                  {selection.edge.method} · {selection.edge.to}
                  {" · "}
                  {confidenceNames[selection.edge.confidence]}
                </p>
              )}
              {preview && (
                <p className="graph-detail-source">
                  Evaluation data · not live
                </p>
              )}
              {staticOnlySelection && (
                <p className="runtime-note">
                  No runtime data connected for this service yet — confidence
                  is based on code analysis only.
                </p>
              )}
              <h3>Callers</h3>
              {callers.length ? (
                <ul className="graph-caller-list">
                  {Array.from(new Set(callers.map((edge) => edge.from))).map(
                    (caller) => (
                      <li key={caller}>
                        <span>{caller}</span>
                        <span className="caller-findings-note">
                          No connected Review finding
                        </span>
                        {callers
                          .filter((edge) => edge.from === caller)
                          .map((edge) =>
                            edge.reviewState ? (
                              <FindingState
                                key={`${edge.method}:${edge.endpoint}`}
                                state={edge.reviewState}
                              />
                            ) : null,
                          )}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="graph-detail-empty">
                  No caller data is connected for this service.
                </p>
              )}
              <div className="graph-detail-actions">
                {hasOpenFinding && (
                    <a
                      className="product-button primary"
                      href="/#evidence"
                    >
                      Open in Reviews
                    </a>
                  )}
                {selectedCandidate && (
                  <a
                    className="product-button secondary"
                    href="/deprecation-candidates?evaluation-preview=1"
                  >
                    View deprecation status
                  </a>
                )}
              </div>
            </aside>
          )}
        </section>
        {preview && (
          <p className="graph-low-data-note">
            This local evaluation graph is not connected to production
            repositories or live runtime sources.
          </p>
        )}
      </main>
    </div>
  );
}

type CandidateConfidence =
  | "Strong candidate"
  | "Rare caller — verify"
  | "Building confidence";

interface CandidateRow {
  service: string;
  endpoint: string;
  confidence: CandidateConfidence;
  staticReference: string | null;
  lastObservedCall: string;
  evidence: string;
}

const evaluationCandidate: CandidateRow = {
  ...evaluationDeprecationCandidate,
  evidence:
    "No static references were found for this endpoint in the local evaluation consumer set. No runtime source is connected to this screen, so this is not a confirmed no-traffic result.",
};

const candidateConfidenceOptions: Array<CandidateConfidence | "all"> = [
  "all",
  "Strong candidate",
  "Rare caller — verify",
  "Building confidence",
];

export function DeprecationCandidatesScreen() {
  const { theme, toggleTheme } = useTheme();
  const [preview, setPreview] = useState(getSearchPreview);
  const [confidence, setConfidence] = useState<CandidateConfidence | "all">(
    "all",
  );
  const [service, setService] = useState("all");
  const [reviewedTab, setReviewedTab] = useState(false);
  const [reviewedRows, setReviewedRows] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"unused" | "endpoint">("unused");
  const [expandedEvidence, setExpandedEvidence] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Deprecation Candidates | Impact Gate";
  }, []);

  const rows = preview ? [evaluationCandidate] : [];
  const serviceNames = Array.from(new Set(rows.map((row) => row.service)));
  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => (reviewedRows.includes(row.endpoint) === reviewedTab))
        .filter((row) => confidence === "all" || row.confidence === confidence)
        .filter((row) => service === "all" || row.service === service)
        .sort((left, right) =>
          sortBy === "endpoint"
            ? left.endpoint.localeCompare(right.endpoint)
            : 0,
        ),
    [confidence, reviewedRows, reviewedTab, rows, service, sortBy],
  );

  function togglePreview() {
    const next = !preview;
    setPreview(next);
    updatePreviewQuery(next);
  }

  function markReviewed(endpoint: string) {
    setReviewedRows((current) =>
      current.includes(endpoint) ? current : [...current, endpoint],
    );
    setReviewedTab(true);
  }

  function toggleEvidence(endpoint: string) {
    setExpandedEvidence((current) =>
      current.includes(endpoint)
        ? current.filter((item) => item !== endpoint)
        : [...current, endpoint],
    );
  }

  return (
    <div className="product-screen product-deprecation-screen">
      <ScreenHeader
        active="deprecation"
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="experimental-banner" role="note">
        <span className="experimental-mark" aria-hidden="true">
          i
        </span>
        <p>
          <strong>Experimental</strong> — these are candidates for review, not
          confirmed-dead code. Always verify before removing anything.
        </p>
      </div>
      <main className="product-screen-main">
        <div className="product-screen-title">
          <div>
            <span className="eyebrow">Deprecation Candidates</span>
            <h1>Leads worth a closer look.</h1>
            <p className="product-screen-description">
              Review possible unused APIs; nothing here is confirmed dead code.
            </p>
          </div>
          <button
            className={`evaluation-toggle${preview ? " is-active" : ""}`}
            type="button"
            onClick={togglePreview}
            aria-pressed={preview}
          >
            {preview ? "Hide local evaluation data" : "View local evaluation data"}
          </button>
        </div>
        {preview && (
          <div className="runtime-source-callout" role="status">
            <span aria-hidden="true">i</span>
            <p>
              Deprecation confidence is currently based on code analysis only —
              connect a runtime data source to improve accuracy.
            </p>
          </div>
        )}
        <div className="candidate-toolbar">
          <div className="candidate-filters" aria-label="Filter candidates">
            <label>
              <span className="sr-only">Filter by confidence</span>
              <select
                value={confidence}
                onChange={(event) =>
                  setConfidence(
                    event.target.value as CandidateConfidence | "all",
                  )
                }
              >
                {candidateConfidenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All confidence states" : option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by service</span>
              <select
                value={service}
                onChange={(event) => setService(event.target.value)}
              >
                <option value="all">All services</option>
                {serviceNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort candidates</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as "unused" | "endpoint")
                }
              >
                <option value="unused">Longest unused</option>
                <option value="endpoint">Endpoint/API name</option>
              </select>
            </label>
          </div>
          <div className="candidate-tabs" role="tablist" aria-label="Candidate review status">
            <button
              type="button"
              role="tab"
              aria-selected={!reviewedTab}
              onClick={() => setReviewedTab(false)}
            >
              Candidates
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reviewedTab}
              onClick={() => setReviewedTab(true)}
            >
              Reviewed
            </button>
          </div>
        </div>
        {preview && (
          <p className="candidate-evaluation-label">
            Local evaluation data · not live
          </p>
        )}
        <section className="candidate-table-section" aria-label="Candidates">
          <table className="candidate-table">
            <thead>
              <tr>
                <th scope="col">Endpoint/API</th>
                <th scope="col">Confidence</th>
                <th scope="col">Last static reference</th>
                <th scope="col">Last observed call</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? (
                visibleRows.map((row) => (
                  <tr key={row.endpoint}>
                    <td data-label="Endpoint/API">
                      <code>{row.endpoint}</code>
                      <span className="candidate-service">{row.service}</span>
                    </td>
                    <td data-label="Confidence">
                      <span
                        className="candidate-confidence"
                        data-confidence={row.confidence}
                      >
                        {row.confidence}
                      </span>
                    </td>
                    <td data-label="Last static reference">
                      {row.staticReference ?? "None found in indexed code"}
                    </td>
                    <td data-label="Last observed call">
                      {row.lastObservedCall}
                    </td>
                    <td data-label="Actions" className="candidate-actions">
                      <button
                        type="button"
                        className="evidence-toggle"
                        aria-expanded={expandedEvidence.includes(row.endpoint)}
                        onClick={() => toggleEvidence(row.endpoint)}
                      >
                        {expandedEvidence.includes(row.endpoint)
                          ? "Hide evidence"
                          : "View evidence"}
                      </button>
                      {!reviewedTab && (
                        <button
                          type="button"
                          className="mark-reviewed"
                          onClick={() => markReviewed(row.endpoint)}
                        >
                          Mark reviewed
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="candidate-empty-cell" colSpan={5}>
                    <div className="candidate-empty-state">
                      <span className="candidate-empty-icon" aria-hidden="true">
                        ◌
                      </span>
                      <h2>
                        {reviewedTab
                          ? "No reviewed candidates yet."
                          : "Not enough data yet to show candidates."}
                      </h2>
                      <p>
                        {reviewedTab
                          ? "Candidates marked reviewed will appear here."
                          : "This does not mean there is nothing to find. Connect indexed code and runtime data to build confidence."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {visibleRows.map(
                (row) =>
                  expandedEvidence.includes(row.endpoint) && (
                    <tr
                      className="candidate-evidence-row"
                      key={`${row.endpoint}-evidence`}
                    >
                      <td colSpan={5}>
                        <strong>Evidence</strong>
                        <p>{row.evidence}</p>
                        <p>
                          Static reference:{" "}
                          {row.staticReference ??
                            "None found in indexed code."}
                        </p>
                        <p>
                          Observed-call history: no runtime data is connected
                          to this screen.
                        </p>
                      </td>
                    </tr>
                  ),
              )}
            </tbody>
          </table>
          <p className="candidate-session-note">
            Marked-reviewed state is kept for this page session.
          </p>
        </section>
      </main>
    </div>
  );
}

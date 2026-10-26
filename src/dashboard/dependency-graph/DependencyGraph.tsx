import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type NodeProps,
  type Edge,
  type Viewport,
} from "@xyflow/react";
import type { WorkspaceSnapshot } from "../../types/workspace";
import {
  buildRepositoryGraph,
  filteredRepositoryGraph,
  type GraphModule,
} from "../dependency-graph";
import { Inspector, type GraphSelection } from "./Inspector";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  layoutGraph,
  type LayoutPosition,
} from "./layout";
import { projectGraph, type SceneNode } from "./project";
import "@xyflow/react/dist/style.css";
import "./styles.css";

type FlowNode = Node<SceneNode & Record<string, unknown>, "entity">;

const EntityNode = memo(function EntityNode({ data }: NodeProps<FlowNode>) {
  return (
    <div
      className={`rg-node rg-node-${data.kind}${data.boundary ? " rg-node-boundary" : ""}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="rg-node-top">
        <span className="rg-node-icon" aria-hidden="true">
          {data.kind === "repository" ? (
            <svg viewBox="0 0 24 24">
              <path d="M5 4h12a2 2 0 0 1 2 2v15l-4-2-4 2V4M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M5 4v12h3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          )}
        </span>
        <span>
          {data.boundary ? "CONNECTED REPOSITORY" : data.kind.toUpperCase()}
        </span>
        {data.kind === "repository" && (
          <i
            title={data.status}
            className={`rg-status-dot rg-status-${data.status}`}
          />
        )}
      </div>
      <strong title={data.title}>{data.title}</strong>
      <small title={data.subtitle}>{data.subtitle}</small>
      <div className="rg-node-bottom">
        <span>{data.detail}</span>
        <span>{data.kind === "repository" ? "Explore →" : data.status}</span>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
});
const nodeTypes = { entity: EntityNode };

function ViewportRestore({
  layoutId,
  saved,
  onReady,
}: {
  layoutId: string;
  saved?: Viewport;
  onReady: (key: string) => void;
}) {
  const initialized = useNodesInitialized();
  const { fitView, setViewport } = useReactFlow();
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      if (saved) await setViewport(saved);
      else await fitView({ padding: 0.18, minZoom: 0.6, maxZoom: 1 });
      if (!cancelled) onReady(layoutId);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // Selection does not change the layout or viewport.
  }, [initialized, layoutId, fitView, setViewport, onReady]);
  return null;
}

function downloadSnapshot(snapshot: WorkspaceSnapshot) {
  const model = buildRepositoryGraph(snapshot);
  const blobUrl = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            snapshotId: snapshot.snapshotId,
            workspaceId: snapshot.workspaceId,
            activeGroupId: snapshot.activeGroupId ?? null,
            repositories: snapshot.repositories,
            modules: model.modules,
            repositoryDependencies: model.aggregates,
            countDefinitions: {
              moduleDependency: "Distinct directed module pair",
              apiRelationship: "Distinct caller module and endpoint pair",
            },
            services: snapshot.services,
            endpoints: snapshot.endpoints,
            edges: snapshot.edges,
            warnings: model.warnings,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = "impact-gate-dependencies.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function DependencyGraph({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const model = useMemo(() => buildRepositoryGraph(snapshot), [snapshot]);
  const [repositoryId, setRepositoryId] = useState<string | null>(() =>
    new URL(location.href).searchParams.get("repo"),
  );
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState("");
  const [connectedOnly, setConnectedOnly] = useState(() => {
    const modules = model.modules.filter(
      (module) =>
        module.repositoryId === new URL(location.href).searchParams.get("repo"),
    );
    return (
      modules.length > 40 && modules.some((module) => module.relationCount > 0)
    );
  });
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [colorMode, setColorMode] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [layout, setLayout] = useState<{
    key: string;
    positions: Map<string, LayoutPosition>;
  } | null>(null);
  const [layoutError, setLayoutError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [viewportKey, setViewportKey] = useState("");
  const onViewportReady = useCallback((key: string) => setViewportKey(key), []);
  const [flow, setFlow] = useState<ReturnType<
    typeof useReactFlow<FlowNode>
  > | null>(null);
  const viewports = useRef(new Map<string, Viewport>());
  const scope = `${snapshot.workspaceId}:${snapshot.activeGroupId ?? "all"}`;
  const previousScope = useRef(scope);
  const viewKey = `${scope}:${repositoryId ?? "overview"}`;
  const filtered = useMemo(
    () => filteredRepositoryGraph(model, query, evidence),
    [model, query, evidence],
  );
  const repository = model.repositories.find(
    (item) => item.id === repositoryId,
  );
  const scene = useMemo(
    () => projectGraph(filtered, repositoryId, connectedOnly),
    [filtered, repositoryId, connectedOnly],
  );
  const sceneKey = JSON.stringify([
    viewKey,
    revision,
    scene.nodes,
    scene.edges,
  ]);
  const connectedCount = model.modules.filter(
    (module) =>
      module.repositoryId === repositoryId && module.relationCount > 0,
  ).length;
  const moduleCount = model.modules.filter(
    (module) => !repositoryId || module.repositoryId === repositoryId,
  ).length;
  const internalCount = filtered.relations.filter(
    (relation) =>
      relation.sourceRepositoryId === repositoryId &&
      relation.targetRepositoryId === repositoryId,
  ).length;

  const openRepository = useCallback(
    (id: string | null, replace = false) => {
      setRepositoryId(id);
      setSelection(null);
      setQuery("");
      const modules = model.modules.filter(
        (module) => module.repositoryId === id,
      );
      setConnectedOnly(
        modules.length > 40 &&
          modules.some((module) => module.relationCount > 0),
      );
      const next = new URL(location.href);
      if (id) next.searchParams.set("repo", id);
      else next.searchParams.delete("repo");
      history[replace ? "replaceState" : "pushState"](
        { repositoryId: id },
        "",
        next,
      );
    },
    [model],
  );

  useEffect(() => {
    if (scope !== previousScope.current) {
      previousScope.current = scope;
      viewports.current.clear();
      openRepository(null, true);
    }
  }, [scope, openRepository]);

  useEffect(() => {
    const onHistory = () => {
      setRepositoryId(new URL(location.href).searchParams.get("repo"));
      setSelection(null);
      setQuery("");
      setConnectedOnly(false);
    };
    window.addEventListener("popstate", onHistory);
    const observer = new MutationObserver(() =>
      setColorMode(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      window.removeEventListener("popstate", onHistory);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLayoutError(false);
    layoutGraph(scene)
      .then((positions) => {
        if (current) setLayout({ key: sceneKey, positions });
      })
      .catch(() => {
        if (current) setLayoutError(true);
      });
    return () => {
      current = false;
    };
  }, [sceneKey]);

  const nodes: FlowNode[] = useMemo(() => {
    if (!layout || layout.key !== sceneKey) return [];
    return scene.nodes.map((node) => ({
      id: node.id,
      type: "entity",
      data: { ...node },
      position: layout.positions.get(node.id) ?? { x: 0, y: 0 },
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      measured: { width: CARD_WIDTH, height: CARD_HEIGHT },
      handles: [
        {
          type: "target",
          position: Position.Left,
          x: -3,
          y: CARD_HEIGHT / 2 - 3,
          width: 6,
          height: 6,
        },
        {
          type: "source",
          position: Position.Right,
          x: CARD_WIDTH - 3,
          y: CARD_HEIGHT / 2 - 3,
          width: 6,
          height: 6,
        },
      ],
      ariaLabel: `${node.kind === "repository" ? "Open repository" : "Inspect module"} ${node.subtitle}`,
    }));
  }, [layout, sceneKey]);

  const selectModule = (module: GraphModule) => {
    setSelection({ kind: "module", id: module.id });
    if (nodes.some((node) => node.id === module.id))
      void flow?.fitView({
        nodes: [{ id: module.id }],
        padding: 1,
        maxZoom: 1,
        duration: 200,
      });
    else setConnectedOnly(false);
  };
  const edges: Edge[] = scene.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: repositoryId
      ? `${edge.relationshipCount} API${edge.relationshipCount === 1 ? "" : "s"}`
      : `${edge.moduleDependencyCount} dep${edge.moduleDependencyCount === 1 ? "" : "s"}`,
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--rg-edge)" },
    style: {
      strokeWidth: Math.min(
        4,
        1.5 + Math.log2(edge.relationshipCount + 1) * 0.45,
      ),
    },
    selected: selection?.kind === "edge" && selection.id === edge.id,
    ariaLabel: `${edge.moduleDependencyCount} module dependencies, ${edge.relationshipCount} API relationships`,
  }));
  const loading =
    (layout?.key !== sceneKey ||
      (scene.nodes.length > 0 && viewportKey !== sceneKey)) &&
    !layoutError;
  const scopeName =
    snapshot.groups?.find((group) => group.id === snapshot.activeGroupId)
      ?.name ?? "All repositories";

  return (
    <div className="ig-repo-graph" data-repository-graph-app>
      <div className="rg-topbar">
        <nav className="rg-breadcrumb" aria-label="Graph navigation">
          <button onClick={() => openRepository(null)}>Repositories</button>
          {repository && (
            <>
              <span aria-hidden="true">/</span>
              <strong title={repository.fullName}>{repository.fullName}</strong>
            </>
          )}
        </nav>
        <button
          className="rg-button"
          onClick={() => downloadSnapshot(snapshot)}
        >
          Export snapshot <span aria-hidden="true">↗</span>
        </button>
      </div>
      <section
        className="rg-workspace"
        aria-label="Repository dependency explorer"
      >
        <div className="rg-workspace-header">
          <div>
            <span className="rg-eyebrow">
              {repository ? "INSIDE THE REPOSITORY" : "YOUR WORKSPACE"}
            </span>
            <h2>
              {repository
                ? repository.fullName.split("/").at(-1)
                : "Repository map"}
            </h2>
            <p>
              {repository
                ? "Explore module dependencies. Select a module or arrow for details."
                : "Start with a repository. Follow the connections to see what depends on it."}
            </p>
          </div>
          <span className="rg-scope">
            <span className="rg-status-dot" />
            {scopeName}
          </span>
        </div>
        <div className="rg-toolbar">
          <label className="rg-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search repositories and modules"
              placeholder={
                repository
                  ? "Find a module by name or path…"
                  : "Find a repository or module…"
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelection(null);
              }}
            />
          </label>
          <select
            aria-label="Dependency evidence"
            value={evidence}
            onChange={(event) => {
              setEvidence(event.target.value);
              setSelection(null);
            }}
          >
            <option value="">All evidence</option>
            <option value="static">Static evidence</option>
            <option value="runtime">Runtime evidence</option>
            <option value="both">Static + runtime</option>
          </select>
          {(query || evidence) && (
            <button
              className="rg-button"
              onClick={() => {
                setQuery("");
                setEvidence("");
              }}
            >
              Clear
            </button>
          )}
          {repositoryId && (
            <div className="rg-toggle" aria-label="Module visibility">
              <button
                aria-pressed={!connectedOnly}
                onClick={() => setConnectedOnly(false)}
              >
                All modules <span>{moduleCount}</span>
              </button>
              <button
                aria-pressed={connectedOnly}
                onClick={() => setConnectedOnly(true)}
              >
                Connected <span>{connectedCount}</span>
              </button>
            </div>
          )}
        </div>
        <div className="rg-stats">
          <span>
            <strong>
              {repositoryId
                ? scene.nodes.filter((node) => node.kind === "module").length
                : filtered.repositories.length}
            </strong>{" "}
            {repositoryId ? "modules shown" : "repositories"}
          </span>
          <span>
            <strong>{repositoryId ? internalCount : moduleCount}</strong>{" "}
            {repositoryId ? "internal API relationships" : "indexed modules"}
          </span>
          <span>
            <strong>
              {repositoryId
                ? scene.edges.filter(
                    (edge) =>
                      edge.source.startsWith("repository:") ||
                      edge.target.startsWith("repository:"),
                  ).length
                : filtered.aggregates.length}
            </strong>{" "}
            {repositoryId ? "boundary connections" : "repository connections"}
          </span>
          <span className="rg-count-note">
            {scene.hiddenModuleCount
              ? `${scene.hiddenModuleCount} unconnected modules in inventory`
              : "Arrows follow dependency direction"}
          </span>
        </div>
        {!loading && scene.nodes.length > 0 && !scene.edges.length && (
          <div className="rg-notice" role="status">
            <span aria-hidden="true">ⓘ</span>
            {query || evidence
              ? "No relationships match the current filters."
              : repositoryId
                ? "No dependency edges found in this view. Modules are still shown."
                : "No cross-repository dependencies found in this snapshot. Open a repository to explore its modules."}
          </div>
        )}
        {repositoryId && !repository ? (
          <div className="rg-empty">
            <h3>Repository unavailable in this scope</h3>
            <p>
              It may have been removed or belong to another repository group.
            </p>
            <button className="rg-button" onClick={() => openRepository(null)}>
              Back to repositories
            </button>
          </div>
        ) : (
          <div className="rg-body">
            <div className="rg-canvas" data-graph-canvas aria-busy={loading}>
              <ReactFlow<FlowNode>
                key={viewKey}
                nodes={nodes.map((node) => ({
                  ...node,
                  selected:
                    selection?.kind === "module" && selection.id === node.id,
                }))}
                edges={edges}
                nodeTypes={nodeTypes}
                onInit={setFlow}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesReconnectable={false}
                deleteKeyCode={null}
                minZoom={0.08}
                maxZoom={1.8}
                colorMode={colorMode}
                onNodeClick={(_, node) =>
                  node.data.kind === "repository"
                    ? openRepository(node.data.entityId)
                    : setSelection({ kind: "module", id: node.id })
                }
                onEdgeClick={(_, edge) =>
                  setSelection({ kind: "edge", id: edge.id })
                }
                onPaneClick={() => setSelection(null)}
                onMoveEnd={(event, viewport) => {
                  if (event) viewports.current.set(viewKey, viewport);
                }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={22}
                  size={1.1}
                />
                <Controls
                  showInteractive={false}
                  fitViewOptions={{ padding: 0.15, minZoom: 0.08, maxZoom: 1 }}
                />
                <MiniMap
                  pannable
                  zoomable
                  nodeBorderRadius={7}
                  nodeColor={(node) =>
                    node.data.kind === "repository" ? "#8796d9" : "#71b7b0"
                  }
                />
                {layout?.key === sceneKey && (
                  <ViewportRestore
                    layoutId={layout.key}
                    saved={viewports.current.get(viewKey)}
                    onReady={onViewportReady}
                  />
                )}
              </ReactFlow>
              {loading && (
                <div className="rg-canvas-message" role="status">
                  Arranging graph…
                </div>
              )}
              {layoutError && (
                <div className="rg-empty rg-canvas-message" role="alert">
                  <p>The layout could not be arranged.</p>
                  <button
                    className="rg-button"
                    onClick={() => setRevision((value) => value + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {!loading && !layoutError && !scene.nodes.length && (
                <div className="rg-empty rg-canvas-message">
                  <h3>
                    {repository && !moduleCount
                      ? "No modules indexed yet"
                      : snapshot.repositories.length
                        ? "No matching nodes"
                        : "Connect your repositories"}
                  </h3>
                  <p>
                    {repository && !moduleCount
                      ? "Review repository indexing and coverage to see what could be discovered."
                      : snapshot.repositories.length
                        ? "Change the search, evidence, or module visibility filter."
                        : "Select GitHub repositories to build your dependency map."}
                  </p>
                  {!snapshot.repositories.length && (
                    <a className="rg-button" href="/onboarding">
                      Connect GitHub
                    </a>
                  )}
                </div>
              )}
            </div>
            <Inspector
              model={filtered}
              snapshot={snapshot}
              scene={scene}
              repositoryId={repositoryId}
              selection={selection}
              onSelectModule={selectModule}
              onOpenRepository={openRepository}
              onClose={() => setSelection(null)}
            />
          </div>
        )}
        <div className="rg-footer">
          <span>
            <i className="rg-legend-repository" />
            Repository <i className="rg-legend-module" />
            Module <i className="rg-legend-edge" />
            Dependency
          </span>
          <span>Drag to pan · Scroll to zoom · Select to inspect</span>
        </div>
      </section>
      {model.warnings.length > 0 && (
        <p className="rg-description">
          Some indexed relationships could not be mapped. Review repository
          coverage for details.
        </p>
      )}
    </div>
  );
}

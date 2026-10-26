import type { WorkspaceSnapshot } from "../../types/workspace";
import type { GraphModule, RepositoryGraphModel } from "../dependency-graph";
import type { GraphScene, SceneEdge } from "./project";

export type GraphSelection = { kind: "module" | "edge"; id: string } | null;

interface InspectorProps {
  model: RepositoryGraphModel;
  snapshot: WorkspaceSnapshot;
  scene: GraphScene;
  repositoryId: string | null;
  selection: GraphSelection;
  onSelectModule: (module: GraphModule) => void;
  onOpenRepository: (id: string) => void;
  onClose: () => void;
}

function ApiLink({
  id,
  method,
  path,
}: {
  id: string;
  method: string;
  path: string;
}) {
  return (
    <a
      className="rg-api-link"
      href={`/dashboard/api-usage?endpointId=${encodeURIComponent(id)}&tab=flow`}
    >
      <span>{method}</span>
      <code>{path}</code>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function EdgeDetails({
  edge,
  model,
}: {
  edge: SceneEdge;
  model: RepositoryGraphModel;
}) {
  const ids = new Set(edge.relationIds);
  const relations = model.relations.filter((relation) => ids.has(relation.id));
  return (
    <>
      <h3>Dependency evidence</h3>
      <p className="rg-description">
        {edge.moduleDependencyCount} module{" "}
        {edge.moduleDependencyCount === 1 ? "dependency" : "dependencies"} ·{" "}
        {edge.relationshipCount} API relationships
      </p>
      <div className="rg-evidence-list">
        {relations.map((relation) => (
          <article key={relation.id}>
            <ApiLink
              id={relation.endpoint.id}
              method={relation.endpoint.method}
              path={relation.endpoint.path}
            />
            <p>
              {
                model.modules.find(
                  (module) => module.id === relation.sourceModuleId,
                )?.name
              }{" "}
              <span aria-hidden="true">→</span>{" "}
              {
                model.modules.find(
                  (module) => module.id === relation.targetModuleId,
                )?.name
              }
            </p>
            <span className="rg-tag">
              {relation.edge.evidence === "both"
                ? "Static + runtime"
                : relation.edge.evidence}{" "}
              evidence
            </span>
            <span className="rg-tag">
              {relation.edge.confidence} confidence
            </span>
            {relation.edge.runtimeCorrelation === "service_route" && (
              <p>
                Runtime evidence identifies the service and route; it does not
                identify a particular call site.
              </p>
            )}
            {relation.edge.references.map(
              (reference, index) =>
                /^https:\/\//.test(reference.url) && (
                  <a
                    key={`${reference.url}:${index}`}
                    className="rg-source-link"
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>
                      {reference.filePath}:{reference.line}
                    </code>{" "}
                    ↗
                  </a>
                ),
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export function Inspector({
  model,
  snapshot,
  scene,
  repositoryId,
  selection,
  onSelectModule,
  onOpenRepository,
  onClose,
}: InspectorProps) {
  const module =
    selection?.kind === "module"
      ? model.modules.find((item) => item.id === selection.id)
      : null;
  const edge =
    selection?.kind === "edge"
      ? scene.edges.find((item) => item.id === selection.id)
      : null;
  const repository = model.repositories.find(
    (item) => item.id === repositoryId,
  );
  const modules = model.modules.filter(
    (item) => item.repositoryId === repositoryId,
  );
  const endpoints = module
    ? snapshot.endpoints.filter(
        (endpoint) => endpoint.serviceId === module.legacyServiceId,
      )
    : [];
  return (
    <aside
      className="rg-inspector"
      aria-label="Graph details"
      data-graph-inspector
    >
      <div className="rg-inspector-heading">
        <span className="rg-eyebrow">
          {selection
            ? "DETAILS"
            : repositoryId
              ? "MODULE INVENTORY"
              : "REPOSITORY INVENTORY"}
        </span>
        {selection && (
          <button
            className="rg-icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        )}
      </div>
      <div className="rg-inspector-content">
        {edge ? (
          <EdgeDetails edge={edge} model={model} />
        ) : module ? (
          <>
            <h3>{module.name}</h3>
            <code className="rg-module-path">{module.path}</code>
            <p className="rg-description">
              {module.endpointCount} defined APIs · {module.relationCount}{" "}
              indexed relationships
            </p>
            <h4>Defined APIs</h4>
            {endpoints.length ? (
              endpoints.map((endpoint) => (
                <ApiLink
                  key={endpoint.id}
                  id={endpoint.id}
                  method={endpoint.method}
                  path={endpoint.path}
                />
              ))
            ) : (
              <p className="rg-description">
                No API endpoints were discovered in this module.
              </p>
            )}
            <p className="rg-description">
              Select a connecting arrow to inspect callers and source evidence.
            </p>
          </>
        ) : repositoryId ? (
          <>
            <h3>{repository?.fullName.split("/").at(-1)}</h3>
            <p className="rg-description">
              {modules.length} modules. Select a module to see its APIs.
            </p>
            <a className="rg-source-link" href="/dashboard/repositories">
              Review indexing coverage ↗
            </a>
            <div className="rg-inventory">
              {modules.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item)}
                  aria-label={`Inspect module ${item.name}`}
                >
                  <span className="rg-inventory-icon" aria-hidden="true">
                    ▦
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.path}</small>
                  </span>
                  <span className="rg-inventory-count">
                    {item.endpointCount} APIs
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>Your repositories</h3>
            <p className="rg-description">
              Open a repository to explore its modules and dependencies.
            </p>
            <div className="rg-inventory">
              {model.repositories.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenRepository(item.id)}
                  aria-label={`Open repository ${item.fullName}`}
                >
                  <span className="rg-inventory-icon" aria-hidden="true">
                    ⌘
                  </span>
                  <span>
                    <strong>{item.fullName.split("/").at(-1)}</strong>
                    <small>{item.fullName.split("/")[0]}</small>
                  </span>
                  <span className="rg-inventory-count">
                    {
                      model.modules.filter(
                        (itemModule) => itemModule.repositoryId === item.id,
                      ).length
                    }{" "}
                    modules
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="rg-inspector-footer">
        <span className="rg-status-dot" />
        Indexed snapshot
        <span>
          {snapshot.repositories.some((item) => item.status === "partial")
            ? "Partial coverage"
            : "Source evidence"}
        </span>
      </div>
    </aside>
  );
}

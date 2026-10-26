import type { RepositoryGraphModel } from "../dependency-graph";

export interface SceneNode {
  id: string;
  kind: "repository" | "module";
  entityId: string;
  title: string;
  subtitle: string;
  detail: string;
  status: string;
  boundary: boolean;
}

export interface SceneEdge {
  id: string;
  source: string;
  target: string;
  relationIds: string[];
  moduleDependencyCount: number;
  relationshipCount: number;
}

export interface GraphScene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  hiddenModuleCount: number;
}

export const repositoryNodeId = (id: string) => `repository:${id}`;

/** Map persisted relationships to the visible scope, exactly once per relationship. */
export function projectGraph(
  model: RepositoryGraphModel,
  repositoryId: string | null,
  connectedOnly = false,
): GraphScene {
  const nodes: SceneNode[] = [];
  const moduleById = new Map(
    model.modules.map((module) => [module.id, module]),
  );
  const repositoryById = new Map(
    model.repositories.map((repository) => [repository.id, repository]),
  );
  const moduleCounts = new Map<string, number>();
  for (const module of model.modules)
    moduleCounts.set(
      module.repositoryId,
      (moduleCounts.get(module.repositoryId) ?? 0) + 1,
    );
  const repositoryNode = (id: string, boundary = false): SceneNode => {
    const repository = repositoryById.get(id)!;
    return {
      id: repositoryNodeId(id),
      kind: "repository",
      entityId: id,
      title: repository.fullName.split("/").at(-1) ?? repository.fullName,
      subtitle: repository.fullName,
      detail: `${moduleCounts.get(id) ?? 0} modules`,
      status: repository.status,
      boundary,
    };
  };

  if (!repositoryId) {
    return {
      nodes: model.repositories.map((repository) =>
        repositoryNode(repository.id),
      ),
      edges: model.aggregates.map((aggregate) => ({
        id: JSON.stringify([
          aggregate.sourceRepositoryId,
          aggregate.targetRepositoryId,
        ]),
        source: repositoryNodeId(aggregate.sourceRepositoryId),
        target: repositoryNodeId(aggregate.targetRepositoryId),
        relationIds: aggregate.relationIds,
        moduleDependencyCount: aggregate.modulePairKeys.length,
        relationshipCount: aggregate.apiRelationshipCount,
      })),
      hiddenModuleCount: 0,
    };
  }

  const scopedRelations = model.relations.filter(
    (relation) =>
      relation.sourceRepositoryId === repositoryId ||
      relation.targetRepositoryId === repositoryId,
  );
  const connectedIds = new Set(
    scopedRelations.flatMap((relation) => [
      relation.sourceModuleId,
      relation.targetModuleId,
    ]),
  );
  const scopedModules = model.modules.filter(
    (module) => module.repositoryId === repositoryId,
  );
  const visibleModules = scopedModules.filter(
    (module) => !connectedOnly || connectedIds.has(module.id),
  );
  for (const module of visibleModules) {
    nodes.push({
      id: module.id,
      kind: "module",
      entityId: module.id,
      title: module.name,
      subtitle: module.path,
      detail: `${module.endpointCount} APIs`,
      status: module.relationCount
        ? `${module.relationCount} relationships`
        : "No relationships found",
      boundary: false,
    });
  }

  const visibleIds = new Set(nodes.map((node) => node.id));
  const edgeMap = new Map<string, SceneEdge & { modulePairs: Set<string> }>();
  for (const relation of scopedRelations) {
    const sourceModule = moduleById.get(relation.sourceModuleId);
    const targetModule = moduleById.get(relation.targetModuleId);
    if (!sourceModule || !targetModule) continue;
    const source =
      relation.sourceRepositoryId === repositoryId
        ? relation.sourceModuleId
        : repositoryNodeId(relation.sourceRepositoryId);
    const target =
      relation.targetRepositoryId === repositoryId
        ? relation.targetModuleId
        : repositoryNodeId(relation.targetRepositoryId);
    for (const module of [sourceModule, targetModule]) {
      if (
        module.repositoryId !== repositoryId &&
        !visibleIds.has(repositoryNodeId(module.repositoryId))
      ) {
        nodes.push(repositoryNode(module.repositoryId, true));
        visibleIds.add(repositoryNodeId(module.repositoryId));
      }
    }
    if (!visibleIds.has(source) || !visibleIds.has(target)) continue;
    const key = JSON.stringify([source, target]);
    const edge = edgeMap.get(key) ?? {
      id: key,
      source,
      target,
      relationIds: [],
      relationshipCount: 0,
      moduleDependencyCount: 0,
      modulePairs: new Set<string>(),
    };
    edge.relationIds.push(relation.id);
    edge.modulePairs.add(
      JSON.stringify([relation.sourceModuleId, relation.targetModuleId]),
    );
    edge.moduleDependencyCount = edge.modulePairs.size;
    edge.relationshipCount = edge.relationIds.length;
    edgeMap.set(key, edge);
  }
  return {
    nodes,
    edges: [...edgeMap.values()].map(
      ({ modulePairs: _pairs, ...edge }) => edge,
    ),
    hiddenModuleCount: scopedModules.length - visibleModules.length,
  };
}

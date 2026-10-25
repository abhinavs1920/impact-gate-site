import type {
  WorkspaceEdge,
  WorkspaceEndpoint,
  WorkspaceRepository,
  WorkspaceService,
  WorkspaceSnapshot,
} from "../types/workspace";

export interface GraphModule {
  id: string;
  repositoryId: string;
  name: string;
  path: string;
  legacyServiceId: string;
  endpointCount: number;
  relationCount: number;
  provisional: boolean;
}

export interface GraphRelation {
  id: string;
  sourceModuleId: string;
  targetModuleId: string;
  sourceRepositoryId: string;
  targetRepositoryId: string;
  endpointId: string;
  edge: WorkspaceEdge;
  endpoint: WorkspaceEndpoint;
}

export interface RepositoryAggregate {
  sourceRepositoryId: string;
  targetRepositoryId: string;
  relationIds: string[];
  modulePairKeys: string[];
  apiRelationshipCount: number;
  evidence: Array<WorkspaceEdge["evidence"]>;
}

export interface RepositoryGraphModel {
  repositories: WorkspaceRepository[];
  modules: GraphModule[];
  relations: GraphRelation[];
  aggregates: RepositoryAggregate[];
  warnings: string[];
}

const modulePath = (service: WorkspaceService): string => service.rootPath || "/";

/** Adapts the current service payload into provisional repository-owned modules. */
export function buildRepositoryGraph(snapshot: WorkspaceSnapshot): RepositoryGraphModel {
  const repositoryIds = new Set(snapshot.repositories.map((repository) => repository.id));
  const services = new Map(snapshot.services.map((service) => [service.id, service]));
  const endpoints = new Map(snapshot.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const canonicalByService = new Map(
    (snapshot.modules ?? [])
      .filter((module) => module.legacyServiceId)
      .map((module) => [module.legacyServiceId!, module]),
  );
  const endpointCounts = new Map<string, number>();
  for (const endpoint of snapshot.endpoints)
    endpointCounts.set(endpoint.serviceId, (endpointCounts.get(endpoint.serviceId) ?? 0) + 1);
  const relationCounts = new Map<string, number>();
  const relations: GraphRelation[] = [];
  const warnings: string[] = [];

  for (const edge of snapshot.edges) {
    const source = services.get(edge.callerServiceId);
    const endpoint = endpoints.get(edge.endpointId);
    const target = endpoint ? services.get(endpoint.serviceId) : undefined;
    if (!source || !target || !endpoint) {
      warnings.push(`Ignored unresolved relationship ${edge.id}.`);
      continue;
    }
    if (!repositoryIds.has(source.repositoryId) || !repositoryIds.has(target.repositoryId)) {
      warnings.push(`Ignored relationship ${edge.id} outside the selected repository scope.`);
      continue;
    }
    const sourceModuleId = canonicalByService.get(source.id)?.id ?? `legacy-module:${source.id}`;
    const targetModuleId = canonicalByService.get(target.id)?.id ?? `legacy-module:${target.id}`;
    relationCounts.set(sourceModuleId, (relationCounts.get(sourceModuleId) ?? 0) + 1);
    relationCounts.set(targetModuleId, (relationCounts.get(targetModuleId) ?? 0) + 1);
    relations.push({
      id: edge.id,
      sourceModuleId,
      targetModuleId,
      sourceRepositoryId: source.repositoryId,
      targetRepositoryId: target.repositoryId,
      endpointId: endpoint.id,
      edge,
      endpoint,
    });
  }

  const modules = (snapshot.modules?.filter((module) => repositoryIds.has(module.repositoryId)).map((module) => ({
    id: module.id,
    repositoryId: module.repositoryId,
    name: module.name,
    path: module.path || "/",
    legacyServiceId: module.legacyServiceId ?? "",
    endpointCount: module.legacyServiceId ? endpointCounts.get(module.legacyServiceId) ?? 0 : 0,
    relationCount: relationCounts.get(module.id) ?? 0,
    provisional: false,
  })) ?? []).concat(
    snapshot.services
      .filter((service) => repositoryIds.has(service.repositoryId) && !canonicalByService.has(service.id))
      .map((service) => ({
        id: `legacy-module:${service.id}`,
        repositoryId: service.repositoryId,
        name: service.name,
        path: modulePath(service),
        legacyServiceId: service.id,
        endpointCount: endpointCounts.get(service.id) ?? 0,
        relationCount: relationCounts.get(`legacy-module:${service.id}`) ?? 0,
        provisional: true,
      })),
  );

  const aggregateMap = new Map<string, RepositoryAggregate>();
  for (const relation of relations) {
    if (relation.sourceRepositoryId === relation.targetRepositoryId) continue;
    const key = `${relation.sourceRepositoryId}\0${relation.targetRepositoryId}`;
    const modulePairKey = `${relation.sourceModuleId}\0${relation.targetModuleId}`;
    const aggregate = aggregateMap.get(key) ?? {
      sourceRepositoryId: relation.sourceRepositoryId,
      targetRepositoryId: relation.targetRepositoryId,
      relationIds: [],
      modulePairKeys: [],
      apiRelationshipCount: 0,
      evidence: [],
    };
    aggregate.relationIds.push(relation.id);
    if (!aggregate.modulePairKeys.includes(modulePairKey)) aggregate.modulePairKeys.push(modulePairKey);
    aggregate.apiRelationshipCount++;
    if (!aggregate.evidence.includes(relation.edge.evidence)) aggregate.evidence.push(relation.edge.evidence);
    aggregateMap.set(key, aggregate);
  }

  return {
    repositories: snapshot.repositories,
    modules,
    relations,
    aggregates: [...aggregateMap.values()],
    warnings,
  };
}

export function repositoryModuleCount(model: RepositoryGraphModel, repositoryId: string): number {
  return model.modules.filter((module) => module.repositoryId === repositoryId).length;
}

export function filteredRepositoryGraph(
  model: RepositoryGraphModel,
  query: string,
  evidence: string,
): RepositoryGraphModel {
  const normalized = query.trim().toLowerCase();
  const relationAllowed = (relation: GraphRelation) =>
    !evidence ||
    relation.edge.evidence === evidence ||
    (evidence === "static" && relation.edge.evidence === "both") ||
    (evidence === "runtime" && relation.edge.evidence === "both");
  const matchingModules = new Set(
    model.modules
      .filter((module) => !normalized || `${module.name} ${module.path}`.toLowerCase().includes(normalized))
      .map((module) => module.id),
  );
  const relations = model.relations.filter(
    (relation) =>
      relationAllowed(relation) &&
      (!normalized ||
        matchingModules.has(relation.sourceModuleId) ||
        matchingModules.has(relation.targetModuleId) ||
        model.repositories.some(
          (repository) =>
            repository.fullName.toLowerCase().includes(normalized) &&
            (repository.id === relation.sourceRepositoryId || repository.id === relation.targetRepositoryId),
        )),
  );
  const repositoryIds = new Set(
    model.repositories
      .filter((repository) => !normalized || repository.fullName.toLowerCase().includes(normalized))
      .map((repository) => repository.id),
  );
  const visibleRepositoryIds = normalized
    ? new Set([...repositoryIds, ...relations.flatMap((relation) => [relation.sourceRepositoryId, relation.targetRepositoryId])])
    : new Set(model.repositories.map((repository) => repository.id));
  const visibleRelationIds = new Set(relations.map((relation) => relation.id));
  const aggregates = model.aggregates
    .map((aggregate) => {
      const relationIds = aggregate.relationIds.filter((id) => visibleRelationIds.has(id));
      const selectedRelations = relations.filter((relation) => relationIds.includes(relation.id));
      return {
        ...aggregate,
        relationIds,
        modulePairKeys: [...new Set(selectedRelations.map((relation) => `${relation.sourceModuleId}\0${relation.targetModuleId}`))],
        apiRelationshipCount: selectedRelations.length,
        evidence: [...new Set(selectedRelations.map((relation) => relation.edge.evidence))],
      };
    })
    .filter(
      (aggregate) =>
        aggregate.relationIds.length > 0 &&
        visibleRepositoryIds.has(aggregate.sourceRepositoryId) &&
        visibleRepositoryIds.has(aggregate.targetRepositoryId),
    );
  return {
    ...model,
    repositories: model.repositories.filter((repository) => visibleRepositoryIds.has(repository.id)),
    modules: model.modules.filter((module) => visibleRepositoryIds.has(module.repositoryId)),
    relations,
    aggregates,
  };
}

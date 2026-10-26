export function graphSnapshot(moduleCount = 36, connectedCount = 0) {
  const repository = (id, name) => ({
    id,
    githubRepositoryId: id === "r1" ? 1 : id === "r2" ? 2 : 3,
    fullName: `acme/${name}`,
    defaultBranch: "main",
    status: "indexed",
    indexedSha: "a".repeat(40),
    indexedAt: "2026-10-25T00:00:00Z",
    serviceCount: id === "r1" ? moduleCount : id === "r2" ? 1 : 0,
    error: null,
    coverage: {
      supportedFiles: 100,
      skippedFiles: 0,
      openApiDocuments: 1,
      notes: [],
    },
  });
  const services = Array.from({ length: moduleCount }, (_, index) => ({
    id: `m${index}`,
    repositoryId: "r1",
    name: `module-${String(index + 1).padStart(3, "0")}`,
    rootPath: `packages/module-${String(index + 1).padStart(3, "0")}`,
    criticality: "medium",
    nameSource: "package.json",
  }));
  services.push({
    id: "consumer",
    repositoryId: "r2",
    name: "web-client",
    rootPath: "",
    criticality: "medium",
    nameSource: "package.json",
  });
  const endpoints = services.map((service, index) => ({
    id: `e${index}`,
    serviceId: service.id,
    method: "GET",
    path: `/api/items/${index}`,
    summary: null,
    criticality: "medium",
    evidence: "static",
    confidence: "high",
    staticCallerCount: 0,
    runtimeCallerCount: null,
    lastObservedAt: null,
    runtimeCoverage: "not_connected",
    source: {
      repositoryId: service.repositoryId,
      filePath: `${service.rootPath || "src"}/index.ts`,
      line: 10,
      sha: "a".repeat(40),
      url: `https://github.com/acme/platform/blob/${"a".repeat(40)}/src/index.ts#L10`,
    },
    requestSchema: null,
    responseSchema: null,
  }));
  const edges = [];
  const edge = (caller, endpointId, evidence = "static") => ({
    id: `edge-${edges.length}`,
    callerServiceId: caller,
    endpointId,
    evidence,
    confidence: "medium",
    references: [endpoints[0].source],
    callsInWindow: null,
    lastObservedAt: null,
  });
  for (
    let index = 0;
    index < Math.min(moduleCount, connectedCount) - 1;
    index++
  )
    edges.push(
      edge(
        `m${index}`,
        `e${index + 1}`,
        ["static", "runtime", "both"][index % 3],
      ),
    );
  if (connectedCount > 1) {
    edges.push(edge("consumer", "e0", "both"));
    edges.push(edge("m0", `e${moduleCount}`));
    edges.push(edge(`m${connectedCount - 1}`, "e0"));
    endpoints.push({
      ...endpoints[1],
      id: "e-extra",
      method: "POST",
      path: "/api/items",
    });
    edges.push(edge("m0", "e-extra"));
  }
  return {
    version: 1,
    workspaceId: "workspace",
    snapshotId: `fixture-${moduleCount}-${connectedCount}`,
    generatedAt: "2026-10-25T00:00:00Z",
    repositories: [
      repository("r1", "platform"),
      repository("r2", "web-client"),
      repository("r3", "empty-repo"),
    ],
    services,
    endpoints,
    edges,
    findings: [],
    candidates: [],
    jobs: [],
    settings: {
      version: 1,
      analysisMode: "deterministic",
      externalModelsEnabled: false,
      aiSummaryEnabled: false,
      syncDefaultBranch: true,
      prCommentsEnabled: true,
      retentionDays: 90,
      runtimeCoverage: "not_connected",
      criticalityRules: {},
    },
  };
}

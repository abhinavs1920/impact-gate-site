/** Versioned wire contracts for the authenticated customer workspace. */
import type { WorkspaceCodeSnapshot } from "./code";
import type { RuntimeConnection, RuntimeProvider } from "./runtime";
export type WorkspaceRole = "owner" | "admin" | "viewer";
export type IndexStatus =
  "selected" | "queued" | "discovering" | "indexing" | "indexed" | "partial" | "failed" | "removed";
export type RuntimeCoverage = "not_connected" | "not_observed" | "available";
export type EvidenceSource = "static" | "runtime" | "both";
export type RetirementEvidenceState =
  | "needs_runtime_coverage"
  | "static_callers_found"
  | "measured_usage_observed"
  | "no_known_caller_selected_repositories"
  | "unknown_external_usage";
export type RetirementReviewState =
  "not_reviewed" | "reviewed_current_snapshot" | "reviewed_previous_snapshot";

export interface WorkspaceIdentity {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
}
export interface WorkspaceMembership {
  id: string;
  name: string;
  role: WorkspaceRole;
  installationId: number;
  accountLogin: string;
  installationStatus: "active" | "suspended" | "deleted";
}
export interface SessionResponse {
  version: 1;
  user: WorkspaceIdentity;
  workspaces: WorkspaceMembership[];
  capabilities: { externalModels: boolean; runtimeTelemetry: boolean };
}
export interface InstallationRepository {
  githubRepositoryId: number;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  language: string | null;
  htmlUrl: string;
  selected: boolean;
}
export interface WorkspaceRepository {
  id: string;
  githubRepositoryId: number;
  fullName: string;
  defaultBranch: string;
  status: IndexStatus;
  indexedSha: string | null;
  indexedAt: string | null;
  serviceCount: number;
  error: string | null;
  coverage: {
    supportedFiles: number;
    skippedFiles: number;
    openApiDocuments: number;
    notes: string[];
  };
}
export interface WorkspaceService {
  id: string;
  repositoryId: string;
  name: string;
  rootPath: string;
  criticality: "high" | "medium" | "low";
  nameSource: string;
}
export interface SourceReference {
  repositoryId: string;
  filePath: string;
  line: number;
  column?: number;
  functionName?: string;
  sha: string;
  url: string;
}
export interface WorkspaceEndpoint {
  id: string;
  serviceId: string;
  method: string;
  path: string;
  summary: string | null;
  criticality: "high" | "medium" | "low";
  evidence: EvidenceSource | null;
  confidence: "high" | "medium" | "low" | null;
  staticCallerCount: number;
  runtimeCallerCount: number | null;
  lastObservedAt: string | null;
  runtimeCoverage: RuntimeCoverage;
  runtimeCallsInWindow?: number | null;
  runtimeRequestSource?: RuntimeProvider | null;
  runtimeWindowStart?: string | null;
  runtimeWindowEnd?: string | null;
  runtimePartial?: boolean;
  measuredFunctionEntriesInWindow?: number | null;
  measuredFunctionEntriesSource?: RuntimeProvider | null;
  measuredFunctionWindowStart?: string | null;
  measuredFunctionWindowEnd?: string | null;
  releaseId?: string | null;
  releaseSourceSha?: string | null;
  instrumentationCoverage?: "measured" | "partial" | "not_instrumented" | "unknown";
  source: SourceReference;
  requestSchema: unknown | null;
  responseSchema: unknown | null;
  serverOrigins?: string[];
  definitionSource?: "contract" | "code" | "both";
  implementationSources?: SourceReference[];
}
export interface WorkspaceEdge {
  id: string;
  callerServiceId: string;
  endpointId: string;
  evidence: EvidenceSource;
  confidence: "high" | "medium" | "low";
  references: SourceReference[];
  callsInWindow: number | null;
  lastObservedAt: string | null;
  runtimeCorrelation?: "service_route" | "call_site";
}

export interface KubernetesClusterConfig {
  clusterId: string;
  displayName: string;
  environment: string;
  namespaces: string[];
  status?: "connected" | "error";
  lastInventoryAt?: string | null;
  lastError?: string | null;
}
export interface KubernetesWorkloadIdentity {
  clusterId: string;
  clusterName: string;
  environment: string;
  namespace: string;
  kind: "Deployment" | "StatefulSet" | "DaemonSet";
  name: string;
  uid: string;
  observedAt: string;
  images: Array<{ name: string; image: string; digest: string | null }>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  serviceNames: string[];
  confidence: "confirmed" | "probable" | "ambiguous" | "unmapped";
  evidence: string[];
  stale: boolean;
}
export interface WorkspaceDeploymentIdentity {
  clusters: KubernetesClusterConfig[];
  workloads: KubernetesWorkloadIdentity[];
  artifacts: Array<{
    id: string;
    repositoryId: string;
    githubRepositoryId: number;
    commitSha: string;
    imageDigest: string;
    componentPath: string | null;
    artifactReference: string | null;
    evidenceSource: "operator" | "oci_annotations" | "ci_attestation";
    observedAt: string;
    confidence: "confirmed" | "probable";
  }>;
  links: Array<{
    repositoryId: string;
    clusterId: string;
    namespace: string;
    workloadKind: KubernetesWorkloadIdentity["kind"];
    workloadName: string;
    componentPath: string | null;
    confidence: "confirmed" | "probable" | "ambiguous";
    evidence: string[];
    updatedAt: string;
  }>;
  matches: Array<{
    workloadKey: string;
    repositoryIds: string[];
    confidence: "confirmed" | "probable" | "ambiguous" | "unmapped";
    evidence: string[];
  }>;
  telemetryMatches: Array<{
    provider: "prometheus" | "datadog";
    telemetryService: string;
    serviceId: string;
    repositoryId: string;
    workloadKey: string;
    confidence: "confirmed" | "probable" | "ambiguous" | "stale";
    evidence: string[];
  }>;
}
export interface WorkspaceFinding {
  id: string;
  analysisId: string;
  repositoryId: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
  headSha: string;
  endpointId: string | null;
  endpoint: string;
  consumerServiceId: string | null;
  consumerName: string;
  consumerEndpointIds?: string[];
  changeKind: string;
  verdict: string;
  risk: "high" | "medium" | "low" | "none";
  evidence: SourceReference[];
  explanation: string;
  createdAt: string;
  status: "open" | "closed";
}
export interface WorkspaceCandidate {
  endpointId: string;
  status: "flagged" | "building_confidence" | "rare_caller" | "strong_candidate";
  reason: string;
  staticCallerCount: number;
  runtimeCoverage: RuntimeCoverage;
  lastObservedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedSnapshotId: string | null;
  evidenceState?: RetirementEvidenceState;
  reviewState?: RetirementReviewState;
  /** True only for complete Prometheus counter evidence explicitly showing zero over 30 days. */
  zeroCallsOver30Days?: boolean;
  nextAction?: string;
  measuredFunctionUsage?: number | null;
}
export interface WorkspaceSettings {
  version: number;
  analysisMode: "deterministic";
  externalModelsEnabled: boolean;
  aiSummaryEnabled: boolean;
  syncDefaultBranch: boolean;
  prCommentsEnabled: boolean;
  retentionDays: number;
  runtimeCoverage: RuntimeCoverage;
  criticalityRules: Record<string, "high" | "medium" | "low">;
}
export interface WorkspaceJob {
  id: string;
  type: "index_repository" | "analyze_pull_request";
  repositoryId: string;
  status: "queued" | "running" | "completed" | "failed" | "superseded";
  phase: string;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
/** A named grouping of selected repositories inside one workspace. */
export interface WorkspaceRepositoryGroup {
  id: string;
  name: string;
  repositoryIds: string[];
  createdAt: string;
}
export interface WorkspaceCollectionPage {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface WorkspaceSnapshot {
  version: 1;
  workspaceId: string;
  snapshotId: string | null;
  generatedAt: string;
  repositories: WorkspaceRepository[];
  groups?: WorkspaceRepositoryGroup[];
  activeGroupId?: string | null;
  services: WorkspaceService[];
  endpoints: WorkspaceEndpoint[];
  edges: WorkspaceEdge[];
  findings: WorkspaceFinding[];
  candidates: WorkspaceCandidate[];
  jobs: WorkspaceJob[];
  settings: WorkspaceSettings;
  code?: WorkspaceCodeSnapshot;
  runtimeConnections?: RuntimeConnection[];
  deploymentIdentity?: WorkspaceDeploymentIdentity;
  indexCoverage?: { missingCodeRepositoryIds: string[]; missingCallSiteRepositoryIds: string[] };
  pagination?: {
    endpoints?: WorkspaceCollectionPage;
    findings?: WorkspaceCollectionPage;
    candidates?: WorkspaceCollectionPage;
  };
}

export type WorkspaceOnboardingStage =
  | "connect_github"
  | "choose_api"
  | "build_map"
  | "first_value"
  | "runtime_enhancement"
  | "complete";
export interface WorkspaceOnboardingStatus {
  version: 1;
  workspaceId: string;
  stage: WorkspaceOnboardingStage;
  providerRepositories: Array<{ id: number; fullName: string; selected: boolean }>;
  recommendedConsumerRepositories: Array<{ id: number; fullName: string; selected: boolean }>;
  firstValue: {
    ready: boolean;
    apiCount: number;
    flowCount: number;
    staticCallerCount: number;
    unresolvedBoundaryCount: number;
  };
  runtime: { connected: boolean; functionMetricsDetected: boolean };
  deployment: { platform: string; confidence: string };
  nextAction: string;
}
export interface WorkspaceDeployment {
  id: string;
  platform: "unknown" | "kubernetes" | "gke" | "ecs" | "cloud_run";
  confidence: "unknown" | "low" | "medium" | "high";
  source: "not_detected" | "repository_metadata" | "deployment_metadata";
  releaseId: string | null;
  sourceSha: string | null;
  discoveredAt: string;
  notes: string[];
}
export interface WorkspaceInstrumentationStatus {
  version: 1;
  detected: boolean;
  enrolledServiceIds: string[];
  measuredFunctionEntries: number;
  supportedServices: string[];
  nextAction: string;
}
/** Queue only identifiers and immutable event refs, never ports, Maps, code or credentials. */
export interface IndexRepositoryJob {
  version: 1;
  type: "index_repository";
  jobId: string;
  workspaceId: string;
  repositoryId: string;
  installationId: number;
  githubRepositoryId: number;
  expectedSha?: string;
}
export interface PullRequestJob {
  version: 1;
  type: "analyze_pull_request";
  jobId: string;
  workspaceId: string;
  repositoryId: string;
  installationId: number;
  githubRepositoryId: number;
  pullRequestNumber: number;
  headSha: string;
  baseSha: string;
  deliveryId: string;
}
export type WorkspaceQueueJob = IndexRepositoryJob | PullRequestJob;
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  version: 1,
  analysisMode: "deterministic",
  externalModelsEnabled: false,
  aiSummaryEnabled: false,
  syncDefaultBranch: true,
  prCommentsEnabled: true,
  retentionDays: 90,
  runtimeCoverage: "not_connected",
  criticalityRules: {},
};

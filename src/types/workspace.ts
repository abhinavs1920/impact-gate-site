/** Versioned wire contracts for the authenticated customer workspace. */
import type { WorkspaceCodeSnapshot } from "./code";
import type { RuntimeConnection, RuntimeProvider } from "./runtime";
export type WorkspaceRole = "owner" | "admin" | "viewer";
export type IndexStatus = "selected" | "queued" | "discovering" | "indexing" | "indexed" | "partial" | "failed" | "removed";
export type RuntimeCoverage = "not_connected" | "not_observed" | "available";
export type EvidenceSource = "static" | "runtime" | "both";

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
  coverage: { supportedFiles: number; skippedFiles: number; openApiDocuments: number; notes: string[] };
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
  source: SourceReference;
  requestSchema: unknown | null;
  responseSchema: unknown | null;
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
}
export interface WorkspaceSettings {
  version: number;
  analysisMode: "deterministic";
  externalModelsEnabled: boolean;
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
export interface WorkspaceSnapshot {
  version: 1;
  workspaceId: string;
  snapshotId: string | null;
  generatedAt: string;
  repositories: WorkspaceRepository[];
  services: WorkspaceService[];
  endpoints: WorkspaceEndpoint[];
  edges: WorkspaceEdge[];
  findings: WorkspaceFinding[];
  candidates: WorkspaceCandidate[];
  jobs: WorkspaceJob[];
  settings: WorkspaceSettings;
  code?: WorkspaceCodeSnapshot;
  runtimeConnections?: RuntimeConnection[];
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
  syncDefaultBranch: true,
  prCommentsEnabled: true,
  retentionDays: 90,
  runtimeCoverage: "not_connected",
  criticalityRules: {},
};

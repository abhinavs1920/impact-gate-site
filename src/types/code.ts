import type { RuntimeProvider } from "./runtime.js";
import type { SourceReference } from "./workspace.js";

/** Immutable static code evidence saved with a repository's indexed commit. */
export interface IndexedCodeFunction {
  id: string;
  serviceId: string;
  name: string;
  qualifiedName: string;
  kind: "function" | "method" | "constructor" | "callback" | "module";
  language: "typescript" | "javascript" | "java";
  source: SourceReference;
  endLine: number;
  endColumn?: number;
  contentHash: string;
  hasImplementation?: boolean;
}

export interface IndexedFunctionCall {
  id: string;
  callerFunctionId: string;
  /** Null preserves external, dynamic and ambiguous calls as visible boundaries. */
  calleeFunctionId: string | null;
  /** Conservative possible targets for an ambiguous dispatch. These are may-edges. */
  candidateFunctionIds?: string[];
  targetName: string;
  source: SourceReference;
  resolution: "resolved" | "external" | "unresolved";
  modeled?: boolean;
  kind: "call" | "callback" | "constructor";
  conditional: boolean;
  repeated: boolean;
  parallel?: boolean;
}

export interface IndexedApiEntryPoint {
  serviceId: string;
  method: string;
  path: string;
  functionId: string;
  source: SourceReference;
}

export interface RepositoryCodeIndex {
  version: 1;
  functions: IndexedCodeFunction[];
  calls: IndexedFunctionCall[];
  entryPoints: IndexedApiEntryPoint[];
  partial: boolean;
  notes: string[];
  analysisVersion?: number;
  diagnostics?: Array<{
    code: string;
    stage: string;
    filePath?: string;
    line?: number;
    message: string;
  }>;
}

export interface FunctionRequestAttribution {
  endpointId: string;
  requestsInWindow: number | null;
  source: RuntimeProvider | null;
  windowStart: string | null;
  windowEnd: string | null;
  partial?: boolean;
}

export interface WorkspaceCodeFunction extends IndexedCodeFunction {
  /** API requests attributed by static reachability, never measured invocations. */
  attributedRequestsInWindow: number | null;
  countBasis: "api_requests";
  attributions: FunctionRequestAttribution[];
  /** True when an API has unknown usage or the contributing windows differ. */
  countsPartial: boolean;
  /** Actual instrumented function-entry usage, when supported runtime telemetry is connected. */
  measuredUsage?: FunctionMeasuredUsage | null;
}

export type ObservationQuality =
  "complete" | "partial" | "estimated_boundary" | "unmapped_release" | "unknown";

export interface FunctionMeasuredUsage {
  functionId: string;
  totalEntries: number;
  totalCompleted: number | null;
  totalFailures: number | null;
  byApiOperation: Array<{
    apiOperationId: string | null;
    entries: number;
    entriesPerRequest: number | null;
  }>;
  quality: ObservationQuality;
  releaseId: string;
  conditionalBranch: boolean;
  repeatedExecution: boolean;
  windowStart: string;
  windowEnd: string;
}

export interface WorkspaceOutboundCall {
  callerFunctionId: string;
  endpointId: string | null;
  method: string;
  path: string;
  source: SourceReference;
  resolution: "matched" | "unresolved" | "ambiguous";
  functionCallId?: string | null;
  targetOrigin?: string;
  matchBasis?: "server_origin" | "route_only";
  confidence?: "high" | "medium" | "low";
  consumerEndpointIds?: string[];
}
export interface WorkspaceStaticApiDependency extends WorkspaceOutboundCall {
  id: string;
  callerServiceId: string;
}

export interface ApiExecutionTreeNode {
  id: string;
  name: string;
  qualifiedName: string;
  source: SourceReference;
  kind: "entrypoint" | "function" | "external" | "modeled" | "outbound_api" | "unresolved";
  /** Possible-target children preserve uncertainty from ambiguous dispatch. */
  certainty?: "definite" | "possible";
  execution: "sequential" | "parallel";
  conditional: boolean;
  repeated: boolean;
  step: number;
  children: ApiExecutionTreeNode[];
}

export interface WorkspaceApiFlow {
  endpointId: string;
  entryFunctionIds: string[];
  callerFunctionIds: string[];
  functionIds: string[];
  callIds: string[];
  outboundCalls: WorkspaceOutboundCall[];
  inboundCalls?: WorkspaceStaticApiDependency[];
  status: "indexed" | "partial" | "entrypoint_not_found";
  notes: string[];
  executionTreeTruncated?: boolean;
  executionTreeNotes?: string[];
  executionTree?: ApiExecutionTreeNode | null;
  pathAnalysis?: WorkspaceConditionalAnalysis;
}
export interface WorkspaceFlowInputOrigin {
  entryFunctionId: string;
  parameterIndex: number;
  accessPath: string[];
}
export interface WorkspaceConditionalAnalysis {
  version: 1;
  status: "indexed" | "partial" | "unavailable";
  notes: string[];
  callConditions: Array<{
    callId: string;
    source: SourceReference;
    conditions: Array<{
      predicateId: string;
      predicate: string;
      polarity: "true" | "false" | "nullish" | "non_nullish";
      source: SourceReference;
      inputOrigins: WorkspaceFlowInputOrigin[];
    }>;
  }>;
  valuePaths: Array<{
    callId: string;
    argumentIndex: number;
    source: SourceReference;
    inputOrigins: WorkspaceFlowInputOrigin[];
  }>;
}

export interface WorkspaceCodeSnapshot {
  version: 1;
  functions: WorkspaceCodeFunction[];
  calls: IndexedFunctionCall[];
  flows: WorkspaceApiFlow[];
  apiDependencies?: WorkspaceStaticApiDependency[];
  /** Older repository snapshots must be reindexed to populate code evidence. */
  missingRepositoryIds: string[];
  partial: boolean;
  notes: string[];
}

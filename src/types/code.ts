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
  targetName: string;
  source: SourceReference;
  resolution: "resolved" | "external" | "unresolved";
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
}

export interface WorkspaceOutboundCall {
  callerFunctionId: string;
  endpointId: string | null;
  method: string;
  path: string;
  source: SourceReference;
  resolution: "matched" | "unresolved" | "ambiguous";
}

export interface ApiExecutionTreeNode {
  id: string;
  name: string;
  qualifiedName: string;
  source: SourceReference;
  kind: "entrypoint" | "function" | "external" | "outbound_api" | "unresolved";
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
  status: "indexed" | "partial" | "entrypoint_not_found";
  notes: string[];
  executionTree?: ApiExecutionTreeNode | null;
}

export interface WorkspaceCodeSnapshot {
  version: 1;
  functions: WorkspaceCodeFunction[];
  calls: IndexedFunctionCall[];
  flows: WorkspaceApiFlow[];
  /** Older repository snapshots must be reindexed to populate code evidence. */
  missingRepositoryIds: string[];
  partial: boolean;
  notes: string[];
}

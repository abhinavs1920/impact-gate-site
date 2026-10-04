/** Customer-owned observability data. Credentials never appear in wire contracts. */
export type RuntimeProvider = "prometheus" | "datadog";

export interface RuntimeConnectionBase {
  windowHours: number;
  /** Observability service name -> selected workspace service ID. */
  serviceMappings: Record<string, string>;
}
export interface PrometheusConnectionConfig extends RuntimeConnectionBase {
  provider: "prometheus";
  baseUrl: string;
  /** A counter increase expression containing {{window}}, replaced with e.g. 24h. */
  query: string;
  serviceLabel: string;
  methodLabel: string;
  routeLabel: string;
  callerLabel: string | null;
}
export interface DatadogConnectionConfig extends RuntimeConnectionBase {
  provider: "datadog";
  site: string;
  query: string;
  serviceFacet: string;
  methodFacet: string;
  routeFacet: string;
  callerFacet: string | null;
}
export type RuntimeConnectionConfig =
  PrometheusConnectionConfig | DatadogConnectionConfig;
export interface RuntimeCredentials {
  bearerToken?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  applicationKey?: string;
}
export interface RuntimeObservation {
  providerService: string;
  callerService: string | null;
  method: string;
  route: string;
  calls: number;
  /** Only a real request timestamp belongs here, never the query evaluation time. */
  lastObservedAt: string | null;
}
export interface RuntimeImportResult {
  observations: RuntimeObservation[];
  windowStart: string;
  windowEnd: string;
  partial: boolean;
  warnings: string[];
}
export interface RuntimeConnection {
  provider: RuntimeProvider;
  config: RuntimeConnectionConfig;
  status: "connected" | "error";
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  error: string | null;
  observationCount: number;
  matchedEndpointCount: number;
  unmatchedObservationCount: number;
  windowStart: string | null;
  windowEnd: string | null;
  partial: boolean;
  warnings: string[];
}
export interface WorkspaceRuntimeEvidence {
  provider: RuntimeProvider;
  config: RuntimeConnectionConfig;
  result: RuntimeImportResult;
}

export interface RuntimeServiceMatch {
  sourceService: string;
  roles: Array<"provider" | "caller">;
  routeCount: number;
  suggestedServiceId: string | null;
  confidence: "high" | "review" | "unmatched";
  reason: string;
  candidates: Array<{ serviceId: string; matchedRouteCount: number }>;
}
export interface RuntimeServiceDiscovery {
  provider: RuntimeProvider;
  services: RuntimeServiceMatch[];
  observationCount: number;
  autoMatchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  windowStart: string;
  windowEnd: string;
  partial: boolean;
  warnings: string[];
}

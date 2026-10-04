export type GraphConfidence = "high" | "medium" | "low";

export interface EvaluationGraphEdge {
  from: string;
  to: string;
  method: string;
  endpoint: string;
  confidence: GraphConfidence;
  coveredByCode: boolean;
  reviewState?: "verified" | "possible" | "usage_not_located" | "not_affected";
}

export const evaluationGraphEdges: EvaluationGraphEdge[] = [
  {
    from: "consumer-ts-1",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/products/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-1",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/inventory/{productId}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-2",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/products",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-2",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/categories",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-3",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/pricing/{productId}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-3",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-4",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/products/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-ts-4",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}/schedule",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-1",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-2",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/rates",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-2",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}/schedule",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-3",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-3",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/customers/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-4",
    to: "loans-api",
    method: "GET",
    endpoint: "/v1/loans/{id}",
    confidence: "high",
    coveredByCode: true,
  },
  {
    from: "consumer-java-4",
    to: "catalog-api",
    method: "GET",
    endpoint: "/v1/products/{id}",
    confidence: "high",
    coveredByCode: true,
  },
];

export const evaluationDeprecationCandidate = {
  service: "loans-api",
  endpoint: "/v1/applications",
  confidence: "Building confidence" as const,
  staticReference: null,
  lastObservedCall: "No runtime data connected",
};

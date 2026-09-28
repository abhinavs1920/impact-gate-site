# Impact Gate Architecture Baseline

Status: Stage 0 complete
Date: 2026-09-28

## 1. Current architecture

This repository is a React 19 single-page marketing site built with Vite and deployed as static assets through a Cloudflare Worker. The page is composed in `src/App.tsx` and shares product claims from `src/data/site-facts.json`.

The current runtime surfaces are:

- A React single-page app with responsive CSS in `src/styles/site.css`.
- A waitlist form at `/api/waitlist`, implemented as a Cloudflare Worker function.
- Google Fonts is loaded externally; no third-party JavaScript or embedded video is included.
- Build/content/type verification through `pnpm verify:site`, `tests/content-scan.mjs`, and `scripts/verify-site.mjs`.
- CI verification and main-branch deployment through GitHub Actions and Wrangler.
- No analyzer service, parser, graph store, contract ingestion, GitHub integration, or findings API exists in this repository.

The current site already communicates the intended product posture well: warn-only review, evidence-first output, visible uncertainty, OpenAPI scope, and private-pilot status. The repository is therefore a product surface, not yet the Impact Gate analysis engine.

## 2. Architecture gaps

The product brief describes a semantic dependency analyzer, but the current repository does not yet contain:

1. A normalized domain model for symbols, contracts, changes, evidence, findings, versions, or analysis budgets.
2. A repository indexer, language parser, symbol/type resolver, call graph, CFG, dataflow, alias analysis, or framework model layer.
3. A persistent semantic graph separated from ephemeral traversal state.
4. Content-addressed artifacts, graph manifests, incremental invalidation, or branch/commit snapshots.
5. A contract provider and normalized OpenAPI schema diff engine.
6. A demand-driven impact engine with explicit `UNKNOWN` outcomes.
7. A findings API, PR adapter, UI for real findings, or calibrated confidence system.
8. Fixtures, golden tests, regression corpus, performance budgets, or analyzer observability.

The highest risk is confusing the current illustrative marketing UI with product evidence. The implementation must keep illustrative examples explicitly labeled until they are backed by a real analyzer run.

## 3. Target architecture

The target is a modular monorepo or service boundary that can begin in-process and split later:

```text
GitHub PR / local commit
        |
        v
Change extraction -> normalized contract model -> contract diff
        |                                      |
        v                                      v
Repository index -> symbols/types/imports/calls -> persistent semantic graph
        |                                      |
        +---------------- demand-driven impact traversal
                                               |
                                               v
                                 access paths / guards / dataflow
                                               |
                                               v
                                   evidence graph + uncertainty
                                               |
                                               v
                           classification -> finding -> PR/UI adapter
```

### Component responsibilities

| Component | Responsibility |
| --- | --- |
| `RepositoryIndexer` | Enumerate bounded, trusted source files and create parse jobs. |
| `Parser` | Produce language-neutral syntax facts through TypeScript/Java adapters. |
| `SymbolResolver` | Resolve stable symbols, imports, exports, re-exports, and declarations. |
| `TypeResolver` | Resolve types while preserving `any`, casts, unions, and unknown states. |
| `CallGraphProvider` | Provide demand-driven direct and polymorphic call edges with provenance. |
| `CFGProvider` | Expose control-flow facts only where impact analysis needs them. |
| `DataflowEngine` | Propagate changed values through parameters, returns, callbacks, and transforms. |
| `ContractProvider` | Load OpenAPI first; leave extension points for AsyncAPI, GraphQL, and protobuf. |
| `DiffEngine` | Emit normalized change kinds without prematurely calling them breaking. |
| `APIMapper` | Connect contract endpoints/fields to framework handlers, clients, DTOs, and serializers. |
| `ImpactEngine` | Traverse only the changed field/endpoint dependency closure. |
| `EvidenceEngine` | Store explainable paths, source locations, transformations, guards, and uncertainty. |
| `ClassificationEngine` | Emit `SAFE`, `POTENTIAL_IMPACT`, `POTENTIAL_REGRESSION`, `VERIFIED_REGRESSION`, or `UNKNOWN`. |
| `GraphStorage` | Persist immutable knowledge artifacts and graph manifests. |
| `Cache` | Reuse analysis keyed by content, analyzer, configuration, and dependency closure. |
| `PRAdapter` | Render findings as warn-only GitHub review information. |

## 4. Data and graph model

Stable IDs must be content-independent of line numbers:

- `SymbolId`: repository/language/qualified identity.
- `SymbolVersion`: symbol identity plus content hash, analyzer version, and source range.
- `ContractId`, `SchemaNodeId`, `ChangeId`, `EvidenceId`, `FindingId`.
- `GraphObjectHash`: immutable content-addressed object hash.
- `GraphManifest`: root object, parent manifests, commit, configuration, and analyzer version.

Graph nodes include API, schema, endpoint, service, module, package, class, method, function, parameter, variable, field, type, DTO, mapper, event, database, configuration, test, and external consumer.

Graph edges include `CONTAINS`, `IMPORTS`, `EXPORTS`, `CALLS`, `READS`, `WRITES`, `DEFINES`, `USES`, `RETURNS`, `PASSES`, `ALIAS_OF`, `MAPS_TO`, `SERIALIZES`, `DESERIALIZES`, `PRODUCES`, `CONSUMES`, `GUARDS`, `DEPENDS_ON`, `IMPLEMENTS`, `OVERRIDES`, `EXTENDS`, `THROWS`, and `CATCHES`.

Every edge carries provenance: source file, start/end range, extractor, analyzer version, certainty (`EXACT`, `INFERRED`, `DYNAMIC`, `UNKNOWN`), and optional budget exhaustion.

## 5. Storage and cache model

The first implementation should use a local adapter behind interfaces, with SQLite or filesystem content-addressed objects for development. Production storage can move to object storage plus a query index without changing domain contracts.

Persist:

- symbols and symbol versions
- normalized contracts and schema nodes
- graph objects and manifests
- API changes
- framework mappings
- evidence paths
- findings and classifications
- analyzer metrics

Keep ephemeral:

- work queues
- traversal frontiers
- fixed-point iterations
- temporary candidates
- parser process state

Cache key:

```text
content_hash + analyzer_version + configuration_hash + dependency_scope
```

Incremental invalidation starts at changed files/symbols, walks reverse dependencies, and reanalyzes the affected closure. Cache misses or budget exhaustion must produce explicit metadata, never a false `SAFE`.

## 6. Analysis pipeline

1. Read Git diff and identify changed contract sources.
2. Normalize OpenAPI endpoints, parameters, schemas, references, status codes, headers, and content types.
3. Diff normalized contracts into typed changes.
4. Resolve changed API nodes to handlers, clients, DTOs, serializers, and deserializers.
5. Traverse direct consumers and demand-driven call/dataflow edges.
6. Resolve access paths: exact, enumerated, inferred, dynamic, or unknown.
7. Inspect guards, defaults, optional chaining, nullish behavior, transformations, aliases, and overwrites.
8. Build an evidence path and classify behavior as crash risk, behavioral change, safe fallback, or unknown.
9. Emit a finding with affected path, source locations, evidence, uncertainty, and developer-facing recommendation.
10. Render warn-only output for PR review and a machine-readable findings payload.

## 7. Language and framework architecture

Language adapters implement common interfaces. TypeScript/JavaScript is first; Java follows after the vertical slice is stable. Framework models are declarative providers that map annotations, decorators, clients, serializers, and generated artifacts to normalized graph edges.

Initial framework scope:

- TypeScript/JavaScript ES modules, CommonJS, re-exports, object access, destructuring, spread, optional chaining, and basic async flow.
- OpenAPI handlers/clients and JSON DTO mappings.

Next adapters:

- JavaParser/JavaSymbolSolver.
- Spring MVC/WebClient/RestTemplate/Feign.
- Jackson annotations and polymorphic serialization.
- Generated OpenAPI and MapStruct providers.

Reflection, opaque dynamic dispatch, generated code without source maps, and external consumers remain explicit `UNKNOWN` or `UNINDEXED` states.

## 8. Evidence and confidence model

Do not use uncalibrated percentages. Findings expose:

- `VERIFIED`: deterministic path and direct changed-value use.
- `LIKELY`: strong connected evidence with one or more inferred edges.
- `UNCERTAIN`: incomplete source, dynamic access, budget exhaustion, or unresolved dispatch.

Product classifications are separate:

`SAFE / NO_IMPACT`, `POTENTIAL_IMPACT`, `POTENTIAL_REGRESSION`, `VERIFIED_REGRESSION`, `UNKNOWN`.

The evidence payload must explain:

```text
changed API field
 -> mapped DTO/property
 -> caller/function path
 -> transformation and guard facts
 -> downstream consumer
 -> source locations and uncertainty
```

## 9. Security and performance model

Never execute repository code. Parse in bounded processes with file-size, file-count, depth, traversal, timeout, and memory limits. Normalize paths before access, reject traversal, isolate configuration, and treat generated/dependency directories as policy-controlled inputs.

Track files analyzed, symbols, nodes, edges, cache hits/misses, duration, memory, unknown resolutions, framework matches, and budget exhaustion. Prefer lazy, demand-driven analysis and parallelize only independent language/contract jobs after correctness is established.

## 10. Edge-case matrix

| Edge case | Initial policy |
| --- | --- |
| Destructuring, spread, overwrite ordering | Supported in TypeScript/JavaScript vertical slice |
| Aliases, reassignment, mutation | Basic local support; uncertain across opaque boundaries |
| Dynamic/computed property access | Exact/enumerated/inferred/dynamic/unknown states |
| Optional chaining, nullish/default guards | Supported in local dataflow milestone |
| Callbacks, closures, promises, async | Supported incrementally; unresolved higher-order flow is uncertain |
| Loops, recursion, exceptions | Bounded CFG; budget exhaustion is unknown |
| Interfaces, inheritance, overloads, generics | Later language/type milestones |
| `any`, `unknown`, casts, reflection | Preserve uncertainty; casts are not proof |
| Spring proxies and dependency injection | Framework-model milestone |
| Jackson annotations and polymorphic JSON | Java framework milestone |
| Generated code | Provider extension; source-map/evidence dependent |
| HTTP/event/external consumers | Boundary nodes; unknown when source/runtime evidence is absent |
| `$ref`, cycles, oneOf/anyOf/allOf, discriminators | Normalized contract milestone with cycle guards |
| Status, headers, parameters, content types | Contract model/diff milestone |
| Branches, rebases, stale caches | Immutable manifests and dependency-keyed invalidation |
| Timeout/resource exhaustion | Explicit incomplete analysis, never safe |

## 11. Staged roadmap and microtasks

### Stage 0 — Repository audit and architecture baseline

**Objective:** record current reality, target boundaries, risks, and acceptance criteria without pretending the analyzer exists.

**Microtasks**

| ID | Task | Dependencies | Definition of done |
| --- | --- | --- | --- |
| S0-01 | Inventory React/Vite entry points, components, data, Worker API, scripts, tests, and deployment files | None | `ARCHITECTURE.md` current-state section matches repository |
| S0-02 | Define analyzer boundaries, domain vocabulary, graph edges, and uncertainty states | S0-01 | Target architecture and graph model are documented |
| S0-03 | Define staged roadmap, edge-case policy, risks, and acceptance gates | S0-02 | Roadmap and matrix are reviewed against product brief |
| S0-04 | Record the decision to keep the website and analyzer decoupled | S0-01 | ADR exists and explains migration path |
| S0-05 | Align illustrative UI copy with the canonical evidence example | S0-01 | Build and content checks pass |

**Stage 0 definition of done:** documentation exists, the illustrative UI is honest and aligned, and the existing site build/verification remains green.

### Stage 1 — Core domain model, IDs, and versioning

Define typed IDs, node/edge provenance, change kinds, evidence, findings, budgets, and manifest interfaces. Add unit tests for serialization and stable identity.

### Stage 2 — Repository indexing and parsing

Add bounded file enumeration and a TypeScript/JavaScript parser adapter. Add fixtures for imports, exports, re-exports, and syntax failure handling.

### Stage 3 — Symbol and type resolution

Resolve declarations/imports/types without treating casts as runtime proof. Add type fixtures for unions, generics, optional fields, `any`, and `unknown`.

### Stage 4 — Contract ingestion and normalized schema model

Ingest OpenAPI with `$ref` resolution and cycle guards. Model endpoints, parameters, schemas, statuses, headers, content types, and references.

### Stage 5 — Contract diff engine

Emit typed changes for fields, requiredness, nullability, enums, endpoints, parameters, statuses, headers, and payload shapes.

### Stage 6 — Basic API-to-code mapping

Map OpenAPI handlers/clients to symbols and DTO/property paths. Deliver the first `User.email` mapping.

### Stage 7 — Call graph and cross-file resolution

Resolve direct calls, imports, methods, and bounded dispatch. Preserve uncertain targets.

### Stage 8 — CFG and def-use

Model branches, returns, exceptions, short-circuiting, and local def-use for changed values.

### Stage 9 — Access paths and property tracking

Support dot/bracket access, destructuring, spread, overwrites, optional chaining, and computed-key certainty.

### Stage 10 — Interprocedural dataflow

Propagate values through parameters, returns, callbacks, closures, async functions, and common transforms.

### Stage 11 — Alias and points-to improvements

Add bounded aliases, mutation facts, and dispatch expansion with budgets.

### Stage 12 — Framework models

Add Spring/Jackson/Feign and generated-code providers behind adapter interfaces.

### Stage 13 — Impact propagation

Traverse changed nodes to consumers and classify direct access, behavior changes, fallback, and unknown.

### Stage 14 — Evidence engine

Persist explainable paths, source locations, transformations, guards, and incomplete-analysis reasons.

### Stage 15 — Confidence and classification

Separate evidence strength from product outcome; add golden tests for verified, likely, uncertain, and no-impact cases.

### Stage 16 — Incremental graph persistence

Persist immutable graph objects and manifests; support commit/branch parents without line-number identity.

### Stage 17 — Content-addressed caching

Add analyzer/configuration/dependency keyed caches, invalidation, hit/miss metrics, and stale-cache tests.

### Stage 18 — Git/PR integration

Read PR diffs and post warn-only machine-readable and human-readable findings.

### Stage 19 — Developer UI and findings

Replace illustrative evidence with real finding payloads when available; preserve unknown states and source links.

### Stage 20 — Performance and security hardening

Enforce resource limits, subprocess isolation, observability, and performance budgets.

### Stage 21 — Regression corpus and production validation

Promote every discovered bug to a fixture; run integration, golden, adversarial, performance, and pilot validation suites.

## 12. Dependency graph

```text
S0
 -> S1 -> S2 -> S3
             \-> S4 -> S5 -> S6
S3 + S6 -> S7 -> S8 -> S9 -> S10 -> S11
S6 + S10 -> S12 -> S13 -> S14 -> S15
S1 + S14 -> S16 -> S17
S5 + S15 + S17 -> S18 -> S19
S16 + S17 + S18 -> S20 -> S21
```

## 13. Risks and open questions

- Which analysis runtime and storage backend are acceptable for the first production deployment?
- Which repositories and languages are in the first pilot, and are external consumers in scope?
- Is OpenAPI supplied as files, generated artifacts, or inferred from code?
- What GitHub permissions and retention policy apply to indexed source and evidence?
- What fixture corpus defines acceptable false-positive and false-negative tradeoffs?
- Which JavaScript framework models are required before pilot claims can expand beyond basic consumers?

These questions do not block Stage 0 or the TypeScript/OpenAPI vertical slice; they should be resolved before Stage 4 productionization.

## 14. Recommended implementation order

Keep the first end-to-end slice narrow:

```text
OpenAPI response field removal
 -> normalized diff
 -> TypeScript DTO/property access
 -> direct consumer read
 -> evidence path
 -> verified/unknown finding
```

Only after this path is tested should the project broaden into full interprocedural analysis, Java/Spring, persistent graph manifests, and PR integration.

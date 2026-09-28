# Product truth

This document records only what was observed in the current session. The source inspected was `/home/abxh/projects/impact-gate`, not this destination repository.

## Execution gate

The required fresh commands could not execute because the environment has no `pnpm` or `node` executable.

### CLI

Command requested:

```text
cd /home/abxh/projects/impact-gate && pnpm cli --help
```

Observed terminal output:

```text
/bin/bash: line 1: pnpm: command not found
```

Required dry-run analysis was also attempted through the live CLI entry point, but could not start for the same reason. No analysis result, finding, service name, file, line, or rendered comment was observed in this session.

The CLI entry point inspected at `scripts/cli.ts` defines:

```text
Usage:
  pnpm cli analyze --provider-repo <path> --base <ref> --head <ref> --consumers <path[,path...]> [--edges edges.yaml|--gateway-log file] [--allow-external-llm] [--no-llm]
  pnpm cli index --repos <path[,path...]>
```

The same source describes `--no-llm` as AST-only mode with no outbound network requests and says ambiguous field-level cases are reported as `possible`. Those are source observations, not a fresh execution result.

### PR bot comment

Command requested:

```text
cd /home/abxh/projects/impact-gate && pnpm samples:render
```

Observed terminal output:

```text
/bin/bash: line 1: pnpm: command not found
```

No current renderer output was produced. Existing files under `samples/` were not used as fresh evidence and are not quoted here.

The renderer invocation source inspected at `scripts/samples-render.ts` calls the real `renderComment` function and writes generated Markdown under `samples/`. Because the command could not run, this teaser must not show a purported current PR comment or attach a purported current finding.

### Web UI

No live web UI was started or verified. The source tree contains a graph web entry point at `scripts/graph-view.ts` and a generated page at `lab/graph-ui.html`; neither was presented as a running product in this session.

The honest product statement for this session is: **no live web UI verified; the available graph page is a source/design artifact, not evidence of a running product.**

## Capability status source

No `site-facts.json` file was found in the inspected source tree. There are therefore no capability-status labels to quote from that file.

The source policy document at `docs/policy.md` names the active policy **`asymmetric_trust`** and says the static analyzer and deterministic AST rules establish the evidentiary baseline. It also says an LLM may raise concern to `possible`, but may never clear an affected or flagged consumer. The policy lists `verified`, `possible`, `not_affected`, and `usage_not_located` as deterministic-rule verdicts; it describes `usage_not_located` as abstention when static tracing is fundamentally unresolvable.

The policy also states that only deterministic AST proof can declare a consumer `not_affected` or `verified`, and that the system should surface uncertainty rather than silently clear it.

## Supported change kinds observed in source

The actual differ source was inspected at:

- `packages/core/src/differ/differ.ts`
- `packages/core/src/differ/schema-diff.ts`

The change-kind strings present in those files are:

```text
endpoint_removed
endpoint_added
path_param_renamed
query_param_removed
param_removed
param_added_required
param_added_optional
response_status_code_changed
response_content_type_removed
unsupported_construct
response_body_shape_changed
response_field_type_changed
request_field_type_changed
format_changed
maxLength_constraint_tightened
maxLength_constraint_loosened
minLength_constraint_tightened
minLength_constraint_loosened
maximum_constraint_tightened
maximum_constraint_loosened
minimum_constraint_tightened
minimum_constraint_loosened
maxItems_constraint_tightened
maxItems_constraint_loosened
minItems_constraint_tightened
minItems_constraint_loosened
response_field_became_nullable
enum_added
response_enum_value_removed
request_enum_value_removed
request_enum_value_added
field_deprecated
response_field_removed
response_field_added
request_field_added_required
request_field_added_optional
request_field_became_required
```

These are source-derived names, not claims that each kind was exercised in this session.

## Ground-truth boundary

This session did not produce fresh executable evidence for a CLI analysis, a PR comment, or a live web UI. The script and generation prompts therefore do not claim a live finding, a current affected service, a current file-line citation, a benchmark result, production readiness, or customer usage.

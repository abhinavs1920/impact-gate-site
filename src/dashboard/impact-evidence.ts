import type {
  ImplementationImpactPath,
  SourceReference,
} from "../types/workspace";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const origin = (value: string) =>
  value === "ai"
    ? "AI"
    : value === "mixed"
      ? "Mixed Static/AI"
      : value === "static"
        ? "Static"
        : "Origin unspecified";
const source = (reference: SourceReference) =>
  `<code>${escape(reference.filePath)}:${reference.line}</code> <span class="ig-note">Commit ${escape(reference.sha.slice(0, 12))}</span>`;

/** Present source witnesses independently of contract breaks and runtime observations. */
export function renderImplementationPaths(
  paths: ImplementationImpactPath[] | undefined,
  limit = 20,
): string {
  if (!paths?.length) return "";
  return `<details class="ig-implementation-evidence"><summary>Implementation paths (${paths.length})</summary><p class="ig-note">These paths show potential impact from changed source. Behavioral breakage and contract compatibility remain unverified.</p><ol>${paths
    .slice(0, limit)
    .map(
      (path) =>
        `<li><strong>${escape(path.endpoint)} → ${escape(path.changedFunction.name)}</strong><p>${escape(path.view)} · ${origin(path.evidenceOrigin)}</p><ol><li>API entry · Static: ${source(path.endpointSource)}</li>${path.calls.map((call) => `<li>${escape(call.targetName)} · ${origin(call.origin)}${call.possible ? " · Possible target" : ""}: ${source(call.source)}</li>`).join("")}</ol>${path.changedFunction.before ? `<p>Before: ${source(path.changedFunction.before)}</p>` : ""}${path.changedFunction.after.map((reference) => `<p>After: ${source(reference)}</p>`).join("")}${path.possibleTargets || path.changedFunction.match === "ambiguous" ? '<p class="ig-note">Supported alternatives or ambiguous definitions remain.</p>' : ""}${path.truncated ? '<p class="ig-note">The recorded witness was truncated; further path details remain Not ready.</p>' : ""}</li>`,
    )
    .join(
      "",
    )}</ol>${paths.length > limit ? `<p class="ig-note">Showing ${Math.min(limit, paths.length)} of ${paths.length} paths.</p>` : ""}<a download="impact-gate-implementation-paths.json" href="${escape(`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(paths))}`)}">Download all path evidence</a></details>`;
}

import type { ReactElement } from "react";

export function LoadingIndicator({
  label = "Loading…",
  centered = false,
}: {
  label?: string;
  centered?: boolean;
}): ReactElement {
  return (
    <div
      className={`ig-loading-indicator ig-loading-indicator-inline${centered ? " is-centered" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="ig-loading-mark" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
      </span>
      <span className="ig-loading-label">{label}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { analyticsPreferences, onAnalyticsPreferences } from "../analytics";

const enabledTitle = "Measure visits and product actions. Events exclude email, repository names, and typed text.";
const disabledTitle = "Usage analytics is disabled by your browser privacy preference.";

// Renders the same text as the prerendered markup on first render so hydration
// matches; the real consent state syncs in an effect after mount. The analytics
// module owns consent changes and notifies this component; it must never
// decorate this button directly (see data-analytics-toggle-react).
export default function AnalyticsToggle() {
  const [state, setState] = useState<{ allowed: boolean; disabled: boolean } | null>(null);
  useEffect(() => {
    setState(analyticsPreferences());
    return onAnalyticsPreferences(() => setState(analyticsPreferences()));
  }, []);
  return (
    <button
      type="button"
      data-analytics-toggle
      data-analytics-toggle-react
      aria-pressed={state ? state.allowed : undefined}
      disabled={state?.disabled || undefined}
      title={state ? (state.disabled ? disabledTitle : enabledTitle) : undefined}
    >
      {state ? `Usage analytics: ${state.allowed ? "on" : "off"}` : "Usage analytics"}
    </button>
  );
}

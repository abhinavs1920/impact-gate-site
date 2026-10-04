import { useEffect, useState } from "react";
import { emailHref } from "../ui/contact";

const consumers = [
  {
    name: "internal-billing-service",
    state: "possible",
    path: "src/billing/account.ts:84",
    code: "const email = account.billing_email.toLowerCase()",
    impact: "Nullable values may reach a string operation without a guard.",
  },
  {
    name: "notification-dispatcher",
    state: "possible",
    path: "src/notifications/account.ts:41",
    code: "sendAccountNotice(account.billing_email)",
    impact: "The call site passes the value through; null handling needs review.",
  },
  {
    name: "analytics-pipeline",
    state: "usage_not_located",
    path: "packages/events/account-change.ts:—",
    code: "// No direct field use shown in this illustrative excerpt",
    impact: "The example excerpt does not establish a direct use of this field.",
  },
  {
    name: "auth-proxy-service",
    state: "not_affected",
    path: "src/proxy/account.ts:112",
    code: "const accountId = account.id",
    impact: "The shown excerpt reads account.id, not billing_email.",
  },
];

function Verdict({ children }: { children: string }) {
  return <span className={`review-verdict verdict-${children}`}>{children.replaceAll("_", " ")}</span>;
}

export function ReviewDeskScreen() {
  const [draft, setDraft] = useState<"" | "follow-up" | "clear">("");
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark",
  );

  useEffect(() => {
    document.title = "Review Desk | Impact Gate";
  }, []);

  function toggleTheme() {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setDark(nextTheme === "dark");
    try {
      localStorage.setItem("impact-gate-theme", nextTheme);
    } catch {
      // Keep the selection for the current page view.
    }
  }

  return (
    <div className="product-screen review-desk-screen">
      <header className="product-screen-header">
        <a className="product-screen-brand" href="/" aria-label="Impact Gate home">
          <img className="product-screen-mark" src="/favicon.svg" width="32" height="32" alt="" />
          <span>Impact Gate</span>
        </a>
        <nav className="product-screen-nav" aria-label="Product screens">
          <a href="/review-desk" aria-current="page">Review Desk</a>
          <a href="/dashboard/dependency-graph">Dependency Graph</a>
          <a href="/dashboard/deprecation-candidates">Deprecation Candidates</a>
        </nav>
        <button
          className="product-theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">{dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></> : <path d="M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11Z" />}</svg>
          <span>{dark ? "Light" : "Dark"}</span>
        </button>
        <span className="review-warn-only">WARN-ONLY</span>
      </header>

      <main className="review-desk-main">
        <div className="review-demo-banner">
          <span className="review-live-dot" aria-hidden="true" />
          DEMO DATA · ILLUSTRATIVE ONLY
          <span className="review-demo-note">No repository is connected</span>
        </div>

        <div className="review-desk-title">
          <div>
            <span className="review-eyebrow">CHANGE REVIEW / OPENAPI</span>
            <h1>Account response contract</h1>
            <p>Review the downstream evidence for a nullable response field.</p>
          </div>
          <div className="review-risk-block">
            <span className="review-tier-label">TIER</span>
            <strong>HIGH</strong>
            <small>Illustrative risk signal</small>
          </div>
        </div>

        <div className="review-workbench">
          <div className="review-primary-column">
            <section className="review-panel review-contract-panel" aria-labelledby="contract-title">
              <div className="review-panel-heading">
                <div>
                  <span className="review-eyebrow">CONTRACT CHANGE</span>
                  <h2 id="contract-title"><code>GET /v2/accounts/&#123;id&#125;</code></h2>
                </div>
                <span className="review-file-chip">openapi.v2.json</span>
              </div>
              <div className="review-diff" aria-label="Illustrative API schema diff">
                <div className="review-diff-line"><span>18</span><code>Account:</code></div>
                <div className="review-diff-line"><span>19</span><code>  id: string</code></div>
                <div className="review-diff-line review-diff-removed"><span>20</span><code><b>−</b> billing_email: string</code></div>
                <div className="review-diff-line review-diff-added"><span>20</span><code><b>+</b> billing_email: string | null</code></div>
                <div className="review-diff-line"><span>21</span><code>  created_at: date-time</code></div>
              </div>
              <div className="review-change-caption">
                <span className="review-change-dot" />
                Response field became nullable
              </div>
            </section>

            <section className="review-panel review-consumers-panel" aria-labelledby="consumers-title">
              <div className="review-panel-heading review-consumer-heading">
                <div>
                  <span className="review-eyebrow">DOWNSTREAM CONSUMERS</span>
                  <h2 id="consumers-title">Impact evidence</h2>
                </div>
                <span className="review-count">4 illustrative excerpts</span>
              </div>
              <div className="review-consumer-list">
                {consumers.map((consumer) => (
                  <article className="review-consumer-row" key={consumer.name}>
                    <div className="review-consumer-status"><Verdict>{consumer.state}</Verdict></div>
                    <div className="review-consumer-content">
                      <div className="review-consumer-title">
                        <h3>{consumer.name}</h3>
                        <code>{consumer.path}</code>
                      </div>
                      <pre><code>{consumer.code}</code></pre>
                      <p>{consumer.impact}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="review-evidence-limit">These example paths are not results from a live repository analysis.</p>
            </section>
          </div>

          <aside className="review-rail" aria-label="Review context">
            <section className="review-panel review-decision-panel">
              <span className="review-eyebrow">REVIEWER DECISION</span>
              <h2>Keep the change in view.</h2>
              <p>Impact Gate is warn-only. This preview does not approve, block, or update a pull request.</p>
              <div className="review-decision-state" role="status">
                <span className="review-state-mark">{draft === "follow-up" ? "!" : draft === "clear" ? "✓" : "—"}</span>
                <span>{draft === "follow-up" ? "Draft marked for follow-up" : draft === "clear" ? "Draft marked reviewed" : "No review action selected"}</span>
              </div>
              <div className="review-decision-actions">
                <button type="button" className="review-action-primary" aria-pressed={draft === "follow-up"} onClick={() => setDraft(draft === "follow-up" ? "" : "follow-up")}>Flag for follow-up</button>
                <button type="button" className="review-action-secondary" aria-pressed={draft === "clear"} onClick={() => setDraft(draft === "clear" ? "" : "clear")}>Mark reviewed</button>
              </div>
              <small className="review-local-note">Preview state only · not saved</small>
            </section>

            <section className="review-panel review-basis-panel">
              <span className="review-eyebrow">EVIDENCE BASIS</span>
              <h2>What this view can say</h2>
              <ul className="review-basis-list">
                <li><span className="basis-symbol basis-present">✓</span><span><strong>Contract diff</strong><small>Illustrative nullable change</small></span></li>
                <li><span className="basis-symbol basis-present">✓</span><span><strong>Consumer excerpts</strong><small>Demo snippets and paths</small></span></li>
                <li><span className="basis-symbol basis-missing">?</span><span><strong>Production guarantees</strong><small>Zero verified guarantees</small></span></li>
              </ul>
            </section>

            <section className="review-panel review-alternative-panel">
              <span className="review-eyebrow">COMPATIBILITY NOTE</span>
              <h2>Review the null path</h2>
              <p>Check that consumers handle <code>null</code>, or keep returning a non-null fallback value.</p>
            </section>

            <details className="review-method-details">
              <summary>Review methodology and checklist</summary>
              <div>
                <p>All examples on this screen are illustrative. Real findings need repository-specific evidence and human review.</p>
                <ul><li>Confirm the changed field and response context.</li><li>Inspect each connected consumer excerpt.</li><li>Check for missing repositories or dynamic paths.</li></ul>
              </div>
            </details>
          </aside>
        </div>
        <footer className="review-desk-footer">
          <span>Impact Gate · Review Desk</span>
          <span>Illustrative interface · no connected repository</span>
          <nav aria-label="Review desk help"><a href="/docs/pull-request-reports">Report guide</a><a href={emailHref("support")}>Contact support</a><a href="/dashboard">Open dashboard →</a></nav>
        </footer>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function DemoHeader({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="product-screen-header bot-demo-header">
      <a className="product-screen-brand" href="/" aria-label="Impact Gate home">
        <img className="product-screen-mark" src="/favicon.svg" width="32" height="32" alt="" />
        <span>Impact Gate</span>
      </a>
      <nav className="product-screen-nav" aria-label="Demo navigation">
        <a href="/">Overview</a>
        <a href="/dashboard">Dashboard</a>
        <a href="/docs/pull-request-reports">Docs</a>
      </nav>
      <button
        className="product-theme-toggle"
        type="button"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
    </header>
  );
}

export function GitHubBotDemoScreen() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    document.title = "GitHub bot demo | Impact Gate";
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      localStorage.setItem("impact-gate-theme", nextTheme);
    } catch {
      // Keep the selection for the current page view.
    }
  }

  return (
    <div className="product-screen bot-demo-screen">
      <DemoHeader theme={theme} onToggleTheme={toggleTheme} />
      <main className="bot-demo-main" id="main-content" tabIndex={-1}>
        <section className="bot-demo-intro" aria-labelledby="bot-demo-title">
          <span className="bot-demo-eyebrow">Try demo · Read-only</span>
          <h1 id="bot-demo-title">See the GitHub bot comment.</h1>
          <p>
            When a pull request changes an OpenAPI contract, Impact Gate posts a
            warn-only comment with the affected paths and the evidence engineers
            can review.
          </p>
        </section>

        <section className="bot-demo-pr" aria-labelledby="bot-demo-pr-title">
          <header className="bot-demo-pr-header">
            <div>
              <span className="bot-demo-repository">impact-gate / demo-api</span>
              <h2 id="bot-demo-pr-title">Make billing_email nullable</h2>
            </div>
            <span className="bot-demo-pr-state">Open · #42</span>
          </header>

          <article className="bot-comment" aria-label="Impact Gate GitHub bot comment">
            <header className="bot-comment-header">
              <span className="bot-comment-avatar" aria-hidden="true">IG</span>
              <strong>impact-gate[bot]</strong>
              <span>commented just now</span>
              <span className="bot-comment-label">DEMO</span>
            </header>
            <h3>Potential downstream impact</h3>
            <p>
              This pull request changes <code>GET /v2/accounts/&#123;id&#125;</code>:
              <code>billing_email</code> is now nullable.
            </p>
            <div className="bot-comment-summary">
              <span className="bot-summary-count">2 possible consumers</span>
              <span className="bot-summary-muted">1 path needs review</span>
            </div>
            <ul className="bot-comment-findings">
              <li>
                <span className="bot-finding-state possible">Possible</span>
                <div>
                  <strong>billing-service</strong>
                  <code>src/billing/account.ts:84</code>
                  <p>Value reaches a string operation without a visible null guard.</p>
                </div>
              </li>
              <li>
                <span className="bot-finding-state unknown">Unknown</span>
                <div>
                  <strong>notification-dispatcher</strong>
                  <code>src/notifications/account.ts:41</code>
                  <p>Review the caller; dynamic dispatch may limit static coverage.</p>
                </div>
              </li>
            </ul>
            <footer className="bot-comment-footer">
              <span>Warn-only · no merge decision was made</span>
              <a href="/docs/pull-request-reports">Read the report guide →</a>
            </footer>
          </article>
        </section>

        <section className="bot-demo-next" aria-labelledby="bot-demo-next-title">
          <div>
            <span className="bot-demo-eyebrow">Next step</span>
            <h2 id="bot-demo-next-title">Connect a GitHub organization to use your own pull requests.</h2>
            <p>The demo is a read-only example. Connected repositories receive comments on their pull requests.</p>
          </div>
          <div className="bot-demo-actions">
            <a className="button primary" href="/onboarding/github">Connect GitHub <span aria-hidden="true">↗</span></a>
            <a className="button secondary" href="/">Back to overview</a>
          </div>
        </section>
      </main>
    </div>
  );
}

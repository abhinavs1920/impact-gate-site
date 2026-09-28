import { useEffect, useState, type FormEvent } from "react";
import siteFacts from "./data/site-facts.json";

type FactStatus =
  "available" | "in_testing" | "planned" | "not_planned_for_pilot";
const factStatusLabels: Record<FactStatus, string> = {
  available: "Available",
  in_testing: "In testing",
  planned: "Planned",
  not_planned_for_pilot: "Not planned for pilot",
};

function isFactStatus(status: string): status is FactStatus {
  return Object.hasOwn(factStatusLabels, status);
}

function Fact({
  status,
  label,
  compact = false,
}: {
  status: string;
  label: string;
  compact?: boolean;
}) {
  if (!isFactStatus(status))
    throw new Error(`Unsupported site fact status: ${status}`);

  return (
    <span
      className={`fact${compact ? " compact" : ""}`}
      data-fact-status={status}
    >
      <span className="fact-dot" aria-hidden="true" />
      <span>{label}</span>
      {!compact && <small>{factStatusLabels[status]}</small>}
    </span>
  );
}

function LogoMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <a
      className={`brand${inverse ? " inverse" : ""}`}
      href="/"
      aria-label="Impact Gate home"
    >
      <svg
        className="logo-mark interactive animate"
        width="76"
        height="56"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Impact Gate"
        focusable="false"
      >
        <g className="chevrons" aria-hidden="true">
          <path className="chevron chevron-left" d="M29 33 13 50l16 17" />
          <path className="chevron chevron-right" d="M71 33 87 50 71 67" />
        </g>
        <g className="bars" aria-hidden="true">
          <rect
            className="bar bar-left"
            x="35"
            y="28"
            width="8"
            height="44"
            rx="4"
          />
          <rect
            className="bar bar-right"
            x="57"
            y="28"
            width="8"
            height="44"
            rx="4"
          />
        </g>
        <g className="dots" aria-hidden="true">
          <circle className="dot dot-1" cx="25" cy="50" r="3" />
          <circle className="dot dot-2" cx="35" cy="50" r="3" />
          <circle className="dot dot-3 dot-mid" cx="45" cy="50" r="3" />
          <circle className="dot dot-4 dot-mid" cx="55" cy="50" r="3" />
          <circle className="dot dot-5" cx="65" cy="50" r="3" />
          <circle className="dot dot-6" cx="75" cy="50" r="3" />
        </g>
      </svg>
      <span>Impact Gate</span>
    </a>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  function toggleTheme() {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setDark(nextTheme === "dark");
    try {
      localStorage.setItem("impact-gate-theme", nextTheme);
    } catch {
      // Keep the selected theme for this page view when browser storage is unavailable.
    }
  }

  const links = [
    ["#how-it-works", "How it works"],
    ["#evidence", "Analysis states"],
    ["#changes", "Contract support"],
    ["#limits", "Limitations"],
    ["#pilot", "Pilot"],
  ];

  return (
    <header className="site-header">
      <div className="container header-inner">
        <LogoMark />
        <div className="header-status" aria-label="Product status">
          <Fact
            status={siteFacts.stage.status}
            label="Private pilot prep"
            compact
          />
          <Fact status={siteFacts.warnOnly.status} label="Warn-only" compact />
        </div>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="sr-only">
            {menuOpen ? "Close navigation" : "Open navigation"}
          </span>
          <span className="menu-icon" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
        <nav
          id="primary-navigation"
          className={menuOpen ? "is-open" : ""}
          aria-label="Primary navigation"
        >
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <a className="header-cta" href="#pilot">
          Request pilot access <span aria-hidden="true">↗</span>
        </a>
        <button
          className="theme-toggle"
          type="button"
          aria-pressed={dark}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title={dark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
        >
          <svg className="moon-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.1 15.2A8.5 8.5 0 0 1 8.8 3.9a8.7 8.7 0 1 0 11.3 11.3Z" />
          </svg>
          <svg className="sun-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div className="hero-copy" data-reveal>
          <div className="hero-kicker">
            <span className="kicker-mark" aria-hidden="true">
              ↳
            </span>{" "}
            Downstream API contract tracing for engineering teams
          </div>
          <h1 id="hero-title">
            Know who
            <br />
            breaks before
            <br />
            you merge<span className="period">.</span>
          </h1>
          <p className="hero-lede">
            API contract changes can affect code beyond the repository where
            they were made. Impact Gate is being built to trace connected
            consumer code and surface evidence for human review.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#pilot">
              Request pilot access <span aria-hidden="true">→</span>
            </a>
            <a className="button secondary" href="#how-it-works">
              See how it works
            </a>
          </div>
          <div className="hero-note">
            <Fact
              status={siteFacts.stage.status}
              label="Private pilot in preparation"
              compact
            />
            <span>Warn-only review; your team stays in control.</span>
          </div>
        </div>
        <div
          className="review-card"
          aria-label="Illustrative example of a downstream evidence path"
          data-reveal
        >
          <div className="review-top">
            <span className="bot-mark" aria-hidden="true">
              <span>ig</span>
            </span>
            <div className="review-byline">
              <strong>Impact Gate</strong>
              <small>Illustrative review preview</small>
            </div>
            <span className="illustrative-tag">ILLUSTRATIVE · NOT LIVE</span>
          </div>
          <div className="contract-block">
            <div className="block-label">
              <span>API CONTRACT CHANGE</span>
              <span>OpenAPI</span>
            </div>
            <div className="schema-code">
              <div>
                <span className="code-muted">User:</span> {"{"}
              </div>
              <div className="removed-line">
                <span className="minus">−</span>
                <span>
                  <span className="code-muted">email:</span> string
                </span>
                <span className="removed-label">removed</span>
              </div>
              <div>
                <span className="code-muted">status:</span> "active" |
                "suspended"
              </div>
              <div>{"}"}</div>
            </div>
          </div>
          <div className="trace-heading">
            <span>EXAMPLE VALUE PATH</span>
            <span className="trace-caption">Illustrative only</span>
          </div>
          <ol className="trace-list">
            <li>
              <span className="trace-index">01</span>
              <span className="trace-node">
                <code>User.email</code>
                <small>changed API field</small>
              </span>
              <span className="trace-arrow" aria-hidden="true">
                →
              </span>
            </li>
            <li>
              <span className="trace-index">02</span>
              <span className="trace-node">
                <code>UserResponse.email</code>
                <small>consumer value</small>
              </span>
              <span className="trace-arrow" aria-hidden="true">
                →
              </span>
            </li>
            <li>
              <span className="trace-index">03</span>
              <span className="trace-node">
                <code>ReceiptService.process()</code>
                <small>example service path</small>
              </span>
              <span className="trace-arrow" aria-hidden="true">
                →
              </span>
            </li>
            <li className="trace-terminal">
              <span className="trace-index">04</span>
              <span className="trace-node">
                <code>sendReceipt()</code>
                <small>example downstream use</small>
              </span>
              <span className="trace-end" aria-hidden="true" />
            </li>
          </ol>
          <div className="review-footnote">
            <span className="footnote-icon" aria-hidden="true">
              i
            </span>
            <p>
              {siteFacts.analysis.copy} This diagram is an example path, not a
              result from a live repository analysis.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const steps = [
  [
    "01",
    "Contract change",
    "Start from a changed API contract in a pull request.",
    "01 / INPUT",
    "⌁",
    "OpenAPI change",
  ],
  [
    "02",
    "Consumer mapping",
    "Connect the changed API surface to indexed downstream callers.",
    "02 / CONNECTION",
    "⋈",
    "Connected codebase",
  ],
  [
    "03",
    "Evidence for review",
    "Surface the trace and leave the decision with the engineering team.",
    "03 / REVIEW",
    "✓",
    "Warn-only output",
  ],
];

function HowItWorks() {
  return (
    <section
      className="section process"
      id="how-it-works"
      aria-labelledby="process-title"
    >
      <div className="container">
        <div className="section-heading" data-reveal>
          <span className="eyebrow">A review path, not a verdict engine</span>
          <h2 id="process-title">How the analysis operates</h2>
          <p>{siteFacts.mechanism.copy}</p>
        </div>
        <div className="steps">
          {steps.map(([number, title, copy, category, symbol, footer]) => (
            <article className="step-card" data-reveal key={number}>
              <div className="step-top">
                <span className="step-number">{number}</span>
                <span className="step-category">{category}</span>
              </div>
              <div className="step-symbol" aria-hidden="true">
                {symbol}
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span className="step-bottom">
                <i />
                {footer}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const states = [
  {
    label: "VERIFIED",
    title: "Direct evidence",
    copy: "A connected code path directly uses the changed API value. Findings should link to the evidence that supports review.",
    className: "verified",
    symbol: "✓",
    footer: "EVIDENCE-LINKED",
  },
  {
    label: "LIKELY",
    title: "Inferred path",
    copy: "The available code connects the change to a consumer, but one or more steps rely on inference.",
    className: "likely",
    symbol: "≈",
    footer: "INFERRED CONNECTION",
  },
  {
    label: "UNCERTAIN",
    title: "Coverage gap",
    copy: "Dynamic behavior, missing source, or an unresolved boundary prevents a reliable conclusion.",
    className: "uncertain",
    symbol: "?",
    footer: "ABSTAIN, DON'T GUESS",
  },
  {
    label: "NOT AFFECTED",
    title: "No observed use",
    copy: "Available connected code does not show use of the changed field. This is limited to the code that was analyzed.",
    className: "not-affected",
    symbol: "—",
    footer: "SCOPE-LIMITED",
  },
];

function EvidenceStates() {
  return (
    <section
      className="section evidence"
      id="evidence"
      aria-labelledby="evidence-title"
    >
      <div className="container">
        <div className="section-heading" data-reveal>
          <span className="eyebrow">Explicit outcome states</span>
          <h2 id="evidence-title">Show what the evidence can—and can’t—say.</h2>
          <p>{siteFacts.policy.copy}</p>
        </div>
        <div className="state-grid">
          {states.map((state) => (
            <article
              className={`state-card ${state.className}`}
              data-reveal
              key={state.label}
            >
              <div className="state-header">
                <span className="state-symbol" aria-hidden="true">
                  {state.symbol}
                </span>
                <span className="state-badge">{state.label}</span>
              </div>
              <h3>{state.title}</h3>
              <p>{state.copy}</p>
              <span className="state-foot">{state.footer}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportedChanges() {
  const categoryFor = (title: string) =>
    /endpoint|path/i.test(title)
      ? "ROUTE"
      : /parameter/i.test(title)
        ? "PARAM"
        : /status|header|content type/i.test(title)
          ? "HTTP"
          : /type|schema|shape|body/i.test(title)
            ? "SCHEMA"
            : "FIELD";
  return (
    <section
      className="section changes"
      id="changes"
      aria-labelledby="changes-title"
    >
      <div className="container changes-grid">
        <div className="section-heading" data-reveal>
          <span className="eyebrow">Current contract scope</span>
          <h2 id="changes-title">Supported OpenAPI changes</h2>
          <p>{siteFacts.contract.copy}</p>
          <div className="scope-note">
            <Fact
              status={siteFacts.contract.status}
              label="OpenAPI contract review"
              compact
            />
            <span>
              Other contract formats are not presented as available here.
            </span>
          </div>
        </div>
        <div className="change-list" data-reveal>
          {siteFacts.contract.changes.map(([title, copy], index) => (
            <article className="change-row" key={title}>
              <span className="change-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="change-copy">
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <span className="change-token">{categoryFor(title)}</span>
            </article>
          ))}
          <div className="change-more">
            <span aria-hidden="true">+</span>
            <p>
              <strong>{siteFacts.contract.manyMore.title}</strong>{" "}
              {siteFacts.contract.manyMore.copy}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const does = [
  "Reads API contract changes for review.",
  "Traces consumers in connected, indexed code.",
  "Surfaces evidence and uncertainty for engineers.",
];
const doesNot = [
  "Guarantee every consumer is known.",
  "Monitor production traffic or runtime behavior.",
  "Block or merge pull requests for your team.",
];

function Boundaries() {
  return (
    <section
      className="section limits"
      id="limits"
      aria-labelledby="limits-title"
    >
      <div className="container">
        <div className="section-heading" data-reveal>
          <span className="eyebrow">Product boundaries</span>
          <h2 id="limits-title">Honest limits are part of the design.</h2>
          <p>
            Impact Gate is being prepared for a private pilot. These boundaries
            describe the current product posture—not a guarantee of complete
            analysis.
          </p>
        </div>
        <div className="boundary-grid">
          <article className="boundary-card does" data-reveal>
            <div className="boundary-title">
              <span className="boundary-icon" aria-hidden="true">
                ✓
              </span>
              <h3>What Impact Gate aims to do</h3>
            </div>
            <ul>
              {does.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Fact
              status={siteFacts.warnOnly.status}
              label="Warn-only; human review stays in control"
            />
          </article>
          <article className="boundary-card doesnt" data-reveal>
            <div className="boundary-title">
              <span className="boundary-icon" aria-hidden="true">
                ×
              </span>
              <h3>What Impact Gate does not claim</h3>
            </div>
            <ul>
              {doesNot.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <Fact
              status={siteFacts.analysis.status}
              label="Coverage and resolution have limits"
            />
          </article>
        </div>
      </div>
    </section>
  );
}

function PilotForm() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    state: "success" | "error" | "";
  }>({ message: "", state: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ message: "Sending your request…", state: "" });
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(
          result.message ||
            "We could not submit that request. Please try again.",
        );
      setStatus({
        message:
          result.message || "Thanks. Your waitlist request was received.",
        state: "success",
      });
      form.reset();
    } catch (error) {
      setStatus({
        message:
          error instanceof Error
            ? error.message
            : "We could not submit that request. Please try again.",
        state: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section pilot" id="pilot" aria-labelledby="pilot-title">
      <div className="container pilot-panel">
        <div className="pilot-copy" data-reveal>
          <span className="eyebrow">Private pilot · In preparation</span>
          <h2 id="pilot-title">Bring a shared API question.</h2>
          <p>
            {siteFacts.stage.copy} Join the waitlist to hear when teams can try
            the review flow with their own connected services.
          </p>
          <div className="pilot-status">
            <Fact
              status={siteFacts.warnOnly.status}
              label={siteFacts.warnOnly.label}
              compact
            />
            <span>Non-blocking by default. No merge control.</span>
          </div>
          <div className="pilot-details">
            <span>
              <i />
              Private pilot updates
            </span>
            <span>
              <i />
              For engineering teams
            </span>
          </div>
        </div>
        <form
          data-waitlist-form
          action="/api/waitlist"
          method="post"
          data-reveal
          onSubmit={submit}
        >
          <div className="form-heading">
            <strong>Request pilot updates</strong>
            <span>Fields marked * are required.</span>
          </div>
          <label htmlFor="email">
            Work email <span>*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
          />
          <label htmlFor="repository">
            GitHub organization or repository <span>*</span>
          </label>
          <input
            id="repository"
            name="repository"
            type="text"
            autoComplete="url"
            required
            placeholder="github.com/org/repository"
          />
          <label htmlFor="notes">What shared API should you review?</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="A little context helps us understand your use case."
          />
          <input
            className="honeypot"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Sending request…" : "Request pilot access"}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <p
            className="form-status"
            data-state={status.state}
            role="status"
            aria-live="polite"
          >
            {status.message}
          </p>
          <p className="form-privacy">
            Your details are used to respond to this pilot request.
          </p>
        </form>
      </div>
    </section>
  );
}

const questions = [
  [
    "Is Impact Gate generally available?",
    "No. Impact Gate is being prepared for a small private pilot. Join the waitlist for updates.",
  ],
  [
    "Will it block a pull request?",
    "No. The current product posture is warn-only: it presents review information and leaves merge decisions with your team.",
  ],
  [
    "Which contracts are in scope?",
    "The current site describes OpenAPI contract review. Other contract formats are not presented as available.",
  ],
  [
    "What happens if the analysis cannot resolve a path?",
    "The result should remain uncertain when source coverage, dynamic behavior, or resolution limits prevent a clear conclusion.",
  ],
  [
    "Does the example on this page come from a real repository?",
    "No. The evidence path on this page is explicitly illustrative and is not a live customer finding.",
  ],
];

function FAQ() {
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <div className="section-heading" data-reveal>
          <span className="eyebrow">Frequently asked</span>
          <h2 id="faq-title">Clear answers before the pilot.</h2>
          <p>
            What is available now, what is still being prepared, and where the
            boundaries are.
          </p>
        </div>
        <div className="faq-list" data-reveal>
          {questions.map(([question, answer], index) => (
            <details
              className="faq-item"
              open={index === 0}
              key={question}
              onToggle={(event) => {
                const marker =
                  event.currentTarget.querySelector("summary span");
                if (marker)
                  marker.textContent = event.currentTarget.open ? "−" : "+";
              }}
            >
              <summary>
                {question}
                <span aria-hidden="true">{index === 0 ? "−" : "+"}</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const links = [
    ["#how-it-works", "How it works"],
    ["#evidence", "Analysis states"],
    ["#changes", "Contract support"],
    ["#limits", "Limitations"],
    ["#faq", "FAQ"],
    ["#pilot", "Private pilot"],
  ];
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <LogoMark inverse />
          <p>Evidence for the changes that travel beyond your repository.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          {links.map(([href, label]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <p>© 2026 Impact Gate. All rights reserved.</p>
        <p>
          GitHub is a trademark of GitHub, Inc. Impact Gate is not affiliated
          with or endorsed by GitHub.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!targets.length || reducedMotion || !("IntersectionObserver" in window))
      return;

    document.documentElement.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -32px 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        <Hero />
        <HowItWorks />
        <EvidenceStates />
        <SupportedChanges />
        <Boundaries />
        <PilotForm />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import siteFacts from "./data/site-facts.json";
import DocsApp from "./docs/DocsApp";
import ContactPage from "./contact/ContactPage";
import { emailHref, emails } from "./ui/contact";
import { leadAttribution, trackEvent } from "./analytics";

const DependencyGraphScreen = lazy(() =>
  import("./screens/ProductScreens").then((module) => ({
    default: module.DependencyGraphScreen,
  })),
);
const DeprecationCandidatesScreen = lazy(() =>
  import("./screens/ProductScreens").then((module) => ({
    default: module.DeprecationCandidatesScreen,
  })),
);
const ReviewDeskScreen = lazy(() =>
  import("./screens/ReviewDesk").then((module) => ({
    default: module.ReviewDeskScreen,
  })),
);

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

function Header({ innerPage = false, active }: { innerPage?: boolean; active?: "/contact" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [menuOpen]);

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
    ["/docs", "Docs"],
    ["/contact", "Contact"],
  ];

  return (
    <header className="site-header" ref={header}>
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
          ref={menuButton}
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
            <a key={href} href={innerPage && href.startsWith("#") ? "/" + href : href} onClick={() => setMenuOpen(false)} aria-current={href === active ? "page" : undefined}>
              {label}
            </a>
          ))}
          <a className="mobile-sign-in" href="/sign-in" onClick={() => setMenuOpen(false)}>Sign in <span aria-hidden="true">→</span></a>
        </nav>
        <a className="header-cta" href="/sign-in">
          Sign in <span aria-hidden="true">↗</span>
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
            API change impact across repositories
          </div>
          <h1 id="hero-title">
            See which
            <br />
            downstream services
            <br />
            may be affected<span className="period">.</span>
          </h1>
          <p className="hero-lede">
            Impact Gate links an OpenAPI change to evidence in connected
            consumer code, so engineering teams can review potential impact
            before a pull request merges.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/sign-in?demo=1" data-analytics-action="live_demo">
              Try the live demo <span aria-hidden="true">→</span>
            </a>
            <a className="button secondary" href="/sign-in" data-analytics-action="use_tool">
              Use the tool
            </a>
          </div>
          <p className="hero-demo-note">
            No account needed for the demo. <a href="/review-desk" data-analytics-action="experience_product">See a sample report</a> or{" "}
            <a href="#pilot" data-analytics-action="request_pilot">join the pilot waitlist</a>.
          </p>
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
              Current pilot scope: OpenAPI contract changes.
            </span>
          </div>
        </div>
        <div className="change-list" data-reveal>
          {siteFacts.contract.changes
            .filter(([title]) =>
              [
                "Endpoint or path changes",
                "Request and response types",
                "Field removal or rename",
                "Nullability changes",
              ].includes(title),
            )
            .map(([title, copy], index) => (
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
              <strong>See the full OpenAPI coverage list.</strong>{" "}
              <a href="/docs/coverage-and-limitations">Explore all supported change types and analysis coverage.</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const does = [
  "Reviews supported OpenAPI changes in selected repositories.",
  "Finds potential downstream consumers in connected code.",
  "Links potential impact to evidence engineers can review.",
];
const doesNot = [
  "Guarantee every consumer is known.",
  "Analyze contracts outside the current OpenAPI scope.",
  "Make merge decisions for your team.",
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
          <h2 id="limits-title">Know what the evidence covers.</h2>
          <p>
            Impact Gate reviews supported OpenAPI changes against connected,
            indexed consumer code. Every result is advisory and reflects only
            the evidence available for review.
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
    if (submitting) return;
    setSubmitting(true);
    setStatus({ message: "Sending your request…", state: "" });
    const form = event.currentTarget;
    const payload = { ...Object.fromEntries(new FormData(form).entries()), attribution: leadAttribution() };
    trackEvent("form_submit", { form_name: "pilot_request" });
    let failureType = "network";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string; leadId?: string; accepted?: boolean };
      if (!response.ok) {
        failureType = response.status >= 500 ? "server" : "validation";
        throw new Error(
          result.message ||
            "We could not submit that request. Please try again.",
        );
      }
      if (result.accepted !== false)
        trackEvent("generate_lead", { form_name: "pilot_request", lead_id: result.leadId });
      setStatus({
        message:
          result.message || "Thanks. Your waitlist request was received.",
        state: "success",
      });
      form.reset();
    } catch (error) {
      trackEvent("form_error", { form_name: "pilot_request", error_type: failureType });
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
          aria-busy={submitting}
        >
          <div className="form-heading">
            <strong>Join the pilot waitlist</strong>
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
            maxLength={254}
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
            maxLength={2000}
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
            {submitting ? "Sending request…" : "Join waitlist"}{" "}
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
            Your request is saved and emailed to the Impact Gate team so they can follow
            up about the pilot. <a href="/docs/permissions-and-data#website-analytics">Data and analytics details</a>.
            {" "}Privacy questions? <a href={emailHref("privacy")}>{emails.privacy}</a>.
          </p>
          <p className="form-email-alternative">Prefer to email us? <a href={emailHref("pilot", "Impact Gate pilot request")}>{emails.pilot}</a></p>
        </form>
      </div>
    </section>
  );
}

const questions = [
  [
    "What is Impact Gate?",
    "Impact Gate reviews OpenAPI changes against connected consumer code, showing engineering teams which downstream services may be affected and linking potential impact to evidence for review.",
  ],
  [
    "Is Impact Gate generally available?",
    "No. Impact Gate is being prepared for a small private pilot. Join the waitlist for updates.",
  ],
  [
    "Will it block a pull request?",
    "No. The current product posture is warn-only: it presents review information and leaves merge decisions with your team.",
  ],
  [
    "Which API contract formats does Impact Gate review?",
    "The current site describes OpenAPI contract review. Other contract formats are not presented as available.",
  ],
  [
    "What happens if the analysis cannot resolve a path?",
    "The result should remain uncertain when source coverage, dynamic behavior, or resolution limits prevent a clear conclusion.",
  ],
  [
    "Does the evidence example on this page come from a real repository?",
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
          <p className="faq-contact">Have another question? <a href={emailHref("info")}>Ask us at {emails.info} <span aria-hidden="true">↗</span></a></p>
        </div>
      </div>
    </section>
  );
}

function Footer({ innerPage = false }: { innerPage?: boolean }) {
  const links = [
    ["#how-it-works", "How it works"],
    ["#evidence", "Analysis states"],
    ["#changes", "Contract support"],
    ["#limits", "Limitations"],
    ["#faq", "FAQ"],
    ["#pilot", "Private pilot"],
    ["/docs", "Documentation"],
  ];
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <LogoMark inverse />
          <p>Evidence for the changes that travel beyond your repository.</p>
        </div>
        <div className="footer-group"><h2>Explore</h2><nav className="footer-links" aria-label="Footer navigation">
          {links.map(([href, label]) => <a href={innerPage && href.startsWith("#") ? "/" + href : href} key={href}>{label}</a>)}
          <a href="/dashboard">Dashboard</a>
        </nav></div>
        <div className="footer-group"><h2>Get in touch</h2><nav className="footer-links footer-contact-links" aria-label="Contact the team">
          <a href={emailHref("contact")}>{emails.contact}</a><a href={emailHref("support")}>Product support</a><a href={emailHref("pilot")}>Pilot & onboarding</a><a href={emailHref("security")}>Report a vulnerability</a><a href={emailHref("privacy")}>Privacy & legal</a><button type="button" data-analytics-toggle>Usage analytics</button><a href="/contact">All contact options <span aria-hidden="true">↗</span></a>
        </nav></div>
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

function NotFound() {
  useEffect(() => {
    document.title = "Page not found | Impact Gate";
    document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex, follow");
  }, []);
  return <main className="contact-page" id="main-content" tabIndex={-1}><div className="container"><section className="contact-heading"><span className="eyebrow">Page not found</span><h1>Let’s get you back on track.</h1><p>This link doesn’t match a page on Impact Gate. Return to the home page, open your workspace, or find what you need in the docs.</p><div className="contact-heading-actions"><a className="button primary" href="/">Back to home <span aria-hidden="true">→</span></a><a className="button secondary" href="/dashboard">Open dashboard</a></div></section><aside className="contact-support-note"><div><strong>Looking for something specific?</strong><p>Browse the <a href="/docs">documentation</a> or email <a href={emailHref("support")}>{emails.support}</a>.</p></div></aside></div></main>;
}

export default function App({ pathname: requestedPath }: { pathname?: string } = {}) {
  const pathname = requestedPath ?? (
    typeof window === "undefined"
      ? "/"
      : window.location.pathname.replace(/\/+$/, "") || "/");

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

  if (pathname === "/docs" || pathname.startsWith("/docs/"))
    return <DocsApp pathname={pathname} />;
  if (pathname === "/contact")
    return <><a className="skip-link" href="#main-content">Skip to content</a><Header innerPage active="/contact" /><ContactPage /><Footer innerPage /></>;
  if (pathname === "/dependency-graph")
    return (
      <Suspense fallback={<main className="product-screen-loading" />}>
        <DependencyGraphScreen />
      </Suspense>
    );
  if (pathname === "/deprecation-candidates")
    return (
      <Suspense fallback={<main className="product-screen-loading" />}>
        <DeprecationCandidatesScreen />
      </Suspense>
    );
  if (pathname === "/review-desk")
    return (
      <Suspense fallback={<main className="product-screen-loading" />}>
        <ReviewDeskScreen />
      </Suspense>
    );
  if (pathname !== "/")
    return <><a className="skip-link" href="#main-content">Skip to content</a><Header innerPage /><NotFound /><Footer innerPage /></>;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
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


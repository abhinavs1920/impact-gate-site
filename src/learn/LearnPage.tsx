import "./learn.css";
import heroImage from "./heroImage";

const replyBars = [
  { label: "Pain or gap confirmed", value: "6 of 21", width: "75%", accent: true },
  { label: "Working process described", value: "8 of 21", width: "100%", accent: false },
  { label: "Engaged or mixed", value: "4 of 21", width: "50%", accent: false },
  { label: "Little or no pain", value: "3 of 21", width: "37.5%", accent: false },
];

const stats = [
  { num: "22", lbl: "Threads reviewed" },
  { num: "21", lbl: "Replies" },
  { num: "6", lbl: "Confirmed pain or gap" },
];

export default function LearnPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section className="learn-hero">
        <div className="container">
          <div className="hero-kicker">
            <span className="kicker-mark" aria-hidden="true">
              ◇
            </span>{" "}
            What we’re learning
          </div>
          <h1>
            What engineering teams told us about API changes<span className="period">.</span>
          </h1>
          <p className="lede">
            For three weeks we asked engineers a simple question: when an API contract changes,
            can your team find every real downstream consumer, and coordinate the owners, before
            merge?
          </p>
          <p className="support">
            We reviewed 22 conversation threads between 17 October and 1 November 2026; 21 had
            replies, with follow-ups that varied by conversation. Here is what engineers told us
            about how they handle API changes today.
          </p>
          <div className="learn-stats">
            {stats.map((stat) => (
              <div className="learn-stat" key={stat.lbl}>
                <div className="num">{stat.num}</div>
                <div className="lbl">{stat.lbl}</div>
              </div>
            ))}
          </div>
          <figure className="learn-figure">
            <img
              src={heroImage}
              width={1536}
              height={1024}
              alt="Abstract diagram: one change passes a gate and its impact fans out to downstream consumers"
            />
            <figcaption>A change passes the gate. Who downstream actually feels it?</figcaption>
          </figure>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Replies by outcome</h2>
            <p>
              Six of twenty-one replies confirmed the pain or the exact gap we work on: finding the
              real downstream consumers of a change, and knowing when it is safe to retire an old
              version. Eight described a working process, four were engaged with a mixed view, and
              three saw little or no pain.
            </p>
          </div>
          <div className="learn-chart">
            <h3>What 21 replies said</h3>
            {replyBars.map((bar) => (
              <div className="bar-row" key={bar.label}>
                <span className="bar-label">{bar.label}</span>
                <div className="bar-track">
                  <div
                    className={bar.accent ? "bar-fill accent" : "bar-fill"}
                    style={{ width: bar.width }}
                  />
                </div>
                <span className="bar-val">{bar.value}</span>
              </div>
            ))}
            <p className="chart-note">
              Our classification of 21 reply threads, 17 Oct – 1 Nov 2026 - an analyst reading of
              a small, self-selected sample from the founder’s own network, not market statistics. Roles
              and employers are withheld.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Where the pain showed up</h2>
            <p>
              Faithful paraphrases of private one-on-one replies. Roles and employers are withheld
              deliberately; these were personal conversations, never company positions.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <span className="tag">Pain confirmed</span>
              <h3>Blast radius is discovered late</h3>
              <p>
                Several engineers said the people making or reviewing a change are often not aware
                of its blast radius. Finding the real downstream consumers - and knowing when an
                old version is safe to retire - came up as the hard part.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Gap confirmed</span>
              <h3>Consumer notification is manual</h3>
              <p>
                Teams inform consumers beforehand, by hand, with room for human error. One
                engineer said a tool that identifies the downstream services of a contract and
                notifies their owners would address a genuine problem - and agreed to take a look
                at the product.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Gap remains</span>
              <h3>Tooling covers the registered, misses the rest</h3>
              <p>
                Teams with schema registries or in-house impact tooling told us one-off and older
                clients still slip past, and testing workflows around contract changes still have
                gaps.
              </p>
            </div>
          </div>
          <div className="learn-quote">
            <p>
              A diff tool can tell you the contract changed; only knowing who actually reads what
              tells you whether anyone will feel it.
            </p>
            <div className="attr">
              Paraphrased from a practitioner’s public comment on one of our articles
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>How teams cope today</h2>
            <p>
              Most replies described a working mechanism. These are the building blocks teams already
              rely on.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <h3>Version and migrate</h3>
              <p>
                Versioning with migration windows; dashboards and logs show who is still calling
                before a version is retired.
              </p>
            </div>
            <div className="learn-card">
              <h3>Know callers by credential</h3>
              <p>
                Caller credentials or service IDs in logs and telemetry tell the owning team who
                its registered consumers are.
              </p>
            </div>
            <div className="learn-card">
              <h3>Coordinate by list</h3>
              <p>
                Known-consumer lists circulate over email, or in-house tooling maps the impact.
                Both take coordination.
              </p>
            </div>
          </div>
          <p className="learn-note">
            These mechanisms generally assume the consumers are already known. The soft spot that
            came up repeatedly in the replies: the consumer nobody registered. That is the gap
            Impact Gate works on.
          </p>
        </div>
      </section>

      <section className="learn-cta">
        <div className="container">
          <div className="learn-cta-box">
            <div>
              <h2>See Impact Gate in action.</h2>
              <p>
                The demo runs on a bundled example project - no account needed. Connect GitHub to
                try it on your own repos.
              </p>
            </div>
            <div className="learn-cta-actions">
              <a className="button primary" href="/onboarding/github">
                Connect GitHub
              </a>
              <a className="button secondary" href="/demo">
                Try the demo <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

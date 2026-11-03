import "./learn.css";
import heroImage from "./heroImage";

const stats = [
  { num: "22", lbl: "Threads reviewed" },
  { num: "21", lbl: "Replies" },
  { num: "3 wks", lbl: "17 Oct - 1 Nov 2026" },
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
            <h2>How teams manage API changes today</h2>
            <p>
              Paraphrases of private one-on-one replies, with no counts attached. Roles and
              employers are withheld; these were personal conversations, never company positions.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <h3>Version and migrate</h3>
              <p>
                Some replies described versioning, keeping older contracts working, and moving
                clients over before an old version is retired.
              </p>
            </div>
            <div className="learn-card">
              <h3>Watch who is calling</h3>
              <p>
                Some described using logs, dashboards and telemetry, or caller credentials and
                service IDs, to see which clients still use a version.
              </p>
            </div>
            <div className="learn-card">
              <h3>Coordinate across teams</h3>
              <p>
                Some described circulating changes to known consumers by email, or building
                in-house tooling to track downstream services.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Where it gets hard</h2>
            <p>
              A few replies pointed at the same limit: these approaches work best when the
              consumers are already known.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <h3>Blast radius is easy to miss</h3>
              <p>
                One reply said the people making or reviewing a change are often not aware of its
                blast radius.
              </p>
            </div>
            <div className="learn-card">
              <h3>Consumers are not always known</h3>
              <p>
                One reply said consumers can be unknown, with only the hits visible in monitoring.
              </p>
            </div>
            <div className="learn-card">
              <h3>Process leans on known lists</h3>
              <p>
                One reply described a process that relies on known consumers, with unidentified
                ones expected to flag their own dependencies.
              </p>
            </div>
          </div>
          <p className="learn-note">
            Finding the consumer nobody registered is the gap Impact Gate works on. These are a
            small, self-selected set of conversations from the founder&rsquo;s own network, not
            market statistics.
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

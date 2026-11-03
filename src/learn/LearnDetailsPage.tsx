import "./learn.css";

export default function LearnDetailsPage() {
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
            The full findings<span className="period">.</span>
          </h1>
          <p className="lede">
            Over the last few weeks we asked engineers one question in one-on-one conversations:
            when an API contract changes, how does your team find the real downstream consumers
            and coordinate their owners before merge - and do your current workflows actually
            solve it?
          </p>
          <p className="support">
            This is the detailed version of <a href="/learn">the summary</a>: every mechanism,
            pain point and pushback we heard, paraphrased and anonymized. Roles and employers are
            withheld; these were personal conversations, never company positions.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>The short version</h2>
            <p>Three kinds of answers showed up. All three are on this page.</p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <span className="tag">Confirmed pain</span>
              <h3>The problem is real</h3>
              <p>
                Five engineers told us, from their own experience, that the blast radius of an API
                contract change is still a real, unsolved problem for their teams.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gaps</span>
              <h3>Setups with clear edges</h3>
              <p>
                Several more described setups that work - and exactly where they stop: unknown
                consumers, service-level visibility, and manual owner coordination.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Working today</span>
              <h3>Solved for some</h3>
              <p>
                A few told us this is not a pain for them, and explained why: written-down
                contracts, versioning, and mandated caller identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Confirmed pain points</h2>
            <p>
              Replies that explicitly confirmed the problem from the engineer&rsquo;s own
              experience, paraphrased.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <span className="tag">Confirmed pain</span>
              <h3>Blast radius is invisible at review time</h3>
              <p>
                Most of the time, the people making or reviewing a change do not know its blast
                radius.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Confirmed pain</span>
              <h3>Still an open problem</h3>
              <p>
                Blast radius is still a problem that people are actively trying to solve.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Confirmed gap</span>
              <h3>A testing workflow gap</h3>
              <p>There is still a gap in testing workflows when an API contract changes.</p>
            </div>
            <div className="learn-card">
              <span className="tag">Confirmed pain</span>
              <h3>Registries only see the registered</h3>
              <p>
                Even with a schema registry in place, it covers registered app-to-app traffic.
                Older or open clients can still fly under the radar.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Confirmed gap</span>
              <h3>Manual notification leaks</h3>
              <p>
                Consuming teams are informed through a manual process, which has room for human
                error. Automatically identifying downstream services and notifying their owners
                would address a genuine problem.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">In between</span>
              <h3>Real, with a safety net</h3>
              <p>
                One engineer confirmed contract changes can have a blast radius - and finds
                contract tests catch it early and reduce the blast. We read this as confirming the
                problem exists, not as a workflow failing.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>Where today&rsquo;s mechanisms stop</h2>
            <p>
              These replies did not frame the problem as pain. They described, concretely, where
              their current setup stops.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>HTTP has no contract tests</h3>
              <p>
                Events and shared libraries run smoothly because the contract is written down and
                versioned. For HTTP between services there are no shared types or contract tests,
                and clients are hand-written. Observability shows which services call an endpoint,
                not which fields they read - so a breaking change still means reading the
                caller&rsquo;s code. Mobile apps and devices appear as traffic, not as named
                callers. It still depends on people knowing the system.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>Hits are visible, consumers are not</h3>
              <p>
                Runtime monitoring mostly shows the hits. Sometimes the consumer behind them never
                becomes known at all.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>Communication alone is not enough</h3>
              <p>
                Communication does not solve this at platform level unless technical safeguards
                back it: canary rollouts behind feature flags, a versioned envelope consumers can
                fall back on, and consumer-side monitors. Adding optional fields rarely breaks
                anyone; deleting fields is what creates panic.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>The known-consumer list</h3>
              <p>
                A change announcement goes by email to the teams currently known to consume the
                API, and any team not on the list is expected to flag its own dependency. Unlisted
                dependencies have surfaced before - rarely, but they have.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>Async needed an in-house fix</h3>
              <p>
                The hard case was downstream services called asynchronously, until an in-house
                wrapper around the message queue made async consumers enumerable. Coordinating
                with code owners is still manual whenever a request shape changes.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Mechanism gap</span>
              <h3>Maps without owners</h3>
              <p>
                Dependency mapping shows which services a change might affect. Mapping that back
                to the right owners - and keeping contract test coverage adequate - still takes
                manual coordination and validation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>What solved looks like</h2>
            <p>
              Some replies told us plainly that this is not a pain for them. That signal matters
              too.
            </p>
          </div>
          <div className="learn-grid">
            <div className="learn-card">
              <span className="tag">Working today</span>
              <h3>Contracts written down</h3>
              <p>
                Where the contract is strongly typed and versioned - or every change goes out
                behind a version that keeps the old one working - teams told us this simply is not
                a problem for them.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Working today</span>
              <h3>Caller identity mandated</h3>
              <p>
                Some teams require every client to send its details and publish events at each leg
                of a call, so the caller list is complete by construction.
              </p>
            </div>
            <div className="learn-card">
              <span className="tag">Working today</span>
              <h3>Honest about limits</h3>
              <p>
                One engineer declined to call this a recurring pain from limited exposure - while
                agreeing that identifying dependencies and coordinating owners gets harder as a
                microservices ecosystem grows.
              </p>
            </div>
          </div>
          <p className="learn-note">
            The pattern across all three groups: where contracts are written down, versioned, and
            consumers are registered, the process works. Trouble concentrates where consumers are
            unknown, unregistered, old, or asynchronous - and where visibility stops at the
            service level instead of the field level.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <h2>What we are taking from it</h2>
          </div>
          <div className="learn-quote">
            <p>
              Teams can generally manage the consumers they know about. The gap is the consumer
              nobody registered: the old pinned client, the cron job, the one-off internal tool,
              the mobile app that only ever shows up as traffic.
            </p>
            <p className="attr">
              That is the gap Impact Gate works on. Before a merge, Impact Gate checks an API
              change against its downstream consumers and shows a warn-only impact summary, so an
              unregistered consumer surfaces before the change ships - not after.
            </p>
          </div>
          <p className="learn-note">
            Method note: these findings come from one-on-one conversations with engineers, held
            between 17 October and 2 November 2026. The set is small, self-selected and drawn from
            the founder&rsquo;s own network. Replies are paraphrased and anonymized; messages
            their authors later deleted are not used. Directional signal, not market statistics.
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

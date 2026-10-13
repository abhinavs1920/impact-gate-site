# Impact Gate teaser script

**Audience:** platform and infrastructure engineers who own a shared API consumed by many services, especially when the caller list is no longer held reliably in memory.

**Value sentence:** It reads your pull request, finds which services call the endpoint you changed, and shows you the exact line that breaks — before you merge.

**CTA:** Connect GitHub and review your first API change at impactgate.in.

This version is deliberately evidence-gated. The current session could not run the product commands because `pnpm` is unavailable, so no live terminal output or current PR comment is represented as product evidence.

| Time | Beat | Visual | VO line |
|---|---|---|---|
| 0:00–0:08 | The false sense of safety | **SCREENSHOT BLOCKED:** capture a real green test run only after a working runtime is available. Do not fabricate this frame. | “Your tests pass. Your CI is green. You merge.” |
| 0:08–0:18 | The invisible dependency | **GENERATE:** text-free network graphic: one API node with quiet connections to many service nodes. | “But services you did not open today can still depend on that API.” |
| 0:18–0:35 | The product, live | **SCREENSHOT BLOCKED:** capture `pnpm cli --help`, then a fresh `pnpm cli analyze ... --no-llm` run with its real output. Capture `pnpm samples:render` and one regenerated Markdown comment only after those commands run successfully. | “Impact Gate is designed to read the contract diff, trace callers in the service graph, and surface evidence for review.” |
| 0:35–0:48 | The honesty layer | **SCREENSHOT BLOCKED:** capture the current renderer’s real `usage not located` or incomplete state after a successful fresh render. Until then, show only a text-free abstract gate motif. | “When the evidence is incomplete, it says so. It does not turn uncertainty into a clean result.” |
| 0:48–0:58 | Get started | **GENERATE:** quiet, text-free desk scene with an empty dark terminal frame reserved for later compositing. Add the Connect GitHub CTA in the editor, not in generated pixels. | “Impact Gate is open to teams. Connect GitHub and review API changes with evidence and uncertainty visible.” |
| 0:58–1:00 | Logo hold | **GENERATE:** text-free ripple and gate motif. Composite the exact wordmark and Connect GitHub CTA in the editor. | Silence, with a short resolving tone. |

The live site now states that Impact Gate is open to teams. Update the final video edit to match before publishing; the existing hosted videos have not been re-cut here.

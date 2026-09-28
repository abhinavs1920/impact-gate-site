# Impact Gate teaser assembly

This folder contains a ground-truth record and an evidence-gated teaser plan. The current record says the required CLI and renderer commands could not run because `pnpm` was unavailable, so blocked screenshot steps must be completed before any product-text shot is published.

Assemble in this order:

1. Restore a working Node and pnpm environment, then capture the real CLI help, a real `--no-llm` analysis, and a real renderer output.
2. Reconcile those captures into `PRODUCT_TRUTH.md`; remove any blocked labels only when the evidence exists.
3. Capture the terminal and Markdown evidence as locked screen assets.
4. Produce only the text-free generated b-roll from `IMAGE_PROMPTS.md`.
5. Feed each locked capture or generated asset to Veo using the matching prompt in `VEO_PROMPTS.md`.
6. Assemble the clips outside these tools in a video editor with the voiceover, sound design, exact composited product text, and waitlist CTA.

Veo prompts alone do not produce a finished file containing mixed real footage, generated animation, and voiceover. The final assembly happens in an editor.

## Website development

The public site is a React/Vite application. The Cloudflare Worker in `src/worker.ts` serves the Vite `dist/` assets and handles `/api/waitlist`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm verify:site
```

GitHub Actions verifies pull requests and deploys pushes to `main` using Wrangler. Configure the repository variable `CLOUDFLARE_ACCOUNT_ID` and secret `CLOUDFLARE_API_TOKEN` before enabling deployments. The token needs permission to deploy Workers and manage Worker routes.

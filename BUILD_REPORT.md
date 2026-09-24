# Build report

## Source mapping

The primary Stitch Home Page desktop export is implemented by `src/pages/index.astro` and the section components under `src/components/`. The mobile Home Page exports use the same source with responsive CSS. The Ledger dark review variant maps to `Hero.astro` and `EvidenceDemo.astro`; the Blast Radius direction maps to the problem and evidence-state sections.

The Stitch comparison index is intentionally not a live route because it is a design-review artifact rather than the waitlist page. The raster logo exports are rebuilt as inline SVG in `BrandMark.astro`.

## Honesty changes

Synthetic incident copy, customer-like service names, line numbers, audit hashes, metrics, adoption counts, pricing claims, and roadmap promises from the Stitch export were removed. Live copy is sourced from `src/data/site-facts.json`.

## Performance

No Lighthouse result is claimed. The environment used for this build did not provide `node` or `pnpm`, so the production build and Lighthouse run could not execute in this session. `pnpm verify:site` is the intended gate once dependencies are installed; it builds the site, checks rendered content, and leaves the Lighthouse run as an explicit required production verification step rather than fabricating a result.

## Deployment

`wrangler.jsonc` points Cloudflare static assets at `dist/`, runs the `/api/*` route through the Worker, and leaves other files as static assets. `public/_headers` sets immutable caching for hashed assets and short revalidation for the root document.

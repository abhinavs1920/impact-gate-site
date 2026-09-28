# Build report

## Source mapping

The primary Stitch Home Page desktop export is implemented by the React page in `src/App.tsx`. The mobile Home Page exports use the same source with responsive CSS in `src/styles/site.css`. The Ledger dark review variant maps to the hero evidence card; the Blast Radius direction maps to the problem and evidence-state sections.

The Stitch comparison index is intentionally not a live route because it is a design-review artifact rather than the waitlist page. The raster logo exports are rebuilt as inline SVG in the React wordmark.

## Honesty changes

Synthetic incident copy, customer-like service names, line numbers, audit hashes, metrics, adoption counts, pricing claims, and roadmap promises from the Stitch export were removed. Live copy is sourced from `src/data/site-facts.json`.

## Performance

`pnpm verify:site` builds and prerenders the React page, runs the TypeScript check, and checks rendered content. No Lighthouse result is claimed.

## Deployment

`wrangler.jsonc` points Cloudflare static assets at `dist/`, runs the `/api/*` route through the Worker, and leaves other files as static assets. `public/_headers` sets immutable caching for hashed assets and short revalidation for the root document.

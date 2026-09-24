# Build status

## Complete

- Stitch project and design systems inventoried.
- Primary desktop and mobile exports fetched.
- Astro static site source scaffolded around the Ledger direction.
- Capability copy is sourced from `src/data/site-facts.json`.
- Robots are noindex/disallow-all.
- No third-party runtime requests are included.
- Cloudflare Workers configuration and waitlist route are included.

## Explicit Stitch deviations

- Stitch contained synthetic pull-request incidents, service names, line numbers, audit hashes, evaluation percentages, pilot capacity, pricing language, and roadmap claims. These are not shipped.
- The comparison-index screen is a design-review artifact, not a public site screen, so it is documented but not exposed as a route.
- Raster logo exports were not shipped as UI. The mark is rebuilt as inline SVG/CSS.
- Stitch requested hosted Google fonts and Tailwind CDN. Those were removed to satisfy the no-third-party-request and production performance constraints. The token file retains the Stitch family names with local system fallbacks.

## Validation limitation

The current environment does not provide `node` or `pnpm`, so `pnpm verify:site`, Astro build, Worker tests, and Lighthouse could not be executed in this session. No performance result is claimed in `BUILD_REPORT.md`.

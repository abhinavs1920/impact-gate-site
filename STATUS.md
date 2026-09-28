# Build status

## Complete

- Stitch project and design systems inventoried.
- Primary desktop and mobile exports fetched.
- React/Vite static site migrated from Astro, server-rendered at build time, and deployed through the Cloudflare Worker.
- GitHub Actions verifies pull requests and deploys pushes to `main` with Wrangler; configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the GitHub repository first.
- Capability copy is sourced from `src/data/site-facts.json`.
- Robots are noindex/disallow-all.
- Google Fonts loads from Google Fonts with local system fallbacks; no third-party JavaScript or embedded video is included.
- Cloudflare Workers configuration and waitlist route are included.

## Explicit Stitch deviations

- Stitch contained synthetic pull-request incidents, service names, line numbers, audit hashes, evaluation percentages, pilot capacity, pricing language, and roadmap claims. These are not shipped.
- The comparison-index screen is a design-review artifact, not a public site screen, so it is documented but not exposed as a route.
- Raster logo exports were not shipped as UI. The mark is rebuilt as inline SVG/CSS.
- Tailwind CDN was not included. The page uses Google Fonts with local system fallbacks.

## Validation limitation

`pnpm verify:site` runs the Vite production build, React type-check, and content assertions. The Cloudflare Worker is configured in `wrangler.jsonc`; the automated deployment workflow uses that configuration.

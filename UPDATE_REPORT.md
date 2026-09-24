# Final update report

## Reference inventory

The supplied archive contains `reference/logo/logo-source.png`, `reference/logo/logo-colors.json`, and `reference/screens_from_videos/README.md`. There are no extracted PNG frames beyond the README, so frame-driven middle sections were skipped rather than inferred.

The logo frame shows a navy tile with two white inward-facing chevrons, two green rounded vertical bars, and a row of white connector dots. It is rebuilt as inline SVG in `src/components/LogoMark.astro`.

## Video status

No `CLOUDFLARE_STREAM_VIDEO_UID_HOWTO.md`, `.env`, Stream customer code, or video UIDs were supplied. `VideoFacade.astro` is wired into both requested placements, but both facades remain disabled placeholders until `PUBLIC_STREAM_CUSTOMER_CODE`, `PUBLIC_STREAM_VIDEO_UID_HOW_IT_WORKS`, and `PUBLIC_STREAM_VIDEO_UID_IMPACT` are supplied in a local `.env`.

When configured, the facade emits only a lazy poster image and creates the Cloudflare Stream iframe after the user clicks play. With the current pending configuration, no Stream URL is emitted at all.

## Changed files

- `src/components/LogoMark.astro`: reusable SVG mark with staggered dot pulse, out-of-phase bar breathing, header hover/focus nudge, and reduced-motion handling.
- `src/components/BrandMark.astro`: uses the new mark in the existing header/footer wordmark.
- `src/styles/tokens.css`: adds the sampled `--brand-mark-green` token and mark ink token.
- `public/favicon.svg`: static version of the same mark on the supplied navy background.
- `src/components/VideoFacade.astro`: click-to-play Cloudflare Stream facade with no iframe on initial render.
- `src/pages/index.astro`: adds impact and how-it-works video placements without changing the existing section theme.
- `src/components/Hero.astro`: existing See how it works action now targets the new video section.
- `.env.example`, `docs.env.example`: documents the three required local Stream variables.
- `UPDATE_REPORT.md`: records the source inventory and current limitations.

## Verification

The current environment does not include a browser automation tool, so changed-page screenshots and a real browser network trace could not be captured in this session. The repository's previous local server was running before this update; after source changes, a fresh build/server verification is required.

No Lighthouse numbers are claimed because no fresh Lighthouse run was available. The Stream facade design intentionally creates no iframe until click, but the requested network-trace proof remains pending browser tooling and real UIDs.

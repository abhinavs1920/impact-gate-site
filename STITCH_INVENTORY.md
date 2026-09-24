# Stitch inventory

Project: `projects/15953705797364082931` — `impact-gate`

## Design systems

| Asset | Name | Mode | Fonts | Primary | Radius |
|---|---|---|---|---|---|
| `assets/12022950597052725610` | Impact Gate — Careful Review Desk | Light | Libre Caslon Text / Hanken Grotesk | `#2B3AC4` | Round eight |
| `assets/1959869190170846024` | Impact Gate — Ledger | Light | Libre Caslon Text / Hanken Grotesk | `#2B3AC4` | Round four |
| `assets/4064342629320362466` | Impact Gate — Diff | Dark | Hanken Grotesk | `#6CB6FF` | Round four |
| `assets/8642424610452069286` | Impact Gate — Blast radius | Light | Hanken Grotesk | `#0E6E75` | Round twelve |

## Screens

| Stitch screen | Device | Export | Implementation |
|---|---|---|---|
| `b07cdc33bc6f449489c7d07a67d28763` — Home Page | Desktop | HTML, no screenshot | `src/pages/index.astro` |
| `db2d46c1cbe94d54bf10eda115296bb2` — Home Page (Rebranded) | Desktop | HTML + screenshot | `src/pages/index.astro` |
| `f41bcd3ed3c3440488e1432b70ff8a83` — Home Page | Desktop | HTML + screenshot | `src/pages/index.astro` |
| `abf260bbbd19411895bad54ba056715d` — Direction A: Ledger (Dark Review Variant) | Desktop | HTML + screenshot | `src/components/EvidenceDemo.astro` and hero theme |
| `b6581658979f4dd2871b988872bce1ff` — Direction C: Blast Radius | Desktop | HTML + screenshot | `src/components/ProblemSection.astro` and `src/components/EvidenceStates.astro` |
| `b228fe48ec13492988afdf7d7ea019c54` — Review-Pack Comparison Index | Desktop | HTML + screenshot | Not a public site route; comparison artifact only |
| `ac0a53642a6f456cb96fbf4e59fdde70` — Home Page (Mobile 390px Rebranded) | Mobile | HTML + screenshot | Responsive `src/pages/index.astro` |
| `b95b3e3936fb42e8bde3b86018a2a718` — Direction A: Ledger (Mobile 375px) | Mobile | HTML + screenshot | Responsive `src/pages/index.astro` |
| `5157158516535618401` — Impact Gate logo asset | Asset | Raster | Rebuilt as inline CSS/SVG mark in `src/components/BrandMark.astro` |
| `8105660737049759018` — Impact Gate logo asset | Asset | Raster | Rebuilt as inline CSS/SVG mark in `src/components/BrandMark.astro` |

## Token extraction

The primary Ledger export uses:

- Background `#F8F9FB`, surface `#FFFFFF`, navy `#0D1E38`, primary `#2B3AC4`, green action `#B7F36B`, muted text `#535F6F`, border `#C6C5D7`, gold `#E9C27A`.
- Display family: Libre Caslon Text.
- Body and label family: Hanken Grotesk.
- Eight-pixel card radius for the primary direction.
- Four-pixel baseline spacing with a two-pixel Stitch spacing scale.

The exact values are centralized in `src/styles/tokens.css`.

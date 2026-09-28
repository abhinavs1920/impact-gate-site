# ADR-0001: Keep the marketing site separate from the analyzer

- Status: Accepted
- Date: 2026-09-28

## Context

The current repository is a React/Vite marketing site deployed on Cloudflare with a waitlist endpoint and illustrative evidence UI. The product brief describes a production static-analysis engine with parsers, graph storage, incremental analysis, and GitHub review integration.

Combining those concerns in the existing page repository would make the site harder to deploy, expose analyzer internals through the public bundle, and encourage synthetic UI examples to be mistaken for real findings.

## Decision

Keep this repository responsible for the public product surface and pilot intake. Implement the analyzer as a separate package/service boundary with shared, versioned finding contracts once Stage 1 begins.

The website may consume sanitized finding examples or a read-only findings API later, but it must not execute repository analysis in the browser or embed proprietary traversal logic.

## Options considered

1. **Add the analyzer directly to the site.** Rejected: wrong runtime boundary, larger attack surface, and poor separation of static UI from resource-intensive analysis.
2. **Rewrite the website around an analyzer backend now.** Rejected: no current analyzer exists and it would replace working product communication before the vertical slice is validated.
3. **Keep a documented boundary and add a separate analyzer incrementally.** Chosen: preserves working UX while allowing a real evidence contract to replace illustrative content.

## Tradeoffs

- A shared findings contract must be designed carefully.
- Local development spans two packages or services.
- The marketing site cannot display live findings until an authenticated adapter exists.

## Migration path

1. Define domain IDs, evidence, finding, and classification schemas in Stage 1.
2. Add a fixture-backed findings payload to the analyzer package.
3. Add a server-side adapter for sanitized pilot findings.
4. Replace illustrative cards only when evidence is real and provenance is available.

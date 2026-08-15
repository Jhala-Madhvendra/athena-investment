# Engineering Concept: Source Traceability

## Definition

Every fact Athena's AI states must be traceable back to a specific, verifiable origin — a context field the user could look up themselves (Sprint 8: `ratios.profitability.grossMargin`), or, as of Sprint 10, a specific news article's URL. Traceability isn't a UI nicety layered on afterward — it's enforced server-side, so an untraceable claim is stripped before the client ever sees it, not just hidden by convention in the frontend.

## Why we use it

An AI-generated research report that reads as authoritative but can't be checked is worse than no report at all — it invites misplaced trust. Athena's whole design philosophy for the AI layer (Sprint 8's `AIResponseValidation.md`, `StructuredLLMOutput.md`) is that the LLM interprets, it never originates a fact — and interpretation without traceability is indistinguishable, to a reader, from fabrication. Source traceability is what lets a user (or an auditor, or a future engineer debugging a bad report) answer "why did the AI say this" with a concrete, checkable answer every time.

## Alternatives considered

- **Trust the model's own citations without server-side verification.** Rejected — LLMs are known to generate plausible-looking but fabricated citations; Sprint 8 already built `sanitizeSectionEvidence` specifically to strip any cited path the model wasn't actually given, and Sprint 10 extends the same allow-list check to article URLs rather than trusting the model's self-reported sources.
- **Show only a generic "sourced from recent news" disclaimer instead of per-article links.** Rejected — a generic disclaimer satisfies nothing about *which* article; the sprint brief is explicit that every displayed news item, and every AI reference to one, must retain its original URL, source, and publication date so the user can independently verify.
- **Link to a search query instead of the exact article URL.** Rejected — a search link doesn't guarantee it surfaces the specific article the claim was based on, especially as search results change over time; the exact stored `url` is the only link that's actually verifiable against what the AI saw.

## Trade-offs

- **Pro:** the mechanism is the same one already built and tested for numeric context fields (`evidenceAllowList` + `sanitizeSectionEvidence`) — extending it to news required no new validation code, just adding URLs to the same allow-list array (see `AIContextWithExternalSources.md`).
- **Pro:** because citations are checked against the exact set of URLs given to the model (not "any URL that looks real"), the AI cannot cite an article it wasn't actually shown, even if it invents a plausible-looking one.
- **Con:** if the model cites zero URLs for its "Recent Developments" text (a valid but unhelpful response), there's no hard failure forcing it to — `sectionEvidence` entries are always optional per the existing Sprint 8 design, so unattributed-but-not-fabricated prose can still pass validation. Accepted, since the alternative (rejecting an otherwise-good report for missing an evidence chip) would reject more good reports than it catches bad ones.
- **Con:** traceability guarantees the *cited* facts are real and sourced — it doesn't and can't guarantee the model's *interpretation* of those facts is correct; that judgment is still left to the reader, by design (see `QualitativeVsQuantitativeAnalysis.md`).

## How Athena implements it

Every `NewsArticle` document, every API response, and every context object the AI ever sees carries `url`, `source`, and `publishedAt` end to end — none of these fields are ever dropped between storage and display. The frontend's `NewsCard` and the AI report's `EvidencePanel` (extended in Sprint 10 to render a URL-shaped citation as an actual clickable outbound link, not a mangled dot-path label) both link out with `target="_blank" rel="noopener noreferrer"`, and neither ever reproduces the article's own text — only Athena's own title/description/category, always alongside the link to the original.

## Interview questions

1. *"How does Athena prevent an AI-hallucinated news citation from reaching the user?"* — `ai.validator.js`'s `sanitizeSectionEvidence` filters every cited value (whether a context path or a URL) against a server-computed allow-list built from what was actually sent to the model — anything not in that list is silently dropped from the response, never surfaced as if it were a real citation.
2. *"Why extend the existing evidence-allow-list mechanism for news instead of building a separate citation-verification system?"* — The underlying problem is identical — verify a model's self-reported citation against a known-good set before trusting it — so reusing the mechanism avoided duplicating validation logic and kept one code path, already tested in Sprint 8, responsible for every kind of citation Athena's AI can make.

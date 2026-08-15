# Engineering Concept: AI Context with External Sources

## Definition

`ai.contextBuilder.js`'s `buildResearchContext` assembles a compact JSON object from Athena's own internal engines (profile, ratios, analysis, market data, DCF, comps) and hands it to the LLM as the *only* source of facts it's allowed to use. Sprint 10 adds `recentEvents` as the context's first section sourced from *external* data (news, ultimately from Yahoo/Marketaux) rather than purely Athena's own computed engines — a meaningful architectural first, handled carefully to not break the context builder's existing guarantees.

## Why we use it

The Sprint 8 AI Research Analyst was deliberately built so every fact the LLM can state is traceable to something Athena itself calculated or stored — never invented, never fetched live from an uncontrolled source mid-generation. Extending that context with news has to preserve the same guarantee even though the underlying data now originates outside Athena's own calculations: the context builder still reads only from Athena's own database (via `news.service.js`'s DB-only `getRecentArticlesForContext`), never by calling a live news provider mid-report-generation, so "what the LLM sees" is always exactly what a user could independently verify by visiting the News & Events tab.

## Alternatives considered

- **Call the news provider live, inside `buildRecentEventsSection`, instead of reading from storage.** Rejected — this would make AI report generation dependent on the news provider's uptime/latency/rate limit, add unpredictable latency to an already-slow LLM call, and — critically — mean the events shown to the LLM might not match what's actually stored and shown to the user in the News & Events tab, breaking the source-traceability guarantee.
- **Include full article text in the context.** Rejected per `GroundedNewsSummarization.md` — token cost and redistribution-rights concerns both argue against it; title/description/source/date/category/url is enough for grounded interpretation.
- **A separate context object for news, sent to the LLM as a second message.** Rejected — `recentEvents` fits naturally as one more section alongside `profile`/`ratios`/`dcf`/etc. in the existing single-context-object design; a second message would complicate the prompt structure for no benefit.

## Trade-offs

- **Pro:** `recentEvents` follows the exact same `{available, ...}` / `{available: false, reason}` contract every other section already uses — the LLM's instructions ("if a section has available: false, say Data unavailable") apply to news with zero special-casing.
- **Pro:** because the section is DB-only, generating an AI report never triggers a live news fetch as a side effect — the two features (deterministic news, AI research) stay operationally independent, exactly as the sprint brief requires ("the deterministic pipeline must exist independently").
- **Con:** if a ticker's news hasn't been fetched by anyone yet (no watchlist row, no News tab visit), `recentEvents` will be `available: false` even though live news might exist — the AI report reflects what Athena has already retrieved, not the full state of the world. Accepted, since fetching news specifically to feed an AI report would violate the "AI is not the primary retrieval mechanism" rule.
- **Con:** `recentEvents.events` (an array of article objects) doesn't fit the context builder's existing `flattenPaths` evidence-path mechanism, which only flattens arrays of primitives — handled by a small, explicit special case in `buildEvidenceAllowList` (pushing each event's `url` directly) rather than generalizing the flattening logic for one new case.

## How Athena implements it

`buildRecentEventsSection(ticker)` calls `newsService.getRecentArticlesForContext(ticker, MAX_RECENT_EVENTS)` (capped at 5 — this feeds a prompt, not a news feed) and maps each stored article to the minimal six fields the prompt needs. It's wired into `buildResearchContext`'s existing `Promise.all` alongside every other section, so it fails independently (a DB error here can't block the rest of the report) and is included in `dataFreshness`-style reasoning implicitly (each event carries its own `publishedAt`, so staleness is visible per-event rather than needing a new top-level freshness field).

## Interview questions

1. *"Why does the AI context builder read news from Athena's own database instead of calling the news provider directly?"* — To guarantee what the LLM sees is identical to what a user can independently verify in the News & Events tab, to keep AI report generation from depending on a second external API's uptime, and to keep the deterministic news pipeline and the AI research pipeline architecturally independent, per the sprint's explicit requirement.
2. *"How does `recentEvents` fit into the existing evidence-allow-list mechanism given it's an array of objects, not primitive values?"* — The generic `flattenPaths` recursion intentionally skips arrays of objects (the same reason `analysis.insights` produces no evidence paths) since there's no single scalar "value" to cite per array item — `buildEvidenceAllowList` instead special-cases `recentEvents` by pushing each event's `url` directly into the allow-list, treating "the whole article" as the citable unit rather than any individual field within it.

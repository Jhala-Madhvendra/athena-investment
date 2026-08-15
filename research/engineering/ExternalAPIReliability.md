# Engineering Concept: External API Reliability

## What it is

The discipline of assuming every call to a third-party service (Yahoo Finance, Marketaux, an LLM provider) will eventually fail, time out, or rate-limit — and designing the calling code so that failure degrades gracefully instead of crashing, hanging, or corrupting state. Sprint 10's news pipeline is the newest surface area this applies to, alongside the Yahoo Finance integration from Sprint 1 and the LLM provider abstraction from Sprint 8.

## Why we use it

Athena depends on multiple external, unofficial, or third-party-quota-limited APIs. None of them offer an uptime or latency guarantee to Athena, and several (Yahoo's unofficial endpoints, a free-tier news API) are explicitly lower-reliability than a paid, contracted API would be. A single unhandled timeout or rate-limit response anywhere in that surface would otherwise take down a request path that has nothing to do with the actual failure — a stale news refresh shouldn't break a user's ability to view a company's financial statements.

## Alternatives considered

- **Retry with exponential backoff on every external call.** Rejected as the default for news specifically — retries make sense for the LLM provider (Sprint 8 retries exactly once on a malformed *response*, not a transport failure) but for news, a failed refresh has an acceptable fallback (serve cached data) that's strictly better than delaying the response for a retry that might fail again.
- **Circuit breaker (stop calling a provider for a cooldown period after repeated failures).** Rejected as unnecessary for this sprint's scale — Athena's request volume to any single provider is low enough that a circuit breaker's main benefit (protecting the provider, and Athena, from a thundering-herd retry storm) doesn't yet apply; the TTL-gated refresh already limits call frequency per ticker.
- **Let a provider failure surface as a hard error to the user.** Rejected for the read path (`GET /api/news/:ticker`) — a transient provider hiccup shouldn't make previously-fetched news disappear from the page; it's kept for the explicit `POST /refresh` action, where the user took a deliberate action and deserves to know it didn't work.

## Trade-offs

- **Pro:** a provider outage degrades one feature's freshness, not the whole page — `getNews`'s try/catch around `refreshFromProvider` means a Yahoo outage never blocks the rest of the News & Events tab, or the Watchlist, or the AI Research report.
- **Pro:** every outbound call goes through `fetchWithTimeout` (`backend/utils/fetchWithTimeout.js`), Athena's shared timeout wrapper, so a stalled provider can't hang a request indefinitely regardless of which domain is calling it.
- **Con:** silently degrading (log a warning, return cached/empty data) means a persistent misconfiguration (e.g. an expired `MARKETAUX_API_KEY`) can go unnoticed by end users — mitigated only by the explicit `logger.warn` a developer/operator would see in server logs, not by any user-facing alert.
- **Con:** `POST /refresh` deliberately does *not* swallow the error (it propagates to a 502) — the right choice for an explicit user action, but it means a flaky provider makes the Refresh button feel unreliable even when the underlying cached data is fine.

## How Athena implements it

Three concrete patterns recur across the news pipeline: (1) `getNews`'s refresh attempt is wrapped in try/catch and logged, never thrown, because it's an implicit background action within a read; (2) `getLatestStoredArticle` and `getRecentArticlesForContext` (used by the Watchlist and the AI Context Builder respectively) catch *any* error, including their own DB read, and return `null`/`[]` — because both callers already have an established "never throws, degrades this one field" contract (`watchlist.service.js`'s `buildWatchlistRow`, `ai.contextBuilder.js`'s `unavailable()` sections) that a news failure must not violate; (3) `refreshNews` (the explicit POST action) does *not* catch — it's the one path where the caller wants to know a call genuinely failed.

## Interview questions

1. *"Why does a failed news refresh inside GET /api/news/:ticker not return an error to the client?"* — Because the endpoint has a reasonable fallback (whatever's already cached, even if empty) that's strictly more useful to the user than an error page, and the refresh was an implicit side effect of the read, not something the user explicitly asked for and is waiting on.
2. *"Where in the codebase does the exact same 'never throw, degrade one field' pattern appear outside of news?"* — `ai.contextBuilder.js`'s per-section builders (`buildProfileSection`, `buildDcfSection`, etc.) each catch their own errors and return `{available: false, reason}` instead of throwing, and `watchlist.service.js`'s `buildWatchlistRow` does the same per data source (market, analysis, DCF) — Sprint 10's `getLatestStoredArticle`/`getRecentArticlesForContext` deliberately reuse this same shape rather than inventing a new failure-handling convention.

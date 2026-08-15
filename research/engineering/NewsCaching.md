# Engineering Concept: News Caching & Persistence

## What it is

Normalized, classified, deduplicated news articles are persisted in MongoDB (`NewsArticle`, `backend/news/news.model.js`), not recomputed per request the way DCF/Comps outputs deliberately are (see `DCFProductDesign.md`'s "never persist derived analysis" precedent). `GET /api/news/:ticker` reads from this store; it only calls the live provider first if nothing is stored yet or the freshest stored article for that ticker is older than `NEWS_CACHE_TTL_MS` (default 4 hours). `POST /api/news/:ticker/refresh` always calls the provider, ignoring the TTL. A Mongo TTL index on `retrievedAt` auto-expires articles after `NEWS_RETENTION_DAYS` (default 90).

## Why we use it

News is genuinely reusable data — the same article is relevant to every user who looks up that ticker, unlike a user-specific DCF assumption. Persisting it means repeated requests for the same ticker don't repeatedly hit an external, rate-limited, possibly-paid API; it also makes deduplication *possible* in the first place (there's nothing to deduplicate against without a store), and gives the AI Context Builder a stable, DB-only source of recent events instead of a live network call embedded inside every research-report generation.

## Alternatives considered

- **No persistence — always call the provider live.** Rejected — the sprint brief explicitly calls out external API rate limits/quotas/cost as a real constraint (especially for Marketaux's free tier), and a "call the provider on every page view" design would burn through a daily quota on a handful of user sessions.
- **In-memory-only cache (a `Map`, like `market.service.js`'s short-TTL quote cache).** Rejected as the *only* store — an in-memory cache is lost on every server restart and shared across all instances only if there's exactly one process, neither of which is true for durable article history or for AI context lookback across days. `market.service.js`'s quote cache is a good pattern for a 60-second price snapshot; news needs to survive longer and be queryable historically.
- **A separate archival/cold-storage tier for old articles.** Rejected as unnecessary complexity for this sprint's scope — a flat Mongo TTL index (`retrievedAt` + `NEWS_RETENTION_DAYS`) gives "keep for N days, then drop" with zero additional infrastructure, and nothing in Athena currently needs news older than that.

## Trade-offs

- **Pro:** a request for a ticker whose news was just fetched (by any user) is instant and free — no provider call at all.
- **Pro:** retention via a Mongo TTL index requires no cron job, no scheduled task, and no manual cleanup code — MongoDB removes expired documents on its own background sweep.
- **Con:** the TTL-gated refresh means a request can occasionally serve up-to-4-hour-stale news rather than the absolute latest — an explicit trade of freshness for provider-call volume, made visible to the user via the "Athena last checked news Xh ago" timestamp rather than hidden.
- **Con:** if a refresh's provider call fails (timeout, rate limit, misconfiguration), `getNews` degrades to serving whatever's cached (possibly empty) rather than surfacing the failure as an error — the right choice for a page load, but it means a persistent provider outage is invisible unless someone checks server logs or explicitly hits Refresh.

## How Athena implements it

Cache freshness is decided per-ticker by the *newest* `retrievedAt` among its stored articles (`getFreshestRetrievedAt`), not a single global timestamp — a ticker no one has looked up yet is always treated as stale on first request. The refresh-on-stale-GET logic mirrors `market.service.js`'s `isCoverageSufficient` gate almost exactly (check freshness → conditionally refresh → always read from the store afterward), a deliberate reuse of an already-proven pattern rather than a new caching design. `POST /refresh` and the possibly-triggered refresh inside `GET` both share `expressRateLimit`'s `expensiveLimiter` (`backend/middleware/rateLimit.js`), the same tighter limiter every other externally-backed route in Athena uses.

## Interview questions

1. *"Why is the cache keyed by 'freshest stored article's retrievedAt' instead of a separate 'last refreshed' timestamp per ticker?"* — It's derived data, not new state to maintain — every article already carries `retrievedAt`, so tracking a redundant separate timestamp would just be a second source of truth that could drift out of sync with what's actually in the store; querying `NewsArticle` directly is always correct by construction.
2. *"What's the difference between the cache TTL and the retention period, and why are they different numbers?"* — The TTL (4h default) controls when Athena considers cached data too old to *serve without refreshing* — a freshness concern. Retention (90d default) controls how long an article is *kept at all* before permanent deletion — a storage-lifecycle concern. They answer different questions and are allowed to move independently; conflating them would mean either refreshing too rarely (long TTL) or discarding useful historical articles too soon (short retention) just to keep one number simple.

# Engineering Concept: User-Scoped Caching

## What it is

Sprint 9 introduces exactly one new "cache" that must be user-scoped: `WatchlistSnapshot`, the "last metrics this specific user was shown for this specific ticker" record change detection compares against. Everything else Sprint 9 reads (quotes, ratios, health scores, DCF) uses the *existing*, deliberately **shared** (ticker-keyed, not user-keyed) caches from Sprints 2-6, because those are facts about a company, not facts about a user.

```js
// watchlistSnapshot.model.js
watchlistSnapshotSchema.index({ userId: 1, ticker: 1 }, { unique: true });
```

## Why we use it

Market quotes, financial ratios, and DCF outputs are the same for every user looking at the same ticker at the same moment — sharing that cache across users is not just safe, it's strictly better (a cache hit for User A also serves User B for free). "What changed since I last checked," by contrast, is inherently personal: two different users looking at the same ticker on different days have different "last checked" baselines, so that state cannot be shared without producing wrong answers for someone.

## Alternatives considered

- **A single shared `MetricSnapshot` keyed only by ticker** (considered first, during design). This was the *initial* plan, on the reasoning that it would avoid storing near-duplicate data for every user tracking the same popular ticker. It was rejected after tracing through a concrete failure case: if User B's read of AAPL updates a global snapshot, User A's next visit compares against a value A never actually saw — silently erasing a change A should have been told about. This is exactly the class of bug user-scoped caching exists to prevent, caught during design rather than in production.
- **No snapshot at all — always compare against the previous request's response, client-side.** Rejected — this requires the frontend to persist "what I saw last time" itself (in `localStorage`, fragile and per-device) and provides no server-side source of truth; it also doesn't survive the user switching browsers or clearing storage, unlike a backend-persisted snapshot.
- **Redis for the snapshot, instead of Mongo.** Rejected alongside every other caching decision this sprint — no Redis (or any cache infrastructure) exists anywhere in this codebase, and a handful of scalar numbers per (user, ticker) pair has no latency or volume profile that justifies introducing one now. See CachingStrategy.md for the same reasoning applied to Sprint 4's quote cache.

## Trade-offs

- **Pro (shared caches for quotes/ratios/DCF):** maximizes cache hit rate — every user benefits from every other user's request for the same ticker, at zero extra cost.
- **Pro (per-user `WatchlistSnapshot`):** correctness — no cross-user interference is possible even in principle, since each row is scoped to exactly one `(userId, ticker)` pair.
- **Con (per-user `WatchlistSnapshot`):** storage duplication — 100 users all tracking AAPL means 100 near-identical snapshot rows instead of 1. Accepted deliberately: the storage cost (five scalar numbers × however many tracked tickers) is trivial next to the correctness bug the shared-snapshot design would have reintroduced.

## How Athena implements it

`watchlistInsights.service.js`'s `getInsights(userId)` reads/writes `WatchlistSnapshot.findOne({userId, ticker})` / `findOneAndUpdate({userId, ticker}, ..., {upsert: true})` — always both fields together, never ticker alone. Everything upstream of it (`market.service`'s quote cache, `valuation.service`'s DCF computation) remains ticker-only, exactly as it was before this sprint. Verified live: rewriting one user's stored snapshot directly in Mongo and re-calling `/insights` correctly detected the change for that user only, without needing (or touching) any other user's data.

## Interview questions

1. *"What's the actual bug that a shared `MetricSnapshot` (keyed only by ticker) would have caused?"* — User B visits AAPL, and the read-then-update-snapshot flow overwrites the global "last seen" values to whatever's current *now*. User A then visits AAPL later — their comparison runs against the value B's visit just wrote, not against what A actually last saw, so any change that happened between A's two visits is silently invisible to A. It's not a crash or an error; it's a quiet correctness bug that would be very hard to notice without the reasoning laid out above.
2. *"Given that per-user snapshots duplicate data, how would you decide if that duplication ever becomes a real problem?"* — Watch two numbers: total tracked (user, ticker) pairs across the whole system, and the actual storage size of a `WatchlistSnapshot` document (five numbers plus a date - a few hundred bytes). Even at a large user base, this stays trivial compared to, say, `MarketHistory`'s daily OHLCV bars per ticker — it would only become worth revisiting if watchlists themselves became enormous (thousands of tracked tickers per user), which is a different scaling question than the one this design solves.

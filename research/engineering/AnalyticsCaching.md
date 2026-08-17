# Engineering Concept: Analytics Caching

## What it is

`portfolio.analytics.service.js` caches the full analytics response in an in-memory `Map`, keyed by:

```
`${userId}:${window}:${benchmark || "auto"}:${portfolioVersion}`
```

where `portfolioVersion` is a cheap, deterministic string built from the user's raw `Holding` rows (`ticker:shares:price:date`, sorted and joined) - not from any of the expensive computed output. TTL on top of that key is `ANALYTICS_CACHE_TTL_MS` (5 minutes).

```js
const buildPortfolioVersion = async (userId) => {
    const rows = await Holding.find({ userId }).select("ticker shares averagePurchasePrice purchaseDate -_id").lean();
    if (rows.length === 0) return "empty";
    return rows.map((r) => `${r.ticker}:${r.shares}:${r.averagePurchasePrice}:${...}`).sort().join("|");
};
```

## Why we use it

Portfolio analytics is genuinely expensive relative to every other cached thing in this codebase: it fans out N historical-price fetches (one per unique held ticker, each up to 5 years of daily bars) plus N quote fetches plus an O(N²) correlation matrix, on every request. Unlike `market.service`'s quote cache or `industry.service`'s universe cache - both shared across users, because a stock's price is the same fact for everyone - this cache **must** be per-user, because two users' analytics are computed from two different sets of holdings; see `UserScopedCaching.md` for the general principle this sprint follows again.

## Alternatives considered

- **A short, fixed TTL alone (no `portfolioVersion` component), same shape as `market.service`'s 60-second quote cache.** Rejected - a user who edits a holding and immediately checks their analytics would see stale numbers for up to the full TTL, which is a materially worse experience for a page whose entire point is "reflect what I currently hold." Baking the holdings themselves into the cache key means an edit invalidates the cache the instant it happens, with no waiting.
- **No caching at all - always recompute.** Considered, since "always recompute from current storage" is exactly `ratio.service.js`/`comps.service.js`'s existing philosophy for cheap, DB-only calculations. Rejected here specifically because this calculation isn't DB-only - it depends on N external-provider-backed historical fetches per request, which is a meaningfully different cost profile than a ratio computed from already-stored financial statements.
- **Caching only the expensive intermediate data (historical bars) rather than the whole assembled response**, relying on `market.service`'s own `MarketHistory` collection to already deduplicate the historical-price fetch. This is real and already happens "for free" - `MarketHistory` backs every `getHistoricalPrices()` call regardless of this cache. The additional whole-response cache on top exists to also skip the correlation matrix computation and the full response-assembly work, not just the network fetch.

## Trade-offs

- **Pro:** correctness - a holdings edit is reflected on the very next analytics request, with no TTL-driven staleness window for the thing users would notice fastest (their own composition change).
- **Pro:** cheap to compute the cache key itself - one small, already-indexed (`{userId: 1}`) Mongo query, versus the full fetch/compute pipeline it gates.
- **Con:** unlike `market.service`'s quote cache, a cache hit here still costs one Mongo round trip (to build `portfolioVersion`) before the cache lookup - a deliberate trade of "always pay a small cost" for "never serve stale-after-an-edit data."
- **Con:** in-memory only, same as every other cache in this codebase (no Redis) - a cache entry doesn't survive a server restart or exist across multiple server instances. Acceptable for the same reason `CachingStrategy.md` already accepts this trade-off elsewhere: no cache infrastructure exists in this codebase yet, and introducing one for a single feature isn't proportionate.
- **Con: stale entries are never actively evicted.** Every distinct `portfolioVersion` a user's holdings ever pass through leaves its own entry in the `Map` - editing a holding doesn't overwrite the old entry, it just means future requests stop matching it. Nothing currently sweeps these unreachable entries out, so the `Map` grows slightly with every holdings edit across every user, for the life of the process. Bounded in practice (personal portfolios are edited occasionally, not continuously, and a server restart clears it), but a real gap worth naming rather than glossing over - a periodic sweep or an LRU cap would be the fix if this ever became a measured problem.

## How Athena implements it

`getPortfolioAnalytics(userId, {window, benchmark})` computes `portfolioVersion` first (cheap), short-circuits to a static empty-state response if the user has no holdings, then checks the cache before doing any of the expensive work in `computeAnalytics()`. Verified in `portfolio.analytics.service.test.js`: a second identical request doesn't re-invoke `market.service.getHistoricalPrices`; two different users never share a cache entry even with byte-identical holdings; and a holdings edit (shares changed) forces recomputation on the next request.

## Interview questions

1. *"Why not just use the userId and window/benchmark as the cache key, with a short TTL, like the quote cache does?"* — Because the quote cache's staleness window (60 seconds) is a fact about how fast a stock's price moves, which is a shared, unavoidable kind of staleness every user of that ticker accepts equally. A portfolio analytics staleness window is different: it's specifically staleness relative to *this user's own last edit*, which they have full control over and would reasonably expect to see reflected immediately. Baking the holdings themselves into the key converts "wait out a fixed TTL" into "the moment you change something, you get fresh data" - a strictly better guarantee for the thing that actually changes fastest here (user edits, not market prices).
2. *"What happens to a cache entry for a holding a user later deletes?"* — It becomes permanently unreachable but isn't actively cleaned up: `portfolioVersion` is computed from the user's *current* holdings, so once they change, no future request will ever produce a key matching the old entry again - yet nothing removes it from the `Map`, since there's no sweep process. It's a real, acknowledged memory-growth trade-off (see AnalyticsCaching.md's trade-offs), accepted because personal portfolios change infrequently and the process restarts periodically in practice - not because it's actually bounded by design.

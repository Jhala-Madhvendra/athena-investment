# Engineering Concept: Caching Strategy (Live Quote vs. Historical Data)

## What it is

Market Intelligence uses two *different* caching strategies for two *different* kinds of data, on purpose:

1. **Live quote snapshot** (current price, market cap, P/E, etc.) - a plain in-memory `Map` in `market.service.js`, keyed by ticker, holding `{ data, expiresAt }` with a 60-second TTL. No database involved.
2. **Historical daily prices** - persisted in the `MarketHistory` Mongo collection (see [[HistoricalDataStorage]]), refreshed only when coverage is stale, not on a fixed timer.

```js
const quoteCache = new Map();
const QUOTE_CACHE_TTL_MS = 60 * 1000;

const cached = quoteCache.get(normalizedTicker);
if (cached && cached.expiresAt > Date.now()) {
  return cached.data;
}
```

## Why we use it

These two data types have opposite volatility profiles, so one caching strategy for both would be wrong for at least one of them:

- A live quote changes continuously during market hours - it should never be treated as permanently "true," only "true enough for the next minute," which is exactly what a short in-memory TTL provides at near-zero implementation cost.
- A historical daily bar, once the trading day has closed, is a fact that doesn't change - it deserves to be persisted and never silently expired, only refreshed when genuinely incomplete or stale.

## Alternatives considered

- **One unified caching layer (e.g. Redis) for both.** Rejected for this sprint - introducing a new infrastructure dependency (Redis) for a 60-second, single-process cache is disproportionate. The sprint's own guidance is to "prioritize correctness and simplicity over premature optimization," and a plain `Map` fully satisfies the live-quote use case without a new moving part.
- **No caching at all for live quotes - always call Yahoo.** Rejected: a user switching between tabs or the chart re-rendering can trigger multiple requests for the same ticker within seconds; without a short cache, each would independently pay the Yahoo cookie/crumb auth round trip for no new information.
- **Cache historical prices in-memory too.** Rejected - see [[HistoricalDataStorage]] for why persistence, not memory, is the right fit there.

## Trade-offs

- **Pro:** the live-quote cache is a few lines of code, requires no new service or dependency, and is trivially correct to reason about (TTL expiry, nothing more).
- **Pro:** each cache's lifetime matches its data's actual volatility - neither over-caches (serving stale prices) nor under-caches (hammering Yahoo).
- **Con:** the in-memory quote cache is per-process and doesn't survive a server restart or scale across multiple server instances - acceptable for the current single-process deployment, but would need to move to a shared store (Redis, or the database) if Athena ever runs multiple backend instances behind a load balancer.
- **Con:** the quote cache Map grows for every distinct ticker ever requested and is never evicted beyond TTL expiry (expired entries are simply overwritten on next access, not proactively cleaned) - acceptable at current scale, worth revisiting if ticker cardinality becomes very large.

## How Athena implements it

`getCurrentMarketData(ticker)` checks the `quoteCache` Map first; on a miss or expiry, it calls the market data provider, stores the result with a fresh `expiresAt`, and returns it. `getHistoricalPrices(ticker, period)` instead checks `MarketHistory` coverage/freshness (earliest bar reaches the required start date, latest bar is recent) and only calls the provider when that check fails - see [[HistoricalDataStorage]] for the coverage-check logic itself.

## Interview questions

1. *"Why not just use a single 60-second cache for the historical price data too, instead of a special coverage check?"* - Tests whether the candidate sees that a TTL is the wrong tool for immutable-once-written data: a completed trading day's bar doesn't need to "expire," it needs to be fetched once and kept, which is a fundamentally different lifecycle than a live quote.
2. *"What breaks if Athena is deployed as three server instances behind a load balancer, with the current implementation?"* - Should identify that the in-memory quote cache is per-process, so each instance would independently cache the same ticker, tripling live Yahoo calls compared to a single-instance deployment - the fix would be moving the quote cache to a shared store.

# Engineering Concept: Historical Price Data Storage

## What it is

`MarketHistory` ([market.model.js](../../backend/market/market.model.js)) is a Mongoose collection of one document per `(ticker, date)` daily price bar - `open`, `high`, `low`, `close`, `adjClose`, `volume`, plus `companyId` and `source`. A compound unique index on `{ ticker: 1, date: 1 }` guarantees at most one bar per trading day per ticker, and makes upserts idempotent.

## Why we use it

Daily historical prices are a fundamentally different kind of data from the live quote snapshot (see [[CachingStrategy]]): once a trading day has closed, that day's bar never changes. That immutability is exactly what makes it worth persisting rather than re-fetching from Yahoo on every request - a 5-year daily history is ~1,250 data points that are expensive (in latency and rate-limit budget) to re-request every time a user opens the chart, but cheap to store once and read from Mongo indefinitely afterward.

## Alternatives considered

- **Never store it - always fetch live from Yahoo on every request.** Rejected: every period switch (1M → 5Y) or page reload would trigger a fresh Yahoo round trip (including the cookie/crumb auth handshake), adding latency and provider load with no benefit, since the data being re-fetched hasn't changed.
- **Store every field Yahoo returns, unfiltered.** Rejected per the sprint's explicit guidance to "not blindly store every API response." `MarketHistory` stores exactly the OHLCV fields the app displays and needs for return calculations - nothing speculative.
- **Cache historical prices in-memory (like the live quote cache) instead of in Mongo.** Rejected: historical data is large (thousands of bars per ticker across all users) and needs to survive server restarts and be shared across the (currently single) server process - a proper persistent store is the right tool, whereas the live quote only needs a 60-second, disposable cache.

## Trade-offs

- **Pro:** once populated, historical data reads are pure Mongo queries - no external latency, no rate-limit exposure, works even if Yahoo is temporarily down (for already-cached ranges).
- **Pro:** the unique index makes re-imports safe - `findOneAndUpdate(..., { upsert: true })` per bar means re-fetching an overlapping range never creates duplicates.
- **Con:** requires a coverage/freshness check before serving data (see below) to decide when a refresh is needed - more logic than "always fetch live," though this mirrors the same "lazy-import-on-read" pattern already used by `financials.controller.js` for financial statements.
- **Con:** the most recent trading day's bar can still be "live" (market not yet closed) - Athena's freshness check tolerates this by treating data up to 5 days old as fresh enough, rather than trying to distinguish an in-progress trading day from a completed one.

## How Athena implements it

`getHistoricalPrices(ticker, period)` in `market.service.js` first checks existing `MarketHistory` coverage for the ticker: is the earliest stored bar old enough to cover the requested period's start date, and is the latest stored bar recent (within the last 5 days)? If either check fails, it fetches the **full 5-year range** from the provider (not just the requested period) and upserts every bar - so a single refresh satisfies every shorter period's cache for that ticker going forward, instead of triggering a separate Yahoo call per period. Dates are stored as `YYYY-MM-DD` strings rather than `Date` objects, since daily bars need no time-of-day precision and string comparison (`date >= requiredStartDate`) is sufficient and index-friendly for range queries.

## Interview questions

1. *"Why does a refresh always fetch the full 5-year range instead of just the period the user requested?"* - Tests understanding of cache design: over-fetching once on a cache miss (5y instead of 1m) means all shorter periods are pre-populated for free, trading a slightly larger single request for avoiding N future cache misses.
2. *"Why is `date` stored as a string instead of a native Date/Timestamp type?"* - Should discuss that daily bars have no meaningful time component, and that ISO `YYYY-MM-DD` strings sort and range-query correctly with plain lexicographic comparison, avoiding timezone-conversion pitfalls that a `Date` type would introduce for a date-only concept.

# Engineering Concept: Batch Data Fetching

## What it is

Watchlist and Portfolio both need one live market quote *per unique ticker*, not per row — a user with three lots of AAPL should trigger exactly one AAPL price lookup, not three. Both features fetch their tickers in parallel via `Promise.all`, deduplicated through a `Set` first:

```js
// portfolio.service.js
const fetchQuotesByTicker = async (tickers) => {
    const uniqueTickers = [...new Set(tickers)];
    const entries = await Promise.all(
        uniqueTickers.map(async (ticker) => {
            const quote = await marketService.getCurrentMarketData(ticker).catch(() => null);
            return [ticker, { price: quote?.price?.current ?? null, currency: quote?.currency ?? null }];
        })
    );
    return new Map(entries);
};
```

Watchlist's `getWatchlistWithMetrics` does the equivalent per-ticker fan-out, but fetches *four* things per ticker (quote, 1Y performance, analysis, DCF), not just a price.

## Why we use it

This is the N+1 problem in its most literal form: without deduplication, a portfolio with 3 AAPL lots would make 3 identical, wasteful AAPL calls; without parallelization, an N-ticker watchlist would make its N calls one after another, multiplying total latency by N instead of paying it once.

## Alternatives considered

- **A true batch provider endpoint** (`getQuotes(tickers[])` instead of `getQuote(ticker)`, requested from Yahoo/TwelveData in one HTTP call). This is the textbook "real" fix, and was rejected *for this sprint specifically* — no batch method exists anywhere in `backend/market/providers/**` today (confirmed by direct inspection before writing any code); adding one means new provider-interface methods, a new mapper shape, and registry plumbing across both the Yahoo and TwelveData providers. That's a proportionate investment for hundreds of tickers per request, not for the tens-of-items lists a personal watchlist/portfolio actually has. Documented here explicitly as a deferred, not rejected-forever, optimization.
- **A serial loop (`for` + `await` per ticker).** Rejected — strictly worse than the parallel version with no offsetting benefit; total latency scales linearly with ticker count instead of being bounded by the single slowest call.
- **No deduplication (fetch once per row/lot, not per unique ticker).** Rejected — wastes calls against an external, rate-limited provider (Yahoo) for information Athena already has in-flight, and Yahoo's own auth cache (`yahooAuth.js`) is shared/global, so redundant calls also compete for the same rate-limited resource other users' requests need.

## Trade-offs

- **Pro:** zero new infrastructure — `Promise.all` and `Set` are both already-available JavaScript primitives, no new dependency.
- **Pro:** correctly bounded by *unique tickers*, not *rows/lots* — the actual cost driver.
- **Pro:** each individual per-ticker call still benefits from `market.service`'s existing 60-second in-memory quote cache, so repeat views within a minute cost nothing extra regardless of this fan-out pattern.
- **Con:** still N external calls for N unique tickers, just parallelized rather than eliminated — a true batch endpoint would turn N calls into 1. Acceptable because personal watchlist/portfolio sizes are small (tens, not hundreds); this would need revisiting if list sizes or traffic patterns changed materially.

## How Athena implements it

`watchlist.service.js`'s `getWatchlistWithMetrics` and `portfolio.service.js`'s `getPortfolio` both follow the same shape: dedupe → `Promise.all` → build a `Map` keyed by ticker → look up per-row/per-holding from that map. Verified live: a 3-lot portfolio (2 AAPL, 1 MSFT) triggered exactly 2 `getCurrentMarketData` calls, not 3 (confirmed directly in `portfolio.service.test.js`'s "fetches one live price per unique ticker, not per lot" test).

## Interview questions

1. *"Why not just build the real batch provider endpoint now, since you already know it'll eventually be needed?"* — Because "eventually needed" isn't "needed now" — the instructions explicitly warn against premature optimization, and the actual data (personal watchlists/portfolios, tens of tickers) doesn't justify the cost of new provider-interface methods across two providers today. Ticker-dedup + parallel fetch solves the real problem (redundant identical calls) at a fraction of the implementation cost, and is a strict subset of what a batch endpoint would eventually replace — nothing here needs to be thrown away later.
2. *"What's the actual failure mode this pattern prevents, concretely?"* — Without dedup: a user with 5 lots of the same stock across a portfolio would trigger 5 identical external API calls on every page load, needlessly consuming the shared rate limit other users' requests also draw from (Yahoo's rate limiting is a real constraint this codebase already works around via `yahooAuth.js`'s cookie/crumb caching). Without parallelization: a 20-ticker watchlist's response time would be roughly 20× a single ticker's latency instead of roughly 1×.

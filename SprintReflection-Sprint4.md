# Sprint 4 Reflection — Market Intelligence Engine

## What was built

A Market Intelligence module (`backend/market/`) that answers a question none of Sprints 1-3 could: how is the market currently pricing this company, as distinct from how the business itself is performing. It follows the same provider-abstraction pattern as the existing Company/Financials modules: a `MarketDataProvider` interface, a `yahooMarketData.provider.js` concrete implementation reusing a newly-extracted shared Yahoo auth helper, and a registry that `market.service.js` depends on instead of the concrete class. Three endpoints were added — `GET /api/market/:ticker` (live snapshot: price, market cap, 52-week range, volume, P/E, forward P/E, P/B, EPS, forward EPS, dividend yield), `GET /api/market/:ticker/history?period=` (daily OHLCV for 1M/3M/6M/1Y/5Y, persisted in a new `MarketHistory` collection with read-through caching), and `GET /api/market/:ticker/performance` (calculated % returns per period). On the frontend, a new "Market Intelligence" tab was added alongside the existing five, built from a reusable `PriceHistoryChart` component, market-specific stat-card components, and a Business vs. Market Performance comparison section that pulls in Sprint 2's ratios and Sprint 3's growth CAGRs alongside the new market data — without generating any buy/sell/cheap/expensive framing, per the sprint's explicit constraint. 38 Jest/Supertest tests cover the mapper, service-layer calculations, and controller error handling; Sprints 1-3 were verified unaffected (both via passing tests and live manual checks against `/api/financials`, `/api/ratios`, `/api/analysis`).

## Finance concepts learned

The clearest lesson this sprint was that **market metrics need a denominator investors already understand, or they're just numbers.** A P/E of 35 means nothing on its own — it only becomes informative next to the company's own earnings trajectory (is that P/E paying for growth that's actually happening?), which is exactly why [[MarketVsBusinessPerformance]] exists as its own section rather than a passing footnote. The other recurring theme was **absence of a value is itself information, not a bug**: a `null` dividend yield means "this company doesn't pay a dividend" (a fact about capital allocation strategy), not missing data to apologize for — the UI renders it as "—", never "0%", to keep that distinction visible.

## Engineering concepts learned

The core engineering decision this sprint was recognizing that "market data" is not one thing with one caching lifecycle — it's two things with opposite volatility:
- [[CachingStrategy]] — a live quote needs a short in-memory TTL (it's stale within a minute); a historical daily bar, once the trading day closes, is a permanent fact and belongs in the database, not a cache that expires it.
- [[HistoricalDataStorage]] — the read-through/backfill design (always refresh the full 5-year window on a cache miss, not just the requested period) means one refresh satisfies every shorter period's request afterward, instead of a Yahoo call per period switch.
- [[MarketDataProvider]] — reusing the existing registry + abstract-base-class pattern from Sprint 1/2 meant the service layer never had to know Yahoo exists, and a shared auth helper avoided copy-pasting the cookie/crumb handshake a third time.
- [[ReusableChartComponents]] — `PriceHistoryChart` was built with zero knowledge of "market data" specifically, following the precedent `TrendLineChart` already set in Sprint 3.

## Product decisions

The decision to make Market Intelligence its own tab, rather than folding price data into the existing Financial Statements or Business Analysis views, was the main product call — see [[MarketIntelligenceProductDecision]] for the full reasoning. The second deliberate decision was scope: the sprint explicitly forbids any "cheap/expensive/buy/sell" framing, so the Business vs. Market Performance section was built as a pure side-by-side data presentation with an explanatory paragraph, not a scored comparison or verdict — a real constraint on what would otherwise be a natural (but out-of-scope) next step.

## Trade-offs made

- **Simplicity over completeness in coverage-checking.** The historical-data freshness check (earliest bar reaches ~5y back, latest bar within 5 days) is a heuristic, not a precise trading-calendar-aware gap detector. It correctly avoids unnecessary refetches and correctly triggers refreshes when data is genuinely missing, but it doesn't detect a narrow gap in the *middle* of an otherwise-fresh series (e.g. one missing day from a past outage) — an accepted simplification given the sprint's "correctness and simplicity over premature optimization" guidance.
- **In-memory over distributed caching.** The live-quote cache is a plain `Map`, not Redis — correct for a single-process deployment, and explicitly flagged in [[CachingStrategy]] as something that would need to change before horizontal scaling.
- **Reusing Sprint 2/3 endpoints over duplicating their logic.** The Business vs. Market Performance section fetches `/api/analysis/:ticker` and `/api/ratios/:ticker` directly from the frontend rather than having the backend aggregate them into a combined endpoint — three separate requests instead of one, in exchange for not adding backend-to-backend coupling between the `market` and `analysis`/`ratio` modules.

## Problems encountered

- Diagnosing a slow/misconfigured Jest run: without a `jest.config.js`, running Jest from the wrong working directory caused it to scan far beyond the project (picking up unrelated projects elsewhere on the machine) rather than just `backend/`. Fixed by adding an explicit `rootDir`-scoped `jest.config.js` and confirming a clean run from the correct directory (4 suites, 38 tests, ~11s).
- Verifying the frontend needed a longer wait than expected on first load: the Market Intelligence tab's three parallel API calls each independently perform a live Yahoo cookie/crumb auth round trip (no shared session across requests), so first paint after the loading skeleton took longer than a typical cached-data page — expected given the "always live" nature of quote data, not a bug.

## What would be improved

- A trading-calendar-aware gap detector for `MarketHistory` coverage, instead of the current start/freshness heuristic, to correctly self-heal from a narrow mid-series gap (e.g. one missed refresh) without a full 5-year refetch.
- Combine the Business vs. Market Performance section's three separate frontend fetches (`market`, `analysis`, `ratios`) into a single backend aggregation endpoint if this comparison view grows more elaborate, trading a small amount of new coupling for fewer round trips.
- Persist a short-lived quote cache in a shared store (or the database) instead of an in-process `Map`, once/if Athena runs more than one backend instance.

## What I would build next

Given this sprint puts both business fundamentals and market pricing on screen side by side, the natural next step is **peer/sector comparison** — the same Business vs. Market Performance framing, but across a set of companies in the same industry rather than one company against itself over time. That would reuse nearly everything built this sprint (the market provider, the ratio/growth endpoints) and is the most direct way to make the "is this priced reasonably relative to its own fundamentals" question answerable relative to *peers*, without Athena ever having to generate the answer itself.

## Interview questions

1. **"Walk me through why you used two completely different caching strategies for live quotes vs. historical prices."**
   *A live quote is stale within seconds — it needs a short TTL and nothing more, so a plain in-memory Map with a 60-second expiry is the right, minimal tool. A historical daily bar, once that trading day has closed, is a permanent fact that never changes — treating it like a TTL cache would mean needlessly re-fetching data that was already correct, so it belongs in a persistent store (MongoDB) instead, refreshed only when coverage is actually incomplete or stale, not on a timer.*

2. **"Your `getHistoricalPrices` always refreshes the full 5-year range on a cache miss, even if the user only asked for 1 month. Isn't that wasteful?"**
   *It's the opposite in practice — a 1-month, 3-month, and 5-year request against the same never-before-seen ticker would otherwise be three separate Yahoo round trips. Fetching the superset once means every shorter period for that ticker is served from the database afterward with zero additional provider calls. It trades a slightly larger single request for eliminating N future cache misses.*

3. **"How does the market module avoid coupling itself to Yahoo Finance specifically?"**
   *`market.service.js` only ever imports the provider registry, never the concrete `YahooMarketDataProvider` class. The registry resolves a provider based on an environment variable and returns an instance satisfying an abstract base class's contract (`getQuote`, `getHistoricalPrices`). Swapping providers is a new class plus one line in the registry — zero changes to the service, controller, or routes.*

4. **"A company has no P/E ratio. How does the system handle that, end to end?"**
   *Yahoo returns no `trailingPE` field (or a non-numeric one) for a company with no positive trailing earnings. The mapper's `getValue()` helper returns `null` rather than `0` or throwing. The service passes that `null` straight through. The frontend renders it as "—", not "0" or "N/A" styled as an error — because a missing P/E isn't a data problem, it's a true fact about the company (no positive earnings to value against).*

5. **"The sprint explicitly forbids labeling a stock 'cheap' or 'expensive.' How did that constrain the Business vs. Market Performance design?"**
   *It ruled out anything resembling a score, a threshold-based verdict, or comparative language ("undervalued relative to peers"). The section presents two cards of plain figures — Revenue CAGR, ROE, and Operating Margin on one side, P/E, P/B, and 1-year return on the other — with one explanatory paragraph stating that the two don't always move together, and stops there. The judgment of what the numbers mean is left entirely to the investor.*

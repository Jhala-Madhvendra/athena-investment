# Snapshot Architecture

## What it is

A persisted "last observed value" that a later monitoring pass compares against to answer "did this change since I last checked." Sprint 11 ships exactly one snapshot model: `PortfolioAlertSnapshot`, scoped `{userId, ticker}`.

## Why it is needed

Some facts have no natural "version" or identity to key off (see `EventDetection.md`) — a portfolio holding's current dollar value is a continuously-changing number with nothing structural (like a fiscal year) to anchor a comparison to. For those facts, the only way to answer "did this change meaningfully" is to have recorded what the value was the last time it was checked.

## Alternatives considered — including one built, then removed

- **A ticker-level `AlertSnapshot` for Market and Valuation facts, shared across all users tracking that ticker.** This was actually built in an early pass of this sprint, then deliberately deleted once its premise turned out to be false. The reasoning: Market rules were assumed to need a persisted "price 5 days ago" to avoid recomputing it on every monitoring pass. In fact, `market.service.js`'s `getHistoricalPrices` already persists and freshness-checks daily bars (Sprint 4/5) — re-deriving "price 5 sessions ago" from that cache costs a database read, not a provider call. The snapshot layer was solving a cost problem that Sprint 4/5's own caching had already solved; keeping it would have been dead weight duplicating the real source of truth. (Valuation's half of that snapshot was removed for an unrelated reason — Valuation alerts were deferred entirely; see `research/finance/ValuationAlerts.md`.)
- **A single global `MetricSnapshot` (Portfolio value keyed only by ticker), to save storage across users holding the same stock.** Rejected for the identical reason `research/engineering/UserScopedCaching.md` already rejected it for `WatchlistSnapshot`: two different users' "last observed value" for the same ticker are genuinely different facts (different shares, different cost basis, different check-in times) — sharing that state would silently produce a wrong comparison for whichever user didn't write it most recently.
- **No snapshot at all — always compare Portfolio value against the *previous request's* response, client-side.** Rejected for the same reasons Sprint 9 already rejected this pattern for Watchlist: no server-side source of truth, doesn't survive a browser/device switch.

## Trade-offs

- **Pro (deleting the ticker-level snapshot):** one fewer collection, one fewer thing to keep consistent, and market-rule computation stays exactly as cheap as it would have been anyway — the "expensive part" this sprint's original design was trying to avoid didn't actually exist.
- **Pro (`PortfolioAlertSnapshot` scoped per-user):** correctness — two users' comparisons can never leak into each other, applying `UserScopedCaching.md`'s own principle (share what's objectively true about a company; scope what's personal) *in the direction that principle actually points* for Portfolio data.
- **Con (`PortfolioAlertSnapshot` scoped per-user):** storage duplication if many users hold the same stock — accepted deliberately, same trade-off `WatchlistSnapshot` already accepted: a handful of scalar numbers per (user, ticker) pair is trivial compared to the correctness bug the shared alternative would reintroduce.

## How Athena implements it

`backend/alerts/portfolioAlertSnapshot.model.js`: `{userId, ticker, currentValue, returnPercent, weightPercent, observedAt}`, unique-indexed on `{userId, ticker}` — same shape and same rationale as Sprint 9's `WatchlistSnapshot`. `alert.service.js`'s `evaluatePortfolio` reads the caller's snapshots for their held tickers in one query (`PortfolioAlertSnapshot.find({userId, ticker: {$in: tickers}})`), hands them to the engine as a `Map`, and upserts fresh values back after — "compare, then overwrite," the same pattern `watchlistInsights.service.js` established in Sprint 9. Market, Financial, Business, and News rules have no snapshot model at all — see `EventDetection.md` for why their event identity is structural rather than value-comparison-based.

## Interview questions

1. *"Walk me through the snapshot model you built, then removed, and why."* — I initially built a ticker-level `AlertSnapshot` assuming Market rules needed persisted state to avoid recomputing "price 5 days ago" on every monitoring pass. Testing against the actual data flow showed `market.service.js` already persists and freshness-checks that history — the cost problem I was solving didn't exist. Removing it wasn't a rollback of a mistake so much as recognizing, mid-build, that a piece of infrastructure was solving an already-solved problem, and dead-weight abstractions are worse than no abstraction.
2. *"Why is `PortfolioAlertSnapshot` scoped per-user when a shared-per-ticker design would save storage?"* — Because unlike a stock's price (an objective fact, the same for every observer), a portfolio position's value depends on that specific user's shares and cost basis — sharing the snapshot across users would mean one user's check-in silently resets the baseline another user's comparison depends on, exactly the bug `UserScopedCaching.md` documents for the analogous Watchlist case.
3. *"How do you decide, in general, whether new data needs a snapshot?"* — Two questions: does the fact have a natural, stable identity to key deduplication off (if yes, no snapshot needed — see `EventDetection.md`)? And if a snapshot is needed, is the fact objective (about the company) or personal (about this user)? The first answer determines whether to persist at all; the second determines the scope.
4. *"What would you watch for to know if `PortfolioAlertSnapshot`'s per-user duplication ever became a real problem?"* — The same metric `UserScopedCaching.md` names for `WatchlistSnapshot`: total tracked (user, ticker) pairs system-wide, and the actual document size (four scalar numbers plus a date — a few hundred bytes). It would only become worth revisiting at a genuinely large user base with very large individual portfolios, a different scaling question than the one this design solves.

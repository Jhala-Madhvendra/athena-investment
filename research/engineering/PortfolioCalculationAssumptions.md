# Engineering Concept: Portfolio Calculation Assumptions

## Sprint 15 update: transaction-aware historical reconstruction

Sprint 14 (below) shipped every historical metric as a documented estimate, because Athena had no transaction ledger - only current `Holding` lots. Sprint 15 adds one (`backend/portfolio/transaction.model.js`) and, wherever it's usable, **replaces the estimate with an actual reconstruction** rather than layering more approximation on top of it. The two methodologies now coexist per-request:

- **Transaction-aware** (`assumptions.historicalMethodology.type === "transaction_aware"`) - used whenever a user's recorded BUY/SELL history produces at least `MIN_OBSERVATIONS_FOR_SERIES` (10) usable daily observations for the requested window.
- **Current-weights-backward** (`type === "current_weights_backward"`) - the original Sprint 14 estimate, still used as a fallback: no ledger at all, or too little of one for this window. Never removed - see "How Athena implements it" below for why it has to stay.

### How reconstruction works

```
Transaction (BUY/SELL rows)
    -> holdingsReconstruction.calculator.js: replay chronologically -> holdings per date
    -> portfolioHistory.service.js: value reconstructed holdings at real historical prices (MarketHistory)
    -> {date, return}[] series
    -> the SAME portfolio.analytics.calculator.js functions Sprint 14 already had
       (calculateVolatility / calculateSharpeRatio / calculateMaxDrawdown / calculatePeriodReturn)
```

Historical analytics never reads a `Transaction` row directly - `portfolio.analytics.service.js` only ever consumes a `{date, return}[]` series, sourced from whichever methodology applies. This is why volatility/Sharpe/drawdown needed zero code changes to become transaction-aware; only the series feeding them changed.

### Ordering and edits

Transactions replay by `transactionDate`, then `createdAt`, then `_id` - deterministic even for same-day transactions or out-of-order inserts. Editing or deleting a transaction re-validates the **entire affected ticker's timeline** (`transaction.service.js`'s `assertNoNegativeHoldings`), not just the row being touched - an edit to an old BUY can invalidate a later SELL that depended on it, and that must be caught at write time, not silently produce negative holdings later.

### What "sufficient transaction history" means here

A user is "transaction-aware eligible" purely by having at least one `Transaction` row - independent of whatever `Holding` rows they also have. **`Holding` and `Transaction` are not synchronized or reconciled with each other** (see PortfolioDataModel.md). This means:

- Adding a `Holding` does not create a `Transaction`, and vice versa. A user who has only ever used the Sprint 9 holdings UI has zero transactions and stays on the legacy methodology until they record some.
- `analyticsStartDate` (the earliest recorded `transactionDate`) is the boundary before which Athena will not claim to know historical holdings - see PortfolioHistoricalDataBoundary below. A window that starts before it is clipped (`historicalMethodology.windowClipped: true`), never silently backfilled by assuming today's - or the ledger's earliest known - holdings applied earlier.
- No attempt is made to reconcile a user's *current* reconstructed-from-transactions holdings against their current `Holding` rows. They can legitimately disagree (e.g. a `Holding` edited directly without a matching `Transaction`), and Athena does not flag or resolve that disagreement - full tax-lot-accounting-style reconciliation is out of scope (see "Non-goals" below).

### Cash flows: why some days are excluded, not estimated

Athena has no cash ledger - a BUY's funding source and a SELL's proceeds destination are both untracked, so a portfolio-value jump on a transaction day can't be attributed to market movement vs. capital added/removed. Rather than compute a distorted return (or fabricate a time-weighted/money-weighted return with no cash-flow data to support it), `portfolioHistory.service.js`'s `buildTransactionAwareReturnSeries` **excludes** any date pair where:

1. Reconstructed holdings differ between the two dates (`excludedTransactionDays`) - a BUY/SELL happened.
2. A currently-held ticker is missing a price on either date (`excludedMissingPriceDays`).
3. The prior date's reconstructed value is zero, e.g. before any purchase (`excludedZeroValueDays`).

All three counts are returned in `assumptions.historicalMethodology` so a caller can see exactly how much of the window was usable, not just a return number with no indication of gaps.

### Distinguishing asset return, portfolio return, time-weighted, and money-weighted return

Athena computes exactly two of these four, and is explicit about not computing the other two:

- **Asset return** - a single ticker's own price return (`computeDailyReturns` in `portfolio.analytics.calculator.js`). Always available from `MarketHistory`, unaffected by any of the above.
- **Portfolio return** (this document's subject) - the reconstructed holdings' value return over time, excluding transaction days as above. This is *not* a time-weighted return in the formal sense (a true TWR resets/geometrically-links sub-period returns specifically at each cash-flow date); it's closer to "the return of a static basket, for the sub-periods where the basket didn't change."
- **Time-weighted return (TWR)** - requires knowing exactly when *external* cash entered/left the portfolio (deposits/withdrawals) so each sub-period's return can be isolated from contribution timing. Athena has no deposit/withdrawal ledger (see Sprint 15's explicit non-goals), so **Athena does not claim to compute TWR** - excluding transaction days is the defensible substitute given the data that exists, not a TWR implementation.
- **Money-weighted return / IRR** - requires the full signed cash-flow timeline (every external contribution/withdrawal amount and date) to solve for the discount rate that zeroes out net present value. Athena has none of that data. **Not computed, not approximated.**

### Historical data boundary

`portfolioHistory.service.js`'s `getReconstructionStatus` returns `analyticsStartDate` = the earliest `transactionDate` in a user's ledger. Nothing before it is ever presented as known - `getHoldingsAt` for an earlier date returns empty holdings with `beforeAnalyticsStartDate: true`, and `buildTransactionAwareReturnSeries` clips its usable date range to start there (`windowClipped: true` when the requested window's data would otherwise reach further back). This mirrors Sprint 14's "Interview questions" answer #1 almost exactly - the boundary shrinks the approximation's blast radius over time as more transactions accumulate, rather than fixing the past retroactively.

### Non-goals (explicitly out of scope for this reconstruction)

Tax lots, FIFO/LIFO accounting, capital gains taxation, dividend reinvestment, stock splits/corporate actions, options, short selling, margin, multi-currency FX accounting inside the ledger itself, broker synchronization, deposits/withdrawals, transfer accounting, a full TWR engine, and money-weighted return/IRR are all out of scope. The `Transaction.type` enum (`BUY`/`SELL` today) is deliberately additive - new types like `DIVIDEND`/`DEPOSIT`/`SPLIT` can be introduced later without a schema redesign, but none are invented now just because the schema *could* support them later.

---

# Sprint 14 (original): current-weights-backward methodology

The rest of this document is preserved as-is - it's still the accurate description of the fallback methodology used whenever transaction-aware reconstruction isn't available for a request.

## What it is

Every historical metric Sprint 14 computes - period return, annualized return, volatility, Sharpe Ratio, max drawdown, correlation - is built on one foundational assumption, stated once and referenced everywhere rather than re-derived per metric:

> Historical portfolio risk metrics are estimated using **today's** portfolio weights and each holding's **own historical price returns** - not a reconstruction of what this portfolio actually held or was worth on any past date.

This is surfaced in every `GET /api/portfolio/analytics` response as `assumptions.historicalWeightMethodology`, and in the frontend's `AssumptionsPanel.jsx`, which renders on every non-empty analytics view - not buried in a tooltip or a footnote.

## Why we use it

Athena's `Holding` model (Sprint 9) stores current lots - `{ticker, shares, averagePurchasePrice, purchaseDate}` - with no transaction ledger and no daily snapshot of what a user held on any given past date. Computing a "portfolio return series" therefore requires *some* assumption about historical weights, because the true historical weights simply aren't recorded anywhere. The engineering choice was never "should we approximate," it was "which approximation, and how loudly do we disclose it."

## Alternatives considered

- **Refuse to compute any historical metric at all, citing insufficient data.** Rejected - this would mean Sprint 14 ships with Volatility, Sharpe, Drawdown, and Correlation entirely unavailable, which defeats the sprint's purpose. The sprint brief is explicit on this exact point: "If transaction history is insufficient for true time-weighted or money-weighted returns: Do NOT fabricate one. Use the most defensible methodology supported by available data." Current-weights-applied-backward *is* that defensible methodology, chosen and disclosed rather than avoided.
- **Assume weights were constant at today's level for the entire window, without disclosing it.** This is functionally what Athena does - but doing it *silently* was rejected. The difference between this option and what Athena ships is entirely about disclosure: the same math, presented as a documented estimate versus presented as fact, is the difference between a defensible analytics feature and a misleading one.
- **Build a lightweight historical-holdings snapshot going forward** (e.g. a nightly job recording each user's weights) so *future* sprints have real historical weight data, even though *this* sprint still can't use it retroactively. Considered as a future direction, explicitly out of scope for Sprint 14 (see the sprint brief's REBALANCING section: "Do NOT implement portfolio rebalancing in Sprint 14... Future Sprint possibility: Transaction-aware portfolio analytics").

## Trade-offs

- **Pro:** every historical metric becomes available immediately, using data Athena already has (current holdings + historical prices, both already fetched for other features).
- **Pro:** the assumption is simple enough to state in one sentence and hold constant across every metric - a user only needs to internalize it once, not per-metric.
- **Con:** every historical number is systematically biased toward "what my portfolio would look like if I'd always held what I hold today" - a portfolio that was very differently allocated a year ago will show volatility/drawdown/correlation reflecting today's mix, not last year's actual experience. This is why `unrealizedReturnPercent` (Sprint 9's real cost-basis number) and `periodReturnPercent` (this estimate) are never merged into one figure - see PortfolioReturn.md.
- **Con:** the approximation gets *less* accurate the more a portfolio's composition has changed over the analysis window - a portfolio rebalanced last week has a much more misleading 1-year volatility estimate than one that's been stable all year, and Athena currently has no way to detect or flag which situation applies.

## How Athena implements it

Centralized in `portfolio.analytics.calculator.js`'s `buildPortfolioReturnSeries()` (the single function every historical metric is ultimately derived from) and its module-level doc comment, then threaded through to `assumptions.historicalWeightMethodology` in the API response and `AssumptionsPanel.jsx` in the UI. No individual metric (volatility, Sharpe, drawdown) re-explains this assumption in its own description text - each links back to the one shared statement, so there's a single place to update if the methodology ever changes.

## Interview questions

1. *"If you had one more sprint's worth of engineering time to improve this, what would you build first?"* — A daily (or transaction-triggered) snapshot of each user's actual holdings, so future analytics requests could use *real* historical weights for the period after the snapshot began, falling back to the current-weights approximation only for the pre-snapshot period. This wouldn't retroactively fix history that already happened before the snapshot existed, but it would mean the approximation's blast radius shrinks over time instead of applying to the entire window forever.
2. *"How would you explain to a non-technical stakeholder why this approximation is acceptable to ship?"* — Because the alternative isn't "accurate data instead of an estimate" - it's "no historical risk metrics at all." Given that Athena genuinely doesn't store historical holdings, disclosed estimates that get *directionally* useful answers (this portfolio's mix has historically been this volatile) are more valuable to a user than blank fields, as long as the disclosure is real and prominent rather than a buried caveat - which is exactly the bar the Assumptions panel is designed to clear.

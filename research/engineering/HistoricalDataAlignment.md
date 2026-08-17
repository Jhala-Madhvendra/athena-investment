# Engineering Concept: Historical Data Alignment

## What it is

When computing a portfolio-level daily return from N holdings, each holding's price bars can't just be zipped together by array index - different tickers have different trading calendars (different exchanges, different listing dates, occasional missing bars from the provider). `portfolio.analytics.calculator.js`'s `buildPortfolioReturnSeries()` aligns by **date**, not index:

```js
const buildPortfolioReturnSeries = (returnsByTicker, weightsByTicker) => {
    // ...build the union of every ticker's trading dates...
    sortedDates.forEach((date) => {
        const covered = tickers.filter((ticker) => returnByTickerByDate.get(ticker).has(date));
        const coveredWeight = covered.reduce((sum, ticker) => sum + weightsByTicker[ticker], 0);
        if (coveredWeight < MIN_COVERAGE_WEIGHT) return; // drop this date - too much of the portfolio unaccounted for

        const weightedReturn = covered.reduce((sum, ticker) => {
            const renormalizedWeight = weightsByTicker[ticker] / coveredWeight; // renormalize over covered tickers only
            return sum + renormalizedWeight * returnByTickerByDate.get(ticker).get(date);
        }, 0);
        series.push({ date, return: weightedReturn, coveredWeight });
    });
};
```

## Why we use it

Naive index-alignment (`bars[i]` from ticker A paired with `bars[i]` from ticker B) silently produces wrong answers the moment any ticker is missing even one bar anywhere in the middle of the window - every subsequent index shifts out of sync with every other ticker's dates, without erroring. Date-based alignment makes "this date exists for this ticker" an explicit, checkable fact rather than an assumption baked into array position.

## Alternatives considered

- **Forward-fill missing prices** (carry the last known price forward for a ticker with no bar on a given date). Rejected - this fabricates a price movement of exactly 0% for a holding that simply has no data that day, which silently understates volatility and can distort correlation, rather than honestly excluding that holding from that day's calculation.
- **Drop any date where *any* holding is missing a bar.** Considered and rejected as too strict - a portfolio with even one illiquid, occasionally-thinly-traded holding would lose many otherwise-good data points across the whole series, for the whole portfolio, because of one holding's gaps.
- **Renormalize every date regardless of coverage, with no minimum threshold.** Rejected - if only 10% of portfolio value has data on a given date, "renormalizing" that 10% up to 100% weight produces a portfolio return dominated by a small, likely unrepresentative slice of the holdings. `MIN_COVERAGE_WEIGHT` (50%) is the line between "enough of the portfolio is represented to trust a renormalized estimate" and "too little is represented, drop the date."

## Trade-offs

- **Pro:** correctness - a portfolio return series built this way only ever reflects dates where a definable majority of portfolio value actually has data, explicitly, rather than silently smearing in fabricated or misleading values.
- **Con:** a portfolio with several holdings on very different trading calendars will have a shorter usable return series than the raw window length would suggest (dates below the coverage threshold are dropped entirely) - `observedTradingDays` in the API response makes this visible rather than hiding it.
- **Con:** slightly more computation than a naive zip (building per-ticker `Map`s, iterating the date union) - negligible in practice given portfolio sizes are tens of holdings, not thousands.

## How Athena implements it

Every ticker's raw bars (`market.service.getHistoricalPrices()`) are converted to day-over-day returns first (`computeDailyReturns()`, which itself only produces a return when both today's and yesterday's close exist), then fed into `buildPortfolioReturnSeries()` together with today's weights. Verified in `portfolio.analytics.calculator.test.js`: a scenario where one ticker has no data at all still produces a correctly-renormalized series when the remaining tickers' weight clears the coverage threshold, and produces an empty series when it doesn't.

## Interview questions

1. *"What's the concrete bug that naive index-alignment causes?"* — Suppose ticker A has bars for every trading day and ticker B is missing one bar in the middle of the window (a provider gap). Zipping by array index means from that point forward, `barsA[500]` is paired with `barsB[500]` - but ticker B's 500th *available* bar is actually a different calendar date than ticker A's 500th bar. Every "portfolio return" computed from that point onward is combining two different actual dates' returns as if they were the same day, silently and with no error thrown.
2. *"Why renormalize weights among covered tickers instead of just using each holding's full portfolio weight even on a day it's missing?"* — Using the full (un-renormalized) weight on a day where, say, 30% of the portfolio has no data would implicitly treat that 30% as contributing a 0% return that day - fabricating a flat return for holdings that simply weren't measured, which understates volatility. Renormalizing among the *covered* tickers instead treats the day's return as "what the represented portion of the portfolio did," honestly scaled up rather than diluted by an assumption about the uncovered portion.

# Engineering Concept: Statistical Aggregation

## What it is

`backend/valuation/comps/comps.statistics.js` is a small, pure library of aggregation functions — `mean()`, `median()`, `percentile()`, and `summarize()` — that turn an array of numeric observations (a peer group's P/E values, or the set of implied per-share values across every applicable Comps methodology) into a small set of representative statistics: count, min, max, mean, median, 25th percentile, 75th percentile.

## Why we use it

A single peer's multiple is a noisy, individually-unreliable data point; the entire premise of Comparable Company Analysis is that a *group* of them, summarized correctly, is more trustworthy than any one of them alone (see `research/finance/TradingMultiples.md`). Getting that summarization right — correctly handling small sample sizes, correctly excluding invalid observations rather than corrupting the aggregate with them — is genuinely easy to get subtly wrong, which is exactly why it's isolated into its own pure, independently-tested module rather than inlined wherever a statistic is needed.

## Alternatives considered

- **Compute statistics inline, wherever needed** (e.g., directly inside `comps.engine.js`'s peer-statistics loop). Rejected — the same min/max/mean/median/percentile logic is needed in two conceptually different places (peer-multiple aggregation, and the final cross-methodology valuation range), and inlining it twice risks the two copies drifting apart, or one of them handling the small-sample-size edge case differently from the other.
- **A third-party statistics library** (e.g., simple-statistics). Rejected for this scope — the actual set of operations needed (mean, median, one percentile method) is small enough that a ~15-line pure implementation is easier to audit, test, and reason about than adding a dependency, and the codebase has an established pattern of hand-writing small, pure formula modules (`ratio.formulas.js`, `dcf.formulas.js`) rather than reaching for a library for arithmetic this simple.
- **Always compute percentiles regardless of sample size.** Rejected — see `OutlierHandling.md` and `TradingMultiples.md` for why a percentile computed from 2-3 points is more misleading than informative, and why Athena withholds it below a minimum threshold instead.

## Trade-offs

**For a small, hand-written pure module:** every function is independently testable against hand-computed expected values (`comps.statistics.test.js` verifies the median-vs-mean outlier-resistance property directly, not just spot-checks individual numbers); the percentile method (linear interpolation, matching Excel's `PERCENTILE.INC`/NIST method 7) is fully specified and auditable in ~10 lines rather than hidden inside a dependency; reuse across peer-multiple aggregation and valuation-range aggregation (see `ComparableValuationEngine.md`) is a one-line function call rather than duplicated logic.

**Against it:** if Athena's statistical needs grow significantly (weighted statistics, confidence intervals, more percentile methods), a hand-rolled module will eventually need to either grow substantially or be replaced by a proper library — an acceptable, not urgent, future trade-off given the current, genuinely small scope.

## How Athena implements it

`summarize(values)` first filters to only finite numbers (`values.filter(isFiniteNumber)`) — a `null` (an excluded observation) or `NaN` is silently dropped, never coerced to zero or otherwise allowed to corrupt a sum or an average — then sorts ascending once and computes every statistic off that single sorted array. `percentile(sortedValues, p)` implements linear interpolation between the two bracketing ranks (`rank = p × (n − 1)`), matching the exact method most spreadsheet tools use by default, so a manually-computed cross-check in Excel will agree with Athena's output. `p25`/`p75` are only populated when at least `MIN_OBSERVATIONS_FOR_PERCENTILE` (4) valid observations exist — below that, `summarize()` returns `null` for both rather than a number that would just echo the min or max. `comps.engine.js` calls `summarize()` twice per request for entirely different purposes: once per multiple, over peer observations; once more, over the small set of applicable cross-methodology implied-per-share values, to build the final valuation range.

## Interview questions

1. *"Why filter out invalid observations before computing statistics, rather than treating a missing multiple as zero?"* — A missing P/E doesn't mean "worth nothing" — it means "no valid observation exists." Treating it as zero would silently drag the mean toward zero and could shift the median as well, actively corrupting the very number the aggregation is supposed to represent. Filtering first (`values.filter(isFiniteNumber)`) means the statistics are always computed over exactly the set of observations that are actually meaningful.
2. *"Walk through why the median is more resistant to outliers than the mean, using Athena's own test case."* — `comps.statistics.test.js` uses `[10, 12, 14, 16, 1000]`: the mean is `210.4` — pulled almost entirely toward the one outlier — while the median is `14`, essentially unmoved, because the median only cares about *rank*, not *magnitude*. One extreme value can shift a median by at most one position in the sorted order; it can shift a mean by an amount proportional to how extreme it is.
3. *"Your `summarize()` function sorts the input array — does that mutate the caller's data, and does it matter?"* — No: `summarize()` builds a new array via `[...validValues].sort(...)` rather than sorting `values` in place, specifically so a caller passing in a live array (e.g. one being iterated elsewhere) never has it silently reordered as a side effect — a small discipline that matters more in a shared library function than it would in a one-off script.

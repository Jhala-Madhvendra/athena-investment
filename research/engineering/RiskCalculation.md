# Engineering Concept: Risk Calculation (Graceful Degradation)

## What it is

Every risk metric in Sprint 14 (volatility, beta, Sharpe, max drawdown, correlation) is built to **degrade to `null` with a stated reason**, never to a fabricated number, `NaN`, or `Infinity`, whenever its inputs are insufficient:

```js
// Sharpe Ratio - zero volatility would otherwise be a division by zero
if (volatility === 0) return null;

// Beta - insufficient coverage among holdings with a known beta
if (coveredWeight < MIN_COVERAGE_WEIGHT) return { beta: null, coveragePercent: ..., excludedTickers };

// Correlation - too few overlapping observations to trust
if (paired.length < MIN_OVERLAPPING_OBSERVATIONS) return { correlation: null, observations: paired.length };

// Volatility - too few return observations
if (portfolioReturnSeries.length < MIN_OBSERVATIONS_FOR_SERIES) return null;
```

## Why we use it

A risk-analytics feature is uniquely dangerous to get subtly wrong: an `Infinity` Sharpe Ratio, a `NaN` beta, or a correlation coefficient computed on 3 overlapping days and presented with the same confidence as one computed on 200 are all failure modes that look like real numbers but aren't - worse than an obvious error, because nothing about them visually signals "don't trust this." Every calculator function in this sprint was written to prefer an honest `null` (rendered as "—" in the UI, with a stated reason where one exists) over a technically-computable-but-meaningless value.

## Alternatives considered

- **Throwing an error when a metric can't be computed.** Rejected for individual metrics - a portfolio with one hard-to-price holding shouldn't lose Volatility, Beta, *and* Sharpe just because Sharpe's risk-free rate happened to be unavailable that request. Each metric fails independently.
- **Silently substituting a default (0 for beta, 0 for correlation, the portfolio's own return for a missing risk-free rate) instead of `null`.** Rejected - each of these defaults is a specific, false claim ("this holding has zero market sensitivity," "these two assets are uncorrelated," "risk-adjusted return is undefined but let's call it raw return") dressed up as a real value. `null` plus a reason is more honest and, per the sprint's core product principle, avoids presenting an assumption as a fact.
- **A single portfolio-wide "insufficient data" flag that hides every metric at once.** Rejected - a portfolio might have enough data for Volatility and Beta but not enough overlapping history for Correlation between two newly-added holdings. Bundling degradation into one flag would hide metrics that are actually computable.

## Trade-offs

- **Pro:** every number the frontend renders is either a real, defensible statistic or explicitly absent - there's no middle ground where a technically-non-crashing-but-wrong number gets displayed with full confidence.
- **Pro:** each metric's minimum-data threshold is a named constant (`MIN_COVERAGE_WEIGHT`, `MIN_OVERLAPPING_OBSERVATIONS`, `MIN_OBSERVATIONS_FOR_SERIES`), documented once at the top of its module, not a scattered magic number.
- **Con:** the frontend has to handle "—" across every single stat card, which is more UI states to design for than assuming every field is always a number. Handled once per component (`formatRatio`/`formatPercent` already return `'—'` for non-numbers), not per call site.

## How Athena implements it

Every calculator function returns `null` (never `NaN`/`Infinity`/a silent fallback) on insufficient or invalid input; the service layer never re-interprets a `null` into a default before it reaches the API response; the frontend's formatters (`formatRatio`, `formatPercent`, `formatCorrelation`) all render `'—'` for anything that isn't a finite number. Verified across the calculator test suite: `calculateSharpeRatio(0.1, 0.04, 0)` returns `null`, not `Infinity`; `calculatePortfolioBeta([])` returns `{beta: null, ...}`, not `0`; `calculatePairwiseCorrelation` on a constant series returns `null`, not a spurious `0`.

## Interview questions

1. *"Why return `null` for Sharpe Ratio on zero volatility instead of just special-casing it to display '∞' in the UI?"* — Because an infinite Sharpe Ratio isn't a real, interpretable risk-adjusted return - it's an artifact of dividing by zero, and displaying it (even as the symbol ∞) implies the calculation succeeded and produced a legitimate, if extreme, result. Reporting it as unavailable is more honest about what actually happened: the metric is mathematically undefined for this input, not extraordinarily good.
2. *"Give an example where fabricating a default instead of returning `null` would have produced a wrong-looking-right number."* — Portfolio Beta: if a newly-listed holding with no beta yet were silently treated as beta = 0 (rather than excluded and reported in `excludedTickers`), a portfolio's weighted-average beta would be understated by exactly that holding's weight - and nothing about the resulting number would look wrong. It would just quietly be incorrect, in a direction that happens to make the portfolio look less market-sensitive than it actually is.

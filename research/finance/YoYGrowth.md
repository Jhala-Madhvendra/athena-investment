# Year-over-Year (YoY) Growth

## 1. Definition

The percentage change in a metric between the current reported fiscal year and the immediately preceding one — the only period comparison Athena's earnings data actually supports today (see `QoQvsYoY.md`).

## 2. Formula

```
YoY % = (latestValue - previousValue) / previousValue * 100
```

Undefined (returned as `null`, not computed) when `previousValue` is zero or negative — see Limitations.

## 3. Intuition

Comparing FY2026 to FY2025 for the *same company* cancels out seasonality entirely (both periods cover a full 12 months, so any within-year seasonal pattern appears in both and drops out of the comparison) while still capturing real business change.

## 4. Why investors care

YoY is the default lens for judging whether a business is actually growing, because it removes the two biggest sources of noise in a shorter comparison: seasonality and calendar-day-count effects. A company whose Q4 always outperforms Q1 doesn't look like it's declining just because this Q1 is smaller than last Q4 — YoY only ever compares like-for-like periods.

## 5. Which financial statements are used

Whichever statement holds the metric being compared — Income Statement for revenue/operating income/net income/EPS, Cash Flow Statement for FCF, Balance Sheet for debt/cash.

## 6. How Athena calculates it

`backend/earnings/earnings.calculator.js`'s `percentChange(previous, latest)` returns `null` when `previous` is missing, zero, or negative — deliberately matching `backend/alerts/alert.engine.js`'s own local `percentChange` and `backend/analysis/trend.engine.js`'s `calculateYoYGrowth`, so "a percent change means something" is defined identically everywhere in Athena, not as three subtly different conventions.

## 7. Limitations

- A base value of zero or below makes a percentage change undefined or actively misleading (a move from -$10M to +$5M is not meaningfully "a -150% decline") — Athena returns `null` rather than computing a number that would mislead more than it informs.
- YoY smooths seasonality but hides it — if a reader specifically wants to know "was this quarter better than the seasonally similar quarter last year," YoY answers that; it cannot show sequential (quarter-to-quarter) momentum, which is a different question (`QoQvsYoY.md`).

## 8. Common interpretation mistakes

- Computing a percent change from a negative prior-period value and reporting it as if it behaved like a normal percentage (see Formula/Limitations above).
- Confusing a relative percent change (YoY growth) with a percentage-**point** change (used for margins) — they are different units and Athena's own comparison table never conflates them (see `MarginAnalysis.md`).

## 9. Interview question

*"Why does Athena return `null` instead of a number when the prior period's value is negative or zero?"* — Because the mathematical result would be technically computable but practically misleading (a swing from a small negative number to a positive one can produce an enormous or sign-flipped percentage that doesn't describe the business change in any useful way). Returning `null` and rendering "Not available" is more honest than a number that looks precise but isn't meaningful.

# Financial Trend Alerts

## 1. Definition

A financial trend alert flags a *sustained, multi-year* direction in a fundamental metric — a margin compressing for several consecutive years, or a profit turning into (or out of) a loss — as distinct from a single period's change. This is the BUSINESS alert category's job in Athena, deliberately separate from the FINANCIAL category's single-period deltas (see `FinancialEventMonitoring.md`).

## 2. Why investors care

A single bad year is often noise — a one-off write-down, a currency swing, a bad quarter that reverses. A trend that holds across 3+ consecutive year-over-year comparisons is a different kind of signal: it suggests something structural (competitive pressure, a changed cost base, a strategy shift) rather than a one-time event, and structural changes are what actually move long-run valuation.

## 3. Formula

Trend direction reuses Sprint 3's `trend.engine.js` rather than re-deriving it:

```
For each year-over-year comparison in the window, classify as improving/declining/stable
using a threshold (50 bps for margins). Direction = the majority classification if
3+ of the comparisons agree; otherwise "stable" or "volatile" (stdDev > 10%).
Consistency % = (comparisons agreeing with the majority direction) / (total comparisons)
```

A sign change (profit → loss, or loss narrowing/widening) is handled separately from CAGR, since CAGR is mathematically undefined across a zero or negative value.

## 4. Appropriate comparison period

Up to a 5-year window (`windowStatements(statements, 5)`), the same window Sprint 3's Business Analysis dashboard already uses — trend detection needs several data points to distinguish a real trend from a single bad year, and Athena's financial data is annual-only, so "multi-year" here always means multiple *fiscal years*, never quarters (Athena has no quarterly statement model).

## 5. Limitations

- Requires at least 3 statements before a trend rule can fire at all — a newly-imported company with 1-2 years of history gets no BUSINESS alerts, only FINANCIAL ones (see `FinancialEventMonitoring.md`), until more history accumulates.
- The consistency threshold (75%, `THRESHOLDS.business.trendConsistencyPercent`) is a magnitude/direction rule, not a statistical significance test — five data points is a small sample, and a 75% consistency bar on five points is a coarser signal than it would be on twenty.
- No sector-relative framing: an industry-wide margin compression (e.g., a raw-material cost shock hitting an entire sector) looks identical to a company-specific one.

## 6. False positives

A company recovering (2 improving years) after 2 declining years won't yet register a change in classification if the improving run hasn't reached majority within the window — the trend label lags the most recent data by design, since a single good year isn't enough to call a reversed trend, exactly the same reasoning that makes a single bad year insufficient to call a decline.

## 7. How Athena implements it

`backend/alerts/alert.engine.js`'s `evaluateBusinessRules` calls `trend.engine.js`'s `analyzeMarginTrend` (operating margin) and `calculateGrowthMetrics` (free cash flow), firing `OPERATING_MARGIN_TREND_DECLINE` / `FCF_TREND_DECLINE` only when direction is declining AND consistency clears the threshold. Separately, `trend.engine.js`'s `describeSignChange` classifies profit/loss inflections (`turnaround`, `declinedToLoss`, `narrowingLoss`, `wideningLoss`, ...) into their own alerts, with `declinedToLoss`/`newLoss`/`wideningLoss` classified HIGH severity (see `research/engineering/RuleEngine.md`'s severity criteria) since falling into or deeper into a loss is structurally significant regardless of the exact magnitude. No snapshot is needed — the fiscal-year window itself (`FY{start}-FY{end}`) is a stable, naturally-idempotent deduplication key; see `AlertDeduplication.md`.

## 8. Common mistakes

- Treating a single declining year as "the trend" — that's what the FINANCIAL category's single-period rules are for; conflating the two produces alerts that overstate how structural a one-off dip actually is.
- Applying CAGR mechanically across a sign change (a year with a loss) without a fallback — the exponent is undefined for a non-positive base/terminus, which is exactly why `describeSignChange` exists as a parallel path rather than letting CAGR silently produce `NaN` or a nonsensical number.

## 9. Interview questions

1. *"Why does Athena have both a single-period margin alert and a multi-year trend alert for the same metric?"* — They answer different questions: "did something change since last year" (period-over-period, catches a sudden shock) versus "is this a sustained direction" (multi-year, catches a structural erosion a single year wouldn't reveal). Both are useful and neither substitutes for the other.
2. *"Why 3+ of 4 comparisons for 'declining', not a stricter bar like 4-of-4?"* — Real fundamentals are noisy even within a genuine trend; requiring unanimity would miss trends that are real but not perfectly monotonic. Majority-with-consistency-scoring communicates both the direction and how clean it is.
3. *"How does Athena avoid treating an industry-wide shock as company-specific?"* — It doesn't yet — this is a documented limitation. A future version could compare a company's trend against sector peers using the same infrastructure the Comps engine already has for peer selection.
4. *"Why can't CAGR describe a company going from a loss to a profit?"* — CAGR requires exponentiation of a ratio (end/start); a negative or zero starting or ending value makes that ratio meaningless as a growth rate. `describeSignChange` exists precisely to describe that transition qualitatively instead of forcing a fractional-exponent calculation onto numbers it was never designed for.

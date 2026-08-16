# QoQ vs. YoY Comparison

## 1. Definition

Two different ways to measure period-over-period change: Quarter-over-Quarter (QoQ) compares a reporting period to the immediately preceding quarter; Year-over-Year (YoY) compares it to the same period one year earlier. Athena implements only YoY today, because it only stores annual financial statements — see Limitations.

## 2. Formula

```
QoQ % = (thisQuarter - lastQuarter) / lastQuarter * 100
YoY % = (thisYear - lastYear) / lastYear * 100                    (implemented - see YoYGrowth.md)
```

## 3. Intuition

QoQ answers "what's the sequential momentum, right now?" YoY answers "how does this compare to the same point in the business's annual cycle, a year ago?" A retailer's Q4 (holiday season) will always look larger than its Q1 sequentially — that's not weakness, it's seasonality. YoY removes that distortion by only ever comparing a period to its own seasonal twin.

## 4. Why investors care

Both serve genuinely different purposes and neither replaces the other. QoQ is more sensitive to a recent inflection — the first sign of an accelerating or decelerating trend often shows up sequentially before it shows up YoY. YoY is more reliable for judging underlying business growth, precisely because it's immune to seasonality. The Sprint 12 brief's own guidance: prefer YoY where seasonality is significant, and show both where both are available and useful.

## 5. Which financial statements are used

Whichever statement holds the metric — the choice of QoQ vs. YoY is about *which periods* are compared, not which statement.

## 6. How Athena calculates it

`backend/earnings/earnings.periods.js`'s `resolvePeriods(statements)` explicitly returns `comparisonType: "YoY"` whenever a comparison is possible — a documented, honest declaration of what kind of comparison is actually happening, not an implicit assumption the reader has to infer. There is currently no `"QoQ"` branch: Athena's `FinancialStatement` model (`backend/financials/financials.model.js`) has only a fiscal `year` field, and neither the Yahoo provider (`backend/financials/providers/yahooFinance.provider.js`, requesting only `annual*` Yahoo timeseries fields) nor the Twelve Data provider fetches or stores quarterly data — see `research/engineering/PeriodComparison.md` for the full investigation.

## 7. Limitations

- Athena cannot show QoQ at all today — this is a real, disclosed gap, not a silently missing feature. The `periodType` enum in `earnings.periods.js` (`ANNUAL` / `QUARTERLY` / `TTM`) exists specifically so quarterly support is additive later, not a rewrite.
- Even once quarterly data exists, QoQ for a highly seasonal business (retail, travel) needs to be read alongside YoY, never alone — a naive QoQ-only view of a retailer's Q1 vs. Q4 would look like a business in freefall every single year.

## 8. Common interpretation mistakes

- Reading a QoQ decline as automatically bad without checking whether it's seasonal — this is the single most common misreading of quarterly data among newer investors.
- Assuming YoY is always safer — it lags a genuine sequential inflection by up to a year, so relying on YoY alone in a fast-changing business can mean missing the story until it's a year old.

## 9. Interview question

*"Athena has annual data only, so why write this document at all instead of skipping QoQ entirely?"* — Because a candidate for extending Athena needs to understand the *concept* before implementing the *feature*, and because the architecture (the `periodType` enum, the explicit `comparisonType` field) was deliberately built so that adding quarterly data later only requires a new branch in `resolvePeriods`, not a redesign of the response shape or the comparison engine.

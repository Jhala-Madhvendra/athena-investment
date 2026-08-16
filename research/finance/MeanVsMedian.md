# Mean vs. Median in Industry Benchmarking

## 1. Definition

The mean is the arithmetic average of a set of observations; the median is the middle value once the observations are sorted (or the average of the two middle values, for an even-sized set). Both summarize "the typical value" of a distribution — but they respond very differently to extreme values.

## 2. The formula

```
Mean   = Σ(values) / count(values)
Median = middle value of sorted(values)   [linear interpolation for an even count]
```

Athena reuses `comps.statistics.js`'s `mean()`/`median()` directly for industry benchmarking (`industry.benchmark.js`) rather than reimplementing them — the same statistics engine Sprint 7's Comps already proved correct.

## 3. Why investors care

The choice of statistic changes the answer. A peer group of `[18%, 20%, 22%, 24%]` has a mean and median that agree (~21%); a peer group of `[18%, 20%, 22%, 90%]` (one outlier) has a mean of ~37.5% but a median of 21% — the median describes what's typical for *most* of the group, the mean describes the group's total mass, which one extreme company can dominate.

## 4. How analysts use it

Analysts default to the median specifically to avoid one atypical company distorting a "typical peer" read — a distressed or hyper-growth outlier in an otherwise ordinary peer set shouldn't single-handedly redefine what "typical" means for the group. The mean remains useful when every observation is considered equally reliable and the full magnitude of each matters (e.g., aggregate exposure calculations), but it is rarely the right *default* for a benchmark meant to represent "a typical company in this space."

## 5. How Athena calculates it

`industry.benchmark.js`'s `summarizeMetric()` computes both mean and median for every benchmarked metric, but the **comparison and classification logic (`compareToTarget()`, `classifyPosition()`) always uses the median** — the same default Sprint 7's `TradingMultiples.md` documents for peer multiples, applied here to operating and growth metrics as well. The mean is still returned in the API response for a fuller picture, but it never drives the "strength/weakness" classification.

## 6. Limitations

- The median is less sensitive to outliers, but it is not immune to a *small sample* — with exactly 4 observations (Athena's minimum), the median is the average of the two middle values, which can shift meaningfully if even one company's data changes.
- Neither statistic captures the *shape* of the distribution — Athena additionally reports min/max/p25/p75 (see `FinancialPercentiles.md`) so a reader isn't left guessing whether the universe is tightly clustered or widely spread.

## 7. Common interpretation mistakes

- **Assuming the mean and median will always be close.** They diverge exactly when a distribution is skewed or has outliers — which is common in financial data (a handful of hyper-growth or distressed companies in an otherwise ordinary peer set).
- **Treating a small-sample median as equally reliable as a large-sample one.** A median of 4 companies and a median of 40 companies are not the same statistical statement, even though both are "the median."

## 8. Interview questions

1. *"Give a concrete example of when the mean and median would tell meaningfully different stories."* — A peer group's operating margins of `[10%, 12%, 14%, 16%, 1000%]` — a data error or an outlier company with a wildly different structure — produces a mean north of 200% (meaningless) but a median of 14% (still representative of the other four). See `industry.benchmark.test.js`'s exact assertion of this case.
2. *"Why does Athena default to median rather than letting the mean be the primary statistic, given the mean uses more information?"* — Because Athena cannot itself judge whether every company in the reference universe is a genuinely typical, comparable business (see `PeerSelection.md`'s discussion of the same limitation for Comps) — defaulting to the statistic that's structurally more robust to one atypical inclusion is the safer choice when that judgment can't be made in code.

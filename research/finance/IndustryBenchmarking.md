# Industry Benchmarking

## 1. Definition

Industry benchmarking is the specific act of comparing one company's metric against a summary statistic computed from a reference universe of peers, and expressing the gap in a standard, comparable unit (percentage points for margins/growth/returns, or "Nx" for valuation multiples).

## 2. The formula

```
Difference (percent-unit metrics) = Company Value − Industry Median
Relative (multiple-unit metrics)  = Company Value ÷ Industry Median
Percentile = share of the reference universe at or below the company's value
```

Athena always benchmarks against the **median**, not the mean — see `MeanVsMedian.md` for why.

## 3. Why investors care

A single comparison ("28% vs. 21%") is more actionable than either number alone. It tells an investor not just *what* the company reports, but *how unusual* that figure is relative to businesses it actually competes with — the first step toward asking *why* (better execution, different mix, temporary conditions).

## 4. How analysts use it

Analysts build benchmark tables as a first-pass screen before deeper diligence: which metrics stand out (in either direction) relative to peers, and by how much. A metric within a point or two of the peer median is usually not worth investigating further; one that's ten points off almost always is. This is exactly the materiality-threshold logic Athena's Relative Strengths/Weaknesses classification implements — see `RelativePerformance.md`.

## 5. How Athena calculates it

`industry.benchmark.js`'s `compareToTarget()` computes a percentage-point difference for percent-unit metrics (revenue growth, operating margin, net margin, ROE, ROA, FCF margin) and a relative multiple for valuation metrics (P/E, EV/EBITDA) — the two are never mixed in the same field, and the frontend labels each explicitly (`pp` vs. `x`). The benchmark is only computed when the reference universe has at least `MIN_UNIVERSE_SIZE` (4) valid observations for that specific metric — see `FinancialPercentiles.md`.

## 6. Limitations

- A benchmark reflects Athena's tracked universe at the time of calculation, not a live, continuously-updated market-wide dataset.
- Financial-statement-derived metrics (margins, growth, ROE) and market-derived metrics (P/E, EV/EBITDA) can reflect different points in time for different universe members — see `IndustryValuation.md`'s data-freshness note.
- A benchmark says nothing about *why* a company differs from its peers — it identifies the gap, not the cause.

## 7. Common interpretation mistakes

- **Treating "above the industry median" as automatically good.** A margin far above peers can reflect genuine competitive advantage — or a temporary, unsustainable condition (a one-off gain, a cost cut that will reverse). Athena's language is deliberately neutral ("above the industry median"), never "better."
- **Ignoring the universe size.** A benchmark computed from exactly 4 companies (Athena's minimum) carries much less statistical weight than one computed from 20 — the `universe.size` field exists specifically so this isn't hidden.
- **Comparing a percentage-point difference on one metric against a relative multiple on another as if they were the same kind of number.** A "+7" for margin and a "1.3x" for P/E are not comparable magnitudes.

## 8. Interview questions

1. *"Why does Athena report a percentage-point difference for margins but a relative multiple for P/E?"* — Because the two metrics answer different questions. A margin difference in percentage points directly states "how many more cents of profit per revenue dollar" — a natural additive comparison. A P/E ratio is itself a ratio; expressing "how much more expensive" as a multiple ("1.3x the median") is the natural multiplicative comparison for a ratio-of-a-ratio.
2. *"A company's operating margin is 2 percentage points above the industry median. Is that a strength?"* — Not necessarily — Athena's materiality threshold (3 percentage points, see `RelativePerformance.md`) exists precisely because small differences can reflect noise, rounding, or timing rather than a genuine structural advantage.

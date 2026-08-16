# Industry Valuation

## 1. Definition

Industry valuation comparison places a company's own trading multiples (P/E, EV/EBITDA) against the median of its industry reference universe — a broader, less curated cousin of Sprint 7's Comparable Company Analysis, used for context rather than an implied per-share value.

## 2. The formula

```
Relative Multiple = Company Multiple ÷ Industry Median Multiple
```

Expressed as "Nx the industry median" (e.g., "1.17x") — never as a percentage-point difference, since a multiple is itself a ratio; comparing two ratios multiplicatively is the natural framing (see `IndustryBenchmarking.md`).

## 3. Why investors care

A P/E in isolation says little; a P/E relative to what the market is currently paying for similar businesses says much more. "27x, versus an industry median of 23x" tells an investor the company trades at a premium to its immediate reference set — the starting point for asking *why* (superior growth, superior quality, or simple overvaluation), not the answer itself.

## 4. How analysts use it

Relative valuation multiples are a standard first-pass screen precisely because they're fast to compute and easy to compare across a peer set — before building a full DCF or Comps model, analysts often just ask "how does this trade relative to its group?" Sprint 6 (DCF) and Sprint 7 (Comps) already give Athena users intrinsic and peer-implied valuations; Industry Valuation adds the lightest-weight version of the same question, scoped to a broader automatic universe.

## 5. How Athena calculates it

P/E and EV/EBITDA are computed identically to Sprint 7's Comps — via `comps.formulas.js`'s `priceToEarnings()` and `evToEbitda()` (Market Cap ÷ Net Income, and Enterprise Value ÷ EBITDA respectively) — not a provider's own trailing-P/E field, which can inconsistently mix TTM and annual figures across different companies. Both are excluded (never fabricated) when the denominator is zero or negative, exactly matching Sprint 7's outlier handling — see `research/engineering/OutlierHandling.md`.

## 6. Data freshness

Financial-statement-derived inputs (net income, EBITDA components) reflect each company's latest *reported fiscal year*, which can differ by weeks or months between universe members. Market inputs (price, market cap) are a live quote as of calculation time. Athena's response carries both timestamps separately (`dataFreshness.financialPeriod` and `dataFreshness.marketDataAsOf`) — it never implies every number in the response was measured at the same instant.

## 7. Limitations

- **Never labeled "cheap" or "expensive."** A premium or discount to the industry median has no inherent positive or negative meaning without further analysis (growth differences, quality differences, temporary market conditions) that Athena does not attempt to judge.
- **The reference universe's own multiples can themselves be temporarily distorted** (a broad market re-rating, a sector-wide selloff) — a "premium to the industry median" during a sector-wide bubble means something very different than the same premium during a normal market.
- **Small universes make the median multiple itself noisy** — the same minimum-sample-size gate (`FinancialPercentiles.md`) applies here as everywhere else in Industry Intelligence.

## 8. Interview questions

1. *"Why does Athena compute P/E itself instead of trusting the market data provider's own trailing P/E field?"* — Consistency across companies: a provider's trailing P/E can mix trailing-twelve-month and most-recent-annual data inconsistently between tickers, which would make a peer comparison compare apples to oranges. Computing it the same way (Market Cap ÷ latest annual Net Income) for every company in the universe guarantees an apples-to-apples comparison — the same discipline Sprint 7's Comps already established.
2. *"A company trades at 1.3x its industry median P/E. What can and can't you conclude from that alone?"* — You can conclude the market is currently pricing this company at a premium to its immediate reference set. You cannot conclude whether that premium is justified (superior growth/quality) or unwarranted (overvaluation) — that requires further analysis Athena deliberately doesn't automate into a recommendation.

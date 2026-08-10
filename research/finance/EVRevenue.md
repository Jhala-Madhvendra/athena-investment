# EV/Revenue

## 1. Definition

EV/Revenue compares a company's Enterprise Value to its top-line Revenue. It answers: "how many times its revenue is the whole operating business valued at?" — the least earnings-dependent multiple Athena calculates, since it needs no profitability at all to be computed.

## 2. The formula

```
EV/Revenue = Enterprise Value / Revenue

where:
  Enterprise Value = Market Cap + Total Debt − Cash & Cash Equivalents
```

## 3. Intuition

Like EV/EBITDA, this is an **Enterprise-Value multiple** — EV belongs to all capital providers, and Revenue, sitting at the very top of the income statement, is entirely untouched by financing decisions, tax rate, or depreciation policy. It's the "purest" of Athena's five multiples in the sense that it depends on the fewest downstream accounting choices.

## 4. Why investors use it

Revenue is much harder to manipulate or distort via accounting choices than earnings or EBITDA, and — critically — it's available even for companies with **no profit at all**, which is exactly why EV/Revenue is the standard fallback multiple for early-stage, high-growth, or currently-unprofitable companies where P/E and EV/EBITDA are simply unusable.

## 5. When it is useful

- Valuing a growth-stage or currently-unprofitable company where earnings-based multiples are unusable.
- Comparing companies within the same industry where margin structures are genuinely similar, so revenue is a reasonable stand-in for eventual profitability.
- As a sanity-check floor: a company shouldn't typically trade *below* what its revenue alone would suggest for its sector, absent a specific reason.

## 6. When it can be misleading

- **It says nothing about profitability.** Two companies with identical revenue but wildly different margins (a 5%-margin retailer vs. a 40%-margin software company) do not deserve the same EV/Revenue multiple, even though the multiple itself doesn't distinguish them.
- Zero revenue makes it undefined — Athena's `evToRevenue()` returns `null` rather than dividing by zero or fabricating a value (see `OutlierHandling.md`).
- It's the multiple most susceptible to comparing fundamentally different business models under the same industry label (a marketplace taking a small commission vs. a company selling goods directly at full price will have very different revenue-to-value relationships even if their underlying economics are comparable).

## 7. What makes a company comparable

Beyond the general factors in `ComparableCompanyAnalysis.md`, EV/Revenue comparisons are only meaningful between companies with **similar expected margin trajectories** — a peer group should be growth-stage-to-growth-stage, or mature-to-mature, not mixed, since the multiple carries an implicit assumption about eventual profitability that differs sharply between the two.

## 8. How Athena implements it

Computed in `comps.engine.js`'s `buildCompanyMetrics()` via `comps.formulas.js`'s `evToRevenue()`, which returns `null` — with a stated `excludedReason` — when Revenue isn't positive or Enterprise Value couldn't be computed. Aggregated across peers by `comps.statistics.js`; the target-company application (`comps.valuation.js`) follows the same enterprise-multiple path as EV/EBITDA: Implied Enterprise Value first, then bridged to Implied Equity Value via `dcf.formulas.js`'s `netDebt()`/`equityValue()`, never skipped.

## 9. Common mistakes

- **Treating the Implied Enterprise Value output as Equity Value directly** — the same non-negotiable bridge violation covered in `ValuationMultiples.md`; Athena's engine structurally cannot skip it.
- **Applying it to a peer group with very different margin profiles** without acknowledging that the resulting "implied value" embeds an assumption the target may not share.
- **Using it as the sole methodology** for a profitable, mature company when P/E or EV/EBITDA are available and more informative — Athena reports all five applicable multiples side by side specifically so no single one is over-relied on.

## 10. Interview questions

*"Why would an investor use EV/Revenue instead of EV/EBITDA?"* — Primarily when the company (or its peers) don't have meaningful, comparable EBITDA — pre-profit growth companies, or a peer group where accounting differences make EBITDA comparisons unreliable. It trades precision (Revenue says nothing about how efficiently that revenue converts to profit) for availability and manipulation-resistance.

*"What's the biggest risk in relying on EV/Revenue?"* — That it silently ignores margin. Applying a peer group's median EV/Revenue to a target with a structurally different (better or worse) margin profile will produce an implied value that's systematically too high or too low relative to what the company's actual earnings power would justify — the multiple has no mechanism to catch that mismatch on its own, which is why Athena always shows EV/Revenue's implied value alongside the other applicable multiples rather than in isolation.

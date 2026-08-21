# Scenario Attribution

## 1. Definition

Scenario attribution breaks a portfolio-level scenario result down into how much each holding — and each sector — actually contributed to it, answering "which holdings caused most of the scenario loss?" rather than only "what happened to the portfolio as a whole." Two related but genuinely different numbers are reported per holding and per sector: **portfolio impact** and **contribution to scenario impact** — conflating them is the single most common mistake in this area (Section 8).

## 2. The formula

```
Portfolio Impact (pp)          = Holding Absolute Change / Current Portfolio Value × 100
Contribution to Impact (%)     = Holding Absolute Change / Total Scenario Absolute Change × 100
```

Sector-level attribution is the same two ratios computed over the *sum* of a sector's holdings' current value / absolute change, not recalculated independently.

## 3. Intuition

**Portfolio Impact** answers "how many percentage points did this holding move the whole portfolio" — a number naturally bounded by the holding's own weight and shock size. **Contribution to Impact** answers a different question: "of the total dollar swing this scenario produced, what share came from this one holding" — a number that depends on how every *other* holding moved too, not just this one. A small, heavily-shocked holding can dominate Contribution to Impact while barely registering by portfolio weight; a large, unaffected holding can carry real portfolio weight while contributing 0% to a scenario's outcome.

## 4. Why investors care

Portfolio weight alone answers "how much do I own of this." It does not answer "if something goes wrong, where does the damage actually come from" — a genuinely different, risk-relevant question. A 3%-weight holding that's the single asset targeted by a scenario's harshest shock can be the primary driver of a scenario's total loss even though a weight-sorted holdings table would never surface it near the top. Attribution exists specifically to answer the "where does the damage come from" question directly, rather than leaving the reader to infer it from weight and shock size separately.

## 5. Assumptions

Every dollar figure attribution is computed on is USD-normalized (same convention as Sprint 9/14's portfolio calculator) — a multi-currency portfolio's contributions are comparable across holdings regardless of native currency. Contribution to Impact is computed against the scenario's **net, signed** total change — when holdings move in opposite directions within the same scenario (some up, some down), individual contributions can be negative or exceed 100% of that smaller net total. This is a correct, well-understood property of attribution against a net total (the same phenomenon shows up in performance attribution when winners and losers partially offset), not a computation bug — see Section 8.

## 6. Limitations

Contribution to Impact is undefined (reported as `null`, never fabricated as 0) when a scenario's total change is exactly zero — dividing by zero has no meaningful answer, and a Base Case scenario (all shocks 0%) is the most common way this occurs. Attribution is purely additive/mechanical — it does not weight a holding's contribution by any measure of "how likely" its shock was, since no probability is ever assigned to a scenario shock in the first place (see `AdvancedScenarioAnalysis.md` Section 5).

## 7. How Athena implements it

`backend/portfolio/portfolio.scenario.calculator.js`'s `attributeHoldingImpact()` and `attributeSectorImpact()` compute both ratios directly from the resolver's per-holding effective shock (`portfolio.scenario.resolver.js`) — no separate recomputation path, so attribution is guaranteed to sum correctly against the same total the headline `absoluteChangeUSD` reports. Sector attribution groups already-attributed holdings by `Company.sector` (falling back to `"Unclassified"` rather than dropping unclassified holdings, matching Sprint 14's `portfolio.analytics.exposure.js` convention). The frontend (`HoldingImpactTable.jsx`/`SectorImpactTable.jsx`) sorts by `|absoluteChangeUSD|` — the biggest dollar movers first, regardless of direction — and shows Portfolio Impact and Contribution to Impact as two visually separate columns with an explanatory footnote, specifically to prevent the two numbers being read as interchangeable.

## 8. Common mistakes

- **Reading Contribution to Impact as if it were portfolio weight** — a holding contributing 80% of a scenario's loss is not necessarily an 80%-weight holding; it may be a small position that happened to receive the scenario's harshest shock.
- **Treating a >100% or negative contribution as a bug** — this is the expected, correct behavior when holdings move in opposite directions and partially offset each other within the same scenario; the net total shrinks, so individual signed contributions against that smaller net total can exceed 100% or go negative.
- **Ranking holdings by Portfolio Impact alone to find "what to worry about"** — Portfolio Impact only reflects that one scenario's assumptions; a holding barely touched by this particular scenario could still be the portfolio's largest real risk under a different set of shocks (see the Sensitivity feature, `PortfolioScenarioSensitivity.md`).

## 9. Scenario vs. forecast

Attribution inherits the scenario/forecast distinction of the scenario it's computed from (`AdvancedScenarioAnalysis.md` Section 9) — "AAPL explains 100% of this scenario's modeled loss" is a fact about the arithmetic of one hypothetical, not a claim that AAPL will in fact be the source of any real future loss.

## 10. How analysts use it

Performance and risk attribution are standard practice wherever a portfolio-level number needs to be traced back to its sources — the same instinct behind Brinson-style return attribution in active management, applied here to a hypothetical stress outcome instead of realized returns. The goal in both cases is the same: a single portfolio-level number is much less actionable than knowing which specific positions are actually driving it.

## 11. Interview questions

1. **"A holding is only 2% of the portfolio by weight but explains 40% of a scenario's total loss. Is that a bug?"** — No. Portfolio weight measures how much is owned; Contribution to Impact measures how much of *this scenario's* dollar swing came from that holding. A small position that happens to receive the scenario's harshest shock can dominate the loss's composition without being a large position — that's exactly the case attribution is designed to surface, not obscure.
2. **"Why can Contribution to Impact be negative or exceed 100%?"** — Because it's computed against the scenario's net, signed total change. If some holdings gain and others lose within the same scenario, the net total is smaller than the gross movement, and an individual holding's signed contribution against that smaller net can mathematically exceed 100% or flip sign relative to the portfolio's overall direction. It's a known property of attribution against a net total, not a computation error.
3. **"Why does Athena report `null` instead of 0 for Contribution to Impact when the scenario's total change is zero?"** — Because dividing by zero has no defined answer, and reporting 0 would falsely imply "this holding contributed nothing" rather than "this ratio isn't meaningful for this scenario" — the same null-over-fabricated-zero discipline Sprint 14's calculators already established for other undefined ratios (e.g., Sharpe Ratio at zero volatility).

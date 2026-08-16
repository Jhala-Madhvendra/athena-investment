# Industry Analysis

## 1. Definition

Industry analysis is the practice of evaluating a company's financial performance and valuation *in the context of the businesses it competes with*, rather than in isolation. A metric only has meaning relative to a reference point — "28% operating margin" is a number; "28% operating margin, 7 points above the industry median" is a signal.

## 2. Formula

There isn't a single formula — industry analysis is a family of comparisons, each computed the same way: `Company Value` vs. `f(Reference Universe)`, where `f` is a statistic (median, mean, percentile — see `MeanVsMedian.md`) and the reference universe is a defined set of peer companies (see `research/engineering/ReferenceUniverse.md`).

## 3. Why investors care

A metric evaluated alone can't distinguish "this company is doing well" from "this company's *industry* is doing well." A 20% operating margin is unremarkable for enterprise software and exceptional for grocery retail — the number is identical, the read is opposite. Investors use industry context to separate company-specific execution from sector-wide tailwinds/headwinds, and to judge whether a valuation premium reflects genuine outperformance or simply an expensive sector.

## 4. How analysts use it

Sell-side and buy-side analysts routinely build "comp sheets" grouping a company with same-industry peers, then read every metric — growth, margin, returns, leverage, valuation — as a relative position within that group, not an absolute score. This is the same discipline Sprint 7's Comparable Company Analysis applies to *valuation specifically*; Industry Intelligence extends it to operating performance and growth, and does so automatically for a broader (though not user-curated) reference set — see Section 7 for how the two differ.

## 5. How Athena calculates it

`GET /api/industry/:ticker` resolves a reference universe from companies Athena already tracks that share the target's `industry` classification (falling back to the broader `sector` when too few match — see `ReferenceUniverse.md`), computes each universe member's metrics by reusing the Ratio Engine and Comps formulas (`industry/industry.calculator.js`), and benchmarks the target against the universe's median for growth, profitability, leverage, and valuation metrics (`industry/industry.benchmark.js`). Every comparison states its reference universe size explicitly — Athena never says "industry average" without saying how many companies that average is built from.

## 6. Limitations

- **The reference universe is Athena's own tracked-company database, not a market-wide industry census.** A company's true industry may have hundreds of participants; Athena can only automatically benchmark against the ones a user has previously searched or imported. A user can *deliberately* grow this universe via "Find More Companies" (a live external classification search — see `research/engineering/IndustryCompanyDiscovery.md`), but this is an explicit, opt-in action, never something Athena does silently as part of computing a benchmark.
- **Sector/industry labels are free-text strings from Yahoo Finance, not a formal taxonomy (no GICS/ICB codes).** Two companies can share an industry label while differing meaningfully in business model — the same limitation `PeerSelection.md` documents for Sprint 7's peer selection.
- **A metric with an insufficient sample size is reported as unavailable, not computed anyway** — see `FinancialPercentiles.md` for the minimum-sample-size rule.

## 7. How this differs from Comparable Company Analysis (Sprint 7)

Comps is a **user-curated** peer set used to produce an **implied valuation** — the user explicitly chooses each peer, and the output is a per-share value. Industry Intelligence is a **broader, automatically-assembled** reference set used to produce **relative operating and valuation context** — no user curation, and no implied valuation is ever produced from it. Industry Intelligence can *suggest* candidates for Comps (`GET /api/industry/:ticker/peers`), but a suggestion never becomes the Comps peer set without the user explicitly selecting it.

## 8. Interview questions

1. *"Why does a 20% operating margin mean different things in different industries?"* — Because cost structure, capital intensity, and competitive dynamics vary enormously by industry — software companies carry near-zero cost of goods sold, while grocers operate on razor-thin margins by design. The number is only interpretable relative to what's typical for that specific business model.
2. *"How is Industry Intelligence different from Comparable Company Analysis?"* — Comps is user-selected peers producing an implied valuation; Industry Intelligence is an automatically-assembled broader universe producing relative operating/valuation context, with no implied valuation output. See Section 7.
3. *"Why does Athena state the size of the reference universe on every industry comparison?"* — Because "industry average" implies completeness Athena doesn't have — the reference set is only the companies Athena happens to track. Stating the count (e.g., "based on 4 tracked companies") lets the reader calibrate how much weight the comparison deserves.

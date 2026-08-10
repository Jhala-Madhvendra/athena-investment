# EV/EBITDA

## 1. Definition

EV/EBITDA compares a company's Enterprise Value to its EBITDA (Earnings Before Interest, Taxes, Depreciation, and Amortization). It answers: "how many times its pre-interest, pre-tax, pre-depreciation earnings is the whole operating business valued at?"

## 2. The formula

```
EV/EBITDA = Enterprise Value / EBITDA

where:
  Enterprise Value = Market Cap + Total Debt − Cash & Cash Equivalents
  EBITDA           = Operating Income (EBIT) + Depreciation & Amortization
```

Athena does not have a directly-reported EBITDA field in stored financial statements, so it derives one: `operatingIncome` is already treated as EBIT elsewhere in the codebase (`FCFF.md`), and adding back `depreciationAndAmortization` (from the cash flow statement) is the standard EBITDA derivation — see `comps.formulas.js`'s `ebitda()`.

## 3. Intuition

EV/EBITDA is **an Enterprise-Value multiple**: the numerator (EV) belongs to everyone with a claim on the business — debt holders and equity holders alike — and the denominator (EBITDA) is a *pre-interest* profitability figure, i.e. it hasn't yet been affected by how the company chooses to finance itself. Numerator and denominator are capital-structure-consistent with each other, which is exactly why this multiple, unlike P/E, can be fairly compared across companies carrying very different amounts of debt.

## 4. Why investors use it

It's the most commonly used multiple in M&A and comps work specifically *because* it's capital-structure-neutral — two operationally identical companies, one financed with debt and one with none, will show similar EV/EBITDA even though their P/E ratios would look wildly different (the levered one has higher interest expense, lower net income, and thus a distorted P/E). It also sidesteps a lot of accounting noise below the operating-income line (D&A policy differences, interest, taxes).

## 5. When it is useful

- Comparing companies with meaningfully different debt loads or tax situations.
- Comparing capital-intensive businesses (heavy D&A) where P/E would be distorted by depreciation-policy differences across companies.
- M&A contexts, where EV/EBITDA maps closely to "how many years of pre-financing-decision earnings does this acquisition cost."

## 6. When it can be misleading

- **Negative or zero EBITDA makes it meaningless** — Athena's `evToEbitda()` returns `null` in this case rather than a nonsensical or artificially-flipped-positive multiple (see `OutlierHandling.md`).
- EBITDA ignores CapEx entirely — two companies with identical EBITDA but very different reinvestment needs (e.g. a telecom vs. a software company) are not economically equivalent, even at the same multiple.
- It's a *proxy* for cash flow, not cash flow itself — it excludes working-capital changes and actual capital expenditure, both of which a DCF explicitly accounts for (see `FCFF.md`).

## 7. What makes a company comparable

Same considerations as any Comps multiple (industry, business model, revenue scale, market cap, geography, growth — see `ComparableCompanyAnalysis.md`), with one EV/EBITDA-specific nuance: capital intensity. Comparing an asset-light software company against an asset-heavy industrial one on EV/EBITDA alone glosses over the fact that the industrial company needs to reinvest a much larger share of that EBITDA in CapEx just to stand still.

## 8. How Athena implements it

Computed per-company in `comps.engine.js`'s `buildCompanyMetrics()`: `enterpriseValue()` and `ebitda()` (both in `comps.formulas.js`) feed `evToEbitda()`, which returns `null` — with a stated `excludedReason` — whenever EBITDA isn't positive or Enterprise Value couldn't be computed (missing market cap, debt, or cash). Peer observations are aggregated by `comps.statistics.js`; applying the selected statistic to the target's own EBITDA is handled by `comps.valuation.js`'s enterprise-multiple path, which bridges the resulting Implied Enterprise Value to Implied Equity Value via `dcf.formulas.js`'s `netDebt()`/`equityValue()` — the *same* Net Debt relationship DCF already uses, reused rather than re-derived (see `EnterpriseValue.md`, `EquityValue.md`).

## 9. Common mistakes

- **Applying a selected EV/EBITDA statistic directly to Net Income or treating the result as Equity Value without bridging through Net Debt** — this is the specific mistake `ValuationMultiples.md` calls out as non-negotiable to avoid; Athena's engine has no code path that skips the bridge.
- **Comparing EV/EBITDA across industries with very different capital intensity** without recognizing that a low multiple in a capital-heavy industry isn't automatically "cheap."
- **Ignoring a negative-EBITDA peer's exclusion** and trying to force a multiple onto it anyway — Athena excludes it and states why instead.

## 10. Interview questions

*"Why is EV/EBITDA an Enterprise-Value multiple, not an Equity-Value multiple?"* — Because both sides of the ratio are capital-structure-neutral: EV represents the whole business's value to both debt and equity holders, and EBITDA is measured *before* interest expense — i.e. before the effect of how much debt the company carries. Pairing a capital-structure-neutral numerator with a capital-structure-neutral denominator is what makes the multiple comparable across differently-levered companies; pairing EV with Net Income (which *is* affected by interest) or P/E's price with EBITDA would break that consistency.

*"Why might a negative-EBITDA company still be a legitimate business worth valuing?"* — Early-stage, high-growth companies can run persistently negative EBITDA while investing heavily in growth (e.g. sales & marketing, R&D) — that doesn't necessarily mean the underlying unit economics are broken. It does mean EV/EBITDA specifically isn't a usable multiple for it; Athena excludes it from the EV/EBITDA calculation and states why, rather than fabricating a meaningless negative or flipped-sign multiple.

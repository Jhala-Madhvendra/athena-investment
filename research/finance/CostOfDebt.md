# Cost of Debt (Kd)

## 1. Definition

Cost of Debt is the rate a company actually pays (or would pay) to borrow money. Unlike cost of equity, it's often directly observable — a company's bonds trade at a yield, or its loan agreements state an interest rate — though Athena, lacking that data source, treats it as a pure user assumption rather than fabricating an observed rate (see Section 7).

## 2. The formula

```
After-Tax Kd = Pre-Tax Kd × (1 − Tax Rate)
```

## 3. Intuition

Interest expense is tax-deductible, so the *effective* cost of a dollar of debt to the company is lower than the stated interest rate — a portion of every interest payment is effectively subsidized by the resulting reduction in taxes owed. A company with a 6% pre-tax borrowing rate and a 25% tax rate is really only bearing a 4.5% cost after the tax shield. WACC needs this after-tax figure, not the raw stated rate, because WACC is meant to reflect what the company actually gives up to fund itself.

## 4. Why investors use it

It's one of the two inputs to WACC, and on its own is a useful signal of a company's perceived credit risk — a company borrowing at a wide spread over the risk-free rate is being priced by the credit market as riskier than one borrowing near it.

## 5. Assumptions

Athena assumes a single blended pre-tax rate applies across all of a company's debt, when in reality most companies carry a mix of instruments (bonds at various coupons, bank loans, leases) at different rates and maturities — a single Kd is a simplification of that mix, same as WACC assumes a static capital structure.

## 6. Limitations

Without observable interest expense or a credit rating/spread data source, there is no way to *derive* a company-specific Kd — it must be provided by the user as a genuine assumption, informed by whatever they know about the company's actual borrowing costs (recent bond issuances, credit rating, industry norms). This is a real gap in Athena's current data coverage, not a design preference.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`'s `afterTaxCostOfDebt(preTaxCostOfDebt, taxRate)` is a one-line calculation — the interesting part is *upstream* of the formula. Athena has no interest-expense line item in its financial statement schema and no credit-spread data provider, so `dcfInput.mapper.js`'s `buildDefaults()` returns `preTaxCostOfDebt` as `{ value: null, source: "required_user_input" }` — always, for every ticker, with no fallback number. The frontend enforces this at the form level (`Valuation.jsx`'s required-field validation blocks submission until it's filled), and the backend enforces it again independently (`valuation.validator.js`'s `validateDCFRequestBody` rejects a request missing it). This is the one place in the whole DCF form where Athena deliberately ships *zero* default — every other "no live source" assumption (Equity Risk Premium, Terminal Growth Rate) at least gets a labeled illustrative starting value; Cost of Debt does not, because unlike a broad market-level figure, a company's borrowing cost is genuinely company-specific, and guessing one would be presenting a fabricated number as if it meant something.

## 8. Common mistakes

- **Using the pre-tax rate directly in WACC**, forgetting the tax-shield adjustment — overstates WACC and understates the valuation.
- **Backing into Kd from interest expense ÷ total debt** without checking whether that ratio reflects the *current* market borrowing rate or an average of old, possibly much cheaper or more expensive, debt issued years ago at different rates.

## 9. Interview questions

*"Athena won't let you submit a DCF without entering Pre-Tax Cost of Debt, and it never suggests a default value for it — every other CAPM input at least has a starting number. Why the difference?"* — Athena has no data source that's even a reasonable proxy for a specific company's borrowing cost (no interest expense field, no credit rating, no bond spread feed) — versus Risk-Free Rate and Beta, which come from genuinely live instruments, and even Equity Risk Premium, which at least has a widely-cited market-level convention to fall back on. Guessing a company-specific number with literally nothing to anchor it to would be fabrication, not a "reasonable starting point" — so it's the one field where the product deliberately shows a hard stop instead of a soft suggestion.

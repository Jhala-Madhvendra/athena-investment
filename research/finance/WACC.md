# Weighted Average Cost of Capital (WACC)

## 1. Definition

WACC is the blended rate of return a company must generate on its assets to satisfy *both* its debt holders and its equity holders, weighted by how much of the company's capital comes from each source. It's the single discount rate Athena's DCF engine uses to bring every year of forecast FCFF, and the terminal value, back to present value.

## 2. The formula

```
WACC = (E / (D + E)) × Ke + (D / (D + E)) × Kd × (1 − Tax Rate)
```

Where E = market value of equity, D = market value of debt, Ke = cost of equity, Kd = pre-tax cost of debt.

## 3. Intuition

A company's assets are funded by a mix of debt and equity, and each source demands a different return: debt holders want their fixed interest payment (relatively low risk, paid first), equity holders want a return commensurate with the extra risk of being paid last (relatively high risk). WACC is the weighted blend of those two required returns — the minimum return the underlying business needs to generate on its assets to satisfy everyone who financed it. Debt gets an extra discount (`× (1 − Tax Rate)`) because interest payments are tax-deductible — debt is "cheaper" than its stated rate once the tax shield is accounted for.

## 4. Why investors use it

WACC is the hurdle rate: a company's return on invested capital above WACC creates value; below WACC, it destroys value even if the business is nominally profitable. In a DCF specifically, it's the rate that converts future unlevered cash flow (FCFF) into today's dollars in a way that respects the actual blended risk/return demanded by everyone who has capital at stake in the business.

## 5. Assumptions

- **Equity is weighted at market value, not book value.** Athena uses live market capitalization (`quote.price.marketCap`) for E. Book equity reflects historical accounting (retained earnings, paid-in capital minus buybacks) and can differ wildly from what the market actually thinks the equity is worth today; WACC needs the weights to reflect *current* claims on the business, which only market value does.
- **Debt is weighted at book value, as a proxy.** Athena has no bond-pricing data source, so `balanceSheet.totalDebt` (book value) stands in for market value of debt. For investment-grade debt trading near par, this is usually a reasonable approximation; for distressed or long-duration debt where market and book values diverge significantly, it's a real limitation (see below).
- Kd, Ke inputs (CAPM's risk-free rate, beta, ERP, and pre-tax cost of debt) are all separately-documented assumptions — see CAPM.md, CostOfEquity.md, CostOfDebt.md.

## 6. Limitations

The book-value-of-debt proxy is the single biggest approximation in Athena's WACC. It also assumes a static capital structure over the entire forecast horizon — in reality, a company's debt/equity mix can shift materially over a 5-year forecast (paying down debt, issuing new equity), and a single WACC computed from today's snapshot doesn't capture that. WACC is also *not* well-defined, and Athena's validator explicitly rejects it, when total capital (D+E) is zero or when the CAPM/cost-of-debt inputs can't produce a valid number.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`'s `wacc()`:

```js
const wacc = ({ marketValueOfEquity, marketValueOfDebt, costOfEquity, afterTaxCostOfDebt }) => {
    const totalCapital = marketValueOfEquity + marketValueOfDebt;
    if (totalCapital === 0) return null;
    const equityWeight = marketValueOfEquity / totalCapital;
    const debtWeight = marketValueOfDebt / totalCapital;
    return equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt;
};
```

Notably, WACC is **not** an input the user types directly anywhere in Athena. `valuation.service.js`'s `assembleEngineInput()` computes it from the user's CAPM inputs (risk-free rate, beta, equity risk premium) plus their pre-tax cost of debt plus the company's live capital structure, and only the resulting number is passed into `dcf.engine.js` as `assumptions.wacc`. This keeps the "WACC = f(Ke, Kd, capital structure)" relationship structurally enforced rather than something a user could accidentally bypass by typing an arbitrary WACC.

## 8. Common mistakes

- **Using book value of equity.** Understates or overstates the equity weight depending on how far book value has drifted from market value — for a company trading well above book (common for profitable growth companies), this understates equity's weight and overweights cheaper debt, artificially lowering WACC and inflating the valuation.
- **Forgetting the tax shield on debt** (using pre-tax Kd directly in the WACC formula instead of after-tax). Overstates the cost of debt and therefore WACC, understating the valuation.
- **Applying one WACC to a company undergoing a major capital-structure change** (e.g., a leveraged buyout target) without adjusting it period-by-period — Athena's model, like most standard DCFs, assumes a constant WACC across the forecast, which is a simplification worth being explicit about for such companies.

## 9. Interview questions

*"Why does Athena use market cap for equity but book value for debt in the same formula — isn't that inconsistent?"* — Ideally both would be market values, but debt doesn't trade with the same visibility as equity does (no public bond price feed integrated), so book value of debt is used as a documented, honest proxy rather than fabricating a market debt price. It's an acknowledged limitation, not an oversight — for investment-grade issuers trading near par it's a reasonable stand-in; the gap matters most for distressed credits.

*"What happens to a DCF's output if you understate WACC by even half a percentage point?"* — The valuation moves meaningfully higher, disproportionately through the terminal value (which is most sensitive to the WACC-minus-terminal-growth spread — see TerminalValue.md and SensitivityAnalysis.md). This is exactly why Athena ships a WACC × terminal-growth sensitivity table by default rather than presenting one WACC's output as authoritative.

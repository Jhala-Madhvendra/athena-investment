# Cost of Equity (Ke)

## 1. Definition

Cost of Equity is the return a company's shareholders require for the risk of holding its stock instead of a safer asset. It has no contractual rate the way debt does (there's no "equity coupon payment") — it's an *implied, estimated* required return, not an observable one.

## 2. The formula

Athena estimates Ke via CAPM (see CAPM.md for full detail):

```
Ke = Risk-Free Rate + Beta × Equity Risk Premium
```

CAPM is the standard, widely-taught approach and the only one Athena implements in Sprint 6, though it's not the only method available in practice (the Dividend Discount Model's implied growth rate and multi-factor models like Fama-French are common alternatives).

## 3. Intuition

Debt holders have a contract: a stated interest rate, a maturity date, a legal claim ahead of equity in bankruptcy. Equity holders have none of that — they're paid whatever's left after everyone else, whenever the company chooses to pay it (or not, via retained earnings and share price appreciation). Because that residual claim is inherently riskier, Ke is virtually always higher than a company's cost of debt. Ke is the rate that reflects "what would an equity investor need to earn, given this specific stock's risk, to prefer it over a risk-free bond."

## 4. Why investors use it

Ke is one of two inputs to WACC (the other being after-tax cost of debt) and, on its own, is the correct discount rate for a pure FCFE-based equity valuation (see FCFE.md) — a path Athena's engine deliberately does not take, but which exists as an alternative valuation method worth understanding.

## 5. Assumptions

Inherits CAPM's assumptions directly (see CAPM.md): a stable, representative beta; a knowable Equity Risk Premium; that the single-factor CAPM captures the risk that actually drives required returns for this stock.

## 6. Limitations

Because Ke is an *estimate*, not an observable market rate, two reasonable analysts using different beta sources or ERP assumptions can produce meaningfully different Ke values for the same company — and because Ke flows directly into WACC, and WACC drives the DCF's terminal value disproportionately (see TerminalValue.md, SensitivityAnalysis.md), small disagreements in Ke can produce large disagreements in the final valuation. This is precisely why Athena treats every CAPM input as a visible, editable assumption rather than a computed fact.

## 7. How Athena implements it

Ke is computed inside `valuation.service.js`'s `assembleEngineInput()` via `dcf.formulas.js`'s `costOfEquityCAPM()`, then fed into the `wacc()` calculation alongside after-tax cost of debt. Ke itself is surfaced in the API response (`waccBreakdown.costOfEquity`) and rendered in the frontend's WACC card (`WACCBreakdown.jsx`) so the user sees it as a distinct, labeled number — not buried inside the final WACC figure.

## 8. Common mistakes

- **Pairing Ke with FCFF instead of WACC.** See FCFF.md and FCFE.md — Ke only prices equity risk; it's the wrong rate for an unlevered cash flow.
- **Treating Ke as more precise than it is.** It's a model output built on estimated inputs (beta, ERP), not a quoted market rate — presenting it to three decimal places without context can overstate its precision.

## 9. Interview questions

*"Why is cost of equity almost always higher than cost of debt for the same company?"* — Equity is a residual, unsecured claim paid only after debt holders, employees, suppliers, and taxes; debt has a contractual rate and legal priority in bankruptcy. Equity's greater risk demands a greater expected return, which is exactly what CAPM's Beta × ERP term is measuring on top of the risk-free rate.

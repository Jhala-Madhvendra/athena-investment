# Discounted Cash Flow (DCF) Valuation

## 1. Definition

A DCF estimates what a company is worth today by projecting the cash it will generate in the future and converting each future dollar into its present-day value using a discount rate that reflects risk and the time value of money. It answers one specific question: *"what could this company be worth based on the cash flows it can generate in the future?"*

## 2. The formula (the whole pipeline)

```
FCFF
  ↓ discount at WACC
PV of Forecast FCFF  +  PV of Terminal Value
  = Enterprise Value
  − Net Debt
  = Equity Value
  ÷ Diluted Shares Outstanding
  = Intrinsic Value Per Share
```

Every step has its own doc: FCFF.md, WACC.md, DiscountFactor.md, TerminalValue.md, EnterpriseValue.md, EquityValue.md, IntrinsicValue.md.

## 3. Intuition

A stock's price reflects what the market is currently willing to pay; a DCF is an independent, bottom-up attempt to answer "regardless of the current price, what does the underlying cash-generating business seem to be worth" by working directly from the company's financials rather than from comparisons to other companies (the way a P/E-multiple valuation would). It's the intrinsic-value investing approach in its most literal form: value equals the cash the business can generate, discounted for time and risk.

## 4. Why investors use it

DCF is the only common valuation method that doesn't depend on other companies being correctly priced (unlike relative-valuation multiples, which inherit whatever mispricing exists in the comparison set). It forces an explicit statement of every assumption behind a valuation — growth, margins, cost of capital — rather than leaving them implicit inside a multiple, which is exactly why Athena treats assumption transparency as a first-class product requirement (see `research/product/DCFProductDesign.md`), not an implementation detail.

## 5. Assumptions

A DCF is a story made numeric: the whole chain of formulas above is only as good as the growth, margin, reinvestment, and cost-of-capital assumptions feeding it — the arithmetic itself is exact, but the inputs are estimates, several of which (terminal growth, equity risk premium) have no live market data source at all. Athena's product design leans into this rather than hiding it: every input is labeled by where it came from (`historical`, `derived`, `market`, `illustrative_default`, `required_user_input`) so the user can see exactly which numbers are facts and which are judgment calls.

## 6. Limitations

DCF is, without qualification, **highly sensitive to its assumptions** — a small change in WACC or terminal growth can swing the output by a large margin (see TerminalValue.md, SensitivityAnalysis.md), and there is no single "correct" set of inputs, only more or less defensible ones. It also cannot account for information the market may be pricing in that isn't captured in historical financials (pending litigation, an unannounced product, a regulatory shift). Athena's product explicitly refuses to resolve this uncertainty into a false-precision single answer — every DCF result ships with Bear/Base/Bull scenarios, a WACC × terminal-growth sensitivity table, and an explicit disclaimer, rather than one number presented as fact.

## 7. How Athena implements it

The core calculation lives in a framework-independent engine (`backend/valuation/dcf/dcf.engine.js` — see `research/engineering/DCFEngine.md`) that knows nothing about Express, MongoDB, or Yahoo Finance: it takes structured financial inputs and assumptions, and returns a deterministic result. `valuation.service.js` is the only layer that touches stored financials, live market data, and the HTTP boundary — it assembles the engine's input, computes WACC from the user's CAPM/cost-of-debt assumptions (WACC.md), and augments the engine's pure result with things the engine deliberately doesn't compute (current market price, the valuation gap, the disclaimer). Three API endpoints expose it: `GET /:ticker/dcf/defaults` (labeled starting assumptions), `POST /:ticker/dcf` (the full calculation), and `POST /:ticker/dcf/scenarios` / `POST /:ticker/dcf/sensitivity` (the two ways Athena avoids presenting one number as authoritative).

## 8. Common mistakes

- **Mixing FCFF with cost of equity, or FCFE with WACC.** The single most important invariant in the whole model — see FCFF.md and FCFE.md for why, and how Athena enforces it structurally (there's no code path that discounts FCFF at anything but WACC).
- **Presenting the output as a price target or recommendation.** DCF estimates intrinsic value under stated assumptions — it is not a prediction, and Athena never emits Buy/Sell language anywhere in the pipeline (enforced by tests at both the API and rendered-page level).
- **Trusting a single point estimate.** The single most common real-world DCF mistake — treating one number, built on one set of assumptions, as more certain than the underlying inputs justify.

## 9. Interview questions

*"Walk me through the full DCF pipeline, end to end, the way Athena implements it."* — FCFF is calculated top-down from EBIT (not from Operating Cash Flow − CapEx, which is a levered proxy); each forecast year's FCFF is discounted at WACC to get its present value; a Terminal Value covers everything beyond the explicit forecast via the Gordon Growth formula and is discounted at the same rate; Enterprise Value is the sum of those two present values; subtracting net debt gives Equity Value; dividing by diluted shares gives Intrinsic Value Per Share, which is then compared — never converted into a recommendation — against the live market price.

*"If you had to defend DCF against someone who says 'it's just made-up numbers dressed up as math,' what would you say?"* — The math itself is exact and auditable — given the same inputs, it always produces the same output (see `research/engineering/DeterministicCalculations.md`). What's genuinely uncertain is the *inputs*, and a well-built DCF tool's job is to make that uncertainty visible and explorable — labeled assumption sources, scenario analysis, sensitivity tables — rather than to pretend the inputs are more certain than they are. The critique is fair against a DCF that hides its assumptions behind one polished number; it's much weaker against one that shows its work at every step, which is the entire design philosophy behind how Athena built this feature.

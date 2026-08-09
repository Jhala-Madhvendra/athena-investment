# Free Cash Flow to Equity (FCFE)

## 1. Definition

FCFE is the cash left over for **equity holders specifically**, after the company has paid everyone else with a prior claim — operating expenses, taxes, interest to debt holders, and any net debt repayment. It's the levered counterpart to FCFF (FCFF.md). Athena documents FCFE for conceptual completeness and to draw a hard line around it — **Athena's DCF engine does not calculate or use FCFE.**

## 2. The formula

```
FCFE = FCFF − Interest Expense × (1 − Tax Rate) + Net Borrowing
```

(Net Borrowing = new debt issued minus debt repaid in the period.) Equivalently, starting from Net Income: `FCFE = Net Income + D&A − CapEx − Change in NWC + Net Borrowing`.

## 3. Intuition

FCFF answers "how much cash does the business generate, full stop." FCFE answers a narrower question: "of that cash, how much is actually left for shareholders once the company has serviced its debt (paid interest) and adjusted its debt balance (borrowed more or paid some down)." A company can have healthy FCFF but weak or even negative FCFE if it's heavily levered and using most of its operating cash to service and pay down debt.

## 4. Why investors use it

FCFE is what you'd discount at the **cost of equity (Ke)**, not WACC, to arrive directly at **Equity Value** — skipping the Enterprise-Value-then-subtract-net-debt route. It's a legitimate, widely-used alternative valuation path, especially for financial companies (banks, insurers) where "debt" is the raw material of the business rather than a financing choice, and where FCFF/EV framing is awkward.

## 5. Assumptions

Same base assumptions as FCFF (steady-state CapEx/D&A/NWC), plus an explicit forecast of the financing schedule — how much new debt gets issued or repaid each year. That's a real forecasting burden FCFF doesn't have, since FCFF is financing-agnostic by design.

## 6. Limitations

FCFE is sensitive to financing decisions in a way that can make it a noisier, more assumption-heavy metric than FCFF for a normal operating company — a single large debt issuance or buyback-funded-by-debt year can swing FCFE dramatically without any change in the underlying business. It also requires forecasting *both* an operating story (revenue, margins) *and* a capital-structure story (borrowing plans), doubling the assumption surface relative to FCFF.

## 7. How Athena implements it

It doesn't — deliberately. There is no `fcfe()` function anywhere in `backend/valuation/`. This is a design decision, not an oversight, made explicit in the sprint brief and preserved structurally: `dcf.engine.js`'s `calculateDCF()` always discounts FCFF at a computed WACC to reach Enterprise Value, then subtracts net debt to reach Equity Value (see EnterpriseValue.md, EquityValue.md). There is no code path where a per-share value is reached by discounting a levered cash flow at Ke directly. If Athena adds an FCFE-based valuation model in the future, it should be a genuinely separate engine (e.g. a hypothetical `fcfe.engine.js`), not a variant flag inside the existing FCFF engine — mixing the two inside one function is exactly the "FCFE discounted at WACC" or "FCFF discounted at Ke" error the sprint brief explicitly forbids.

## 8. Common mistakes

- **Discounting FCFE at WACC.** WACC is a blended rate across debt and equity; FCFE already excludes what's owed to debt holders. Discounting it at WACC effectively pays debt holders' required return twice (once implicitly by excluding their cash flow, once explicitly via the discount rate) — the result understates equity value.
- **Discounting FCFF at Ke.** The reverse error — Ke only reflects equity holders' required return, but FCFF is a pre-financing cash flow that belongs to debt and equity holders alike; using Ke overstates the value attributable to equity.
- **Switching between FCFF and FCFE mid-model** (e.g., forecasting FCFF but subtracting interest expense "to be conservative"). Either commit to the full FCFF → EV → Equity Value path, or the full FCFE → Equity Value path — never a hybrid.

## 9. Interview questions

*"When would you reach for FCFE instead of FCFF?"* — When valuing a financial institution where debt is operational rather than a financing choice (a bank's deposits are functionally its "debt"), or when the capital structure is expected to change significantly and predictably over the forecast period in a way that's easier to model directly through financing cash flows than by holding WACC constant.

*"If I told you a model discounts FCFE at WACC, what would you tell the analyst?"* — That the model is internally inconsistent and will produce an equity value that doesn't correspond to any real economic claim: WACC already accounts for the cost of debt in the blend, but FCFE has already excluded debt holders' cash flow, so the discount rate is compensating for a claim that isn't in the numerator. The fix is either FCFF→WACC→EV→(−Net Debt)→Equity Value, or FCFE→Ke→Equity Value directly — not a mix.

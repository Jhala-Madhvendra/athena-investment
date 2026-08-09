# Enterprise Value (EV)

## 1. Definition

Enterprise Value is the value of a company's core operating business, belonging collectively to **everyone with a financial claim on it** — debt holders and equity holders alike — independent of how that business happens to be financed today.

## 2. The formula

```
Enterprise Value = PV of Forecast FCFF + PV of Terminal Value
```

## 3. Intuition

Because FCFF is deliberately unlevered (see FCFF.md) and discounted at WACC (a blended cost of capital across debt and equity), the resulting present value is, by construction, a value that doesn't care about the current debt/equity split — it's asking "what is this operating business worth, full stop," before getting to the separate question of "and who gets what piece of that value." That second question is what EquityValue.md answers.

## 4. Why investors use it

EV is the standard basis for comparing companies with different capital structures on equal footing (EV/EBITDA and EV/Revenue multiples exist specifically because they're capital-structure-neutral, unlike a P/E ratio which is entangled with leverage). It's also the number an acquirer effectively pays in a full buyout — they assume the target's debt (or pay it off) *and* buy out the equity, so EV approximates total acquisition cost.

## 5. Assumptions

Inherits every assumption underlying its two components: the FCFF forecast (revenue growth, margins, reinvestment — see FCFF.md) and the Terminal Value (perpetual growth rate, WACC — see TerminalValue.md). EV assumes both pieces are discounted at the *same* WACC, consistent with the idea that the terminal period's risk profile hasn't fundamentally changed from the explicit forecast period's.

## 6. Limitations

EV is a derived, model-dependent number — not something directly observable the way a stock's trading price is. It's only as reliable as the FCFF forecast and Terminal Value assumptions feeding it, and because Terminal Value typically dominates EV (see TerminalValue.md), EV inherits that same outsized sensitivity to WACC and terminal growth.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`'s `enterpriseValue()` is a one-line sum:

```js
const enterpriseValue = (pvOfForecastFCFF, pvOfTerminalValue) => pvOfForecastFCFF + pvOfTerminalValue;
```

`dcf.engine.js`'s `calculateDCF()` computes `pvOfFCFF` by summing each forecast year's individually-discounted FCFF (`forecastDetail[i].presentValue`), and `pvOfTerminalValue` by discounting the Terminal Value at the *same* discount factor as the final forecast year (since the perpetuity, by construction, starts being received at the end of year `n`). Both components — and their sum — are surfaced individually in the API response and rendered separately in `DCFSummary.jsx`, so a user can see how much of Enterprise Value came from the explicit forecast versus the terminal assumption, rather than only seeing the combined total.

## 8. Common mistakes

- **Confusing Enterprise Value with Equity Value** (or with market capitalization) when discussing valuation multiples or acquisition prices — see EquityValue.md for the exact relationship and why they diverge by net debt.
- **Discounting the Terminal Value at a different rate or timing than the final forecast year** — since the Gordon Growth formula already prices the perpetuity as of the *end* of year `n`, it needs the year-`n` discount factor, not year `n+1` or an undiscounted figure.

## 9. Interview questions

*"If two companies have identical Enterprise Values but very different debt loads, do they have the same Equity Value?"* — No — EV is capital-structure-neutral by design, but Equity Value is EV minus net debt, so the more indebted company will have a materially lower Equity Value (and thus lower value per share, all else equal) despite an identical Enterprise Value. This is exactly why EV is the right basis for comparing the *operating businesses* of differently-levered companies, while Equity Value/share price comparisons need the leverage difference accounted for separately.

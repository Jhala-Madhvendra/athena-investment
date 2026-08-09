# Discount Factor and Present Value

## 1. Definition

A Discount Factor converts a future dollar amount into what it's worth *today*, given a required rate of return — the mechanical tool that makes "a dollar next year is worth less than a dollar today" precise and computable.

## 2. The formula

```
Discount Factor for year t = 1 / (1 + WACC)^t
Present Value = Cash Flow × Discount Factor
```

## 3. Intuition

If you require a 10% annual return, you'd be indifferent between $100 today and $110 a year from now — so $110 received in a year is only "worth" $100 to you today. Flip that around: a dollar received in a year, at a 10% required return, is worth `1 / 1.10 ≈ $0.909` today. The discount factor is exactly that ratio, generalized to any rate and any number of years — and it compounds, so cash further in the future is discounted more heavily (year 5's factor is smaller than year 1's).

## 4. Why investors use it

Discounting is what makes a multi-year cash flow forecast comparable and summable in the first place — you cannot simply add up five years of raw FCFF, because a dollar in year 5 and a dollar in year 1 are not the same thing economically. Every valid DCF depends on this step being applied consistently, using the same rate (WACC) that reflects the actual risk and time value relevant to the cash flows being discounted.

## 5. Assumptions

Uses a single, constant WACC across every forecast year and into the terminal period — assuming the company's risk profile and financing mix don't meaningfully shift year to year (the same simplification WACC.md documents). Also assumes cash flows arrive as a lump sum at the end of each year, a standard simplifying convention (versus, e.g., discounting continuously or assuming mid-year cash receipt).

## 6. Limitations

If WACC is misestimated, every single year's present value is systematically off in the same direction, and the error compounds — a 1-point WACC error affects year 5's discount factor more than year 1's, because the exponent grows. This is part of why Athena treats WACC as something to stress-test (SensitivityAnalysis.md) rather than trust as a single precise number.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`:

```js
const discountFactor = (rate, year) => 1 / Math.pow(1 + rate, year);
const presentValue = (cashflow, factor) => cashflow * factor;
```

`dcf.engine.js`'s `forecastFCFF()` computes a fresh discount factor for each forecast year `t = 1..forecastYears`, applies it to that year's FCFF to get its present value, and separately applies the *final* forecast year's discount factor to the Terminal Value (since the Gordon Growth formula already prices the terminal perpetuity as of the end of year `n` — see TerminalValue.md). Both the discount factor and present value for every year are returned in `forecastDetail` and rendered as their own columns in `FCFFForecastTable.jsx`, so the "how much is year 5's cash flow actually worth today" question is answered explicitly, not buried inside a summed total.

## 8. Common mistakes

- **Discounting the Terminal Value with the wrong year's factor** — it needs year `n`'s discount factor (the same as the final explicit forecast year), not `n+1` or an undiscounted value, since the Gordon Growth formula's output is already a "value as of the end of year n."
- **Using WACC = 0 without realizing what that implies.** A zero discount rate means every future dollar is worth exactly as much as a dollar today — Athena's validator explicitly rejects `WACC ≤ 0` as economically invalid, rather than silently computing a discount factor of 1.0 for every year.

## 9. Interview questions

*"Why does a dollar of FCFF in year 5 get discounted more heavily than a dollar in year 1, even at the same WACC?"* — The discount factor is `1/(1+WACC)^t` — the exponent grows with `t`, so the same per-year required return compounds over more years by year 5 than by year 1. It's the same mechanic as compound interest running in reverse: the longer you wait for a cash flow, the more "required return" has to be backed out of its face value to state it in today's dollars.

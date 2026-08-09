# Free Cash Flow (FCF)

## 1. What it is

Free Cash Flow is the actual cash a company generates from operations after paying for the capital expenditures needed to maintain and grow its asset base. Unlike Net Income, which includes non-cash accounting items (depreciation, accruals, deferred revenue timing), FCF measures cash that's genuinely left over — the money actually available to pay down debt, buy back stock, pay dividends, or reinvest.

## 2. Why investors care

"Cash is a fact, profit is an opinion" — Net Income depends on accounting choices (depreciation schedules, revenue recognition timing, one-time non-cash charges), while cash flow is much harder to manipulate. FCF is the foundation of intrinsic-value investing: **discounted cash flow (DCF) valuation** — the next major feature planned for Athena — is literally built by projecting future FCF and discounting it back to present value. A company can show strong net income while burning cash (common in aggressive-revenue-recognition frauds or capital-intensive growth phases), so investors treat a persistent gap between Net Income and FCF as a signal to dig deeper into earnings quality.

## 3. The formula

```
Free Cash Flow = Operating Cash Flow − Capital Expenditures
```

## 4. Which financial statements are used

**Cash Flow Statement only.** Both `operatingCashFlow` and `capitalExpenditure` are cash flow statement line items — this is the only ratio in the engine that touches the cash flow statement's raw inputs rather than the income statement or balance sheet.

## 5. How Athena calculates it

`freeCashFlow(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const freeCashFlow = (statement) => {
  const operatingCashFlow = statement.cashFlow.operatingCashFlow;
  const capitalExpenditure = statement.cashFlow.capitalExpenditure;

  if (typeof operatingCashFlow !== "number" || typeof capitalExpenditure !== "number") {
    return null;
  }

  // capitalExpenditure is stored as a negative outflow (standard cash-flow-statement
  // sign) - the magnitude is normalized here regardless of the stored sign.
  return operatingCashFlow - Math.abs(capitalExpenditure);
};
```

This is the only formula in the engine that doesn't call `safeDivide` — it's a subtraction, not a division, so there's no zero-denominator case to guard against. It still follows the same defensive pattern (explicit `typeof` checks before the arithmetic) so a missing field produces a clean `null` rather than `NaN`. In `ratio.calculator.js`, this is the one ratio tagged `unit: "currency"` rather than `"percent"` or `"ratio"`, which routes it through the frontend's `Intl.NumberFormat` currency formatter instead of a percentage or decimal — a good example of how the `unit` field lets one rendering path handle structurally different value types.

**Bug history (fixed in Sprint 6):** from Sprint 1 through Sprint 5, this formula was `operatingCashFlow - capitalExpenditure` with no sign normalization. Yahoo reports `capitalExpenditure` as a negative outflow (confirmed empirically: `operatingCashFlow + capitalExpenditure` matches Yahoo's own reported FCF exactly), so the unmodified subtraction was silently *adding* CapEx back instead of subtracting it — inflating every "Free Cash Flow" ratio card by 2×CapEx. This was discovered while building Sprint 6's DCF engine (`dcf.engine.js` has the same normalization, documented alongside its own historical-FCFF calculation) and had no test coverage catching it until the regression test in `ratio/__tests__/ratio.formulas.test.js` was added as part of the fix.

## 6. Interview question

*"A company reports growing net income for three straight years, but its Free Cash Flow has been flat or declining over the same period. What could explain this, and how concerned should an investor be?"*

(Points toward: rising capital expenditures outpacing operating cash flow growth, working capital changes (e.g., receivables growing faster than revenue — earnings quality concern), or aggressive revenue recognition. The concern level depends on whether capex is *growth* capex — reinvesting for future expansion — versus a sign that operating cash generation itself is weakening.)

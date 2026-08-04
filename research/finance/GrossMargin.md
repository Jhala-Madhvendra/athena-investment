# Gross Margin

## 1. What it is

Gross Margin measures the percentage of revenue a company keeps after paying the direct costs of producing its goods or services (Cost of Revenue / COGS). It's the first, and purest, profitability signal on the income statement — before any operating expenses, interest, or taxes get involved.

## 2. Why investors care

Gross Margin tells you about **pricing power and production efficiency**, independent of how a company chooses to spend on marketing, R&D, or admin. A high, stable gross margin (think software companies at 70-90%) signals a durable competitive advantage — the company can charge a premium or produce very cheaply. A thin or shrinking gross margin (think retailers or manufacturers at 20-30%) signals commoditization or rising input costs, and leaves little room to absorb a bad quarter of operating spend. Investors track the *trend* as much as the level — a declining gross margin is often the earliest warning sign of margin compression before it shows up in net income.

## 3. The formula

```
Gross Margin (%) = (Gross Profit / Total Revenue) × 100

where Gross Profit = Total Revenue − Cost of Revenue
```

## 4. Which financial statements are used

**Income Statement only.** Both `totalRevenue` and `grossProfit` are line items on the income statement — no balance sheet or cash flow data is required.

## 5. How Athena calculates it

In [ratio.formulas.js](../../backend/ratio/ratio.formulas.js), `grossMargin(statement)` reads `statement.incomeStatement.totalRevenue` and `statement.incomeStatement.grossProfit`, and passes them through the shared `safeDivide` helper:

```js
const grossMargin = (statement) => {
  const revenue = statement.incomeStatement.totalRevenue;
  const grossProfit = statement.incomeStatement.grossProfit;

  const ratio = safeDivide(grossProfit, revenue);
  return ratio === null ? null : ratio * 100;
};
```

`safeDivide` returns `null` if either value is missing (not a `number`) or if revenue is `0` — this prevents `Infinity`/`NaN` from ever reaching the API response. `ratio.calculator.js` then wraps the result via `buildRatio()`, rounding to 4 decimal places and marking `available: false` when the value is `null`, so the frontend can render "N/A" instead of crashing on a bad value.

## 6. Interview question

*"A company's gross margin jumped from 40% to 55% year-over-year while revenue stayed flat. What are three possible explanations, and how would you distinguish between them using the rest of the financial statements?"*

(Good answers probe: cost of revenue reclassification, a shift in product mix toward higher-margin offerings, a one-time supplier rebate, or aggressive inventory accounting — and how footnotes, segment data, and the cash flow statement can help disambiguate.)

# Net Profit Margin

## 1. What it is

Net Profit Margin measures the percentage of revenue that ultimately becomes bottom-line profit after **every** expense — cost of goods, operating costs, interest, taxes, and any one-off items. It's the final, all-in profitability number on the income statement.

## 2. Why investors care

This is the metric most directly tied to what shareholders actually "own" per dollar of sales. Because it includes interest and taxes, it also reflects capital structure (how much debt a company carries) and tax efficiency — things Operating Margin deliberately excludes. Investors use Net Profit Margin to answer "for every dollar this company sells, how much becomes real profit?" and to compare that efficiency against industry peers. A gap between Operating Margin and Net Profit Margin is itself informative — a large gap usually means heavy interest expense (leverage risk) or an unusual tax situation.

## 3. The formula

```
Net Profit Margin (%) = (Net Income / Total Revenue) × 100
```

## 4. Which financial statements are used

**Income Statement only.** `netIncome` is the final line of the income statement; `totalRevenue` is the first.

## 5. How Athena calculates it

`netProfitMargin(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const netProfitMargin = (statement) => {
  const revenue = statement.incomeStatement.totalRevenue;
  const netIncome = statement.incomeStatement.netIncome;

  const ratio = safeDivide(netIncome, revenue);
  return ratio === null ? null : ratio * 100;
};
```

Note that `netIncome` can legitimately be **negative** (a net loss) — `safeDivide` doesn't reject negative numerators, only non-numeric values and a zero denominator, so a loss-making company correctly shows a negative margin rather than an error. This is intentional: negative isn't invalid data, it's a real financial outcome the UI needs to display honestly.

## 6. Interview question

*"Company A has a 25% operating margin but only a 5% net profit margin. Company B has a 15% operating margin and a 12% net profit margin. Which business is healthier, and what would you check next?"*

(Points toward: interest expense / debt load, effective tax rate, and one-time charges — Company A likely carries significant debt or had a one-off hit below the operating line, which changes the risk picture even though its core operations look stronger.)

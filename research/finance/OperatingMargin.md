# Operating Margin

## 1. What it is

Operating Margin measures how much profit a company generates from its core business operations, after covering both the cost of goods sold *and* operating expenses (SG&A, R&D, etc.) — but before interest and taxes. It sits one layer deeper than Gross Margin: Gross Margin asks "how efficient is production?"; Operating Margin asks "how efficient is the whole business, including running it day-to-day?"

## 2. Why investors care

Operating Margin isolates the profitability of the actual business model from financing decisions (interest expense) and tax jurisdiction (tax rate), both of which can vary for reasons unrelated to operational quality. It's one of the most-watched metrics for judging **management's cost discipline** — a company growing revenue but with a shrinking operating margin is often spending unsustainably to buy growth. Comparing operating margin across competitors in the same industry is also one of the cleanest apples-to-apples profitability comparisons available, since it strips out capital structure differences.

## 3. The formula

```
Operating Margin (%) = (Operating Income / Total Revenue) × 100
```

## 4. Which financial statements are used

**Income Statement only.** `totalRevenue` and `operatingIncome` are both income statement line items.

## 5. How Athena calculates it

`operatingMargin(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js) pulls `statement.incomeStatement.totalRevenue` and `statement.incomeStatement.operatingIncome`:

```js
const operatingMargin = (statement) => {
  const revenue = statement.incomeStatement.totalRevenue;
  const operatingIncome = statement.incomeStatement.operatingIncome;

  const ratio = safeDivide(operatingIncome, revenue);
  return ratio === null ? null : ratio * 100;
};
```

Same `safeDivide` guard as Gross Margin protects against a zero or missing revenue figure. `ratio.validator.js` runs before any formula executes and rejects the entire request with a 422 if `incomeStatement` itself is missing from the stored statement, so `operatingMargin` can safely assume the object shape exists (even if individual numeric fields are absent).

## 6. Interview question

*"Why might a company report a healthy gross margin but a negative operating margin? Walk me through what that implies about the business, and which line items you'd inspect next."*

(Points toward: bloated SG&A, heavy R&D investment in a growth-stage company, or one-time restructuring charges sitting inside operating expenses — and the follow-up of checking if the trend is improving or worsening across periods.)

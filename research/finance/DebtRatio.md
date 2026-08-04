# Debt Ratio

## 1. What it is

The Debt Ratio measures what fraction of a company's total assets are financed by debt, as opposed to equity. Where Debt to Equity compares debt against *shareholder capital*, Debt Ratio compares debt against *everything the company owns* — a broader, denominator-stable view of leverage.

## 2. Why investors care

Debt Ratio is often preferred over Debt to Equity in situations where equity is small, volatile, or even negative — since a shrinking or negative equity base makes Debt to Equity swing wildly or turn deceptively negative, while total assets stay a much more stable denominator. A Debt Ratio above 0.5 means more than half the company's assets are debt-financed, i.e., creditors have a larger claim on the business than shareholders do — a meaningful signal for both equity investors (dilution/bankruptcy risk) and credit analysts (collateral coverage). It's a standard input into overall solvency and credit-rating assessments.

## 3. The formula

```
Debt Ratio = Total Debt / Total Assets
```

## 4. Which financial statements are used

**Balance Sheet only.** Both `totalDebt` and `totalAssets` are balance sheet line items.

## 5. How Athena calculates it

`debtRatio(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const debtRatio = (statement) => {
  const totalDebt = statement.balanceSheet.totalDebt;
  const assets = statement.balanceSheet.totalAssets;

  return safeDivide(totalDebt, assets);
};
```

Both `debtToEquity` and `debtRatio` read `totalDebt` from the same field, but divide by a different denominator — this is why they're grouped together under `solvency` in [ratio.calculator.js](../../backend/ratio/ratio.calculator.js) rather than scattered across categories. Presenting them side-by-side on the frontend lets an investor immediately see both the "vs. shareholders" and "vs. everything owned" views of the same debt load, without re-deriving one from the other mentally.

## 6. Interview question

*"A company has a Debt Ratio of 0.4 but a Debt to Equity ratio of 8.0. What does that combination tell you about its balance sheet?"*

(Debt Ratio of 0.4 means assets are financed mostly by non-debt sources overall — but a Debt to Equity of 8.0 means equity itself is very small relative to debt. Reconciling the two: liabilities other than debt — e.g., large deferred revenue or payables — must make up a big share of the balance sheet, or equity has been eroded by losses/buybacks, leaving a thin equity base beneath a moderate debt load.)

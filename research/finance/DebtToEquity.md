# Debt to Equity

## 1. What it is

Debt to Equity compares how much of a company's financing comes from debt versus how much comes from shareholders' own capital. It's the primary measure of **financial leverage** — how much the company is relying on borrowed money to fund itself.

## 2. Why investors care

Leverage is a double-edged sword: debt can amplify returns to equity holders when things go well (it's part of what inflates ROE — see [[ROE]]), but it also amplifies losses and bankruptcy risk when things go badly, because interest and principal payments are fixed obligations regardless of how the business is performing. Investors use Debt to Equity to gauge risk tolerance appropriateness — a ratio that's fine for a stable utility company (predictable cash flows, can service more debt) would be alarming for a cyclical or early-stage company (volatile cash flows, less margin for error). It's also a key input to the credit-risk view of a stock, distinct from the pure-profitability view.

## 3. The formula

```
Debt to Equity = Total Debt / Total Stockholders' Equity
```

## 4. Which financial statements are used

**Balance Sheet only.** Both `totalDebt` and `totalStockholderEquity` are balance sheet line items.

## 5. How Athena calculates it

`debtToEquity(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const debtToEquity = (statement) => {
  const totalDebt = statement.balanceSheet.totalDebt;
  const equity = statement.balanceSheet.totalStockholderEquity;

  return safeDivide(totalDebt, equity);
};
```

This is one of the ratios where **negative input is meaningful, not an error**. If `totalStockholderEquity` is negative (accumulated deficits exceeding paid-in capital), the resulting Debt to Equity ratio will be negative — which looks strange but accurately reflects a company in financial distress. Athena's `safeDivide` deliberately does not filter out negative values; only non-numeric values and a zero denominator return `null`. Suppressing a negative result here would hide exactly the signal an investor most needs to see, which is why "negative values where applicable" is called out explicitly as a case the engine must *surface*, not swallow.

## 6. Interview question

*"Why might a mature utility company comfortably carry a Debt to Equity ratio of 2.0, while the same ratio would be a serious red flag for an early-stage biotech?"*

(Tests understanding that leverage risk is a function of cash flow predictability and asset stability — regulated utilities have steady, contracted revenue that reliably services debt; a pre-revenue biotech has no such cushion.)

# Return on Equity (ROE)

## 1. What it is

Return on Equity measures how much net income a company generates for every dollar of shareholder equity invested in it. It's the headline metric for "how good is this business at turning shareholders' money into profit."

## 2. Why investors care

ROE is arguably the single most-quoted profitability ratio in investing — it's the core metric in Warren Buffett-style quality investing, because a consistently high ROE (15%+) over many years often signals a durable moat (pricing power, brand, network effects, low capital intensity). But ROE has a well-known trap: it can be inflated by **leverage** — a company can boost ROE simply by taking on more debt and buying back stock, without actually improving the underlying business. That's exactly why Athena also surfaces Debt to Equity and ROA side-by-side — a sophisticated read of ROE always checks it against leverage, not in isolation.

## 3. The formula

```
ROE (%) = (Net Income / Total Stockholders' Equity) × 100
```

## 4. Which financial statements are used

**Income Statement** for `netIncome`, **Balance Sheet** for `totalStockholderEquity`. This is the first ratio in the engine that spans two statements — a preview of why the Ratio Engine needs the full statement object, not just one section of it.

## 5. How Athena calculates it

`returnOnEquity(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const returnOnEquity = (statement) => {
  const netIncome = statement.incomeStatement.netIncome;
  const equity = statement.balanceSheet.totalStockholderEquity;

  const ratio = safeDivide(netIncome, equity);
  return ratio === null ? null : ratio * 100;
};
```

`ratio.validator.js` requires both `incomeStatement` and `balanceSheet` to be present objects before any calculator function runs, which is what makes it safe for this formula to reach directly into both without an existence check of its own. If equity is zero or negative (a company with accumulated losses exceeding paid-in capital — not uncommon for early-stage or highly leveraged companies), `safeDivide` returns `null` for a zero denominator, but will return a (correctly) negative or oversized ratio for negative equity — a case worth flagging distinctly in a future iteration, since a negative ROE from negative equity means something very different from a negative ROE from a net loss.

## 6. Interview question

*"Two companies both report a 30% ROE. One has a Debt-to-Equity ratio of 0.2, the other 3.5. Are these companies equally attractive to a long-term investor? Explain the mechanism by which leverage inflates ROE."*

(Tests whether the candidate understands the DuPont decomposition: ROE = Net Margin × Asset Turnover × Equity Multiplier — and that the second company's ROE is largely a leverage artifact, not operating excellence.)

# Return on Assets (ROA)

## 1. What it is

Return on Assets measures how much net income a company generates for every dollar of **total assets** it controls — regardless of whether those assets were financed with debt or equity. It answers "how efficiently does this company use everything it owns to produce profit?"

## 2. Why investors care

ROA is the natural companion (and check) to ROE. Because ROA's denominator is total assets rather than just equity, it is **not distorted by leverage** — a company can't inflate ROA by borrowing more money, since the borrowed cash shows up as an asset too. This makes the ROE/ROA gap one of the fastest ways to read how leveraged a business is: if ROE is much higher than ROA, the difference is being manufactured by debt, not operational efficiency. Investors comparing companies across different capital structures (e.g., a bank vs. an industrial company) lean on ROA to get a leverage-neutral read on management quality.

## 3. The formula

```
ROA (%) = (Net Income / Total Assets) × 100
```

## 4. Which financial statements are used

**Income Statement** for `netIncome`, **Balance Sheet** for `totalAssets`.

## 5. How Athena calculates it

`returnOnAssets(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const returnOnAssets = (statement) => {
  const netIncome = statement.incomeStatement.netIncome;
  const assets = statement.balanceSheet.totalAssets;

  const ratio = safeDivide(netIncome, assets);
  return ratio === null ? null : ratio * 100;
};
```

Structurally identical to `returnOnEquity` — same cross-statement read, same `safeDivide` guard — which is deliberate. Every profitability formula in the engine follows the same "pull two numeric fields, divide safely, scale to a percent" shape, so a reader who understands one understands nearly all of them. `ratio.calculator.js` places `returnOnAssets` directly beside `returnOnEquity` in the `profitability` group so the frontend renders them as neighboring cards, inviting the direct ROE-vs-ROA comparison described above.

## 6. Interview question

*"Why is ROA generally lower than ROE for the same company, and under what circumstances could ROA exceed ROE?"*

(Correct reasoning: Assets = Liabilities + Equity, so Assets ≥ Equity whenever liabilities are non-negative — meaning ROA ≤ ROE in the normal case. ROA can exceed ROE only when equity is negative, which flips the ROE denominator and produces a distorted, hard-to-interpret ROE — itself a red flag worth discussing.)

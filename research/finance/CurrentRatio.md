

# Current Ratio

## 1. What it is

The Current Ratio measures a company's ability to pay off its short-term obligations (due within a year) using its short-term assets (convertible to cash within a year). It's the most basic liquidity check: "if every current liability came due tomorrow, could this company cover it with what it has on hand or can quickly convert to cash?"

## 2. Why investors care

Liquidity failure — not profitability failure — is what actually bankrupts companies in the short term. A business can be profitable on paper and still collapse if it can't pay suppliers, payroll, or short-term debt when due. The Current Ratio is a first-pass solvency smoke test: a ratio comfortably above 1.0 suggests current assets cover current liabilities; a ratio below 1.0 is a warning sign (though not automatically fatal — some business models, like grocery retail, run intentionally low current ratios because inventory turns into cash so fast). Investors watch it especially closely for companies in cyclical or capital-intensive industries where a bad quarter can strain working capital.

## 3. The formula

```
Current Ratio = Current Assets / Current Liabilities
```

Expressed as a ratio (e.g., 1.8), not a percentage.

## 4. Which financial statements are used

**Balance Sheet only.** `currentAssets` and `currentLiabilities` are both balance sheet line items.

## 5. How Athena calculates it

`currentRatio(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const currentRatio = (statement) => {
  const currentAssets = statement.balanceSheet.currentAssets;
  const currentLiabilities = statement.balanceSheet.currentLiabilities;

  return safeDivide(currentAssets, currentLiabilities);
};
```

Notice this formula does **not** multiply by 100 — `ratio.calculator.js` tags it with `unit: "ratio"` rather than `"percent"`, and the frontend's `formatRatioValue()` renders ratio-unit values as a plain decimal (e.g., `1.80`) instead of appending a `%` sign. This unit tag is what lets one generic card-rendering component in `FinancialAnalysis.jsx` correctly format percentages, ratios, and currency values without any per-ratio special-casing in the UI.

## 6. Interview question

*"A retailer has a Current Ratio of 0.9 and a software company has a Current Ratio of 0.9. Should you be equally concerned about both? Why or why not?"*

(Tests understanding that the "right" current ratio is industry- and business-model-dependent — a retailer's current liabilities are backed by fast-turning inventory and steady cash sales, while a low ratio in a capital-light software company with lumpy deferred revenue might mean something different entirely.)

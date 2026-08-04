# Asset Turnover

## 1. What it is

Asset Turnover measures how much revenue a company generates for every dollar of assets it owns. It's the core **efficiency** metric of the ratio suite — not "is the company profitable" but "how hard is it working the assets on its balance sheet to produce sales?"

## 2. Why investors care

Two companies can have identical profit margins but very different investment quality if one needs far more assets to generate the same revenue. Asset Turnover is the piece that (together with Net Profit Margin) explains ROA under the DuPont framework: `ROA = Net Profit Margin × Asset Turnover`. A capital-light business (e.g., a software or services company) will naturally show high asset turnover, while a capital-intensive one (e.g., a utility, manufacturer, or airline) will show low turnover as a structural feature of the business model, not necessarily a flaw. Investors use it mainly to compare a company against its own history or direct industry peers — asset turnover has almost no meaning compared across unrelated industries.

## 3. The formula

```
Asset Turnover = Total Revenue / Total Assets
```

## 4. Which financial statements are used

**Income Statement** for `totalRevenue`, **Balance Sheet** for `totalAssets`. Like ROE and ROA, this is a cross-statement ratio.

## 5. How Athena calculates it

`assetTurnover(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const assetTurnover = (statement) => {
  const revenue = statement.incomeStatement.totalRevenue;
  const assets = statement.balanceSheet.totalAssets;

  return safeDivide(revenue, assets);
};
```

It's grouped alone under `efficiency` in [ratio.calculator.js](../../backend/ratio/ratio.calculator.js) — currently the only efficiency ratio Athena calculates, but the category exists precisely so future ratios (Inventory Turnover, Receivables Turnover) have an obvious home without restructuring the response shape. This is a deliberate design choice: the five-category grouping (profitability, liquidity, solvency, cashFlow, efficiency) was picked to scale to more ratios per category, not just the eleven implemented in this sprint.

## 6. Interview question

*"Would you expect a grocery chain or a semiconductor fab to have a higher Asset Turnover ratio, and why doesn't the lower number automatically mean the fab is a worse business?"*

(Grocery chains have high turnover — low fixed assets, fast inventory cycling, thin margins. Fabs have low turnover — enormous fixed asset base (fabrication plants), but often much higher margins per dollar of revenue. The point: Asset Turnover must be read alongside margin, never in isolation, which is exactly why the DuPont decomposition exists.)

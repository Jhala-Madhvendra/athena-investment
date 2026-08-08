# Market Capitalization

## 1. What is it?

Market capitalization ("market cap") is the total market value of a company's outstanding shares. It represents what the stock market currently thinks the entire equity of the company is worth.

## 2. Why does it matter?

Market cap is the most common way to describe the *size* of a public company. It's used to categorize companies (large-cap, mid-cap, small-cap), compare companies of different share prices on a like-for-like basis, and as a rough proxy for how much capital investors have collectively committed to the business.

## 3. How do investors use it?

- To gauge company size and relative scale against peers.
- To understand liquidity expectations - larger-cap stocks are typically more liquid and less volatile than small-cap stocks.
- As an input to other ratios (e.g. P/E, P/B) that divide market cap by a fundamental metric.

## 4. What are its limitations?

- It only reflects the value of *equity*, not the whole business - it ignores debt. Two companies with identical market caps can have very different total enterprise values if their debt loads differ.
- It moves with sentiment and short-term price swings, not just fundamentals - a stock can be "large-cap" one week and "mid-cap" the next purely on price movement.
- It says nothing about profitability, growth, or financial health on its own.

## 5. How is it calculated?

```
Market Cap = Current Share Price × Total Shares Outstanding
```

Athena receives this figure directly from Yahoo Finance rather than recomputing it locally, since it already reflects the live share count and price.

## 6. How does Athena use it?

Displayed in the Market Snapshot section of the Market Intelligence tab (`price.marketCap` in the `/api/market/:ticker` response), and again in the Business vs. Market Performance comparison as one of the "how the stock is priced" figures. Large numbers are abbreviated (e.g. `4572.8B`) using the same formatter used for financial statement figures, for visual consistency across the app.

## 7. What can cause the metric to be misleading?

- A falling market cap can reflect broad market conditions (e.g. a sector-wide selloff) rather than anything specific to the company.
- Share buybacks and issuances change share count independently of the underlying business - market cap can shift without any change in per-share economics.
- Comparing market cap across companies with very different capital structures (e.g. one heavily debt-financed, one equity-financed) understates the true economic footprint of the debt-financed company.

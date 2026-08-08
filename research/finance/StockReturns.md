# Stock Returns (Performance %)

## 1. What is it?

Stock return measures the percentage change in a stock's price between two points in time. Athena calculates this for five standard lookback windows: 1 month, 3 months, 6 months, 1 year, and 5 years.

## 2. Why does it matter?

It's the most direct measure of what an investor holding the stock over that period actually experienced in price terms. It's the "market performance" counterpart to the "business performance" metrics (revenue growth, margins) computed elsewhere in Athena.

## 3. How do investors use it?

- Comparing a stock's return against a benchmark index or peer group over the same window.
- Understanding how volatile or trending a stock has been recently vs. over longer horizons.
- As a starting point for the Business vs. Market Performance comparison - checking whether price movement has tracked, outpaced, or lagged the underlying business's growth.

## 4. What are its limitations?

- This is a **price return**, not a **total return** - it excludes dividends received during the period. A stock with a modest price return but a high dividend yield may have a materially better total return than the price-only figure suggests.
- Past returns say nothing about future returns - a stock that returned 100% over the last year carries no implied guarantee (or even likelihood) of repeating that.
- Short lookback windows (1M especially) are heavily influenced by near-term noise, single news events, or overall market conditions rather than anything company-specific.
- The choice of start/end date matters - a return calculated from an unusually high or low starting price can look distorted relative to the stock's typical trading range.

## 5. How is it calculated?

```
Return (%) = ((Ending Price - Starting Price) / Starting Price) × 100
```

Athena computes this itself (not sourced from Yahoo) using daily closing prices stored in the `MarketHistory` collection. The starting price is the earliest available close on or after the period's start date; the ending price is the most recent available close. If fewer than two price points fall within the requested window (e.g. a newly listed company with no 5-year history), the return for that period is returned as `null` instead of a misleading `0%` or a divide-by-zero error. If the starting price is exactly `0` (a data anomaly), the return is also `null` rather than an infinite or undefined percentage.

## 6. How does Athena use it?

Shown as the five Performance stat cards on the Market Intelligence tab (`/api/market/:ticker/performance`), color-coded green for positive and red for negative, and again as the "1 Year Stock Return" line in the Business vs. Market Performance comparison.

## 7. What can cause the metric to be misleading?

- Excluding dividends understates total return for dividend-paying stocks.
- A single volatile trading day near the start or end date can swing the reported return disproportionately for short windows.
- Comparing returns across different currencies (e.g. a US stock vs. an NSE-listed Indian stock) without adjusting for exchange-rate movement is not a fair apples-to-apples comparison - Athena reports each stock's return in its own listing currency and does not attempt FX normalization.

# P/E Ratio (Price-to-Earnings)

## 1. What is it?

The Price-to-Earnings ratio measures how much investors are currently paying for each dollar (or rupee, etc.) of a company's annual earnings. Athena surfaces both the **trailing P/E** (based on the last twelve months of actual reported earnings) and, where available, the **forward P/E** (based on analysts' projected future earnings).

## 2. Why does it matter?

It's one of the most widely quoted valuation multiples, giving a quick sense of how expensively (or cheaply) a stock is priced relative to its current earnings power.

## 3. How do investors use it?

- Comparing a company's P/E to its own historical range, to its industry peers, or to the broader market.
- As one input (never the only input) when thinking about valuation.
- Forward P/E is sometimes preferred for companies where earnings are expected to change meaningfully (e.g. a recovering or fast-growing business), since trailing P/E can look distorted by a one-off bad or good year.

## 4. What are its limitations?

- It's meaningless (or reported as N/A) for companies with zero or negative earnings.
- It doesn't account for growth rate - a high P/E can be entirely reasonable for a fast-growing company and unreasonable for a stagnant one. (This is why some investors look at PEG ratio, which Athena does not currently calculate.)
- It's sensitive to one-time accounting items (write-offs, asset sales) that distort a single year's earnings without reflecting the ongoing business.
- Forward P/E depends on analyst estimates, which can be wrong or biased.

## 5. How is it calculated?

```
Trailing P/E = Current Share Price / Trailing Twelve-Month EPS
Forward P/E  = Current Share Price / Estimated Next-Twelve-Month EPS
```

Athena does not compute this locally - it is sourced directly from Yahoo Finance's `summaryDetail` module (`trailingPE`, `forwardPE`), since Yahoo already has access to the underlying EPS and estimate data needed to compute it correctly.

## 6. How does Athena use it?

Shown in the Market Snapshot section (`valuation.peRatio`, `valuation.forwardPE`) and again in the Business vs. Market Performance comparison, presented as a plain figure - Athena does not label any P/E value as "cheap" or "expensive."

## 7. What can cause the metric to be misleading?

- A company with temporarily depressed earnings (e.g. due to a one-off charge) will show an inflated P/E that doesn't reflect its normal earnings power.
- A company with no reported earnings (net loss) will show no meaningful trailing P/E at all - Athena returns `null` in this case rather than a fabricated or misleading number.
- Comparing P/E across industries with very different capital intensity or growth profiles (e.g. a bank vs. a software company) is rarely a fair comparison.

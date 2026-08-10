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

## 8. Sprint 7 addendum: a second, distinct P/E in Comparable Company Analysis

Since Sprint 7, Athena computes a **second P/E figure** that is deliberately not the same value, or the same computation, as the one described above - the two coexist for different purposes:

| | This doc's P/E (Sprint 4) | Comps' P/E (Sprint 7) |
|---|---|---|
| Source | Sourced directly from Yahoo's `summaryDetail.trailingPE` | Computed by Athena: `Market Cap / Net Income` (`comps.formulas.js`'s `priceToEarnings()`) |
| Uses | Trailing twelve-month EPS (Yahoo's own definition) | Athena's own stored latest-reported-year Net Income |
| Purpose | A market snapshot metric, shown standalone | A trading multiple, aggregated across a peer group and applied to a target's Net Income to produce an Implied Value Per Share |
| Negative earnings | Not applicable/returned by Yahoo | Explicitly excluded (`null`), see `research/finance/OutlierHandling.md` |

Both are legitimate P/E figures and will usually be close but not identical (different EPS/Net-Income time windows, different share-count conventions). Athena keeps them as two separate code paths rather than one shared "the P/E" value specifically so a Comps calculation - which needs Athena's own consistent Net-Income figure to aggregate correctly across a peer group - never silently depends on a third-party snapshot metric that isn't guaranteed to use the same fiscal period as Athena's stored financials. See `research/finance/ComparableCompanyAnalysis.md` for how the Comps P/E is used, and `research/finance/ValuationMultiples.md` for why P/E is an **equity** multiple (never bridged through Enterprise Value).

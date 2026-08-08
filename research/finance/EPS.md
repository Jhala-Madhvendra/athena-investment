# EPS (Earnings Per Share)

## 1. What is it?

Earnings Per Share is the portion of a company's net income allocated to each outstanding share of common stock. Athena surfaces both **trailing EPS** (based on actual reported earnings) and, where available, **forward EPS** (based on analyst estimates for the next period).

## 2. Why does it matter?

EPS is the standard unit for expressing a company's profitability on a per-share basis, which makes it directly comparable to the per-share price of the stock - it's the denominator in the P/E ratio and a headline number in every quarterly earnings report.

## 3. How do investors use it?

- Tracking EPS growth over time as a signal of improving (or deteriorating) per-share profitability.
- Comparing actual EPS against analyst expectations at earnings time ("beat" or "miss").
- As the direct input to the P/E ratio.

## 4. What are its limitations?

- EPS can be manipulated upward by share buybacks (fewer shares outstanding raises EPS even if total net income is flat or falling) without any underlying operational improvement.
- It's sensitive to one-time items (asset sales, write-offs, tax adjustments) the same way net income is - "adjusted" or "non-GAAP" EPS figures (which Athena does not report) attempt to strip these out but introduce their own judgment calls.
- Forward EPS is an estimate, not a fact - it depends entirely on the accuracy of analyst forecasts.

## 5. How is it calculated?

```
EPS = Net Income / Weighted Average Shares Outstanding
```

Athena already calculates basic and diluted EPS from stored income statement data for the Financial Statements tab (Sprint 1). The Market Intelligence tab instead uses Yahoo's live `trailingEps` / `forwardEps` figures directly, since they reflect the most current share count and, for forward EPS, analyst estimates that Athena has no independent source for.

## 6. How does Athena use it?

Shown in the Market Snapshot section (`valuation.eps`, `valuation.forwardEps`), alongside the P/E ratio it feeds into.

## 7. What can cause the metric to be misleading?

- A company that aggressively buys back stock can show rising EPS even while total profit is shrinking.
- One-off gains (e.g. selling a division) can spike EPS for a single period without reflecting the ongoing business.
- Forward EPS estimates can be stale or based on overly optimistic/pessimistic analyst assumptions, especially for volatile or newly public companies.

# Margin Analysis

## 1. Definition

Tracking how a company's operating margin, net margin, and FCF margin changed between two periods — and, critically, expressing that change in **percentage points**, not a relative percent.

## 2. Formula

```
Operating margin = operatingIncome / revenue * 100
Net margin       = netIncome / revenue * 100
FCF margin       = freeCashFlow / revenue * 100

Margin change (percentage points) = latestMargin - previousMargin
```

30.1% → 28.4% is **"-1.7 percentage points,"** never **"-2%"** (a relative-percent read would in fact compute `(28.4-30.1)/30.1*100 ≈ -5.6%`, an entirely different — and here, misleadingly larger-sounding — number).

## 3. Intuition

Revenue and profit can both grow while the *relationship* between them weakens — margin analysis is what surfaces that. The brief's own worked example: revenue +10%, operating income +4% → operating margin necessarily declined, because profit grew slower than the base it's measured against.

## 4. Why investors care

Margin trend is often a more forward-looking signal than either revenue or profit growth in isolation — a business growing revenue while margin steadily contracts is spending more (on discounting, on cost inflation, on competitive pressure) to generate each dollar of sales, which is a meaningfully different story than one where margin holds or expands alongside growth.

## 5. Which financial statements are used

Income Statement for operating/net margin; Cash Flow Statement (for FCF) combined with the Income Statement's revenue line for FCF margin.

## 6. How Athena calculates it

`backend/earnings/earnings.calculator.js`'s `marginPointChange(previousPercent, latestPercent)` — a plain subtraction, deliberately never routed through `percentChange` (the relative-percent function) — is used for every margin-shaped metric (`buildMarginMetric`). The frontend (`frontend/src/lib/earningsFormat.js`'s `formatPercentagePoints`) renders it with an explicit `"pp"` suffix so it is never visually confusable with a relative percent in the comparison table.

## 7. Limitations

- A single-period margin move can reflect a one-time item (a large write-down, an unusual gain) rather than a structural change — Athena's earnings comparison covers exactly two periods, so it cannot by itself distinguish "one bad quarter" from "the start of a trend." Sprint 3's multi-year Business Analysis is the complementary tool for that.
- Margin analysis says *that* margin changed, not *why* — it doesn't decompose the change into its cost-line drivers (COGS, opex, tax rate).

## 8. Common interpretation mistakes

- Reporting a margin change as a relative percent (see Formula above) — this is explicitly called out in the Sprint 12 brief as something the system must never do.
- Treating margin contraction as automatically "bad" — the brief is explicit that Athena should describe this neutrally ("Operating margin declined") rather than judge it, because a margin decline driven by deliberate reinvestment reads very differently from one driven by competitive pressure, and Athena's deterministic engine has no way to distinguish the two from the numbers alone.

## 9. Interview question

*"Revenue grew 10%, operating income grew 4% — what happened to operating margin, and how would you phrase it?"* — Operating margin declined, because profit grew slower than revenue (the same profit is now a smaller share of a larger base). Phrase it as an observation ("Operating margin declined this period") rather than a verdict ("margins got worse") — the reader, not the system, should decide whether that's a concern.

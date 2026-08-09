# Net Working Capital (NWC) and Change in NWC

## 1. Definition

Net Working Capital is the short-term operating capital a business has tied up (or freed up) in running day-to-day operations — the gap between what it's owed/holds short-term (current assets) and what it owes short-term (current liabilities). *Change* in NWC — the year-over-year movement — is what actually matters for FCFF, because it represents cash consumed or released by operations that never shows up in EBIT.

## 2. The formula

```
NWC = Current Assets − Current Liabilities
Change in NWC = NWC(t) − NWC(t−1)
```

A **positive** Change in NWC means the business tied up *more* cash in working capital this year (e.g., receivables and inventory grew faster than payables) — a cash *outflow*, subtracted in the FCFF formula. A **negative** Change in NWC releases cash — added back.

## 3. Intuition

Imagine a growing retailer: as sales grow, it typically needs to carry more inventory and extends more credit to customers (receivables) before it collects the cash — both consume cash even though they don't touch EBIT at all (a sale is recorded as revenue whether or not the cash has actually arrived). Growth is not free, even for a profitable, growing business — funding that growth in working capital is a real, recurring cash cost that EBIT-based profitability numbers don't show, which is exactly why FCFF explicitly nets it out.

## 4. Why investors use it

A company can show accelerating revenue and healthy margins while its Change in NWC quietly consumes most of its operating cash flow — a classic "profitable on paper, cash-starved in practice" pattern, and often an early signal of either aggressive growth or deteriorating collection/inventory discipline. Watching Change in NWC alongside revenue growth is a standard earnings-quality check.

## 5. Assumptions

Athena's NWC definition uses the *total* current assets and current liabilities reported on the balance sheet — a simplification of the more surgical definition some analysts use (excluding cash and short-term debt from the calculation, since those are financing items, not operating ones). For most companies the difference is modest; for companies holding unusually large cash balances or short-term debt within "current" line items, Athena's broader definition will overstate the swings somewhat.

## 6. Limitations

**The historical first year in Athena's forecast is always unavailable.** Change in NWC needs a *prior* year's balance sheet to compare against — the earliest year Athena has on file has no such prior year, so `dcf.engine.js`'s `calculateHistoricalFCFF()` correctly marks that year's `changeInNWC` and `fcff` as `null` with `available: false`, rather than defaulting to zero (which would silently understate that year's true cash consumption/release). For the *forecast*, Change in NWC is derived from a user-set "Working Capital % of Revenue" assumption rather than a real balance sheet projection — a simplification standard to DCF modeling, but one that assumes working capital scales linearly with revenue, which may not hold through a major operational shift (e.g., a new payment-terms policy).

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`:

```js
const netWorkingCapital = (currentAssets, currentLiabilities) => currentAssets - currentLiabilities;
const changeInNetWorkingCapital = (currentNWC, priorNWC) => currentNWC - priorNWC;
```

Historically, `dcf.engine.js` computes NWC per statement year and diffs consecutive years. In the forecast, `forecastFCFF()` derives each year's NWC as `revenue × workingCapitalPercentRevenue`, then diffs against the *prior* year's NWC — the first forecast year diffs against the company's latest actual historical NWC (`historicalFinancials.latestNWC`), so the forecast starts from a real, not assumed, base.

## 8. Common mistakes

- **Defaulting a missing prior-year NWC to zero instead of `null`.** Silently treats a real "we don't know" as "no change," which would misstate FCFF for that year — Athena explicitly surfaces this as unavailable instead.
- **Sign confusion.** It's easy to get backwards which direction of NWC change is a cash inflow versus outflow — a *growing* NWC (more receivables/inventory relative to payables) is a cash *use*, and gets *subtracted* in the FCFF formula; a shrinking NWC releases cash and gets added.
- **Assuming NWC always grows with revenue.** For a company improving its collections or payment terms, NWC can shrink even as revenue grows — a fixed "Working Capital % of Revenue" forecast assumption won't capture that shift unless the user deliberately changes it.

## 9. Interview questions

*"A company's revenue and EBIT both grew 20% year-over-year, but its FCFF barely moved. Change in NWC is the largest single line item explaining the gap. What's likely happening?"* — The company is very likely tying up a disproportionate amount of cash funding its growth — inventory build-up ahead of expected demand, or receivables growing faster than the underlying sales (looser credit terms, slower collections). It's not necessarily a red flag on its own — growth genuinely requires working capital — but it's worth checking whether receivables/inventory days are trending up materially faster than revenue, which would suggest a collections or inventory-management problem rather than simple growth-funding.

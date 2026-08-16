# FCF Conversion

## 1. Definition

The share of a company's reported net income that actually shows up as free cash flow — a measure of how "cash-backed" reported profit is.

## 2. Formula

```
FCF Conversion = Free Cash Flow / Net Income
```

Where `Free Cash Flow = Operating Cash Flow - |Capital Expenditure|` (`backend/ratio/ratio.formulas.js`'s `freeCashFlow`, reused unchanged).

## 3. Intuition

A conversion ratio near 1.0× means most of reported profit becomes spendable cash. A ratio well below 1.0× means a meaningful gap exists between the P&L profit figure and the cash the business actually generated — driven by non-cash items, working-capital changes, or heavy capex. A ratio above 1.0× (FCF exceeding net income) is also normal and simply means non-cash charges (e.g. depreciation) exceeded cash outflows for the period.

## 4. Why investors care

Net income is an accounting construct; cash is what actually funds dividends, buybacks, debt paydown, and reinvestment. A business with strong reported earnings but weak cash conversion has less real flexibility than the income statement alone suggests.

## 5. Which financial statements are used

Cash Flow Statement (for FCF) and Income Statement (for net income) together.

## 6. How Athena calculates it

`backend/earnings/earnings.calculator.js`'s `fcfConversion(freeCashFlow, netIncome)` computes the ratio whenever both inputs exist and `netIncome` is not exactly zero — **including when net income is negative**, per the Sprint 12 brief's explicit instruction not to treat that as an error. When `netIncome < 0`, a static, deterministic caveat string is attached (never an AI judgment) explaining that the ratio's usual "cents of cash per dollar of profit" reading doesn't apply with a negative denominator. `netIncome === 0` is treated as true divide-by-zero and returns `available: false`.

## 7. Limitations

- Deeply misleading, not just imprecise, when net income is very small (a tiny profit near breakeven can produce an enormous or wildly volatile conversion ratio even with a perfectly normal FCF figure) — the caveat mechanism only fires on a *negative* net income today, not a merely small positive one; a reader should still sanity-check the net income magnitude alongside the ratio.
- Single-period, same limitation as every other Sprint 12 metric — capex is often lumpy quarter-to-quarter/year-to-year (a large one-time capital project can depress FCF Conversion for one period without reflecting a change in underlying business quality).

## 8. Common interpretation mistakes

- Treating any conversion ratio far from 1.0× — especially a negative one — as evidence of "bad" or fraudulent earnings. The brief is explicit: never label it that way. A negative net income with positive FCF (negative conversion) can simply mean a company took a large non-cash write-down while still generating real cash.
- Comparing FCF Conversion across companies with very different capital intensity (e.g. a capex-heavy manufacturer vs. an asset-light software company) as if the "right" ratio were universal — it isn't; it's industry- and business-model-dependent.

## 9. Interview question

*"A company reports net income of -$20M and FCF of +$50M this period — what does FCF Conversion say, and how should Athena present it?"* — The computed ratio is -2.5× (a negative number, since net income is negative). Athena still shows the number rather than hiding it, but attaches a caveat explaining that with a negative net income, the ratio's usual interpretation doesn't hold — it should never be labeled "problematic" or "fraudulent" on the strength of the sign alone.

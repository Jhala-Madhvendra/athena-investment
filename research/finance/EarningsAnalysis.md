# Earnings Analysis

## 1. Definition

Earnings analysis is the practice of interpreting how a company performed in its latest reported period relative to a prior period — not simply reading its net income figure. Sprint 12's Earnings Intelligence covers seven dimensions together: revenue, profitability, margins, cash generation, growth, balance-sheet context, and per-share metrics.

## 2. Formula

There is no single "earnings" formula — it's a composite read across several already-defined ones, all reused from earlier sprints rather than redefined:

```
Revenue growth %      = (latestRevenue - previousRevenue) / previousRevenue * 100
Operating margin      = operatingIncome / revenue * 100          (ratio.formulas.js)
Net margin            = netIncome / revenue * 100                (ratio.formulas.js)
FCF                   = operatingCashFlow - |capitalExpenditure| (ratio.formulas.js)
ROE, ROA              = netIncome / equity, netIncome / assets   (ratio.formulas.js)
```

## 3. Intuition

"How much profit did they make?" is one question. "Is the business getting stronger or weaker?" is a different one, and it requires comparison — a $10B net income figure means nothing on its own; whether it's up or down 15% from last year, and whether that move came with margin expansion or contraction, is what actually informs a decision.

## 4. Why investors care

A single-period snapshot can't distinguish a temporarily depressed year from a structurally declining business, or a one-time gain from durable operating strength. Comparison against the immediately preceding period — the freshest, most decision-relevant data point Athena has — is the fastest way to surface what changed.

## 5. Which financial statements are used

All three: the Income Statement (revenue, operating income, net income, EPS), the Balance Sheet (debt, cash, equity, assets — for ROE/ROA and balance-sheet context), and the Cash Flow Statement (operating cash flow, capital expenditure — for FCF and FCF conversion). Earnings analysis deliberately never looks at only one statement in isolation.

## 6. How Athena calculates it

`backend/earnings/earnings.calculator.js`'s `calculateEarningsMetrics(latestStatement, previousStatement)` is the single entry point, composing five metric groups (growth, profitability, cashFlow, balanceSheet, perShare) plus three rule-based quality observations. It does not reimplement any formula `backend/ratio/ratio.formulas.js` already provides — see `research/engineering/ServiceReuse.md`.

## 7. Limitations

- Athena's financial data provider (Yahoo/Twelve Data, via `backend/financials/`) only supplies **annual** statements — see `research/finance/QoQvsYoY.md`. There is no quarterly earnings analysis today.
- No analyst consensus/estimates exist anywhere in Athena, so there is no "beat/miss" framing — only what actually happened, compared with what happened before.
- A two-period comparison can't see a longer structural trend; that's what Sprint 3's multi-year Business Analysis (`backend/analysis/`) is for, and the two are complementary, not redundant.

## 8. Common interpretation mistakes

- Treating "earnings" and "net income" as synonyms — a company can grow net income while free cash flow deteriorates (see `EarningsQuality.md`), which a net-income-only read would miss entirely.
- Reading revenue growth and profit growth as if they must move together — they frequently don't, and the gap between them *is* the margin story (see `MarginAnalysis.md`).
- Judging a single metric (e.g. rising debt) as inherently negative without its cash-flow context.

## 9. Interview question

*"Why does Athena compare five categories of metrics instead of just showing net income growth?"* — Because net income alone can't distinguish an operationally healthy company from one propped up by a one-time item, or a company growing revenue while quietly losing margin. Growth, profitability, cash flow, balance sheet, and per-share metrics each answer a different question a single number can't.

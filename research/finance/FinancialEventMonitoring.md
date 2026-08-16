# Financial Event Monitoring

## 1. Definition

Financial event monitoring is comparing a company's most recently reported fiscal year against the prior one and flagging any single metric that moved by more than a meaningful amount — a margin compression, an ROE decline, a free cash flow drop, a debt increase, or a Financial Health Score change. This is Athena's FINANCIAL alert category, distinct from the multi-year BUSINESS trend category (see `FinancialTrendAlerts.md`).

## 2. Why investors care

A period-over-period change is the most direct signal a new financial statement carries: "operating margin declined from 32.1% to 28.7%" is a concrete, verifiable fact an investor can act on without waiting to see if it becomes a multi-year pattern. Catching it the moment new financials are imported — rather than requiring the investor to notice it themselves on a dashboard — is the core value of turning "displaying information" into "flagging meaningful change."

## 3. Formula

```
Operating margin       = operatingIncome / totalRevenue * 100        (ratio.formulas.js)
Net profit margin      = netIncome / totalRevenue * 100
Return on equity       = netIncome / totalStockholderEquity * 100
Free cash flow % change = (FCF_latest - FCF_prior) / FCF_prior * 100
Debt % change           = (debt_latest - debt_prior) / debt_prior * 100
Revenue growth-rate delta = YoY_growth_latest - YoY_growth_prior (percentage points)
```

## 4. Appropriate comparison period

Always the two most recently reported fiscal years, never a quarter — Athena's `FinancialStatement` schema (`backend/financials/financials.model.js`) has no `periodType` field and no quarterly concept anywhere; `year` is the only period discriminator. This isn't a corner that was cut for Sprint 11 specifically — it's a pre-existing constraint of the whole Financials domain, and every comparison in this alert category respects it rather than fabricating a quarter-over-quarter comparison the underlying data can't support.

## 5. Limitations

- A "prior year" comparison only exists once two fiscal years are on file — a newly-imported company gets exactly one alert (`NEW_ANNUAL_RESULTS`, informational) until a second year arrives.
- Annual-only granularity means a mid-year deterioration that reverses by fiscal year-end is invisible — Athena would show a flat year-over-year number for a company that actually had a rough H1 and a strong H2.
- A percentage-point threshold (e.g., 3pp for margins) treats a move from 5%→8% the same as 50%→53%, even though the former is a much larger *relative* change. Athena accepts this simplification for consistency with how the sprint brief frames these thresholds.

## 6. False positives

A one-off, non-recurring item (a large asset sale, a legal settlement, a tax law change) can move a margin or ROE by several points without reflecting the underlying business's real trajectory — Athena's alert correctly reports the fact ("operating margin declined from X to Y") but, like the underlying financial statements themselves, can't distinguish a recurring change from a one-time item; the "why it matters" text is deliberately general rather than claiming a cause it can't verify.

## 7. How Athena implements it

`backend/alerts/alert.engine.js`'s `evaluateFinancialRules` takes the two most recent statements (`financialsService.getFinancialStatementsByTicker`, sorted descending) and runs each formula through `ratio.formulas.js` — the exact same pure functions the Ratio Engine (Sprint 2) already uses, not a reimplementation. No snapshot is needed to detect these changes: since the comparison is always "latest FY vs. the FY before it," the fiscal-year pair itself (`FY2025-FY2026`) is a stable, naturally-idempotent identity — see `research/engineering/AlertDeduplication.md`. The Financial Health Score comparison is the one exception requiring extra computation: `computeHealthScoreOverall` re-runs `analysis.service.js`'s own scoring pipeline twice — once over all available statements, once with the latest year excluded — to get a genuine "before this year's results" baseline without needing a persisted snapshot.

## 8. Common mistakes

- Comparing the latest year against a multi-year average instead of specifically the prior year — that's a trend question (see `FinancialTrendAlerts.md`), not a period-over-period one, and conflating them either mutes a real single-year shock or over-reacts to normal variance.
- Computing a percent change against a zero or negative prior-period base (e.g., debt of 0, or a prior-year loss) — Athena's `percentChange` helper explicitly guards against a non-positive base and returns `null` (no alert) rather than a nonsensical or infinite percentage.

## 9. Interview questions

1. *"Why compare fiscal year to fiscal year instead of quarter to quarter?"* — Because Athena's financial data model is annual-only; there's no quarterly statement to compare against. Building a quarter-over-quarter rule on data that doesn't exist would mean fabricating a comparison, which the codebase's own conventions explicitly avoid.
2. *"A company's operating margin declines 3.4pp because of a one-time legal settlement. Should the alert have known that?"* — No — the alert reports an observed fact from the financial statements, not an interpretation of its cause. Athena's principle throughout is "state what changed," not "explain why," precisely because the latter requires information (footnotes, MD&A) the structured financial-statement data doesn't carry.
3. *"Why does a debt increase from $0 not fire an alert even though it's technically an infinite percent increase?"* — A percent change from a zero base is mathematically undefined as a meaningful magnitude — reporting "infinity%" would be more misleading than informative, so the rule simply doesn't fire rather than surface a nonsensical number.
4. *"How is the 'Financial Health Score changed' comparison computed without a stored prior score?"* — By re-running the exact same scoring pipeline (`analysis.service.js`'s trend + ratio + health-score chain) twice: once with all statements, once with the most recent year excluded. Both runs are deterministic and reproducible from data Athena already stores, so no separate persistence is needed just to answer "what was the score before this year's results."

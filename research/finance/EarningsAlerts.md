# Earnings Alerts

## 1. Definition

An earnings alert notifies an investor that a company has new financial results available to review. In most investment platforms this means a quarterly earnings release; in Athena, it means a new annual `FinancialStatement` has been imported for a tracked ticker — the `NEW_ANNUAL_RESULTS` alert, severity `INFO`.

## 2. Why investors care

New financial results are the trigger for essentially every other financial and business decision an investor makes about a company — updated margins, updated growth rates, an updated Financial Health Score, a stale DCF that now needs rerunning. Knowing the moment new results land, rather than stumbling onto them, is table stakes for staying current on a tracked company.

## 3. Formula

Not applicable — this is a data-availability event, not a calculated metric. The "formula" is existence: a `FinancialStatement` document for fiscal year Y exists where it didn't before.

## 4. Appropriate comparison period

None — this alert doesn't compare two periods, it announces the arrival of one. Its "period" field is simply the new fiscal year itself (e.g., `FY2026`).

## 5. Limitations

**This is the most important limitation in the entire Alert Engine to be explicit about: Athena has no quarterly earnings data, at all.** `backend/financials/financials.model.js` has no `periodType` field and financial statements are imported and stored annually only. What other platforms call an "earnings alert" — a quarterly EPS beat/miss with a stock reaction the same day — is simply not a category Athena's data can support. `NEW_ANNUAL_RESULTS` is a genuinely useful but much coarser-grained signal: it fires once per fiscal year per tracked ticker, not four times.

## 6. False positives

None in the traditional sense (there's no "beat vs. miss" judgment being made — it's a pure availability notification), but the *absence* of a quarterly cadence means a user expecting quarterly frequency will be surprised by how rarely this fires — worth setting that expectation explicitly rather than letting a user discover it by silence.

## 7. How Athena implements it

`backend/alerts/alert.engine.js`'s `evaluateFinancialRules` unconditionally emits a `NEW_ANNUAL_RESULTS` candidate for the latest available statement, deduplicated by `fiscalYearKey(latest.year)` (e.g., `FY2026`) — so it fires exactly once per user per ticker per fiscal year, no matter how many times `POST /api/alerts/monitor` runs in between. Its `triggeredAt` is the statement document's own `createdAt` (when Athena imported the data), not the statement's fiscal year end — the two are different facts, and conflating them would misrepresent a statement imported in 2026 for FY2025 as a "real-time 2025 event."

## 8. Common mistakes

- Assuming this alert behaves like a brokerage's quarterly earnings alert and building product expectations (or a demo) around a quarterly cadence that the underlying data doesn't support.
- Treating "new results available" as inherently positive or negative news — it's neither; the actual FINANCIAL and BUSINESS category alerts (margin change, revenue growth deceleration, etc.) are what carry direction. `NEW_ANNUAL_RESULTS` only says "look, there's something new to check."

## 9. Interview questions

1. *"Why is Athena's earnings alert annual instead of quarterly, and is that a bug?"* — It's a direct consequence of the underlying data model, not a bug: `FinancialStatement` has no quarterly concept anywhere in Athena, going back to Sprint 1's financial statements domain. Building a quarterly alert on top of annual-only data would mean fabricating a comparison period that doesn't exist in the source data.
2. *"What would it take to add real quarterly earnings alerts?"* — A new quarterly statement schema/import pipeline (a materially larger change than Sprint 11's scope), plus deciding how quarterly and annual data coexist without double-counting trend/margin comparisons that currently assume one fiscal year per data point.
3. *"Why is this alert INFO severity rather than MEDIUM or HIGH?"* — Because on its own it isn't good or bad news — it's a fact that something new is available to review. Severity in Athena's model is meant to communicate how much a change matters, and "new data exists" doesn't carry directional weight the way "margin declined 3.4pp" does.

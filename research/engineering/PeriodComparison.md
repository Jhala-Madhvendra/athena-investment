# Period Comparison

## What it is

The mechanism for identifying which two reporting periods to compare, and labeling that comparison honestly — `backend/earnings/earnings.periods.js`'s `resolvePeriods(statements)`.

## Why we use it

Financial periods are easy to get quietly wrong: mixing an annual figure with a quarterly one, comparing non-adjacent years after a data gap, or presenting a single-period result as if a comparison existed when none does. A single, well-tested function that owns "what am I comparing to what" prevents every downstream module (`earnings.calculator.js`, `earnings.signals.js`, the frontend) from independently guessing.

## Alternatives considered

- **Let each consumer compute `statements[0]` vs. `statements[1]` inline.** This is what `alert.engine.js`'s `evaluateFinancialRules` does today, and it works there because it's the only consumer. Earnings has multiple consumers (calculator, signals, formatter, frontend) that all need to agree on the same period labels and comparison-availability flag — inlining the same logic three or four times invites drift.
- **Assume the two most recent statements are always adjacent fiscal years.** Rejected: `resolvePeriods` explicitly sorts by year and pairs the latest with the *immediately preceding* year it finds, rather than blindly taking `statements[1]` — if Athena's stored data has a gap (e.g. FY2026 and FY2024 imported, FY2025 missing), the function still behaves correctly rather than silently comparing across a two-year gap while labeling it "YoY."
- **Hardcode `periodType: "ANNUAL"` with no enum.** Rejected per the brief's explicit instruction to build the architecture so quarterly support is additive — see `EarningsEngine.md`.

## Trade-offs

- **Pro:** every downstream consumer gets an explicit `comparisonAvailable` boolean and `comparisonType` string instead of having to infer both from whether a second statement happens to exist.
- **Pro:** degrades gracefully — one statement produces a valid (if comparison-less) result; zero statements produce a valid empty result; neither path throws.
- **Con:** one more file/indirection layer for what is, in the single-statement-array case, a fairly small amount of logic — justified here because the alternative (three or four call sites reimplementing "sort and pick two") is worse.

## Athena implementation

`resolvePeriods(statements)` defensively sorts descending by `year` (never trusts caller ordering, even though `financialsService.getFinancialStatementsByTicker` already returns descending order), then returns `{periodType, latest, previous, latestPeriodLabel, previousPeriodLabel, comparisonAvailable, comparisonType}`. `periodType` is always `"ANNUAL"` today (Athena's `FinancialStatement` model and both financial-statement providers — Yahoo and Twelve Data — are annual-only, see `research/finance/QoQvsYoY.md`); the enum (`PERIOD_TYPES.ANNUAL/QUARTERLY/TTM`) exists specifically so a `QUARTERLY` branch is additive later.

## Interview questions

1. *"Why does `resolvePeriods` re-sort the statements array instead of trusting it's already sorted?"* — Defensive programming for a pure function with no side effects to lean on — its only contract is "give correct output for any array of statement-shaped objects," and a caller (present or future) passing unsorted data shouldn't silently produce a wrong period pairing. The cost of sorting defensively is negligible; the cost of a silent wrong pairing is a materially wrong comparison shown to a user.
2. *"How does this module handle a data gap — e.g. statements exist for FY2026 and FY2024, but FY2025 was never imported?"* — It pairs FY2026 with FY2024 (the two most recent by year, whatever the gap), correctly, but the `comparisonType` is still labeled `"YoY"` even though it's really a 2-year gap dressed up as one. This is a known limitation worth surfacing — a future improvement could detect non-adjacent years and label the comparison differently, but Sprint 12 doesn't currently distinguish that case.

# Earnings Engine

## What it is

The `backend/earnings/` domain: a deterministic pipeline that turns two `FinancialStatement` documents (latest + previous fiscal year) into a structured, period-over-period comparison — `earnings.periods.js` (period resolution) → `earnings.calculator.js` (variance/margin/quality math) → `earnings.signals.js` (Improving/Stable/Deteriorating classification) → `earnings.marketReaction.js` (price-move context) → `earnings.formatter.js` (public API shape), orchestrated by `earnings.service.js` and exposed at `GET /api/earnings/:ticker`.

## Why we use it

Sprint 12's core question — "how did the company perform, and what changed?" — was previously answerable only by manually cross-referencing three separate pages (raw Financial Statements, 5-year Financial Analysis, and Alerts). None of those pages compute a single-period-over-period comparison as their primary output; Financial Analysis is CAGR-oriented (5 years), Alerts fire only on threshold breaches, and raw statements show no comparison at all. A dedicated, focused engine fills that specific gap without repurposing an existing one built for a different question.

## Alternatives considered

- **Extend `analysis.service.js` (Sprint 3's Business Analysis) with a "latest period" mode.** Rejected: that engine's entire shape (`trend.engine.js`'s CAGR/consistency/trend-direction machinery) is built around a 5-year window; forcing a 2-period comparison through it would mean either a parallel code path inside an already-complex file or degrading its multi-year assumptions, neither of which is cleaner than a dedicated, small module.
- **Fold Earnings into the Alert Engine.** Rejected explicitly by the brief and by the codebase's own separation of concerns: `alert.engine.js`'s `evaluateFinancialRules` already does its own latest-vs-previous diff internally for the sole purpose of deciding whether to *fire an alert* — it has no reason to expose that diff as a browsable, human-facing report, and repurposing it to do so would blur "detect a threshold breach" with "explain the full period."
- **A standalone `earnings/` domain reusing existing services.** What shipped — mirrors the shape of every other Sprint 1-11 domain (`ratio/`, `analysis/`, `alerts/`, `news/`): its own routes/controller/service, but zero new external-provider calls and zero duplicated financial formulas.

## Trade-offs

- **Pro:** small, focused, independently testable modules (82 tests across 7 files) — each one does exactly one job (`earnings.periods.js` only resolves periods, `earnings.calculator.js` only computes, `earnings.signals.js` only classifies).
- **Pro:** reuses `ratio.formulas.js`, `financials.service.js`, `news.service.js`, `market.service.js`, and `alert.rules.js`'s `THRESHOLDS` directly — see `ServiceReuse.md` — so there is exactly one implementation of "what is operating margin" or "what counts as a meaningful margin change" in the whole codebase.
- **Con:** a small amount of orchestration duplication is unavoidable — `earnings.service.js` fetches statements/news/market data the way `alert.service.js` and `ai.contextBuilder.js` each already do for their own purposes, because none of those existing orchestrators expose a reusable "give me the latest+previous period comparison" function themselves.

## Athena implementation

Seven backend files (`earnings.periods.js`, `earnings.calculator.js`, `earnings.signals.js`, `earnings.marketReaction.js`, `earnings.validator.js`, `earnings.formatter.js`, `earnings.service.js`) plus `earnings.controller.js`/`earnings.routes.js`, mounted at `/api/earnings` in `server.js`. Frontend: `frontend/src/components/Earnings.jsx` plus `frontend/src/components/earnings/` (comparison table, signal badges, quality section, market reaction card), reusing `ui/Card`, `ui/Skeleton`, `ui/ErrorState`, `ui/EmptyState`, and Sprint 10's `NewsCard` unchanged.

## Interview questions

1. *"Why is `earnings.periods.js` a separate file from `earnings.calculator.js` instead of one module?"* — Different concerns and different failure modes: period resolution is about *which* two documents to compare (and will need a `QUARTERLY` branch someday); the calculator is about *what to compute* once you already have them. Keeping them separate means adding quarterly support later touches one small file, not the whole pipeline.
2. *"What would you have to change to add quarterly earnings support?"* — Add `quarterly*` field requests to the Yahoo/Twelve Data providers, a quarter field to `FinancialStatement`, and a `QUARTERLY` branch in `earnings.periods.js`'s `resolvePeriods`. `earnings.calculator.js`, `earnings.signals.js`, and the frontend would need no changes — they already operate on whatever two statement documents they're handed, agnostic to period type.

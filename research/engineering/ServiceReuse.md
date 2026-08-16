# Service Reuse

## What it is

The architectural rule that governed every design decision in Sprint 12: the Earnings Engine computes nothing that an existing service already computes, and calls no external provider that an existing, already-cached service doesn't already sit in front of.

## Why we use it

The brief's own diagram makes the failure mode explicit:

```
Earnings API
    ↓
Financial API
    ↓
Market API
    ↓
News API
```

— a naive implementation could turn one `GET /api/earnings/:ticker` request into a cascade of *fresh* external-provider calls (Yahoo Finance for statements, Yahoo/marketaux for news, Yahoo for price history), each with its own latency and rate-limit exposure, every single time someone loads the Earnings tab. Every one of those data sources already has a domain in Athena with its own DB-backed cache and freshness policy; the correct behavior is to call *those*, not the providers behind them.

## Alternatives considered

- **A single large `earnings.service.js` that fetches directly from Yahoo/marketaux for anything the existing services don't expose conveniently.** Rejected outright — this is exactly the anti-pattern the brief warns against, and it would mean Earnings has its own opinion about, e.g., how fresh market data needs to be, duplicating (and potentially contradicting) `market.service.js`'s own `FRESHNESS_THRESHOLD_DAYS` policy.
- **Reimplementing margin/ROE/FCF formulas locally "to avoid a cross-module dependency."** Rejected — `backend/ratio/ratio.formulas.js` already has a battle-tested, sign-normalized `freeCashFlow` implementation (with a real regression test locking in a sign-handling bug fix from an earlier sprint); reimplementing it risks reintroducing that exact bug.
- **New, Earnings-specific significance thresholds instead of reusing `alert.rules.js`'s `THRESHOLDS`.** Rejected wherever an existing threshold already measured the same thing — see `FinancialSignalDetection.md`.

## Trade-offs

- **Pro:** zero new external-provider call sites anywhere in `backend/earnings/` — verified by grep: no `fetch`, no provider `require`, only `financialsService`, `newsService`, `marketService` (each already DB-cached with its own TTL policy).
- **Pro:** a fix or improvement to `ratio.formulas.js`'s FCF calculation, or to `alert.rules.js`'s margin threshold, automatically benefits Earnings without a second change — there is exactly one place each fact lives.
- **Con:** Earnings' own service layer still fetches from three different existing services (Financials, News, Market) in one request — that's inherent to the feature (it genuinely synthesizes three domains), not something service reuse eliminates; what reuse *does* eliminate is each of those three domains being re-implemented or re-fetched from scratch.

## Athena implementation

| Reused from | What Earnings takes from it | Not reimplemented |
|---|---|---|
| `backend/ratio/ratio.formulas.js` | `operatingMargin`, `netProfitMargin`, `returnOnEquity`, `returnOnAssets`, `freeCashFlow` | Every margin/return/FCF formula |
| `backend/financials/financials.service.js` | `getFinancialStatementsByTicker` | Statement storage, import, provider abstraction |
| `backend/news/news.service.js` | `getNews(ticker, {category: "Earnings"})` | Article fetching, classification, deduplication, caching |
| `backend/market/market.service.js` | `getHistoricalPrices(ticker, "5y")` | Provider abstraction, DB caching, freshness policy |
| `backend/alerts/alert.rules.js` | `THRESHOLDS.financial.{marginChangePoints, fcfDeclinePercent, debtIncreasePercent}` | The definition of "a meaningful change" for these metrics |

Alert integration is passive by design: Earnings does not call into `backend/alerts/` at all — the existing Alert Engine independently evaluates the same underlying statements on its own monitoring pass and will surface the same kind of significant change on its own, with no coordination code needed between the two domains.

## Interview questions

1. *"Walk through what happens, service-call-wise, on a `GET /api/earnings/AAPL` request."* — `financialsService.getFinancialStatementsByTicker` (DB read, no provider call unless data was never imported), `newsService.getNews` (DB read, provider call only if the cached articles are past `newsCacheTtlMs`), `marketService.getHistoricalPrices` (DB read, provider call only if coverage is stale) — run as `Promise.all` for news+market. Zero calculations are re-derived that `ratio.formulas.js` already provides.
2. *"If `market.service.js`'s caching policy changes tomorrow, does anything in `backend/earnings/` need to change?"* — No — Earnings calls `marketService.getHistoricalPrices` exactly as `alert.engine.js` and `ai.contextBuilder.js` already do, and never reasons about staleness itself. Any caching/freshness improvement in the Market domain benefits every consumer, including Earnings, for free.

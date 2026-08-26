# Data Ownership

## What it is

A single reference table for what category of data every one of Athena's current (and near-future) entities belongs to, and where its source of truth lives. This doesn't exist as one document today — each engineering doc states its own entity's source of truth locally (e.g. `PortfolioDataModel.md`, `AiResearchReport`'s module comment) but nothing connects them. Sprint 19 is the first point where enough entities exist across enough pillars that a central table earns its keep.

## The seven categories

1. **External market data** — owned by the provider, Athena only caches/normalizes it.
2. **Derived deterministic data** — owned by Athena's calculation engines, recomputed on read, never a separate fact to maintain.
3. **User-owned data** — facts about the user's real-world holdings/interests, owned by the user, Athena just stores them.
4. **User decisions** — the user's own reasoning and choices, owned by the user, Athena stores and never edits or overrides.
5. **User preferences** — settings/configuration the user controls (currently minimal in Athena).
6. **Temporary calculations** — computed for one request, intentionally never persisted.
7. **Historical records** — immutable-in-spirit logs of what happened, append-only in practice.

## The table

| Entity / data | Category | Source of truth | Notes |
|---|---|---|---|
| Market price, OHLCV | External market data | Yahoo/TwelveData (provider) | `MarketHistory` is a cache with a `source` field, not a competing truth |
| Financial statement line items | External market data + Athena normalization | Provider + `FinancialStatement`'s normalized shape | Athena's schema is the canonical *shape*; the numbers themselves originate externally |
| Company profile (sector, industry, market cap) | External market data | Provider, refreshed via `POST /api/company/import/:ticker` | `Company` document is a cache, not authored by Athena |
| News articles | External market data | Provider (Yahoo News/Marketaux), deduplicated by `canonicalUrl` | TTL-expired after `newsRetentionDays` — not an archive |
| Ratios (margins, ROE, liquidity, leverage) | Derived deterministic data | `ratio.calculator.js`, computed on every request | No `Ratio` collection exists or should exist |
| DCF valuation | Derived deterministic data | `dcf.engine.js`, computed on every request from user-provided assumptions | Never persisted — recomputation is cheap and always reflects latest data/inputs |
| Comps valuation | Derived deterministic data | `comps.engine.js`, computed on every request | Same reasoning as DCF |
| Financial Health Score, trends, insights | Derived deterministic data | `analysis.service.js`'s engines | Computed on every request |
| Portfolio Analytics (volatility, Sharpe, beta, correlation, exposure) | Derived deterministic data | `portfolio.analytics.calculator.js`, computed per request from Holding/Transaction + MarketHistory | Depends on documented assumptions (`PortfolioCalculationAssumptions.md`) — the *methodology* is deterministic even though it's an estimate |
| Scenario stress-test results | Derived deterministic data (temporary) | `portfolio.scenario.resolver.js`/`calculator.js`, computed per request | Never persisted — see "Temporary calculations" below |
| Watchlist entries | User-owned data | `Watchlist` collection, user-authored via `POST /api/watchlist` | Zero financial commitment, per `WatchlistVsPortfolio.md` |
| Holdings (current lots) | User-owned data | `Holding` collection, user-authored | Not reconciled against `Transaction` — see `PortfolioDataModel.md` |
| Transactions (BUY/SELL ledger) | User-owned data / historical record | `Transaction` collection, user-authored, replayed chronologically | Immutable-in-spirit; edits re-validate the whole ticker timeline |
| Alerts | Historical record (derived, user-scoped) | `Alert` collection, system-generated from deterministic rules against user-tracked tickers | TTL-expired after `alertRetentionDays` — not an archive, a rolling window |
| AI Research Report | Derived data, persisted for cost reasons | `AiResearchReport`, keyed on `(ticker, contextVersion)` | The one deliberate exception to "never persist derived analysis" — justified by LLM cost/latency, not a general precedent shift (`AIResearchAnalystProductDesign.md`) |
| AI Scenario Explanation | Temporary calculation | Not persisted — regenerated per click | Cheap enough (and short-lived enough in relevance) that persistence would be premature infrastructure |
| User identity | User-owned data (minimal) | `User` collection — a hashed bearer token, no email/profile today | See `FutureDataModel.md` for why this needs to evolve before Phase 4/6 |
| **(Phase 2) InvestmentDecision** | User decisions | New `InvestmentDecision` collection, user-authored, citing but not duplicating Research outputs | Evidence fields (DCF value, Comps range) should store a *reference/snapshot*, not a live recomputation — see below |
| **(Phase 3) Dividend, CorporateAction** | Historical record | New collections, likely provider-sourced with user confirmation | Not designed yet — flagged here as a future category, not specified |
| **(Phase 6) Goal, PortfolioTarget** | User decisions / preferences | New collections, entirely user-authored | Depends on Phase 3's cash-ledger existing to compute honest progress |

## Why a Decision's evidence fields should snapshot, not re-reference live values

This is worth calling out explicitly because it's a different answer than DCF/Comps' own "never persist, always recompute" rule. A `DCF value: $96/share, calculated 2026-08-01` cited inside a Decision record must stay $96 even if the user later re-runs DCF with different assumptions and gets $110 — the whole point of the Decision record is "what did I believe, and why, at the time I decided." If the evidence field were a live pointer that changed value silently, Phase 5's Review pillar would be comparing a decision against evidence that quietly rewrote itself, which defeats the entire purpose. This mirrors why `AiResearchReport` stores a `contextSnapshot` alongside its report (`ai.model.js`'s own documented reasoning: "why did the AI say this is always answerable from stored data") — Decision evidence needs the same discipline, for the same reason.

## Interview questions

1. *"Why does everything in category 2 (derived deterministic data) get recomputed instead of cached?"* — Because it's cheap (local math, no external cost) and correctness matters more than the marginal latency saved by caching — a cached ratio computed from yesterday's assumptions could silently disagree with today's underlying financials. The one exception (AI Research Report) is exactly the case where recomputation cost stops being negligible.
2. *"Why does a future Decision's evidence field break the 'never persist derived data' rule DCF/Comps established?"* — It doesn't break the rule — it's a different category entirely. DCF/Comps outputs themselves stay unpersisted (a fresh DCF calculation is still computed live, same as today); what's persisted is a *snapshot reference* inside a User Decision record, which was always going to be persisted regardless (it's category 4, not category 2). The snapshot exists to make the Decision record historically accurate, the same reasoning `AiResearchReport.contextSnapshot` already establishes.

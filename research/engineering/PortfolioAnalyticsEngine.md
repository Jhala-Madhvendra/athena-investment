# Engineering Concept: Portfolio Analytics Engine

## What it is

Sprint 14's calculation layer for `GET /api/portfolio/analytics`, split into four pure calculator modules with zero I/O:

```
backend/portfolio/
    portfolio.analytics.calculator.js    return series, period/annualized return, volatility, Sharpe, drawdown
    portfolio.analytics.risk.js          beta (weighted average of holding betas)
    portfolio.analytics.exposure.js      sector/industry grouping, concentration/HHI
    portfolio.analytics.correlation.js   pairwise correlation matrix
    portfolio.analytics.service.js       orchestration: fetch data, call calculators, cache
    portfolio.analytics.validator.js     query param validation (window, benchmark)
    portfolio.analytics.controller.js    HTTP
    portfolio.analytics.routes.js        Express router
```

This mirrors the shape already established by `portfolio.calculator.js` (Sprint 9), `dcf.formulas.js` (Sprint 6), and `comps.formulas.js`/`comps.statistics.js` (Sprint 7): given plain numbers/arrays, return plain numbers/arrays, with all Express/Mongoose/provider concerns pushed into the service layer.

```
Portfolio Data (Sprint 9 holdings)
      ↓
Historical Market Data (market.service - already exists)
      ↓
Analytics Calculator (pure functions)
      ↓
Risk/Exposure/Correlation Calculations (pure functions)
      ↓
Formatter (inline in service.js - response shaping)
      ↓
API (controller/routes)
      ↓
Frontend (PortfolioAnalyticsSection.jsx)
```

## Why we use it

**Testability without mocking a database.** Every calculator function in this list can be (and is) unit-tested with plain JavaScript objects and arrays - no `jest.mock()` of Mongoose, no test database, no network stubbing. `portfolio.analytics.calculator.test.js` alone covers 23 cases this way. The service layer, which *does* need I/O mocking, is tested separately and more sparingly (integration-style, mocking only the boundary modules: `Holding`, `Company`, `market.service`, `companyService`, `riskFreeRateProvider`).

**Deterministic, debuggable math.** Every calculator function is a pure function of its inputs - the same holdings, the same historical prices, and the same window always produce the same output. This matters specifically because Sprint 14's numbers are estimates built on an approximation (current weights applied backward, see PortfolioCalculationAssumptions.md) - if the *math* weren't deterministic on top of that, debugging a wrong-looking number would require untangling two sources of variability instead of one.

## Alternatives considered

- **One large `portfolio.analytics.service.js` with the math inlined.** Rejected - would make the volatility/Sharpe/drawdown formulas untestable without a database mock, exactly the problem the existing `portfolio.calculator.js`/`comps.formulas.js` split already solved for Sprints 6/7/9. Splitting later, after the file grew large, would have been a bigger refactor than starting split.
- **One single `portfolio.analytics.calculator.js` covering everything (including beta, exposure, correlation).** Considered, since it would mean one fewer file. Rejected in favor of separate `risk.js`/`exposure.js`/`correlation.js` files because each has a genuinely distinct input shape and concern (beta doesn't touch the historical return series at all; exposure operates on classification strings, not returns; correlation is inherently pairwise) - keeping them separate keeps each file's job legible from its name alone, matching the granularity the sprint brief itself suggested.

## Trade-offs

- **Pro:** every formula is independently unit-testable, and the test suite documents expected behavior (zero volatility, missing risk-free rate, single-holding portfolios, etc.) directly alongside the implementation.
- **Pro:** the service layer stays thin - its job is exclusively "fetch data, call calculators, shape the response," which keeps it readable even though it orchestrates several external fetches.
- **Con:** more files than a single-file implementation - navigating the analytics engine means knowing which of five files owns which metric. Mitigated by consistent naming (`portfolio.analytics.<concern>.js`) matching the existing `portfolio.*`/`dcf.*`/`comps.*` module-family convention already used throughout the codebase.

## How Athena implements it

`portfolio.analytics.service.js`'s `computeAnalytics()` is the single orchestration point: it calls `portfolioService.getPortfolio()` (Sprint 9, unchanged) for holdings/cost-basis/value, fans out to `market.service.getHistoricalPrices()`/`getCurrentMarketData()` per unique ticker (same dedup-by-ticker pattern as `BatchDataFetching.md`), reads `Company.sector`/`Company.industry`/`Company.exchange` in one batched query, and hands the results to the four calculator modules. Verified: the analytics test suite (calculator + risk + exposure + correlation + service + validator + routes) passes as 64 tests across 7 files, and the full backend suite (899 tests, 82 suites) passes with zero regressions to Sprints 1-13.

## Interview questions

1. *"Why four separate calculator files instead of one?"* — Each owns a genuinely different input shape: the return-series calculator needs aligned historical price data, beta needs only weights and provider-supplied betas (no historical series at all), exposure needs classification strings, and correlation is inherently pairwise. Splitting along those natural seams keeps each file's responsibility obvious from its name, and lets a change to one (e.g. a different volatility annualization assumption) never risk touching unrelated code (e.g. HHI).
2. *"What would you have to change if Athena later added a true batch historical-price provider endpoint?"* — Only `portfolio.analytics.service.js`'s fetch step (`Promise.all(uniqueTickers.map(...))` → a single batch call) - none of the four calculator modules take a provider or a ticker list as input, they take already-fetched price/weight/classification data. The calculation layer was deliberately kept ignorant of *how* its inputs were fetched.

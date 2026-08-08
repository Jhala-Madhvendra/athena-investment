# Engineering Concept: Market Data Provider Abstraction

## What it is

[market/providers/](../../backend/market/providers/) is a three-file provider abstraction, structured identically to the existing `financialStatementsProvider` (Sprint 1/2) pattern:

- `marketData.provider.js` - an abstract base class with `getQuote(ticker)` and `getHistoricalPrices(ticker, range)`, each throwing "must be implemented" if not overridden.
- `yahooMarketData.provider.js` - the concrete Yahoo implementation, calling Yahoo's `quoteSummary` and `v8/finance/chart` endpoints.
- `marketData.provider.registry.js` - a tiny factory reading `process.env.MARKET_DATA_PROVIDER` (default `"yahoo"`) and returning the matching provider instance. `market.service.js` imports this registry, never the concrete Yahoo class directly.

```js
class MarketDataProvider {
  async getQuote(ticker) {
    throw new Error("getQuote must be implemented by a market data provider.");
  }
  async getHistoricalPrices(ticker, range) {
    throw new Error("getHistoricalPrices must be implemented by a market data provider.");
  }
}
```

## Why we use it

The service layer (`market.service.js`) needs to fetch live quotes and historical prices without knowing or caring *which* upstream API supplies them. Coding directly against Yahoo's response shapes throughout the service would tie every caller to Yahoo's field names, auth scheme, and error format. The registry indirection means swapping providers (e.g. adding an Alpha Vantage or IEX provider later) is a one-file, one-class change with zero edits to `market.service.js`, `market.controller.js`, or anything downstream.

This mirrors a decision already made and validated in Sprint 1/2 for company profiles and financial statements - reusing the same shape here keeps the codebase's provider pattern consistent rather than inventing a second convention for market data.

## Alternatives considered

- **Call Yahoo directly from `market.service.js`.** Rejected for the same reason the existing financials/company providers weren't inlined into their services - it would couple business logic to one vendor's API shape and make provider failures harder to isolate and test.
- **A single shared provider class covering company profile, financial statements, and market data.** Rejected - these are three different upstream data shapes (company metadata, annual fundamentals, live price/volume series) with different refresh cadences and different consumers. Splitting them keeps each provider's interface small and each module's blast radius contained.
- **A generic HTTP-client wrapper with per-endpoint config objects.** A plausible pattern at larger scale, but for two methods (`getQuote`, `getHistoricalPrices`) it would trade a small amount of duplication for indirection that makes the actual Yahoo request logic harder to read and debug.

## Trade-offs

- **Pro:** provider swap is isolated to one new file + one registry `case` branch; existing Sprint 1-3 provider code is untouched.
- **Pro:** the abstract base class documents the contract every future provider must satisfy, and fails loudly (not silently) if a method is missing.
- **Con:** as with the existing Yahoo providers, there's still hand-rolled `fetch`-based HTTP and manual cookie/crumb auth rather than a maintained client library - `yahoo-finance2` (or similar) isn't used anywhere in this codebase, so Sprint 4 follows that existing precedent rather than introducing a new dependency for one module.

## How Athena implements it

`market.service.js` never imports `yahooMarketData.provider.js` directly - it imports `marketData.provider.registry.js`, which resolves and returns a singleton instance based on `MARKET_DATA_PROVIDER`. The concrete provider itself reuses a shared Yahoo cookie/crumb auth helper ([yahooAuth.js](../../backend/providers/yahoo/yahooAuth.js)) extracted specifically for this sprint, so the same authentication logic that already existed (duplicated) in the company and financials Yahoo providers isn't copy-pasted a third time.

## Interview questions

1. *"Why does `market.service.js` import a registry module instead of the concrete `YahooMarketDataProvider` class directly?"* - Tests understanding of dependency inversion: the service depends on an interface/contract, not a concrete implementation, so the upstream data source can change without touching business logic.
2. *"If Yahoo Finance changed its response format tomorrow, how many files would need to change in this codebase?"* - Should identify: the mapper (`yahooMarketData.mapper.js`) and possibly the provider's request-building code, but zero changes to the service, controller, or routes layers - proving the abstraction is doing its job.

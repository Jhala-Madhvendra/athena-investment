# Engineering Concept: News Provider Architecture

## What it is

`backend/news/providers/` follows the exact same abstract-base + registry pattern as `backend/providers/financialDataProvider.js` and `backend/ai/providers/llmProvider.js`: a `NewsProvider` base class declares the interface (`getNewsForTicker`, `providerName`), three concrete implementations (`YahooNewsProvider`, `MarketauxNewsProvider`, `MockNewsProvider`) each implement it against a different vendor shape, and `newsProvider.registry.js` picks exactly one at startup based on `NEWS_PROVIDER` (default `"yahoo"`). `news.service.js` depends only on the registry's single exported instance — it never imports a concrete provider directly.

## Why we use it

News, like financial data and LLM access before it, is an external dependency Athena doesn't control — vendors change terms, go down, or turn out not to fit the free tier a developer actually has access to. Coupling `news.service.js` to one vendor's response shape would mean every future provider swap touches the service, the model, and every caller. The abstraction means swapping `NEWS_PROVIDER=yahoo` for `NEWS_PROVIDER=marketaux` is a one-line env change with zero code changes anywhere else in the app.

## Alternatives considered

- **Fan out to multiple providers on every refresh and merge the results.** Rejected for this sprint — Athena's deduplication layer (`news.deduplicator.js`) already exists to handle a single provider's syndicated duplicates, and multi-provider fan-in would multiply external API calls (and cost, for the paid provider) for marginal coverage gain. The registry pattern doesn't preclude adding this later — it would be a change to `news.service.js`'s `refreshFromProvider`, not to the provider abstraction itself.
- **A single "smart" provider that internally tries Yahoo, falls back to Marketaux.** Rejected — that logic belongs in the registry/service layer if wanted, not baked into what should be a thin per-vendor adapter; keeping providers dumb and swappable was more valuable than a clever default.
- **Scraping additional websites directly.** Rejected outright per the sprint's own constraint against scraping in a way that violates a site's terms; Yahoo's `v1/finance/search` endpoint is the same unofficial-but-already-relied-upon endpoint the rest of Athena's Yahoo integration uses (`searchTickerByName`), not a new scraping surface.

## Trade-offs

- **Pro:** zero-setup default (`yahoo`, no API key) with a clear upgrade path (`marketaux`, richer fields) behind an identical interface.
- **Pro:** the mock provider (`MockNewsProvider`) makes local development and every unit test fully independent of network access or API keys, and is loud about being fake data (a `logger.warn` on startup, a `provider: "mock"` field surfaced all the way to the frontend).
- **Con:** only one provider is ever active at a time — a provider outage degrades to "serve cached articles" (see `NewsCaching.md`) rather than automatic failover to a second live provider.
- **Con:** each new provider is still hand-written glue code (a raw-shape mapper in `news.normalizer.js` plus a provider class) — there's no schema-driven adapter generation, which is the right trade for three providers but wouldn't scale gracefully to a dozen.

## How Athena implements it

`YahooNewsProvider` reuses the unauthenticated `v1/finance/search?newsCount=` endpoint (no cookie/crumb, unlike `quoteSummary`). `MarketauxNewsProvider` calls `api.marketaux.com/v1/news/all`, throwing a clear configuration error if `MARKETAUX_API_KEY` is unset rather than silently falling back. `MockNewsProvider` returns three deterministic, obviously-fake fixture articles per ticker. All three expose a `providerName` getter (mirroring `LLMProvider.modelName`) so `news.service.js` and the API response can always report which provider actually served the data, without a second lookup table.

## Interview questions

1. *"Why does Athena use the same provider-abstraction pattern for news, financial data, and the LLM, instead of three different designs?"* — Consistency has compounding value: an engineer who understands one registry (`financialDataProvider.registry.js`) already understands all three, and a future provider swap in any domain follows a known, low-risk shape instead of requiring a bespoke design each time.
2. *"What happens if Marketaux is selected but the API key is missing?"* — `MarketauxNewsProvider.getNewsForTicker` throws immediately with a message telling the operator exactly what to set or which provider to switch to instead — it never silently falls back to a different provider or returns empty data pretending nothing's wrong, which would hide a misconfiguration behind an innocuous-looking empty news list.

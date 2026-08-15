# Engineering Concept: News Normalization

## What it is

`news.normalizer.js` maps each provider's raw, vendor-specific article shape (Yahoo's `{uuid, title, publisher, link, providerPublishTime, thumbnail, relatedTickers}`, Marketaux's `{uuid, title, description, url, image_url, published_at, source, entities}`, the mock provider's already-simple shape) into one internal schema every downstream module (classifier, deduplicator, model, API response, AI context) depends on:

```js
{ title, description, url, canonicalUrl, source, author, imageUrl,
  publishedAt, retrievedAt, ticker, companyName, relatedTickers,
  provider, providerArticleId }
```

## Why we use it

Without normalization, every downstream consumer would need to know which provider produced a given article and branch on its shape — the classifier, the dedup logic, the frontend, and the AI context builder would each independently re-derive "what's the publish date field called this time." Normalizing once, at the boundary, means everything past `news.normalizer.js` is provider-agnostic.

## Alternatives considered

- **Store raw provider responses and normalize on read.** Rejected — this would mean every read path (API response, watchlist row, AI context) re-implements the same mapping, and a schema mismatch would surface far from its actual cause (a change in Yahoo's response shape would break the AI context builder, not the normalizer).
- **A generic/dynamic field-mapping config (e.g. a JSON spec per provider) instead of hand-written mapper functions.** Rejected as premature for three providers with genuinely different shapes (Yahoo has no description field at all; Marketaux's related-tickers live in a nested `entities` array) — a config-driven mapper adds a layer of indirection that would only pay off with many more providers than Athena has today.

## Trade-offs

- **Pro:** every downstream module (classifier, deduplicator, API, AI context) works against one stable shape regardless of which provider is active.
- **Pro:** missing optional fields (Yahoo has no `description`) are explicit `null`, never fabricated or silently omitted — the rest of the system can trust "this field is either the real value or `null`," never a guess.
- **Con:** a provider's raw shape changing (e.g. Yahoo renaming `providerPublishTime`) breaks silently at the mapper, not loudly at the boundary — there's no runtime schema validation of provider responses, only best-effort field access (`raw.link || null`).
- **Con:** articles missing a load-bearing field (title, url, or publishedAt) are silently dropped (`normalizeArticle` returns `null`) rather than surfaced as a data-quality warning — accepted because a partial, unusable article is worse than a smaller but complete list.

## How Athena implements it

`canonicalizeUrl` also lives here, not in the deduplicator, because it's a *normalization* concern (turning `?utm_source=twitter` link variants into one comparable form) that happens once per article regardless of which dedup tier later uses it. `toIsoDate` handles both Yahoo's unix-seconds `providerPublishTime` and Marketaux's ISO-string `published_at` into one consistent ISO string, so `publishedAt` is never a mixed type downstream.

## Interview questions

1. *"Why is canonicalUrl computed in the normalizer instead of the deduplicator that actually uses it?"* — Because canonicalization is a property of the article itself (what is its "real" URL, independent of tracking parameters), not a property of the comparison being made — computing it once at normalization time means every consumer that needs a stable URL (dedup, storage, the unique Mongo index) reads the same precomputed value instead of each recomputing it.
2. *"What happens to an article that's missing a publish date?"* — It's dropped entirely (`normalizeArticle` returns `null`, filtered out by `normalizeArticles`) rather than stored with a null `publishedAt` — Athena's freshness/sorting/filtering logic all assume `publishedAt` is a real date, and a fabricated or missing date would silently corrupt every one of those.

# Engineering Concept: News Deduplication

## What it is

`news.deduplicator.js` decides whether a newly normalized article is the same story as one Athena already has, using three tiers, cheapest and most reliable first:

1. **Same `provider` + `providerArticleId`** — both Yahoo and Marketaux supply a stable article UUID.
2. **Same `canonicalUrl`** — catches the common case of no provider ID, or the same link resurfacing.
3. **Same-day title similarity** (token-set/Jaccard overlap ≥ 0.85) — catches wire-service reprints (the same Reuters/AP story) published under different publisher URLs with no shared ID.

A match at any tier means the candidate is merged into the existing document instead of inserted as a new row: `$addToSet` onto its `tickers` array, and `$set` to re-sync `category`/`classificationConfidence` to what the classifier produces right now for that title/description - not whatever they were computed as when the row was first inserted. Classification is a pure, deterministic function of title/description (`news.classifier.js`), so re-syncing it on every merge is always safe - it can only bring a stored article's category up to date (e.g. after a keyword-list improvement), never introduce nondeterministic "flapping" between refreshes of the same story.

## Why we use it

News providers routinely return the same underlying story more than once — the same wire report re-syndicated by different publishers, or the same article resurfacing when Athena searches for a second related ticker. Without deduplication, a user's news feed would show near-identical headlines multiple times, and category counts would be inflated by the same event counted several times.

## Alternatives considered

- **Semantic/embedding-based similarity.** Explicitly rejected per the sprint's own instruction not to over-engineer this — an embedding model adds a real dependency (a vector store or an embedding API call per article) to solve a problem token-overlap already solves well enough for headlines, which are short and formulaic.
- **Exact title string match only.** Rejected — too brittle; the same story from two publishers is essentially never character-for-character identical (different phrasing, different length), so exact match would miss most real duplicates.
- **URL-only matching (no title tier at all).** Rejected — this alone misses the wire-service-reprint case, which is common enough (the same AP/Reuters story appearing on multiple financial news sites with different URLs) to be worth the extra, bounded comparison.

## Trade-offs

- **Pro:** each tier is O(1) or a small bounded scan (title similarity only compares against same-day, same-ticker candidates — not the whole collection), so dedup stays cheap even as the article count grows.
- **Pro:** merging via `$addToSet` on `tickers` rather than rejecting the duplicate means a story relevant to multiple watchlisted companies is stored once, not once per ticker — see `NewsCaching.md` for why this also matters for retention.
- **Con:** the 0.85 title-similarity threshold is a heuristic, tuned by inspection rather than a labeled dataset — a genuinely distinct story with an unusually similar headline (rare, but possible for template-style financial headlines like "X reports Q3 earnings") could be incorrectly merged. Accepted as a low-probability, low-consequence failure mode (losing one distinct headline is far less harmful than showing the same story five times).
- **Con:** dedup only runs against articles already stored for the *same ticker* at persist time (`persistArticles`'s `existingForTicker` lookup) — a story shared between two tickers that are refreshed independently can briefly exist as separate documents until both refreshes have run, though the `canonicalUrl` unique index still prevents true duplication (a race is caught and merged, not double-inserted — see the `E11000` handling in `news.service.js`).

## How Athena implements it

`findDuplicate(candidate, existingArticles)` is a pure function — no DB I/O — so it's fully unit-testable in isolation (`news.deduplicator.test.js`) and callers control what "existing" scope to check against. `news.service.js`'s `persistArticles` fetches a bounded candidate set (`NewsArticle.find({tickers: ticker})`, a handful of fields only) once per batch, then calls `findDuplicate` per incoming article, so a refresh of N new articles costs one DB read plus N in-memory comparisons, not N separate DB round-trips.

## Interview questions

1. *"Why check provider ID before URL, and URL before title similarity?"* — Reliability and cost both decrease down the list: a provider-supplied ID is a guaranteed-unique key when present, URL matching is nearly as reliable and always available, and title similarity is a heuristic fallback that should only run when the cheaper, more certain checks fail to find a match — checking it first would do unnecessary work and risk more false positives for no benefit.
2. *"What would you change if title-similarity dedup started producing too many false positives in production?"* — Raise the similarity threshold, narrow the same-day window (e.g. same-hour instead), or add a second signal (same `source`/`category`) as a required co-condition — all changes confined to `news.deduplicator.js`'s pure function, verifiable against a test suite before touching the persistence layer that calls it.

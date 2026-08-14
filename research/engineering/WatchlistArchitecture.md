# Engineering Concept: Watchlist Architecture

## What it is

Watchlist is the mirror-image data-model decision from Portfolio: **one document per user with an embedded array**, not one document per entry.

```js
// backend/watchlist/watchlist.model.js
{ userId (unique), name: "My Watchlist", companies: [{ ticker, addedAt }] }
```

Adding/removing a company is a `$push`/splice against this single document, guarded by a service-layer duplicate check (`watchlist.service.js`'s `addCompany`) rather than a database-level uniqueness constraint on the array.

## Why we use it

A watchlist entry has no independent lifecycle: a ticker is either on the list or it isn't — there's no "edit a watchlist entry" operation, unlike a portfolio holding where shares/price/date are all independently mutable. Since nothing needs a stable per-entry id to address for updates, there's no reason to pay for a separate top-level collection and its ownership-scoped queries; an embedded array on one per-user document is strictly simpler and sufficient.

## Alternatives considered

- **A separate `WatchlistEntry` collection, symmetric with `Holding`.** Rejected — this would only earn its cost if entries needed independent addressing (an id-based `PUT`/`DELETE /entries/:id`), which they don't; `DELETE /api/watchlist/:ticker` addresses an entry by its natural key (the ticker) just fine.
- **Multiple named watchlists per user** (closer to the sprint brief's own example schema, which included `name`/`description` on a per-list basis implying more than one list). Rejected for this sprint — the user story only ever describes a single "My Watchlist." The schema keeps a `name` field (defaulted to `"My Watchlist"`) specifically so relaxing the `unique` index on `userId` later, to support multiple lists, wouldn't require a schema migration — but building the UI/API for that now would be scope nobody asked for.
- **No dedicated `Watchlist` document at all — just query `Company` documents a user has "starred."** Rejected — a company's `Company` document is shared, global data (Sprint 1); tagging it as "starred by user X" would either require an embedded per-user array on a *shared* document (a correctness hazard — see UserScopedCaching.md for the same class of mistake made and caught with `WatchlistSnapshot`) or a separate join collection, which is exactly what `Watchlist` already is.

## Trade-offs

- **Pro:** listing a user's watchlist tickers is one document fetch, no join, no aggregation pipeline.
- **Pro:** duplicate prevention is a simple array scan (`companies.some(c => c.ticker === normalizedTicker)`) against a small, bounded array (personal watchlists are tens of items, not thousands).
- **Con:** the add operation is a non-atomic find-then-check-then-push-then-save, not a single atomic database operation — a real race condition exists if the same user's browser somehow fires two simultaneous "add AAPL" requests. Accepted as low-risk for this scope (no other write path in this codebase, e.g. `Company.findOneAndUpdate` upserts, is fully race-proof either), and not worth the added complexity of a conditional atomic update for a single-browser, single-user action.
- **Con:** if multi-list support is ever added, the `unique: true` index on `userId` has to be relaxed and every route needs a `watchlistId`, not just `userId` — a real (if modest) migration, not a zero-cost pivot.

## How Athena implements it

`watchlist.service.js` loads the (possibly-just-created) `Watchlist` document, checks for the ticker's presence in `companies`, and either throws `DuplicateCompanyError` (409) or pushes and saves. `WatchlistSnapshot` (used by change detection) is a genuinely separate, indexed collection — because unlike a watchlist *entry*, a snapshot's "last observed metrics" for a ticker absolutely does need independent per-(user, ticker) storage and its own compound index. See UserScopedCaching.md.

## Interview questions

1. *"Portfolio uses one document per holding; Watchlist uses one document per user with an embedded array. Isn't that inconsistent?"* — It's a deliberate, not accidental, difference — the two features have different mutation shapes. A holding is independently edited (needs its own stable id and top-level ownership-scoped queries); a watchlist entry is only ever added or removed as a whole (a ticker is present or it isn't), which an embedded array on one per-user document handles more simply. Using the same shape for both would mean choosing convenience for one feature at the cost of the other.
2. *"What breaks first if Watchlist scales to thousands of tickers per user?"* — The array-scan duplicate check (`companies.some(...)`) and the full-document read/write on every add/remove both become linear in list size — at a few thousand entries this is still fast, but a truly large watchlist would eventually want a separate collection with an index on `{userId, ticker}`, the same shape `WatchlistSnapshot` already uses. Not a concern at the personal-watchlist scale this sprint targets.

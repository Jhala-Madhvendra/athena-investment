# Engineering Concept: Portfolio Data Model

## What it is

Portfolio has exactly one persisted collection — `Holding` — with no `Portfolio` wrapper collection above it, even though the sprint brief's own suggested schema included one:

```js
// backend/portfolio/holding.model.js
{ userId, ticker, shares, averagePurchasePrice, purchaseDate, timestamps }
```

"A user's portfolio" is never fetched by id; it's always `Holding.find({ userId })`, computed and aggregated fresh in `portfolio.service.js`/`portfolio.calculator.js` on every request.

## Why we use it

A `Portfolio` document would need to justify its own existence with some field or behavior a plain query over `Holding` couldn't provide — a name, a description, multiple named portfolios per user. Nothing in the sprint's requirements needs any of that; "portfolio" is fully defined as "this user's holdings," so a wrapper collection would be indirection with zero payoff, the same reasoning DCF/Comps results already follow (computed per request, never persisted).

## Alternatives considered

- **A `Portfolio` document per user with an embedded `holdings` array** (closer to the sprint's suggested shape, and the same pattern Watchlist actually uses). Rejected specifically for Portfolio: holdings need independent CRUD (edit shares/price/date on one lot, delete one lot) with a stable id addressable by `PUT /api/portfolio/holdings/:id`. Embedded subdocuments *can* support this (Mongoose subdocuments get their own `_id`), but updating one requires positional (`$`) or `arrayFilters` update operators against the parent document, plus re-fetching/re-computing the whole array on every single-lot edit — meaningfully more complex than a plain top-level `findOneAndUpdate({_id, userId})`. See WatchlistArchitecture.md for the mirror-image case where the embedded-array shape *is* the right choice.
- **A `Portfolio` wrapper with a `Holding[]` array of references** (normalized, but still a wrapper). Rejected — it adds a document to keep in sync (holdings added/removed independently would need the wrapper's reference array updated too) for no benefit over `find({userId})`, which needs no synchronization at all.

## Trade-offs

- **Pro:** every holding CRUD operation is a single, ownership-scoped query against one flat collection — no nested-document update complexity, no synchronization between a wrapper and its children.
- **Pro:** matches the sprint's existing precedent that derived/aggregate data (DCF, Comps, and now portfolio summaries) is computed on read, not stored.
- **Con:** listing a portfolio costs one query plus one live-price fetch per unique ticker, versus a single document fetch if everything were embedded — negligible at the list sizes a personal portfolio actually has (see BatchDataFetching.md).
- **Con:** there's no natural place to hang portfolio-level metadata (a name, multiple portfolios per user) if that's ever wanted — would require introducing the wrapper collection this design currently avoids. An acceptable trade for not over-building for a feature nobody asked for.

## How Athena implements it

`holding.model.js` has a `userId` index (not unique — a user can have many holdings) and no uniqueness constraint on `{userId, ticker}`, unlike Watchlist — duplicate tickers are allowed by design (dollar-cost averaging is normal), and `portfolio.calculator.js`'s `groupByTicker()` nets them for weighting/concentration purposes without needing them deduplicated at the storage layer.

## Interview questions

1. *"The sprint's own example schema suggested a `Portfolio` wrapper — why deviate from it?"* — The instructions explicitly say to inspect the existing architecture and avoid redundant collections where a better design exists, and to treat the suggested schemas as examples, not requirements. Since nothing in the actual requirements needs portfolio-level fields, the wrapper would be redundant indirection.
2. *"If Athena later needs multiple named portfolios per user (e.g. 'Retirement' vs 'Taxable'), what changes?"* — Add a `portfolioId` (or a `Portfolio` collection reference) to `Holding`, default every existing holding to an implicit "default" portfolio via a migration, and scope queries by `{userId, portfolioId}` instead of just `{userId}`. The current design doesn't block this extension; it just doesn't pay its cost upfront for a feature that isn't needed yet.

## Related: the Transaction ledger (Sprint 15)

Sprint 15 added a second collection, `Transaction` (`backend/portfolio/transaction.model.js`), scoped by `userId` the same way `Holding` is — Athena still has no `Portfolio` wrapper, so a transaction's `portfolioId` (as the sprint brief phrased it) is just `userId` here too, for the exact reasoning above. `Transaction` is deliberately **not** synchronized with `Holding`: creating a `Holding` doesn't write a `Transaction` and vice versa. They're two independent, additive inputs — `Holding` still drives the current portfolio (Sprint 9, unchanged), and `Transaction` exists purely so historical holdings can be reconstructed by replay. See PortfolioCalculationAssumptions.md's "Transaction-aware historical reconstruction" section for why they aren't merged into one model and what that means for a user who only records one of the two.

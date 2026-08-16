# Engineering Concept: The Reference Universe

## What it is

`backend/industry/industry.peerDiscovery.js`'s `resolveReferenceUniverse()` determines *which companies* a target is benchmarked against: same-`industry` companies already tracked in Athena's `Company` collection that also have imported financial statements, falling back to the broader `sector` when too few match. The result always states its `level` (`"industry"` | `"sector"` | `"none"`), its `key` (the actual sector/industry string used), its `size`, and a human-readable `note` explaining the fallback if one occurred.

## Why we use it

Athena has no external "give me every company in this industry" data source — the only companies it knows about are ones a user has previously searched or imported (the exact limitation `PeerSelection.md` already documents for Sprint 7's Comps). Presenting that partial set as if it were a complete industry census would be actively misleading, so `resolveReferenceUniverse()`'s entire design is built around being explicit about what it actually has, rather than dressing up a small database query as "the industry."

## Alternatives considered

- **Calling an external market-data API for a complete industry constituent list.** Rejected for this version — no such provider abstraction exists in Athena today, and the sprint brief explicitly says not to invent a new external dependency without inspecting what's realistically available first (none of Athena's existing providers expose industry constituent lists).
- **Always using the `sector` level (broader, more likely to have enough companies).** Rejected — sector is a much coarser grouping ("Technology" spans everything from semiconductors to social media), and defaulting to it would produce noisier, less meaningful benchmarks whenever the finer `industry` grouping would have been sufficient.
- **Silently using whatever companies happen to be available, without stating the level or size.** Rejected — this is exactly the "industry average" overclaim the sprint brief explicitly warns against. Every response states its reference set.

## Trade-offs

**For "industry with a sector fallback, both stated explicitly":** the API response is slightly more complex (a `universe` object with `level`/`key`/`size`/`note`, not just a flat list of peers) than a version that silently returned whatever it found — but the frontend can render the exact caveat a reader needs ("computed at the broader sector level because fewer than 4 tracked companies share this exact industry") instead of presenting a sector-level result with industry-level confidence.

**Against it:** for a niche industry with very few tracked companies, the fallback can still land on `"none"` — a real, if honest, dead end. Athena doesn't invent companies to fill the gap; the sprint brief is explicit that a small universe should be reported as insufficient, not padded.

## How Athena implements it

`resolveReferenceUniverse(targetTicker)` queries `Company` for `industry`-matching and `sector`-matching candidates in parallel (capped at `MAX_UNIVERSE_SIZE * 2` each, to bound the query), then filters both pools to companies with at least one imported `FinancialStatement` via a single batched `FinancialStatement.distinct("ticker", {...})` call (not one query per candidate). If the industry-level filtered set meets `MIN_UNIVERSE_SIZE` (4, imported from `industry.benchmark.js` so the two modules never disagree about the threshold), it's used as-is; otherwise the sector-level set is used if *it* meets the threshold; otherwise Athena reports whichever pool is larger as a best-effort, explicitly marked below the minimum.

## Interview questions

1. *"Why does the reference universe require imported financial statements, not just a matching sector/industry label?"* — A company with only a name/ticker/sector label but no financial statements has nothing to contribute to a margin, growth, or ROE benchmark — including it would either silently skew the count or require every downstream calculation to handle a company with no usable data. Filtering at the universe-resolution step keeps every later step simpler.
2. *"What happens if a target company has a sector but no industry classification at all?"* — The industry-level pool is empty (querying `Company.find({industry: null, ...})` would be meaningless), so the sector-level pool is used if it meets the minimum, otherwise the universe is reported as `"none"` — Athena never fabricates an industry label to avoid this outcome.
3. *"Why is `MIN_UNIVERSE_SIZE` imported from `industry.benchmark.js` into `industry.peerDiscovery.js`, rather than each module defining its own constant?"* — So universe resolution and per-metric statistical gating always agree about what counts as "enough companies" — two independently-defined thresholds for the same underlying question would risk silent drift (e.g., a universe reported as sufficient at the resolution step but then immediately marked insufficient at the statistics step for an unrelated reason).

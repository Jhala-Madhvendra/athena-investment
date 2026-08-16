# Engineering Concept: Peer Discovery (Industry Intelligence)

## What it is

`backend/industry/industry.peerDiscovery.js`'s `rankByMarketCapProximity()` ranks the reference universe (see `ReferenceUniverse.md`) by closeness to the target's market cap, producing "Potential Peers" — suggestions surfaced on the Industry page and exposed via `GET /api/industry/:ticker/peers`. It is deliberately distinct from, and does not modify, Sprint 7's `comps.peerSelector.js`.

## Why we use it

Sprint 7 established that Athena has no genuine business-model-similarity scoring engine (see `research/finance/PeerSelection.md`), and deliberately kept Comps peer selection entirely user-controlled as a result. Industry Intelligence needed a lighter-weight, ranked shortlist for a different purpose — narrowing an already-computed reference universe down to a handful of the most plausible comps candidates — without either duplicating Comps' "browse everything" behavior or overstepping into an unearned "these are your comps" recommendation.

## Alternatives considered

- **Reusing `comps.peerSelector.js`'s candidate list as-is.** Rejected — that endpoint intentionally returns *every* company Athena knows about (a browsing list for a human to search through), not a ranked, industry-matched shortlist. Reusing it directly would mean re-deriving the sector/market-cap ranking logic at the call site anyway.
- **A genuine similarity-scoring algorithm** (weighting sector match, revenue scale, geography, growth profile into one score). Rejected for the same reason Sprint 7 rejected it — Athena's data (sector/industry strings, market cap, revenue) is too coarse to make a composite score trustworthy, and a wrong ranking presented with algorithmic confidence is worse than a simple, explainable one.
- **Auto-populating the Comps peer set with the top-ranked suggestions.** Rejected outright — the sprint brief is explicit that potential peers must never automatically become the Comps peer set. Selecting "Use for Comparable Analysis" only pre-fills the Comps picker via navigation state; the user still has to review and explicitly click Calculate (see `ComparableCompanies.jsx`'s handling of `location.state.suggestedPeer`).

## Trade-offs

**For market-cap-proximity ranking:** it's simple, explainable, and mirrors a heuristic Athena already trusted internally — `ai.contextBuilder.js`'s private `selectAutoPeers()` (built for Sprint 8's AI report context) uses the identical "same sector, closest market cap" logic. Reusing a proven, already-shipped heuristic pattern for a second, now-public purpose was lower-risk than inventing a new ranking signal.

**Against it:** market-cap proximity is a rough proxy for comparability — two companies can have near-identical market caps and still be poor comps (different growth stage, different margin structure). This is the same caveat Sprint 7's peer browsing already carries, and it's why the "Potential Peers" limitation notice explicitly tells the user to review sector, industry, market cap, and financials themselves before treating a suggestion as a genuine peer.

## How Athena implements it

`rankByMarketCapProximity(target, candidates, limit)` is a pure function — sorts the reference universe by `|candidate.marketCap - target.marketCap|` (missing market caps sort to the end rather than crashing) and slices to `limit` (default `SUGGESTED_PEERS_LIMIT = 10`). It's exported standalone, not only used internally, specifically so a future automatic-peer-selection system (or a refactored `ai.contextBuilder.js`) could reuse the exact same ranking logic without duplicating it — see Section "Future integration" below. `GET /api/industry/:ticker/peers` reuses the same cached universe bundle `GET /api/industry/:ticker` builds (see `BenchmarkCaching.md`), so requesting peer suggestions after already viewing the Industry page costs no extra financial-statement or quote fetches.

## Future integration (documented now, not built)

The sprint brief explicitly asks how Industry Intelligence's peer discovery could integrate with a *future* automatic peer-selection system, without building that system now. Because `rankByMarketCapProximity()` is a pure, standalone function operating on the same universe-member shape `industry.calculator.buildCompanyMetricBundle()` already produces, a future system could call it directly to seed a default Comps peer set (with the user still able to override it) — no interface change would be required. Nothing in this sprint changes `comps.peerSelector.js`, `comps.validator.js`, or `ai.contextBuilder.js`'s own `selectAutoPeers()` — this is deliberately additive, not a replacement.

## Interview questions

1. *"Why does Industry Intelligence need its own peer-ranking logic when Sprint 7 already has peer discovery?"* — They answer different questions for different audiences. Sprint 7's `comps.peerSelector.js` is a search/browse tool for a human building a Comps calculation (broad, unranked, exhaustive). Industry Intelligence's peer discovery is a narrow, ranked shortlist meant to be immediately useful without further searching (top N by proximity within an already-resolved reference universe).
2. *"Why does `rankByMarketCapProximity()` mirror `ai.contextBuilder.js`'s existing `selectAutoPeers()` instead of being built from scratch?"* — Reusing a heuristic Athena had already shipped and implicitly validated (it's been powering Sprint 8's AI report peer selection) was lower-risk than inventing a new ranking signal for a now user-facing feature — same proven logic, now exposed as a standalone, testable, reusable function instead of staying private to one caller.
3. *"What would you need to change if a future team wanted 'Potential Peers' to auto-populate the Comps peer set by default?"* — Nothing in `industry.peerDiscovery.js` itself — `rankByMarketCapProximity()` is already a pure function any caller can invoke. The change would be entirely in the *product* decision (and the corresponding UI/UX) of whether to pre-select those suggestions rather than just suggest them, which the current sprint deliberately does not do.

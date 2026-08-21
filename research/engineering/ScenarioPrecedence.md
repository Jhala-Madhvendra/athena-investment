# Scenario Precedence

## Definition

The explicit rule that decides which single scenario rule governs a holding when more than one rule matches it — Asset > Industry > Sector > Market > Portfolio-wide, most to least specific. Implemented as `PRECEDENCE_RANK` in `backend/portfolio/portfolio.scenario.resolver.js`; a holding is never affected by more than one rule's shock at once.

## Why it exists

The sprint brief describes a real, common overlap case directly: a Technology sector shock and an AAPL-specific shock in the same scenario, where AAPL is a Technology holding. Without an explicit precedence rule, an implementation has to choose *some* behavior for this case — and the two naive choices (stack the shocks additively, or multiply them) both silently double-count the same underlying risk exposure through two different rules, producing a number that looks precise but overstates the modeled impact in a way that's invisible to the user. Precedence exists to make the choice explicit, documented, and the same every time, rather than an implementation accident.

## Alternatives considered

- **Additive stacking** (`-20% + -30% = -50%` for AAPL) — rejected: the sector shock and the asset shock are both claims about the *same* holding's price move, not independent, compounding effects; adding them treats one risk exposure as if it were two.
- **Multiplicative stacking** (`(1-0.20)(1-0.30) - 1 ≈ -44%`) — rejected for the same reason, plus it has no clean economic interpretation for a single holding under two simultaneous single-factor shocks (multiplicative combination makes sense for genuinely independent, sequential events — a sector shock and an asset-specific shock describing the *same* holding at the *same* moment are neither).
- **Last-rule-wins (order of entry)** — rejected: makes the result depend on the arbitrary order a user happened to type rules into the builder, an implementation detail that shouldn't matter, and impossible to reason about from the rule list alone.
- **Most-specific-wins (chosen)** — a holding-specific rule is a more targeted, presumably more informed claim about that exact holding than a broad sector/market rule; specificity is a principled, order-independent tiebreak a user can predict just by reading their own rule list.

## Athena implementation

`PRECEDENCE_RANK = { ASSET: 0, INDUSTRY: 1, SECTOR: 2, MARKET: 3, PORTFOLIO: 4 }` (lower = more specific = wins). Industry outranks Sector specifically because Athena's `Company` model (Sprint 13) carries them as two independent free-text fields where industry is always the finer-grained label (e.g. sector "Technology", industry "Consumer Electronics") — more specific still beats less specific, consistent with the rest of the ordering. `resolveHoldingRule()` collects every rule matching a holding, sorts by `PRECEDENCE_RANK`, and picks the first one that can actually be evaluated (see the MARKET/beta case below) — losers are recorded in `overriddenRules`, never silently discarded, so "which rule affected this holding, and what else would have applied" is always answerable from the API response.

A second, genuinely distinct case is handled separately: a MARKET rule matches every holding, but its effective shock (`holding.beta × rule.shockPercent`) is undefined for a holding with no known beta. This isn't a precedence loss (the rule wasn't outranked, it simply couldn't be computed) — so it's tracked in a separate `unevaluableRules` list, and resolution falls through to the next-lower-precedence rule that *can* be evaluated (typically PORTFOLIO, if present). Conflating "lost on precedence" with "couldn't be evaluated" would hide a real data gap (missing beta) behind what looks like an ordinary ranking outcome.

## Testing strategy

`portfolio.scenario.resolver.test.js` asserts precedence directly and by name for every pairwise combination the sprint brief calls out: asset-overrides-sector, sector-overrides-market, and the full ASSET > INDUSTRY > SECTOR > MARKET > PORTFOLIO ordering as a standalone assertion (`PRECEDENCE_RANK` comparisons). A dedicated test proves overlapping shocks are neither summed nor multiplied — asserting the resolved value equals the winning rule's shock exactly, and explicitly *not* equal to either the additive or multiplicative combination. The MARKET/beta-unavailable fallthrough has its own tests distinguishing `overriddenRules` (empty in that case) from `unevaluableRules` (containing the MARKET rule) — the exact distinction the module's design is built around.

## Interview questions

1. **"Why does an asset-specific shock override a sector shock instead of both applying?"** — Because both rules are claims about the same holding's price move at the same moment, not two independent, additive effects — applying both would double-count a single underlying risk exposure. The more specific claim (this exact holding) is treated as the more informed one and wins outright; the less specific rule still applies to every *other* holding in that sector.
2. **"How does Athena distinguish a rule that lost on precedence from one that simply couldn't be evaluated?"** — Two separate output lists: `overriddenRules` (the rule matched and could be computed, but a more specific rule won) versus `unevaluableRules` (the rule matched but had no usable input — currently only a MARKET rule with unknown beta). Merging them would hide a real data gap (missing beta) behind what looks like an ordinary precedence outcome, when the caller actually needs to know which situation occurred.
3. **"If Athena added a new, more specific targetType than ASSET (say, a specific tax lot), where would it rank?"** — Above ASSET (rank 0 shifts down, everything else's numeric rank shifts accordingly) — the ordering is a single exported constant precisely so a new, more specific level slots in without touching the matching or calculation logic elsewhere in the engine.

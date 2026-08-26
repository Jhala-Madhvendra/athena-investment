# Future Data Model

## What it is

A classification of every candidate entity the Sprint 19 brief proposed (`InvestmentThesis`, `InvestmentDecision`, `Goal`, `PortfolioTarget`, `RebalancePlan`, `Dividend`, `CorporateAction`, `TaxLot`, `JournalEntry`, `ResearchNote`) into NOW / LATER / MAYBE / UNNECESSARY, plus the reasoning behind each call. No entity below is implemented in Sprint 19 — this is design classification only.

## Classification

| Entity | Classification | Why |
|---|---|---|
| `InvestmentDecision` (absorbing `InvestmentThesis` — see below) | **NOW** (Phase 2 target, not built this sprint) | The single largest identified gap (`ProductPillars.md`, Pillar 2). Cheap relative to its value: no new calculation engine, just a record citing existing evidence. |
| `Dividend` | **LATER** (Phase 3) | Real gap in Manage pillar, but requires either a new provider data source or user-entry UX not yet designed — bigger scope than Phase 2's Decision record. |
| `CorporateAction` (splits, spin-offs) | **LATER** (Phase 3) | Same reasoning as Dividend — genuinely needed for portfolio accuracy over time, but not urgent relative to Decide. |
| `TaxLot` (FIFO/LIFO accounting) | **LATER** (Phase 3, possibly later within it) | `Holding` already functions as a lot (one document per purchase), so the *storage* half of this exists — what's missing is FIFO/LIFO *matching logic* on sale, which is a nontrivial calculation problem explicitly out of scope per `PortfolioCalculationAssumptions.md`'s own non-goals list. Worth doing eventually; not urgent for the primary user's current stated needs. |
| `Goal` / `PortfolioTarget` | **MAYBE**, leaning Phase 6 | Blocked on two things: Phase 3's cash-ledger (a goal's "progress" is dishonest without knowing what was actually contributed) and the identity system (a goal a user can lose by clearing a browser is a bad goal product). Building it before either exists would produce a feature that *looks* done but computes something misleading. |
| `RebalancePlan` | **LATER** (Phase 6) | Depends on `PortfolioTarget` existing first — a rebalance plan is meaningless without a target to rebalance toward. Can reuse the existing Scenario engine's precedence-resolution logic once built. |
| `JournalEntry` | **UNNECESSARY as a separate entity** | Evaluated and rejected as its own collection — see "Why not a separate JournalEntry" below. Its function is absorbed into `InvestmentDecision` plus Phase 5's Review views over it. |
| `ResearchNote` | **MAYBE** | A persistent "notes on this company, independent of any decision" concept has real value (the Research pillar currently has no memory at all beyond Watchlist membership), but isn't validated as needed yet, and risks becoming a second place reasoning lives, competing with `InvestmentDecision`'s thesis field. Revisit once Decide ships and it's clear whether users want to jot notes on companies they haven't yet formed a decision about. |
| `Scenario` (persisted) | **MAYBE**, already repeatedly deferred | `AdvancedScenarioProductDesign.md` Section 8 already declined to build this three sprints running, pending validated need. No new argument in Sprint 19 changes that — still correct to wait for usage signal. |
| `Portfolio` (wrapper collection) | **UNNECESSARY**, until multi-portfolio is actually prioritized | `PortfolioDataModel.md` already made this exact call and documented the trigger for reversing it ("if Athena later needs multiple named portfolios..."). That trigger hasn't fired. Re-affirmed here, not re-litigated. |

## Why `InvestmentThesis` and `InvestmentDecision` should be one entity, not two

The Sprint 19 brief lists both as separate pillar-2 capabilities. Splitting them would create exactly the kind of duplicated-concept risk `ProductPillars.md` warns about: a thesis ("I think this company is undervalued because...") and a decision ("I bought 10 shares because...") are the same act of reasoning at two different levels of commitment, not two different facts. Modeling them as one entity with an optional `action` (a thesis with no attached BUY/SELL is a pure research conviction; one with an action attached is a decision) avoids a user having to maintain two parallel records that describe the same reasoning. See `research/finance/InvestmentDecisionFramework.md` for the resulting minimum viable field set.

## Why not a separate `JournalEntry`

A journal entry, in the brief's own framing, is "reflection on a decision over time" — but that's exactly what an `InvestmentDecision` plus a later `outcomeReview` sub-document (added when Phase 5 ships, not now) already covers. A separate `JournalEntry` collection would need its own reference back to the Decision it's about, its own CRUD surface, and its own UI — for content that's structurally "more text about a Decision that already exists." This is the same reasoning `PortfolioDataModel.md` used to reject a `Portfolio` wrapper collection: a new collection needs to justify its existence with something a field on an existing document can't provide, and nothing here clears that bar. If Phase 5 usage reveals a real need for journaling *not* tied to any specific decision (a general market-observation diary), that's a distinct, smaller, and separately-justified feature — not a reason to build it speculatively now.

## Portfolio model — architectural gaps (evaluated per the brief's own checklist)

| Capability | Exists today? | Gap severity |
|---|---|---|
| Holdings | Yes | — |
| Transactions | Yes | — |
| Cash | No | High — blocks true TWR, blocks Goals |
| Dividends | No | Medium — real but not urgent |
| Corporate actions | No | Medium |
| Cost basis | Yes (`averagePurchasePrice`) | — |
| Tax lots (FIFO/LIFO matching) | Partial (lot storage yes, matching logic no) | Medium |
| Portfolio targets | No | Low urgency until Goals prioritized |
| Goals | No | Low urgency until Phase 3 lands |
| Benchmark comparison | Partial (beta only, no "vs. index total return" line) | Medium |
| Historical composition | Yes (transaction-aware reconstruction) | — |
| Performance attribution | No (no per-holding contribution-to-return breakdown) | Medium — natural Phase 3/5 extension, reuses Scenario's attribution pattern (`ScenarioAttributionEngine.md`) applied to actual historical returns instead of hypothetical shocks |

## Research model — conceptual design (not built)

The brief's proposed shape (`Research Workspace → Company → Notes → Thesis → Assumptions → Scenarios → Decision → Outcome`) is more hierarchy than Athena needs right now. The simpler, actually-justified version:

- **One unified entity** (`InvestmentDecision`), not several — for the reasons above.
- **Referenced, not embedded**, evidence: a Decision stores a *reference plus snapshot* (ticker, DCF value at decision time, Comps range at decision time — see `DataOwnership.md`'s snapshot reasoning) rather than embedding full DCF/Comps documents. This keeps the Decision document small and keeps DCF/Comps' own "never persist" rule intact — only the *pointer and the numbers that mattered* get captured, not the full calculation.
- **Scenarios stay unreferenced** unless a specific scenario run directly informed the decision, in which case the same snapshot pattern applies (store the scenario's headline result, not a live reference to an unpersisted computation that no longer exists).

**Trade-off accepted:** a Decision's snapshot evidence can go stale relative to a freshly recomputed DCF — this is intentional (see `DataOwnership.md`), not a bug to fix later.

## Interview questions

1. *"Why classify `Goal` as MAYBE instead of committing to Phase 6 now?"* — Because its dependencies (cash-ledger, identity upgrade) aren't guaranteed to land in the form assumed here — if Phase 3 takes a different shape than expected, Goal's design would need to change with it. Classifying it MAYBE keeps the roadmap honest about a real dependency chain rather than pre-committing to a design that might not fit its own prerequisites.
2. *"Isn't merging Thesis and Decision just avoiding work now that you'll have to redo later if they turn out to need different shapes?"* — The reverse risk is worse: shipping two entities that describe the same reasoning invites exactly the confusion `WatchlistVsPortfolio.md` warns about for a different pair of concepts — two records that can drift out of sync describing what should be one continuous thought. If real usage later shows a genuine need to separate "pure research conviction" from "acted-on decision," that's an additive schema change (an optional `action` field going from populated to the record's only distinguishing trait), not a redesign.

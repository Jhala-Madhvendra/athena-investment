# Future Roadmap

## Phase structure

| Phase | Focus | Status |
|---|---|---|
| 1 | Financial Intelligence | Done — Sprints 1–18 |
| 2 | Investment Research & Decision | Recommended next |
| 3 | Portfolio Management depth | Depends on Phase 2 existing (Decide records should be able to cite Manage transactions) |
| 4 | Monitoring & Workflow | Depends on Phase 3 (thesis-relevant alerts need Decide records to reference) and an identity upgrade (for any real notification delivery) |
| 5 | Learning & Decision Review | Depends on Phase 2 (nothing to review without decisions) and ideally Phase 3 (outcome comparison is stronger with real cash/dividend accounting) |
| 6 | Advanced Platform Capabilities | Depends on Phase 3 (Goals need cash-flow data) and Phase 2 (Rebalancing simulation is more useful once tied to a stated target from a Decision/Goal) |

This is a dependency chain, not a fixed calendar — Phase 3 doesn't have to wait for Phase 2 to fully ship before starting design work, but a phase's *user-facing* value is genuinely gated on its dependencies existing, so shipping order should follow this sequence.

---

## Phase 2 — Investment Research & Decision (sprint-level detail)

### Sprint 20: Investment Decision — Minimal Thesis & Decision Record
- **Product goal:** close the single largest gap identified in Sprint 19 — no persistent record of investment reasoning.
- **User problem:** "I did the DCF work, formed a view, then acted on it — and three months later I can't remember why I thought what I thought."
- **Major functionality:** `InvestmentDecision` create/read/list, citing existing DCF/Comps/Scenario outputs as evidence fields (not recomputing them). See `research/finance/InvestmentDecisionFramework.md` for the minimum viable field set.
- **Dependencies:** none new — reuses DCF/Comps/Scenario engines and the existing anonymous-token identity model.
- **New data models:** `InvestmentDecision` (see `FutureDataModel.md`).
- **Engineering complexity:** Low-medium — mostly CRUD plus an evidence-reference pattern already proven by `AiResearchReport`'s `sectionEvidence` field.
- **Product value:** High — this is the pillar with zero current coverage and the clearest path to differentiation.
- **Why here:** Research is mature enough to cite; nothing else blocks it.

### Sprint 21: Decision List & Watchlist/Portfolio Cross-Linking
- **Product goal:** make recorded decisions visible where a user already looks (Company Dashboard, Watchlist row, Portfolio holding row).
- **User problem:** a decision record nobody revisits provides no value — it needs to surface at the moments a user is already looking at the related ticker.
- **Major functionality:** "Past decisions on this ticker" panel; a decision can optionally reference a specific `Transaction`.
- **Dependencies:** Sprint 20.
- **New data models:** none (adds a reference field, not a new collection).
- **Engineering complexity:** Low — presentation and query work, no new calculation.
- **Product value:** Medium-high — this is what makes Sprint 20's record actually get looked at again.
- **Why here:** a decision record with no surfacing is dead data; this closes that risk immediately rather than letting it accumulate unused.

### Sprint 22: Decision Confidence & Assumption Tracking
- **Product goal:** let a user record *what would have to be true* for their thesis to hold, not just the thesis text.
- **User problem:** a thesis written as prose is hard to check against reality later; a thesis with explicit, named assumptions ("revenue growth stays above 15%") is checkable.
- **Major functionality:** structured `keyAssumptions` field, editable, distinct from free-text reasoning.
- **Dependencies:** Sprint 20.
- **New data models:** extends `InvestmentDecision`, no new collection.
- **Engineering complexity:** Low.
- **Product value:** Medium — sets up Phase 5's review work to be about specific, checkable claims rather than vague prose re-reading.
- **Why here:** cheap to add now, expensive to retrofit onto decisions already recorded without it.

---

## Phase 3 — Portfolio Management Depth (phase-level)

- **Focus:** cash ledger, dividends, corporate actions, tax lots, multi-portfolio support.
- **Major functionality:** deposit/withdrawal tracking (unlocks true time-weighted return, currently explicitly not computed per `PortfolioCalculationAssumptions.md`), dividend recording, stock-split adjustment, `portfolioId` added to `Holding`/`Transaction` for multi-portfolio.
- **New data models:** `Dividend`, `CorporateAction`, `TaxLot` (or lot-level fields on `Transaction`), optional `Portfolio` wrapper (only once multi-portfolio is actually being built — see `FutureDataModel.md`'s reasoning for why this stays UNNECESSARY until then).
- **Engineering complexity:** Medium-high — cash-flow-aware return calculation is a genuinely harder problem than the current "exclude transaction days" approach (`PortfolioCalculationAssumptions.md`'s documented limitation).
- **Product value:** High for the Manage pillar specifically, and a hard prerequisite for Phase 6's Goals.
- **Why here:** this is bookkeeping depth Athena has explicitly deferred four sprints running (Sprints 9, 14, 15, 16) — it's due, but only after Decide (Phase 2) since Decide is the bigger current gap and doesn't depend on Phase 3.

## Phase 4 — Monitoring & Workflow (phase-level)

- **Focus:** turn Alerts from pull-triggered to push-capable, and make alerts thesis-aware.
- **Major functionality:** a scheduler (cheapest version: cron calling the existing `runMonitoring` function, per `ScheduledMonitoring.md`'s own documented next step), notification delivery (email at minimum), and a new alert category checking whether a Decision's stated key assumptions (Sprint 22) still hold.
- **Dependencies:** Phase 2 (thesis-aware alerts need Decisions to exist) and an identity upgrade (delivering a notification requires somewhere to deliver it — the current anonymous bearer token has no email address).
- **New data models:** none required for the scheduler itself; thesis-aware alerts reuse `InvestmentDecision`.
- **Engineering complexity:** Medium — the detection logic is proven (Alert Engine already works), the new work is scheduling infrastructure and identity, both genuinely new categories of complexity for this codebase.
- **Product value:** High — this is the single biggest lever on retention (a user who isn't in the app right now currently gets zero value from Alerts).
- **Why here:** deliberately not Phase 1 or 2 — `IntelligentAlertsProductDesign.md` Section 6 already argued notifications require "a real identity system Athena doesn't have yet," and that's still true. Sequencing it after Decide means the identity upgrade (a real, non-trivial project) is justified by two features needing it (notifications AND cross-device thesis persistence), not one.

## Phase 5 — Learning & Decision Review (phase-level)

- **Focus:** compare recorded decisions against actual outcomes; surface patterns across a user's own decision history.
- **Major functionality:** "Review" view showing a past Decision alongside what actually happened (price, return, whether stated key assumptions held); aggregate pattern surfacing ("your decisions citing DCF undervaluation >20% have outperformed your average") — deterministic aggregation, AI narration optional and clearly secondary.
- **Dependencies:** Phase 2 (decisions must exist), benefits from Phase 3 (real return accounting makes "did this work out" more honest).
- **New data models:** none required if Decision already stores enough (expected holding period, key assumptions) — this phase is mostly new *queries and views* over Phase 2's data, not new persisted entities. A `JournalEntry` collection is evaluated and rejected in favor of extending `InvestmentDecision` — see `FutureDataModel.md`.
- **Engineering complexity:** Medium — the comparison logic (decision-time value vs. current value, assumption-held vs. not) is new, but reuses existing market-data and portfolio-history infrastructure.
- **Product value:** High — this is the pillar with zero current existence and the clearest source of genuinely personal, non-generic insight.
- **Why here:** cannot start meaningfully earlier; there's nothing to review.

## Phase 6 — Advanced Platform Capabilities (phase-level)

- **Focus:** Goals, Rebalancing simulation, comparison-level AI explanation, cross-portfolio/watchlist synthesis.
- **Major functionality:** `Goal`/`PortfolioTarget` entities; a rebalancing view that reuses the existing Scenario engine to show "if I moved toward this target, how would risk/exposure change" (deliberately framed as simulation, never a recommendation, per `ProductBoundaries.md`); `/compare` scenario AI explanation (already identified as a natural, low-risk extension in `AdvancedScenarioProductDesign.md` Section 4 and `ScenarioExplanationProductDesign.md` Section 4).
- **Dependencies:** Phase 3 (Goals need real cash-flow data to compute honest progress) and Phase 2 (a rebalance target is more meaningful when tied to a stated Decision or Goal, not an arbitrary number).
- **New data models:** `Goal`, `PortfolioTarget`, `RebalancePlan`.
- **Engineering complexity:** High — Goals and Rebalancing are each non-trivial calculation problems (goal-progress math needs contribution accounting; rebalancing needs to reuse Scenario's precedence-resolution logic against a target rather than a shock).
- **Product value:** Medium-high, but lower urgency than Phases 2–5 — these are genuine platform capabilities, not gap-closing.
- **Why here:** every other phase is either a bigger current gap (Decide, Learn) or a hard technical prerequisite (Phase 3's cash ledger, Phase 4's identity upgrade) for these specific features to be honest rather than superficial.

---

## Prioritization framework

Each phase scored 1 (low) – 5 (high) on: User value, Strategic importance, Technical feasibility (given current infra), Reuse of existing Athena infrastructure, Data availability, Complexity (inverse — 5 = low complexity), Differentiation.

| Phase | User value | Strategic | Feasibility | Reuse | Data availability | Complexity (inverse) | Differentiation | Total |
|---|---|---|---|---|---|---|---|---|
| 2 — Decide | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** |
| 3 — Manage depth | 4 | 3 | 3 | 4 | 3 | 2 | 2 | 21 |
| 4 — Monitoring push | 4 | 3 | 2 | 4 | 3 | 2 | 2 | 20 |
| 5 — Learn | 5 | 4 | 3 | 3 | 2 | 3 | 5 | 25 |
| 6 — Advanced | 3 | 2 | 2 | 3 | 2 | 1 | 3 | 16 |

**TOP PRIORITY:** Phase 2 (Decide). **MEDIUM PRIORITY:** Phase 5 (Learn), Phase 3 (Manage depth). **LATER:** Phase 4 (Monitoring push), Phase 6 (Advanced). **DO NOT BUILD:** anything under `ProductBoundaries.md`'s "avoid" column (brokerage execution, tax filing, automated trading, generic chatbot, budgeting tracker).

Note Phase 5 scores higher in total than Phase 3 or 4 despite being sequenced later — it's gated by a hard dependency (Phase 2 must ship first), not by lower priority. Score and sequence are different questions; this table answers the first, the phase table above answers the second.

# Sprint 19 Reflection — Platform Expansion & Product Architecture

## What was built

No code. This sprint's entire deliverable is architecture and product strategy: a full inspection of the existing system (12 MongoDB collections, 18 backend feature-verticals, the complete frontend page/nav structure, and the 182-file `research/` corpus already documenting 18 prior sprints' reasoning), followed by ten new documents:

- `research/product/AthenaProductVision.md` — north star, primary/secondary/excluded users, competitive positioning, v1/v2/v3 framing
- `research/product/ProductPillars.md` — Research/Decide/Manage/Learn, mapped against existing modules
- `research/product/UserJourneys.md` — five journeys, each marked exists-vs-gap step by step
- `research/product/ProductBoundaries.md` — what Athena will never become, and why
- `research/product/FutureRoadmap.md` — six phases, sprint-level detail for Phase 2, a scoring table for prioritization
- `research/engineering/FutureArchitecture.md` — the layered conceptual architecture and where AI sits in it
- `research/engineering/DataOwnership.md` — a single source-of-truth table across all current and near-future entities
- `research/engineering/FutureDataModel.md` — NOW/LATER/MAYBE/UNNECESSARY classification for every candidate entity
- `research/finance/InvestmentDecisionFramework.md` — the minimum viable Decision record model
- This document

## The central finding

Athena is a deep **Research** platform with a substantial **Manage** module, and almost nothing in **Decide** or **Learn**. This wasn't obvious from inside any single sprint — each of the 18 prior sprints was individually well-scoped and well-justified — but became obvious the moment the four pillars were laid over the existing module inventory: 10 mature Research capabilities and 5 substantial Manage capabilities, against essentially zero Decide capabilities and zero Learn capabilities. Two independent checks arrived at the same conclusion from different angles — the module-inventory mapping (`ProductPillars.md`) and the user-journey walkthrough (`UserJourneys.md`), where 3 of 5 journeys stayed entirely within Research/Manage and the other 2 were almost entirely gaps.

## Why the brief's own proposed entities needed to be re-argued, not just accepted

The brief listed `InvestmentThesis` and `InvestmentDecision` as separate future capabilities and `JournalEntry` as a third. Treating all three as separate collections would have repeated a mistake Athena's own history already warns against: `WatchlistVsPortfolio.md` documents, at length, why Watchlist and Portfolio stay deliberately separate (different financial realities, different data shapes) — but Thesis/Decision/Journal aren't in that situation. They're the same act of reasoning (why did I think what I thought about this company) viewed at three different moments (forming a view, acting on it, reflecting on it later), and splitting them into three collections would create exactly the "two records that can drift out of sync describing one continuous thought" failure mode the codebase has already learned to avoid once. This sprint's job was to notice that pattern-match and re-architect around it, not to implement the brief's proposed schema literally — the brief itself explicitly invited this ("treat suggested schemas as examples, not requirements," in the spirit of `PortfolioDataModel.md`'s own precedent of deviating from a suggested schema for a documented reason).

## Product decisions

The most consequential call was recommending Decide (Phase 2) as the immediate next sprint over Manage-depth (cash ledger, dividends, tax lots) or Monitoring-push (real notifications), even though both of those are also genuine, long-acknowledged gaps (Manage-depth has been explicitly deferred in Sprints 9, 14, 15, and 16; Monitoring-push was explicitly deferred in Sprint 11). The reasoning: Decide requires no new calculation engine and no infrastructure investment (no scheduler, no identity upgrade, no cash-flow modeling) — it's the cheapest large gap to close, and closing it is also a prerequisite for Phase 5 (Learn), which is independently the highest-differentiation opportunity identified in the competitive-positioning analysis. Manage-depth and Monitoring-push are real, but each requires harder infrastructure work (cash-flow-aware return calculation; a scheduler and identity system respectively) for comparatively lower differentiation value, per the prioritization table in `FutureRoadmap.md`.

The second most consequential call was recommending an identity-system upgrade as an explicit, named piece of technical debt rather than leaving it implicit. Every prior sprint that touched identity (`WatchlistAndPortfolioProductDesign.md` Section 8, `IntelligentAlertsProductDesign.md` Section 6) noted the anonymous-bearer-token model as a known limitation and moved on, because nothing built so far actually required it to change — Watchlist/Portfolio/Alerts all work fine single-device. Decide and Learn are the first capabilities where that stops being true: a Decision record a user can lose by clearing browser storage undermines the entire pillar's value proposition. This sprint's contribution is connecting that dot explicitly, in `FutureArchitecture.md`, rather than letting a fourth sprint in a row note the limitation without flagging when it actually becomes load-bearing.

## Why AI was deliberately kept out of the roadmap's center

The brief was explicit that AI must not define the roadmap, and the codebase's own history made this an easy instruction to honor rather than fight: every existing AI feature (Research Report, Scenario Explanation) is already built as an optional narration layer over deterministic engines, never a source of new facts. The temptation in a "platform expansion" sprint would have been to propose AI-generated theses, AI-assigned confidence scores, or an AI portfolio advisor — all of which were explicitly rejected in `ProductBoundaries.md` and `InvestmentDecisionFramework.md` for the same underlying reason already established across five prior product-design docs: Athena's credibility depends on AI narrating, never deciding.

## What would have been the wrong move here

Treating this sprint as license to start scaffolding `InvestmentDecision` code, a scheduler, or an identity migration. The brief was explicit and repeated ("Do NOT implement... during this sprint") for good reason: none of Phase 2–6 has been validated with real usage yet, and building ahead of that validation is exactly the failure mode `AdvancedScenarioProductDesign.md` Section 8 and `IntelligentAlertsProductDesign.md` Section 9 already warn against for smaller-scoped features. A platform-level roadmap deserves the same discipline, at higher stakes.

## Limitations of this sprint's analysis

The roadmap and pillar classification are reasoned from the existing codebase and its own documented product decisions — they are not validated against real user behavior, because Athena has no instrumentation anywhere (a fact this sprint's own `AthenaProductVision.md` success-metrics section inherits from every prior sprint's identical caveat). The Phase 2 recommendation is a strong architectural and product-logic argument, not a data-backed one; the first real test of this sprint's reasoning will be whether users who get a Decision-record feature actually use it, the same open question every prior feature has shipped with and never yet measured.

## Future improvements

The most immediate follow-up, if this roadmap is accepted, is a dedicated design sprint for `InvestmentDecision`'s API and UI (this sprint intentionally stopped at the minimum-viable field set in `InvestmentDecisionFramework.md`, not a full implementation plan). The second is a scoping pass on the identity-system upgrade, since it's now a named dependency for two future phases (4 and, for cross-device persistence, arguably 2/5 as well) rather than a background limitation — worth understanding its full scope before Phase 2 work begins, even though Phase 2 itself doesn't strictly require it to ship a first version.

---

## Product Management interview questions

**Q1: A stakeholder asks why this sprint didn't just start building the highest-priority item (Decide) instead of spending a whole sprint on documents. How do you respond?**
A: Because "Decide" isn't one well-defined feature yet — it's a pillar with several plausible shapes (the brief itself proposed Thesis, Decision, Paper Trading, and Journal as four separate things), and building the wrong shape (e.g., three separate collections that should have been one) would be far more expensive to unwind later than one sprint of analysis now. The same logic Athena already applies to DCF assumptions ("don't fabricate a number you have no basis for") applies to roadmap decisions: better to state the reasoning explicitly and let it be reviewed than to guess and ship.

**Q2: Why recommend Decide over Manage-depth, when Manage-depth (cash, dividends, tax lots) has been deferred four sprints running and Decide has been deferred zero — doesn't that suggest Manage-depth is more overdue?**
A: Being deferred repeatedly isn't the same as being higher-value right now — each of those four sprints deferred it because something else was more urgent at the time, and the same is true here: Decide requires no new infrastructure and unlocks the highest-differentiation future pillar (Learn), while Manage-depth requires genuinely harder engineering (cash-flow-aware return math) for a smaller near-term product gap. The prioritization table in `FutureRoadmap.md` scores this explicitly rather than relying on "it's been waiting longer."

**Q3: What's the biggest risk in this sprint's recommendations?**
A: That the Decide-first sequencing is a strong logical argument built entirely from the existing codebase's own documented reasoning, with zero real user data behind it — the same limitation every prior Athena sprint has shipped under. If Phase 2 ships and users don't actually want to record decisions (the same open question `WatchlistAndPortfolioProductDesign.md` still has about watchlists five sprints later), the roadmap's sequencing would need to be revisited, not defended on principle alone.

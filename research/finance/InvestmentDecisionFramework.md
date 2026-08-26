# Investment Decision Framework

## Definition

An **investment decision record** is a user-authored, timestamped statement of *why* an investor formed a view on a company and *what, if anything,* they did about it — distinct from the transaction itself (which records *what happened*) and distinct from Athena's own analysis (which is evidence the record can cite, never content the record inherits automatically).

## The "formula"

Not a calculation — a minimum viable field set, evaluated field by field against one question: *does removing this field make the record meaningfully less useful to review later?*

```
InvestmentDecision {
  ticker
  createdAt
  decisionType        // enum: BUY, SELL, HOLD, WATCH — user-selected, never AI-assigned
  linkedTransactionId  // optional — set only if an actual BUY/SELL followed
  price                // price at time of decision (may differ from linkedTransaction's execution price)
  quantity              // optional — only meaningful if a transaction is linked
  thesis                // free text — the core reasoning
  bullCase               // free text
  bearCase               // free text
  keyAssumptions         // structured list of short, checkable claims (Phase 2.2, see FutureRoadmap.md)
  confidence             // user-selected scale (e.g. Low/Medium/High) — never AI-assigned
  expectedHoldingPeriod  // free text or coarse enum (e.g. <1yr, 1-3yr, 3yr+)
  evidence               // snapshot references: { dcfValue, dcfCalculatedAt, compsRange, scenarioResult } — see below
}
```

## Intuition

A DCF form already answers "what do I think this company is worth, and on what assumptions." A Decision record answers a different question: "given what I think it's worth, what did I actually decide to do, and why." The first is Athena's analysis; the second is the user's judgment call layered on top of it — the two must stay visibly distinct so a user (or a future reviewer of the same record) can tell which parts are Athena's math and which parts are their own reasoning, the same distinction DCF's assumption-source badges already draw within a single feature.

## Why investors care

Without a decision record, an investor's reasoning exists only in their memory, which degrades and reconstructs itself with hindsight bias — a well-documented behavioral finance problem (people systematically misremember their own past confidence and reasoning once they know the outcome). A written-at-the-time record is the only defense against that: it lets a later review compare what was *actually* believed against what happened, rather than what the investor now remembers believing.

## Why each field earns its place

- **`decisionType`** — without it, there's no way to distinguish "I decided to hold despite temptation to sell" (a real, valuable decision to record) from a pure watch-list add. `HOLD` and `WATCH` as first-class decision types matter as much as `BUY`/`SELL` — some of the most valuable reviewable decisions are the ones where a user chose to do nothing.
- **`linkedTransactionId` (optional)** — a decision doesn't require action (a `WATCH` or a considered-but-rejected `BUY` has no transaction), so this must be optional, not required. When present, it's the bridge Phase 5's Review pillar uses to compare "what I decided" against "what actually happened to the position."
- **`thesis`/`bullCase`/`bearCase`** — kept as three separate fields, not one blob, because a good investment decision genuinely considers both sides — collapsing them into one "reasoning" field would make it too easy to only ever record the bull case and never engage with what could go wrong, defeating the field's purpose.
- **`keyAssumptions`** — structured and separate from `thesis` specifically so Phase 5 can check them mechanically later ("did revenue growth actually stay above 15%") rather than requiring a human to re-read prose and guess which sentence was the checkable claim.
- **`confidence`** — user-selected, never AI-assigned, for the same reason DCF never lets Athena assign a Buy/Sell rating: confidence is a subjective claim about the user's own conviction, not a fact Athena has any basis to assert on their behalf.
- **`evidence` (snapshot, not live reference)** — see `research/engineering/DataOwnership.md`'s dedicated section on why this must be a snapshot. A decision reviewed a year later needs to see the DCF value *that actually informed the decision*, not whatever DCF now computes with today's financials and today's assumptions.

## What's deliberately NOT in the minimum viable model

- **No AI-suggested quantity or price** — sizing a position is a judgment call involving risk tolerance and portfolio context Athena doesn't have full visibility into (the same reasoning `PortfolioRiskProductDesign.md` Section 7 already applies to rejecting portfolio optimization).
- **No AI-generated thesis text** — a thesis must be the user's own reasoning; an AI-drafted thesis a user just approves would be Athena making the decision and dressing it as the user's, the exact failure mode `ProductBoundaries.md` rules out.
- **No outcome/grade field at creation time** — outcome only exists in hindsight (Phase 5's Review pillar computes it by comparing this record against later reality); a field for it at creation would be meaningless and empty forever.
- **No portfolio-level aggregation fields** — a Decision is about one ticker at one point in time; portfolio-level pattern recognition (Phase 5/6) is a query over many Decision records, not a field on any single one.

## Limitations

This model doesn't handle: multi-leg decisions (a pairs trade, a hedge position), decisions that reference multiple tickers at once, or decisions made about an asset class rather than a specific company. All are legitimate future extensions but are out of scope for the minimum viable version — adding `relatedTickers` or a decision "group" concept later is additive, not a redesign, the same way `Transaction.type`'s enum was kept additive in `PortfolioCalculationAssumptions.md`.

## Common mistakes to avoid when implementing this

- **Making `thesis` a rich-text/structured document from day one.** Start with plain text; structure (like `keyAssumptions`) should be added only where mechanical review genuinely needs it (Phase 2.2), not applied everywhere pre-emptively.
- **Auto-populating `bullCase`/`bearCase` from an AI Research Report's own bull/bear framing (if one exists).** This would blur "Athena's analysis" and "the user's own reasoning" exactly the way `ProductBoundaries.md` warns against — a user could end up with a thesis they never actually formed themselves, just accepted from a suggestion.
- **Treating `confidence` as something that affects downstream calculations.** It's a self-report for the user's own later review, never an input to any Athena engine — conflating the two would quietly turn a subjective field into something with computational consequences it was never designed to carry.

## Interview questions

1. *"Why merge Thesis and Decision into one entity instead of the two the brief names separately?"* — See `research/engineering/FutureDataModel.md`'s dedicated section: they're the same act of reasoning at different commitment levels, and splitting them risks two records drifting out of sync describing what should be one continuous thought — the same failure mode `WatchlistVsPortfolio.md` warns about for a different pair of concepts.
2. *"How would you know if this minimum viable model is actually sufficient, versus needing the fuller `Research Workspace → Notes → Assumptions → Scenarios` hierarchy the brief describes?"* — Ship the minimum version, then watch whether users hit its limits in practice (e.g., wanting to track a thesis before they're ready to call it a decision, or wanting to attach multiple scenario runs to one decision). Extending the model to add those later is a schema addition, not a rebuild, because the core entity and its evidence-snapshot pattern don't change shape.
3. *"Why does `evidence` snapshot the DCF value instead of always showing the user's live, current DCF number?"* — Because the record's entire purpose is reviewing what was believed *at decision time* — a live-updating number would mean the record silently rewrites history every time the user reruns DCF with new assumptions, making any later "was I right" comparison meaningless.

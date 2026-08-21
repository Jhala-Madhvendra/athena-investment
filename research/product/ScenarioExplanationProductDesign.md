# Scenario Explanation — Product Design

## 1. What problem this solves

Sprint 16 shipped a genuinely dense result: precedence-resolved rules, per-holding and per-sector attribution with two distinct percentage figures (`portfolioImpactPercentagePoints` vs. `contributionToScenarioImpactPercent`), overridden/unevaluable rule lists, and a separate historical-context block. All of it correct, none of it self-explanatory to a reader who hasn't internalized `research/finance/ScenarioAttribution.md`. Scenario Explanation closes that gap without adding a second, competing source of numbers — it narrates the numbers already on the page.

## 2. Why opt-in, not automatic

An "Explain this result" button, never an auto-fired call on `/run`. Two reasons: cost (every LLM call has a real per-request cost, and a user re-running a scenario five times while tuning shock values shouldn't trigger five explanation calls they never asked to read) and trust (a user who wants to read the raw numbers themselves shouldn't have prose pushed in front of them first). This mirrors the AI Equity Research Analyst's own generate-on-click design (`research/product/AIResearchAnalystProductDesign.md`) — Athena's established pattern for every LLM-touched surface.

## 3. Why the explanation is not persisted

No `Scenario` collection exists — scenario results themselves are computed fresh on every `/run` call (`research/product/AdvancedScenarioProductDesign.md` Section 8). Persisting an explanation would mean persisting *something* tied to a scenario definition that itself isn't stored anywhere, which would be backwards. An explanation is cheap to regenerate and short-lived by nature (it explains one specific result the user is currently looking at) — infrastructure to cache or version it is exactly the kind of investment-ahead-of-validated-need Sprint 16 already chose to defer for scenarios generally.

## 4. Why this is scoped to `/run`, not `/compare`

A comparison already juxtaposes several scenarios' headline numbers side by side — the reader's question there is usually "which of these differs most and why," a question best answered by looking across rows of the comparison table, not by reading N separate paragraphs. Single-run explanation answers a narrower, better-defined question ("what does this one result mean") and was judged the higher-value piece to ship first. Comparison explanation is a plausible extension, not a cut feature — nothing in the implementation blocks adding it later.

## 5. Why the explanation always ships with a disclaimer, not just once in page copy

Every explanation panel repeats "AI-generated explanation of the numbers above - not financial advice, not a forecast" directly under the generated text, not only as a one-time page-level notice. An explanation is the one surface on the Scenario Analysis page where prose could plausibly be mistaken for Athena's own institutional voice rather than a rephrasing of user-controlled hypothetical numbers — the disclaimer needs to travel with the text it qualifies.

## 6. Why a failed verification returns an error, not a hedged explanation

If the mechanical hallucination check (`research/engineering/GroundedScenarioExplanation.md`) fails twice, the API returns `502` and the frontend shows an error state with a retry button — never a partial or caveated explanation. There is no reliable way to show *which* sentence in a paragraph contains the fabricated number without building inline flagging (not in scope), so the only trustworthy failure mode is showing nothing rather than something partially wrong.

## 7. Sector/industry coverage indicator (secondary deliverable)

`assumptions.sectorCoveragePercent` / `assumptions.industryCoveragePercent` (value-weighted, mirroring Sprint 14's `betaCoveragePercent`) were added alongside the explanation feature — a small, low-risk transparency addition using data the scenario context already fetches (`Company.sector`/`Company.industry`), not a new data source. Placed in the same Assumptions card as beta coverage so a reader can judge, at a glance, how much of a SECTOR or INDUSTRY rule's reach is limited by unclassified holdings — the same way beta coverage already flags MARKET-rule reach.

## Potential product metrics (not implemented this sprint)

- Explain-click rate as a share of scenario runs — the direct signal of whether users want prose alongside the tables.
- Retry/failure rate on `/explain` — an unusually high rate would indicate the prompt or verification tolerance needs tuning, not just a per-request annoyance.
- Whether explanation use correlates with more scenario runs per session (a sign it's helping users interpret and iterate) versus fewer (a sign it's substituting for engagement with the underlying tables).

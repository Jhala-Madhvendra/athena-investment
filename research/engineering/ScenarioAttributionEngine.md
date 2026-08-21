# Scenario Attribution Engine

## Definition

The part of `portfolio.scenario.calculator.js` that turns a resolved per-holding shock into the two distinct attribution numbers the sprint brief asks for — Portfolio Impact and Contribution to Scenario Impact, at both the holding and sector level (`research/finance/ScenarioAttribution.md` has the finance-level definitions and worked examples).

## Why it exists

A portfolio-level scenario total (`absoluteChangeUSD`) answers "how much did the portfolio move," but not "which holdings actually drove that." The sprint brief asks specifically for the ability to answer "which holdings caused most of the scenario loss" — a question that requires tracing the portfolio-level total back to its per-holding and per-sector sources, not just reporting the aggregate.

## Alternatives considered

- **Reporting only Portfolio Impact (pp)** — rejected: it answers "how much did this holding move the whole portfolio" but not "of the total swing, how much came from here" — the second question is what actually identifies the scenario's real drivers, and the two can disagree sharply for a small, heavily-shocked holding (`ScenarioAttribution.md` Section 4).
- **Reporting only Contribution to Impact (%)** — rejected: on its own it hides the absolute scale (a 100% contribution to a $200 total change is very different from a 100% contribution to a $2M one), so both numbers are surfaced together, explicitly labeled as answering different questions.
- **Weighting contribution by portfolio weight instead of computing it independently** — rejected: would silently produce the wrong number for exactly the case attribution is designed to surface (a low-weight, heavily-shocked holding dominating the outcome) — see the worked "SMALL is 1% of the portfolio but explains 100% of the loss" test case.

## Athena implementation

`attributeHoldingImpact(shockedHoldings, currentPortfolioValueUSD, totalAbsoluteChangeUSD)` computes both ratios per holding directly from already-shocked values (`applyHoldingShock()`'s output) — no re-derivation from raw rules, so attribution can't drift out of sync with the totals it's attributing. `attributeSectorImpact()` re-aggregates the same already-attributed holdings by `Company.sector` (falling back to `"Unclassified"`, matching Sprint 14's `portfolio.analytics.exposure.js` convention exactly) rather than running a parallel per-sector calculation. `contributionToScenarioImpactPercent` is explicitly `null` — never a fabricated `0` — whenever `totalAbsoluteChangeUSD` is exactly zero (the Base Case's defining condition), since the ratio is genuinely undefined there, not merely small.

## Testing strategy

`portfolio.scenario.calculator.test.js` includes a worked example directly from the sprint brief (AAPL, ₹2,00,000/-30%/-₹60,000, expressed in the same USD-normalized units the engine actually uses) and a dedicated test proving weight and contribution diverge as designed: a 1%-weight holding shocked -80% is asserted to explain ~100% of the total change while a 99%-weight untouched holding explains ~0% — the exact scenario that would silently pass if contribution were mistakenly weight-derived instead of independently computed. A separate test asserts `contributionToScenarioImpactPercent` is `null`, never `0`, when the scenario's net change is zero.

## Interview questions

1. **"Why compute Portfolio Impact and Contribution to Impact as two separate fields instead of one combined 'importance' score?"** — Because they answer different, independently useful questions (how much did this move the whole portfolio, vs. what share of the total swing came from here) that can point in different directions for the same holding — collapsing them into one score would force an arbitrary weighting between two things a reader might reasonably want to see separately.
2. **"How does sector attribution stay consistent with holding attribution instead of computing its own separate numbers?"** — It's a pure re-aggregation of the already-computed holding-level `absoluteChangeUSD`/`currentValueUSD` values, grouped by sector — never a second, independent calculation over raw shocks. Any holding-level correction automatically flows through to sector attribution without a matching sector-side fix needed.
3. **"Why does the engine group unclassified holdings under 'Unclassified' instead of excluding them from sector attribution?"** — Because an unclassified holding's dollar impact on the scenario is real and belongs somewhere in the total — silently dropping it would make the sector breakdown's totals not reconcile with the actual portfolio-level `absoluteChangeUSD`, the same reasoning Sprint 14's exposure calculator already established for sector/industry weighting.

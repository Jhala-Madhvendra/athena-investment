# Portfolio Scenario Sensitivity

> Named `PortfolioScenarioSensitivity.md` rather than `SensitivityAnalysis.md` to avoid colliding with the existing `research/finance/SensitivityAnalysis.md` (Sprint 6/7's DCF WACC × terminal-growth sensitivity grid) — a different feature entirely. See that document for DCF sensitivity; this one covers the portfolio scenario engine's sensitivity feature (Sprint 16).

## 1. Definition

Portfolio scenario sensitivity flexes **one rule's shock value** across a small, fixed set of alternatives (2–5 values) while holding every other rule in the scenario constant, showing how the portfolio-level result moves in response — turning "Technology -20% produces a -10.4% portfolio impact" into "here's how that impact changes if the Technology shock were -10%, -15%, -20%, -25%, or -30% instead."

## 2. The formula

```
For each candidate shockValue in the requested list:
    flexedRules = rules, with the targeted rule's shockPercent replaced by shockValue
    result = calculateScenarioImpact(resolveScenario(holdings, flexedRules))
    record {shockValue, scenarioPortfolioValueUSD, absoluteChangeUSD, percentageChange}
```

Every other rule in the scenario (and therefore every other holding's effective shock) stays exactly as entered — only the targeted rule's value changes across the sensitivity run.

## 3. Intuition

A single scenario result is one point; sensitivity shows the *slope* around it — how much the portfolio's outcome actually depends on getting that one specific assumption right. A shallow slope (little change in outcome across a wide range of shock values) says the portfolio's result is fairly robust to disagreement about that particular number; a steep slope says the conclusion hinges heavily on it — informative regardless of which shock value turns out to be closest to reality.

## 4. Why investors care

It directly answers "how much does my conclusion depend on this one number being right?" — the same question DCF's WACC × terminal-growth sensitivity table answers for valuation mechanics (`SensitivityAnalysis.md`), applied here to a portfolio scenario's shock assumption instead. A user deciding whether a -20% Technology shock is "close enough" to their actual view benefits from seeing the neighboring values' outcomes rather than treating -20% as the only number that matters.

## 5. Limitations

Deliberately **one-dimensional** — only one rule is flexed at a time, holding all others fixed, per the sprint brief's explicit "do not create a giant matrix" constraint. A true multi-dimensional sensitivity (flexing Technology and Market simultaneously across a grid) would show cross-effects this feature doesn't — a conscious simplicity-over-completeness trade-off, the same one `SensitivityAnalysis.md` Section 6 makes for DCF's own 2-variable grid. Capped at 2–5 shock values per run (`portfolio.scenario.validator.js`'s `MIN/MAX_SENSITIVITY_VALUES`) — enough to show a trend, deliberately not enough to become an overwhelming table.

## 6. Assumptions

The targeted rule must already exist in the base scenario's rule list (matched by `targetType`/`target`) — sensitivity flexes an existing assumption, it doesn't introduce a new one. Shock values are still bounded by the same sanity range as any rule (-100% to +1000%, `portfolio.scenario.validator.js`), and duplicates aren't allowed.

## 7. How Athena implements it

`backend/portfolio/portfolio.scenario.service.js`'s `runScenarioAgainstContext()` re-runs the same pure `resolver.resolveScenario()` + `calculator.calculateScenarioImpact()` pipeline once per requested shock value — never a separate calculation path, so sensitivity results are guaranteed consistent with what a full scenario run for that shock value would produce. The already-fetched holdings/company/beta context (`loadScenarioContext()`) is reused across every sensitivity point in one request — not re-fetched per point. The frontend (`SensitivityPanel.jsx`) renders the results as a small horizontal-bar table (shock value → dollar impact → percentage change), the same "Technology Shock | Portfolio Impact" shape the sprint brief describes.

## 8. Common mistakes

- **Building a separate calculation path for sensitivity** instead of reusing the exact scenario engine — risks the sensitivity table silently disagreeing with what a full `/run` call for the same shock value would produce. Athena avoids this by construction.
- **Flexing more than one rule at once** — defeats the purpose of isolating which single assumption the outcome is actually sensitive to; if two things change simultaneously, an observed swing in the outcome can't be attributed to either one specifically.
- **Interpreting a wide sensitivity range as itself alarming** — a steep sensitivity slope only says the outcome depends heavily on getting that one number right; it says nothing about how likely any particular value in the range actually is (no probability is ever attached).

## 9. Scenario vs. forecast

Each row of a sensitivity table is still a hypothetical scenario result, not a forecast — "if the Technology shock were -30% instead, modeled impact would be -12.0%" carries the same conditional framing as any single scenario run, repeated across a small set of alternative inputs.

## 10. How analysts use it

Sensitivity/what-if analysis around a single key assumption is standard practice anywhere a model output depends heavily on an uncertain input — the same instinct behind DCF's WACC sensitivity table, applied here to ask "how much does this portfolio's stress-test outcome depend on exactly how severe the Technology shock turns out to be."

## 11. Interview questions

1. **"How is portfolio scenario sensitivity different from running the same scenario five separate times with different shock values?"** — Functionally nearly identical in output, but sensitivity does it in one request, reusing the already-fetched portfolio/company/beta context once instead of five times, and returns the results together as a ready-to-compare table rather than five independent API round trips.
2. **"Why does Athena only let a user flex one rule at a time instead of a full multi-dimensional grid?"** — Per the sprint's explicit "no giant matrix" constraint — a 2-dimensional grid multiplies the number of scenario runs and the complexity of reading the result, for a marginal benefit (cross-effects) that a determined user can still explore manually by running separate multi-factor scenarios. One-dimensional sensitivity keeps the feature simple and fast to reason about.
3. **"Why must the sensitivity target already exist as a rule in the base scenario?"** — Because sensitivity is defined as "how does the outcome change if *this specific assumption* were different" — it presupposes the assumption is already part of the scenario being analyzed. Allowing an arbitrary, not-yet-present rule to be flexed would blur sensitivity analysis into scenario construction, a different (and already well-served) part of the product.

# Scenario Analysis

## 1. Definition

Scenario Analysis re-runs a valuation under a small number of named, internally-consistent narratives — typically Bear (pessimistic), Base (expected), and Bull (optimistic) — rather than varying assumptions mechanically across a grid the way Sensitivity Analysis does. Each scenario tells a coherent "if this business performs like *this*" story.

## 2. The formula

Athena's scenarios shift only two assumptions relative to the user's Base Case, by a fixed, documented delta:

```
Bear:  Revenue Growth − 2pp,  EBIT Margin − 2pp
Base:  (the user's own entered assumptions, unchanged)
Bull:  Revenue Growth + 2pp,  EBIT Margin + 2pp
```

WACC, terminal growth, tax rate, and capital structure are held identical across all three — see Section 6 for why.

## 3. Intuition

Where Sensitivity Analysis asks "how does the valuation mechanics respond if WACC or terminal growth moves" (a question about the *model*), Scenario Analysis asks "what is this company plausibly worth if the *business itself* performs better or worse than expected" (a question about the *business*). Bear/Base/Bull is a narrative framing that's more intuitive for most investors than a grid of numbers — "if growth disappoints" is a story; "WACC = 9.5%, g = 2.0%" is a coordinate.

## 4. Why investors use it

It bounds a valuation the same way sensitivity analysis does, but along the axis investors usually think in first: business performance, not valuation mechanics. A wide gap between Bear and Bull cases is itself informative — it says the stock's fair value is highly dependent on how the business actually executes, which matters for position-sizing and risk assessment even before deciding whether the current price looks attractive.

## 5. Assumptions

The ±2 percentage point deltas are a **documented, adjustable starting convention** — not derived from the company's specific historical volatility, industry, or any statistical measure of how much its growth/margins actually tend to vary. A highly cyclical company's realistic bear case might swing far more than 2pp; a highly stable utility's might swing far less. Athena's fixed delta is a reasonable, transparent default (matching the sprint's own example), not a claim that ±2pp is the "correct" spread for every company.

## 6. Limitations

Deliberately narrow in scope: only revenue growth and EBIT margin vary. WACC, terminal growth, and capital structure stay fixed across all three scenarios — a real bear case might also justify a *higher* discount rate (more risk, more required return) or a more conservative terminal growth assumption, but mixing valuation-mechanics changes into a business-performance scenario would make it unclear whether a lower Bear Case valuation is coming from the story ("the business underperforms") or from a separate mechanical choice ("and also we discounted it more harshly") — conflating the two defeats the purpose of having Scenario and Sensitivity Analysis as two distinct tools.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.scenarios.js`:

```js
const SCENARIO_DELTAS = {
    bear: { revenueGrowth: -0.02, ebitMargin: -0.02 },
    base: { revenueGrowth: 0, ebitMargin: 0 },
    bull: { revenueGrowth: 0.02, ebitMargin: 0.02 },
};

const runScenarios = (engineInput, deltas = SCENARIO_DELTAS) => ({
    bear: calculateDCF({ ...engineInput, assumptions: buildScenarioAssumptions(engineInput.assumptions, deltas.bear) }),
    base: calculateDCF({ ...engineInput, assumptions: buildScenarioAssumptions(engineInput.assumptions, deltas.base) }),
    bull: calculateDCF({ ...engineInput, assumptions: buildScenarioAssumptions(engineInput.assumptions, deltas.bull) }),
});
```

Like the sensitivity matrix, scenarios reuse the same `calculateDCF()` engine three times with adjusted inputs — never a parallel calculation path. `buildScenarioAssumptions()` supports both scalar and per-year-array revenue growth/EBIT margin assumptions (adding the delta to every year uniformly), and the deltas themselves are an exported, overridable constant rather than a hardcoded magic number inside the function body, so they're documented and testable in isolation. The frontend (`ScenarioComparison.jsx`) shows all three cards side by side with each one's revenue growth and EBIT margin delta labeled explicitly ("Revenue Growth +2.0pp vs. Base") — never presenting Bull/Bear as unexplained alternate numbers.

## 8. Common mistakes

- **Varying WACC or terminal growth as part of a "scenario"** rather than keeping those fixed — muddles whether a scenario's different valuation comes from the business story or a separate mechanical assumption change (see Limitations above).
- **Presenting Bear/Bull as if they were confidence-interval bounds** (e.g., "there's a 90% chance the value is between these two") — they're not statistically derived; they're a fixed, illustrative delta applied to two variables, useful for bounding a story, not a probability distribution.
- **Picking scenario deltas that are too small to be meaningful** or so large they describe an implausible business outcome — the ±2pp default is a starting point precisely because it's stated explicitly and can be adjusted per company.

## 9. Interview questions

*"Why do Bear and Bull only touch revenue growth and EBIT margin, and not WACC or terminal growth, even though a genuinely pessimistic scenario might justify a higher discount rate too?"* — Because mixing a business-performance story with a valuation-mechanics change would make the resulting number ambiguous — you couldn't tell whether the lower Bear Case value came from "the business does worse" or from "and we also decided to discount it more harshly," which are two separate claims that deserve separate tools. Keeping WACC and terminal growth fixed isolates the scenario analysis to exactly the question it's meant to answer: how much does *business execution* move the valuation, holding the valuation mechanics constant. If someone wants to stress-test the mechanics too, that's what the sensitivity table is for.

*"How would you decide whether ±2 percentage points is the right scenario spread for a given company?"* — I'd anchor it to the company's own historical volatility in revenue growth and margins — a company whose revenue growth has swung by 10+ points year to year in its reported history probably deserves a wider scenario spread than a stable, mature company whose growth has been steady within a couple points for years. Athena's fixed ±2pp is a reasonable, transparent default, but it's explicitly documented as adjustable rather than presented as a universal constant, precisely because the "right" spread is company-specific.

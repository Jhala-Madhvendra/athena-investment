# Engineering Concept: Grounded Portfolio Explanation (Deferred)

## Status

**Not implemented in Sprint 14.** The sprint brief marks AI explanation of portfolio analytics as explicitly optional ("AI explanation is OPTIONAL. If not implemented: Document it for future work"). This document records the design constraints that would apply if/when it is built, so a future sprint doesn't have to re-derive them.

## Why portfolio calculations must remain deterministic

Every number in `GET /api/portfolio/analytics` - volatility, beta, Sharpe, drawdown, HHI, correlation, exposure - is produced by pure, unit-tested calculator functions (see PortfolioAnalyticsEngine.md), with zero LLM involvement anywhere in the computation path. This is non-negotiable for a financial analytics feature: a Sharpe Ratio, unlike a piece of prose, has one correct value for a given input, and a language model is the wrong tool for producing it - LLMs are not reliable arithmetic engines, and even a small hallucinated digit in a risk number is a category of error users have no way to detect by reading it.

## Why AI should consume structured analytics, not compute them

If portfolio explanation is added in a future sprint, the contract should be exactly what Sprint 8's AI Equity Research Analyst already established for company-level analysis: the AI receives a **structured, already-computed** input object and is only permitted to describe it in natural language, never to derive or adjust the numbers itself.

```js
// Illustrative future input shape - NOT implemented in Sprint 14
{
    volatility: 0.184,
    beta: 1.14,
    sharpe: 0.62,
    maxDrawdown: { percent: -18.4, peakDate: "...", troughDate: "..." },
    concentration: { top1: 34.2, top3: 61.5, hhi: 2140 },
    sectorExposure: [{ label: "Technology", weightPercent: 52.1 }, ...],
}
```

This mirrors `ai.contextBuilder.js`'s existing approach for DCF/comps context (Sprint 8) - the AI is handed Athena's own computed numbers as ground truth and asked to narrate them, never to independently "figure out" a metric it could get wrong.

## How hallucination risk would be reduced

- **No number the AI states should ever originate from the AI.** Every figure in a hypothetical explanation must trace back to a field in the structured input, the same discipline `StructuredLLMOutput.md`/`AIResponseValidation.md` already apply to DCF/comps AI output.
- **Response validation would need to check that stated numbers match the input**, not merely that the response is well-formed prose - a plausible-sounding but numerically wrong sentence ("your portfolio's volatility of 22%..." when the actual figure was 18.4%) is a harder failure mode to catch than a malformed JSON response, and would need explicit guarding.
- **No comparison to data the AI wasn't given.** An explanation must not introduce a "typical portfolio" or "the market average" comparison unless that comparison was itself part of the structured input - otherwise the AI would be fabricating a benchmark claim Athena never computed.

## Why AI should not make portfolio recommendations

This follows directly from the sprint's core product principle (see PortfolioRiskProductDesign.md): Athena is an investment intelligence platform, not a trading advisor, and that constraint applies with equal force to AI-generated text as to the deterministic UI copy. A hypothetical AI explanation is permitted to describe *what the data says* ("portfolio volatility has historically been higher than the benchmark's") and must never cross into *what the user should do about it* ("you should reduce exposure to X") - the same BUY/SELL/HOLD/REDUCE/INCREASE prohibition that governs every other surface in this sprint. Sprint 8's AI research analyst already enforces an equivalent boundary (valuation interpretation, not investment instructions) via prompt constraints and output validation - a future portfolio-explanation feature would reuse that same discipline rather than inventing a new one.

## Interview questions

1. *"Why not let the AI compute portfolio volatility directly from price history, since it's already good at explaining numbers?"* — Because "good at explaining numbers" and "good at computing numbers precisely and reproducibly" are different capabilities. A deterministic calculator gives the exact same volatility for the exact same input every time, is unit-testable, and is auditable line-by-line; an LLM asked to compute a standard deviation over a return series has no such guarantee, and a financial analytics product cannot afford non-reproducible math.
2. *"If you built the AI explanation feature next sprint, what's the single hardest part to get right?"* — Response validation that catches a numerically-wrong-but-fluent sentence, not just a malformed one. A hallucinated JSON field fails loudly (parsing breaks); a hallucinated number embedded correctly in otherwise-accurate prose fails silently, and is exactly the failure mode a deterministic-math product can least afford to ship.

# Grounded Scenario Explanation

## Definition

The design for an *optional, future* AI layer that would turn a scenario's structured result into a plain-English explanation — deliberately not implemented in Sprint 16. This document exists specifically because the sprint brief requires the integration point be designed even when deferred, per the same discipline Sprint 14 applied to `GroundedPortfolioExplanation.md`.

## Why deterministic scenario calculations are necessary

Every number a scenario response contains — portfolio/holding/sector values, absolute and percentage change, attribution — comes from `portfolio.scenario.resolver.js` and `portfolio.scenario.calculator.js`, pure functions with no LLM involvement anywhere in the call path. This is non-negotiable for a financial calculation: an LLM is a plausible-text generator, not a verified arithmetic engine, and letting it compute or adjust a dollar figure would mean the number displayed to a user is no longer traceable to a specific, testable formula. If AI explanation is ever added, it explains a computation that already happened and is already correct — it never performs or influences the computation itself.

## How structured scenario results can be passed to AI

If implemented, the AI layer's *only* input would be the already-computed, structured JSON a `/run` or `/compare` response already contains: `scenario.rules`, `currentPortfolioValueUSD`, `scenarioPortfolioValueUSD`, `percentageChange`, `holdingImpact`, `sectorImpact`, `historicalContext`, `assumptions.methodologyNotes` — the same shape a human reader already sees on the Scenario Analysis page. No raw market data, no unstructured text, no separate data-fetching step for the AI to draw from — it would only ever rephrase numbers Athena has already calculated and already displays elsewhere on the same page.

## Why AI should not generate financial assumptions

A scenario's shock values are the user's stated hypothesis — the entire product principle of Sprint 16 is that this hypothesis stays exactly what the user entered, never silently adjusted by anything (including historical data, per `research/finance/HistoricalStressContext.md`, and including an LLM). Letting an AI suggest or generate a shock value ("Technology should probably see a -25% shock") would mean Athena is effectively making the hypothetical on the user's behalf — indistinguishable from a forecast dressed up as a UI suggestion, and a direct violation of the sprint's explicit "no automatic shock generation" requirement.

## How hallucination risk is controlled

By construction, not by prompting discipline alone: since every number the AI would ever see is already computed and already correct before the AI is invoked, the only way a hallucination can occur is the AI inventing a number that *isn't* in its structured input — which a validation pass (checking every numeric claim in the AI's output string against the structured input it was given) could catch mechanically, the same pattern `GroundedPortfolioExplanation.md` already specifies for Sprint 14's deferred AI layer. No portion of the explanation would ever be treated as authoritative on its own — the structured numbers remain the source of truth, displayed regardless of whether an AI explanation is also shown.

## Difference between explanation and prediction

An explanation restates and contextualizes a number that already exists ("a 20% decline across Technology holdings would reduce the portfolio by approximately 10.4%, assuming all other holdings remain unchanged" — literally just prose around `sectorImpact`/`percentageChange`). A prediction asserts something about the future the AI has no basis for ("Technology is likely to decline 20% this quarter"). If implemented, the explanation layer's prompt would explicitly instruct the model to only restate/contextualize already-computed figures, never to add likelihood language, trade recommendations, or new numbers — mirroring the "no BUY/SELL/HOLD" constraint that already governs every other AI-touched surface in Athena (Sprint 8's AI Equity Research Analyst, Sprint 14's deferred explanation layer).

## Interview questions

1. **"If Athena adds AI scenario explanation later, what exactly would the AI be allowed to see and do?"** — See only the already-computed structured JSON response (rules, values, attribution, historical context, assumptions) — the same data a human reader already sees — and only rephrase/contextualize it in prose. It would never compute a number, adjust a shock value, fetch additional data, or assign a probability or recommendation.
2. **"Why is this integration point designed now even though it isn't being built this sprint?"** — Because writing the constraints down before any implementation exists prevents a future, time-pressured "let's just have the AI pick a reasonable shock value" shortcut from ever seeming like a small, reasonable addition — the discipline needs to be established as a design decision, not discovered as a bug after the fact.
3. **"How would you verify an AI-generated scenario explanation didn't hallucinate a number?"** — Diff every numeric token in the AI's output text against the structured input it was actually given; any number that doesn't trace back to the input is a hallucination by definition, since the AI was given no other source of numbers to draw from. This is checkable mechanically, not just through prompt wording, because the AI's entire input is a closed, known set of already-verified numbers.

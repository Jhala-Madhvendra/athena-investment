# Grounded Earnings Explanation

## Status: designed, not implemented in Sprint 12

The Sprint 12 brief treats AI narration of the earnings scorecard as optional ("AI may optionally explain the scorecard"). This sprint shipped the full deterministic pipeline (`GET /api/earnings/:ticker` — periods, calculator, signals, market reaction, related news, all working end-to-end against real data) and deliberately deferred the AI explanation endpoint rather than rushing it — the deterministic API is genuinely complete and usable without it. This document records the grounding design so a future sprint can implement it directly, following exactly the pattern Sprint 8 already proved out.

## Why calculations must remain deterministic

Every number in an Earnings Intelligence response — revenue growth, a margin point-change, an FCF conversion ratio — has one, and only one, correct value for a given pair of financial statements. An LLM asked to "compute" that value could plausibly produce something close but wrong, with no way for a reader to tell the difference from the real figure. `backend/earnings/earnings.calculator.js` and `earnings.signals.js` are pure, deterministic functions precisely so every number is reproducible and independently verifiable — the same guarantee Sprint 8's `ai.contextBuilder.js` header comment states for the AI Research Analyst ("Nothing here recalculates anything; every number is read exactly as the corresponding service already computes it").

## How structured data would be passed to the LLM

Sprint 8's pattern, directly reusable: build a compact JSON context object from data that *already exists* (in this case, the exact object `GET /api/earnings/:ticker` already returns — `growth`, `profitability`, `cashFlow`, `balanceSheet`, `signals`, `qualityObservations`), never raw database documents. A hypothetical `earnings.aiPromptBuilder.js` would follow `ai.promptBuilder.js`'s shape: a system prompt encoding non-negotiable rules, a user message embedding the context JSON plus a closed evidence allow-list, and a narrow, closed output schema (`{narrative: string, evidenceUsed: string[]}` — far smaller than Sprint 8's 12-field research report, since Earnings' explanation job is narrower: narrate an already-computed scorecard, not synthesize a full report).

## How hallucination risk is reduced

Three layers, all already proven in Sprint 8 and directly portable:

1. **A closed evidence allow-list** — `ai.contextBuilder.js`'s `buildEvidenceAllowList` flattens every available context field into an explicit list of citable dot-paths; the model may only cite from that list, never invent a field name. An Earnings version would flatten `growth.revenue.percentChange`, `signals.profitability.operatingMargin`, etc.
2. **Post-hoc schema validation** — `ai.validator.js`'s pattern of rejecting any response whose citations reference a path outside the allow-list, with one retry (`ai.service.js`'s `attemptReport`/retry-once pattern) before failing the request rather than silently accepting an ungrounded response.
3. **An explicit "Data unavailable" instruction** — when a section (e.g. `marketReaction`) has `available: false`, the prompt instructs the model to say so plainly rather than guess, exactly as Sprint 8's system prompt already does for its own sections.

## How claims can be traced to underlying metrics

Every sentence the model writes would carry a `sectionEvidence`-style citation back to a specific field already present in the same response the frontend already renders — a reader (or a test) can check that "Revenue growth remained strong" cites `growth.revenue.percentChange` and that field is in fact positive, exactly as Sprint 8's evidence chips let a reader verify a claim against the underlying context.

## Difference between calculation and interpretation

Calculation is `earnings.calculator.js` computing that operating margin moved -3.2 percentage points — a fact, reproducible, never touched by the model. Interpretation is a sentence like "profitability weakened this period" — a paraphrase of an already-computed fact, not a new fact. The AI's only job, if implemented, is the second kind of sentence, built strictly from the first kind of number — never the reverse.

## Interview questions

1. *"Why design this in detail without implementing it?"* — Because the design decisions (schema shape, evidence allow-list, retry pattern) are the hard part and are best made deliberately, referencing a proven precedent (Sprint 8), rather than rushed alongside the rest of a large sprint. Implementing it later is now a scoped, well-defined task, not an open design question.
2. *"What's the single biggest risk if this were implemented carelessly?"* — The model inventing a plausible-sounding number that isn't in the context (e.g. a specific percentage it wasn't given) — that's why every existing Athena AI feature validates citations against a closed allow-list rather than trusting the model's own claim of where a number came from.

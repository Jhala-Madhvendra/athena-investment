# Grounded Industry Explanation

## Status: designed, not implemented in Sprint 13

The Sprint 13 brief treats AI explanation of the industry comparison as strictly optional ("AI may optionally explain the deterministic comparison... AI should be optional"), and is explicit that AI must never calculate a benchmark or judge which company is "best." This sprint shipped the full deterministic pipeline (`GET /api/industry/:ticker`, `/peers`, `/metrics` — reference universe resolution, benchmark calculation, positioning, strengths/weaknesses, all working end-to-end against real data) and deliberately deferred the AI explanation layer, following the same precedent Sprint 12 set for `GroundedEarningsExplanation.md`. This document records the grounding design so a future sprint can implement it directly.

## Why industry calculations must remain deterministic

Every number Industry Intelligence produces — a percentage-point difference, a percentile rank, a relative multiple — has exactly one correct value for a given reference universe and target. The sprint brief is unambiguous that this must never change: *"Do NOT use AI to calculate industry benchmarks. Do NOT ask AI to determine which company is 'best.'"* `industry.calculator.js` and `industry.benchmark.js` are pure, deterministic functions (no LLM call anywhere in their call graph) for exactly the same reason `earnings.calculator.js` is — a reader must be able to trust that "7 percentage points above the industry median" is a reproducible fact, not a paraphrase that might drift from the real number.

## How structured data would be passed to the LLM

The exact object `GET /api/industry/:ticker` already returns is the natural context payload — `benchmarks`, `positioning`, `strengths`, `weaknesses`, `growthComparison`, `profitabilityComparison`, `valuationComparison` are already compact, already labeled with units, and already carry their own "available"/exclusion-reason state. A hypothetical `industry.aiPromptBuilder.js` would follow `ai.promptBuilder.js`'s shape: a system prompt stating the non-negotiable rules above, a user message embedding this JSON plus a closed evidence allow-list, and a narrow output schema — something like `{explanation: string, evidenceUsed: string[]}`, deliberately smaller than Sprint 8's full research-report schema, since the job here is narrower still than Sprint 12's Earnings narration: explain an already-computed comparison table, not synthesize a report.

## How source traceability would work

Every sentence the model writes would cite a specific dot-path already present in the API response (e.g. `profitabilityComparison[1].difference`, `strengths[0].note`) — the same evidence-allow-list pattern Sprint 8 established and Sprint 12 documented for reuse. A reader (or an automated test) could verify that a claim like "operating margin is meaningfully above the industry median" cites a `profitabilityComparison` entry whose `difference` is in fact positive and past the materiality threshold.

## How hallucination risk would be reduced

The same three layers already proven in Sprint 8 and reused in Sprint 12's design, applied to industry data specifically:

1. **A closed evidence allow-list** built by flattening the exact `GET /api/industry/:ticker` response — the model could never cite a metric, universe statistic, or company name that isn't already in the payload the deterministic engine produced.
2. **Post-hoc citation validation with one retry** — `ai.validator.js`'s existing pattern, unchanged, applied to whatever new schema an Industry explanation endpoint would introduce.
3. **An explicit "not available" instruction** for any benchmark with `available: false` — the model would be told to say the comparison is unavailable, exactly as it already does for Sprint 8/12's unavailable sections, rather than inventing a plausible-sounding number for a metric the reference universe couldn't support.

## Difference between calculation and interpretation, applied to industry data

Calculation is `industry.benchmark.compareToTarget()` computing that operating margin is 7.0 percentage points above the industry median — a fact, reproducible, and already covered by 65 backend tests. Interpretation is a sentence like *"The company's operating margin is 7 percentage points above the industry median, indicating stronger operating profitability relative to the reference universe"* (the sprint brief's own example) — a paraphrase of the fact, never a new fact, and never a recommendation ("indicating stronger operating profitability" describes the comparison; it does not say "buy").

## Interview questions

1. *"Why does the sprint brief forbid AI from calculating a benchmark, when Athena already trusts AI for other things (like the research report narrative)?"* — Because a benchmark is a single correct number given the reference universe and target — there's no legitimate creative or synthesizing role for a model to play in computing it, unlike a research report's narrative synthesis across sections. Any AI involvement here can only be explanatory, never computational, which is exactly how the design in this document scopes it.
2. *"If you were implementing this next, what would you build first?"* — The evidence allow-list builder, mirroring `ai.contextBuilder.js`'s `buildEvidenceAllowList` — it's the piece every other safeguard (prompt construction, citation validation) depends on, and it can be built and unit-tested entirely from the already-shipped `GET /api/industry/:ticker` response shape without needing a live LLM call to verify.
3. *"Why defer this instead of building even a minimal version this sprint?"* — The deterministic feature (benchmark calculation, positioning, strengths/weaknesses, peer discovery) is independently complete and valuable without any AI layer — exactly the same judgment Sprint 12 made for earnings narration. Building AI explanation well requires the same grounding rigor as every other Athena AI feature (allow-lists, validation, retry), which is real, scoped work better done deliberately in its own pass than bolted on at the end of an already-large sprint.

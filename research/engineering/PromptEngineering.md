# Engineering Concept: Prompt Engineering

## What it is

`backend/ai/ai.promptBuilder.js` builds two strings sent to the LLM per report: a system prompt (fixed rules — role, grounding, no-recommendation, fact/interpretation/risk distinction, output schema) and a user message (the specific company's compact context JSON plus a closed evidence-path allow-list). Neither is hand-typed per request — both are generated from code, so the rules and the schema they describe can never drift out of sync with what `ai.validator.js` actually checks (enforced directly by a test: `ai.promptBuilder.test.js` asserts every field the validator requires also appears, quoted, in the system prompt).

## Why we use it

An LLM's behavior is steered by its prompt, not configured by a settings object — "prompt engineering" here is just the practice of treating that prompt as a real, versioned, testable software artifact instead of an ad hoc string. Given the sprint's non-negotiable requirements (no fabrication, no recommendations, structured-only output), the prompt is where those requirements get *expressed* to the model — `ai.validator.js` is where they get *enforced* regardless of whether the model actually followed them.

## Alternatives considered

- **One long, unstructured prompt paragraph.** Rejected: the system prompt is organized into clearly labeled sections (GROUNDING, NO INVESTMENT ADVICE, FACT vs INTERPRETATION vs RISK, OUTPUT FORMAT) because LLMs follow explicit, separated instructions more reliably than the same rules buried in flowing prose — this is a widely observed practical property of instruction-following models, not specific to Athena.
- **Few-shot examples (showing a full sample report in the prompt).** Rejected for this sprint: a full example report would roughly double the prompt's token cost for a benefit (more consistent formatting) that a closed JSON schema plus post-hoc validation already achieves more cheaply and more reliably — see `TokenOptimization.md`.
- **Sending the entire allowed vocabulary of report content ("only ever use these exact phrases").** Rejected as both impractical and unnecessary — the grounding constraint (facts must come from the context JSON) is what actually matters; constraining phrasing itself would make reports sound robotic without improving factual safety.

## Trade-offs

- **Pro:** system prompt and user message are pure functions of their inputs (`buildSystemPrompt()` takes no arguments at all) — fully unit-testable without any LLM call.
- **Pro:** low temperature (0.25) and a bounded `max_tokens` (1800) keep output size and variability predictable, appropriate for an interpretive-summary task rather than creative writing.
- **Con:** prompt instructions are guidance, not guarantees — a model can still, occasionally, drift from instructions (add an extra field, use recommendation-adjacent language), which is exactly why the prompt alone is never treated as sufficient (see `AIResponseValidation.md`).

## How Athena implements it

`buildSystemPrompt()` returns a fixed string built from `REPORT_JSON_SHAPE` (kept as a template literal, not duplicated logic, so the schema's presentation to the model stays in one place). `buildUserMessage(context, evidenceAllowList)` embeds `JSON.stringify(context)` directly (not a paraphrase or summary of it) plus the evidence allow-list, so the model's input is exactly the same object Athena's own code produced — nothing is lost or altered in translation. `ai.service.js` appends a short retry instruction to the user message (`RETRY_INSTRUCTION`) if the first attempt's output failed parsing or validation, quoting the specific reason back to the model.

## Interview questions

1. *"Why does the retry logic append the specific validation failure reason to the prompt, rather than just resending the exact same prompt again?"* — Tests whether the candidate understands that resending an identical prompt to a non-deterministic model is a weak retry strategy (it might just fail the same way again) — telling the model specifically what was wrong ("strengths must be a non-empty array") gives it a much better chance of self-correcting on the second attempt.
2. *"How would you catch a regression where the prompt builder's described schema and the validator's actual schema silently drift apart?"* — Should point to the actual mechanism used here: a test that asserts every field name in `REQUIRED_STRING_SECTIONS`/`REQUIRED_ARRAY_SECTIONS` (imported directly from `ai.validator.js`) appears in the generated system prompt string — a structural check, not a hand-maintained comment reminding a future developer to keep the two in sync.

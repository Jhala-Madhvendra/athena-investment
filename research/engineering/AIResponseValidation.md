# Engineering Concept: AI Response Validation

## What it is

`backend/ai/ai.validator.js`'s `validateReportSchema(report, evidenceAllowList)` is the code-level gate every LLM response has to pass before `ai.service.js` will persist or return it: required string fields present and non-empty, required arrays non-empty and containing only non-empty strings, no unexpected top-level keys, and every `sectionEvidence` citation cross-checked against a real, closed list of context field paths. It returns `{isValid, errors, warnings, sanitized}` — the same shape convention every other validator in this codebase already uses (`dcf.validator.js`, `ratio.validator.js`, `comps.validator.js`).

## Why we use it

The sprint's core principle is that the LLM is never the source of truth — that principle is only real if something *other than the LLM's own good behavior* enforces it. A system prompt is an instruction, not a guarantee; a model can still, on some fraction of calls, drop a required field, add an unrequested one, or return an empty array where a populated one was required. Validation is what turns "the model was told to do X" into "the response provably does X, or gets rejected."

## Alternatives considered

- **A JSON Schema library (Ajv, Zod) instead of hand-written checks.** Rejected, matching the rest of the codebase — Athena has zero validation library dependencies anywhere (`backend/package.json` confirms this), and the hand-written `{isValid, errors}` style is already the established convention. The AI domain's validation needs (required non-empty strings/arrays, a closed key set, one cross-referenced field) don't justify introducing the repo's first schema library dependency.
- **Trusting the prompt and only validating on observed failures in production.** Rejected: an ungrounded or malformed report reaching a user is exactly the failure mode the sprint explicitly prohibits ("do not return malformed data") — validation has to run on every response, not just ones that already look suspicious.
- **Hard-failing on any recommendation-adjacent language.** Rejected in favor of a soft, logged warning — a strict regex block risks false-positiving on legitimate analytical phrasing ("investors should avoid overpaying for growth") and silently discarding an otherwise-good report over a false alarm is its own kind of failure.

## Trade-offs

- **Pro:** the "no unexpected top-level keys" check is a single rule that catches an entire class of problems at once — a hallucinated field, a model deciding to add its own recommendation field, or a future prompt-injection attempt smuggling extra instructions into the output, all fail the same way.
- **Pro:** evidence-path cross-checking degrades gracefully — an unknown citation is stripped, not treated as fatal, so one hallucinated citation doesn't sink an otherwise well-formed, well-grounded report.
- **Con:** the soft recommendation-language check is a blunt regex (`\bbuy\b`, `\bsell\b`, etc.) that will false-positive on benign phrases containing those words as substrings of other terms (documented directly in `ai.validator.test.js`) — accepted because the alternative (a stricter, hard-blocking check) risks discarding valid reports over coincidental word matches, a worse failure mode for a soft, defense-in-depth layer.

## How Athena implements it

Validation runs inside `ai.service.js`'s `attemptReport()` immediately after parsing; on failure, `ai.service.js` retries once with the specific validation errors quoted back into the prompt, and only raises `MalformedLLMResponseError` (502) if the second attempt also fails — so a single validation miss doesn't necessarily surface as a user-facing error, but two in a row do, rather than silently looping forever. Validated output is `.trim()`-sanitized before being persisted (`ai.model.js`) or returned to the frontend.

## Interview questions

1. *"Why does an unexpected top-level key cause hard validation failure, while an unrecognized evidence-path citation only gets silently stripped?"* — Tests whether the candidate can distinguish structural integrity (the report's actual shape must be exactly right, no exceptions) from a lower-stakes annotation (a wrong citation makes one evidence chip disappear, not the whole report unusable) — the two failure modes warrant different severities.
2. *"The retry logic calls the LLM a second time after a validation failure. What stops this from becoming an expensive infinite loop if the model consistently fails?"* — Should identify the fixed retry count (exactly one retry, hardcoded in `ai.service.js`'s two sequential `attemptReport()` calls, no loop) — after the second failure, the pipeline raises an error rather than retrying again, bounding worst-case cost at two LLM calls per report generation.

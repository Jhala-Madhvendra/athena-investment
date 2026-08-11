# Engineering Concept: AI Error Handling

## What it is

Every failure mode specific to calling an external LLM — provider outage, timeout, rate limiting, malformed/invalid output, insufficient upstream data to even build a context — mapped to a specific error class with a specific HTTP status code, flowing through the same `sendServiceError` mechanism every other Athena domain already uses, rather than a bespoke error-handling path invented just for AI.

## Why we use it

An LLM call is a slower, less predictable external dependency than Yahoo Finance or Twelve Data (Athena's other external calls) — it can time out, get rate-limited, or (uniquely to this domain) technically "succeed" at the HTTP level while returning content that fails Athena's own validation. Each of these needs to surface as a distinct, actionable error rather than a generic 500, both so the frontend can render an appropriate message and so server logs can distinguish "our code is buggy" from "the provider was rate-limiting us" from "the model didn't follow instructions this time."

## Alternatives considered

- **A single generic `LLMError` for every failure.** Rejected: `ai.controller.js` needs to return different status codes for different situations (429 for rate limiting so a client can reasonably back off and retry, 404 for a ticker with no underlying data at all, 502 for a genuinely malformed response) — collapsing them into one error class would either lose that distinction or push string-matching logic into the controller, exactly what the existing codebase's typed-error-class convention (`CompanyNotFoundError`, `NoFinancialDataError`, etc.) avoids everywhere else.
- **Swallowing LLM errors and returning a degraded-but-200 response.** Rejected — the sprint is explicit that malformed data must never reach the client; a 200 response with a broken or missing report would be worse than a clear error, since the frontend and any future consumer would have no signal to treat it differently from a real report.
- **Retrying indefinitely on any failure.** Rejected — retries are scoped narrowly (one retry, only for parse/validation failures, never for provider-level errors like rate limits) specifically because retrying a rate-limited or timed-out call immediately is more likely to make the situation worse than better.

## Trade-offs

- **Pro:** reusing `sendServiceError` (rather than inventing AI-specific response formatting) means the AI domain's error responses look exactly like every other domain's to the frontend — `AIResearch.jsx`'s error handling is unremarkable, using the same `fetchJson` pattern every other page already uses.
- **Pro:** `InsufficientContextError` is checked *before* any LLM call is made (in `ai.service.js`, after the context builder runs but before the prompt builder does) — a ticker Athena has no data for at all fails fast and cheaply, never spending a paid API call on a report that could never have been grounded in anything.
- **Con:** the distinction between "provider error, don't retry" and "malformed output, retry once" requires `ai.service.js` to know which errors originate from the LLM call itself (rate limit, timeout, auth) versus from parsing/validating an otherwise-successful response — a boundary that has to be maintained carefully as the pipeline evolves (see `attemptReport`'s try/catch scoping).

## How Athena implements it

Five error classes cover the AI domain's specific failure modes: `LLMProviderError` (502), `LLMRateLimitError` (429), `LLMTimeoutError` (504) — all defined once in `providers/llmProvider.js` so any current or future provider throws the same vendor-agnostic types — plus `InsufficientContextError` (404) and `MalformedLLMResponseError` (502), both defined in `ai.service.js` itself since they're specific to Athena's own pipeline logic, not to any vendor. `ai.controller.js` catches all of them uniformly via `sendServiceError(res, error, 502)`, relying on each class's own `.statusCode` to pick the right response.

## Interview questions

1. *"Why does `InsufficientContextError` get thrown before the LLM is ever called, rather than letting the LLM see an almost-empty context and respond however it responds?"* — Tests whether the candidate connects this to cost efficiency and grounding both: an LLM given a context with zero available sections has nothing real to interpret, so the call would either produce a useless response or (worse) start inventing content to fill the gap — failing fast avoids paying for a call that can't succeed honestly.
2. *"A user reports the AI report failed with a 429. What does that tell you, and what should the frontend do differently than for a 502?"* — Should identify: 429 means Athena's own request rate to the LLM provider is being throttled — this is transient and likely to succeed shortly, so a frontend could reasonably suggest "try again in a moment," versus a 502 (malformed response after a retry, or a genuine provider error) which doesn't carry the same "just wait" signal and might need investigation if it recurs.

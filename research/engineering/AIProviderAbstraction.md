# Engineering Concept: AI Provider Abstraction

## What it is

`backend/ai/providers/` isolates every vendor-specific detail of talking to an LLM behind one interface, exactly the way `backend/providers/financialDataProvider.js` already isolates Yahoo/Twelve Data behind one interface for financial data:

```js
// providers/llmProvider.js
class LLMProvider {
  async generateReport(prompt) {
    throw new Error("generateReport must be implemented by an LLM provider.");
  }
}
```

`providers/llmProvider.registry.js` reads `AI_LLM_PROVIDER` from the environment and instantiates the matching concrete class (today, only `AnthropicLLMProvider`), exporting a singleton — `ai.service.js` imports the registry, never a concrete provider directly.

## Why we use it

`ai.service.js` (the orchestrator) and everything upstream of it (context builder, prompt builder, validator) have no reason to know whether the underlying model is Claude, GPT, or something else — they only need "give me a report for this prompt, or throw one of three well-known error types." Without the abstraction, a future provider swap (or a multi-provider fallback strategy) would mean changing the orchestrator itself; with it, it's a new file in `providers/` plus one line in the registry's switch statement.

## Alternatives considered

- **Call the Anthropic SDK (`@anthropic-ai/sdk`) directly from `ai.service.js`.** Rejected: couples the orchestrator to one vendor's client library and error shapes, and diverges from this repo's established convention of zero SDK dependencies for external APIs (Yahoo and Twelve Data are both hand-rolled `fetch` clients) — see `AnthropicClient` below.
- **A single generic `callLLM(url, body)` function instead of a class hierarchy.** Rejected: the base-class-plus-registry pattern is already proven in this codebase (`financialDataProvider.js`/`.registry.js`) and gives every future provider a compile-time-checkable contract (`generateReport` must exist) rather than an implicit one.

## Trade-offs

- **Pro:** provider swap is a one-env-var change (`AI_LLM_PROVIDER=openai`) once a second concrete provider exists — no changes to `ai.service.js`, `ai.promptBuilder.js`, or `ai.validator.js`.
- **Pro:** every error `ai.service.js` needs to handle is one of exactly three vendor-agnostic classes (`LLMProviderError`, `LLMRateLimitError`, `LLMTimeoutError`), defined once in `llmProvider.js` — adding a second provider never means adding a fourth error type the orchestrator has to learn about.
- **Con:** the abstraction only has one real implementation today (Anthropic) — its value is speculative until a second provider actually exists, the same trade-off `financialDataProvider.js` accepted when Yahoo was its only implementation.

## How Athena implements it

`providers/anthropic/anthropicClient.js` is the low-level HTTP layer (mirrors `twelveDataClient.js`: one `sendMessage()` function, normalized errors, `isRateLimitError`/`isTimeoutError` helpers). `providers/anthropic/anthropicLlm.provider.js` is the thin adapter implementing `LLMProvider.generateReport`, translating `anthropicClient`'s errors into the three generic classes. `ai.service.js` only ever imports `providers/llmProvider.registry.js`.

## Interview questions

1. *"Why three error classes instead of just letting every provider error bubble up as a generic Error?"* — Tests whether the candidate sees that `ai.controller.js` needs to map failures to different HTTP status codes (429 for rate limits, 504 for timeouts, 502 for everything else) — a single generic Error would force the controller to string-match error messages, which is fragile and vendor-specific exactly where the abstraction is supposed to prevent that.
2. *"What would change if Athena added a second LLM provider tomorrow?"* — Should identify: a new `providers/openai/` folder implementing the same `LLMProvider` interface, one new `case` in `llmProvider.registry.js`'s switch, and zero changes anywhere else in the AI domain — proving the abstraction boundary is where it should be.

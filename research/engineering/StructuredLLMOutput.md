# Engineering Concept: Structured LLM Output

## What it is

Rather than letting the LLM return free-form prose that Athena would then have to parse heuristically, `ai.promptBuilder.js` instructs the model to return exactly one JSON object matching a fixed schema, and `ai.responseParser.js` + `ai.validator.js` turn that instruction into an actually-reliable pipeline: parse the text into an object, then validate the object's shape before anything downstream trusts it.

## Why we use it

A research report has genuinely structured content (an Executive Summary is a different kind of thing than a Risks list) — free-form prose would force the frontend to guess where one section ends and the next begins, using string-matching heuristics ("look for a line starting with 'Risks:'") that break the moment the model phrases something slightly differently. A closed JSON schema turns "does this report have the right sections" from a fuzzy text-parsing problem into a mechanical, testable one.

## Alternatives considered

- **Provider-native structured output / tool-use mode** (having the API itself constrain generation to a JSON schema, where supported). Not used for the initial implementation — the fetch-based `anthropicClient.js` sends a plain prompt instruction rather than a schema-constrained request, keeping the first version simple and provider-portable; this is a documented opportunity for a future iteration, not a rejected option (see Trade-offs).
- **Markdown output, parsed by section headers.** Rejected: markdown headers are even less reliable to parse deterministically than JSON keys (heading text can vary: "Key Risks" vs "Risks" vs "## Risks"), and JSON gives a single unambiguous format with a real parser (`JSON.parse`) instead of a hand-rolled markdown-section splitter.

## Trade-offs

- **Pro:** JSON is trivially parseable and directly maps to what the frontend needs to render — no intermediate text-to-structure translation layer with its own bugs.
- **Pro:** a closed schema (rejecting unexpected top-level keys) doubles as a safety mechanism — a model attempting to add a `"recommendation"` or `"priceTarget"` field on its own initiative gets rejected by the same check that catches an honest formatting mistake.
- **Con:** models occasionally wrap JSON in markdown code fences or add a sentence of preamble despite instructions not to — `ai.responseParser.js` has to defensively recover from both cases (fence-stripping, then a last-resort `{...}` substring extraction) rather than assuming instruction-following is perfect.
- **Con:** not using provider-native schema-constrained generation (where available) means the pipeline still needs its own retry logic for occasional malformed output, rather than the API guaranteeing valid JSON on every call — a reasonable simplification for a first version, worth revisiting once a single provider is battle-tested.

## How Athena implements it

`ai.responseParser.js`'s `parseReportResponse(rawText)` tries a direct `JSON.parse` first, falls back to stripping a ` ```json ` fence, then falls back to extracting the substring between the first `{` and last `}` — each step only attempted if the previous one failed, and the final failure throws a plain `Error` with the raw text attached for logging. Parsing success does *not* imply the result is usable — that's a separate concern, validated next by `ai.validator.js`.

## Interview questions

1. *"Why is JSON parsing success treated as a separate, weaker guarantee than schema validation passing?"* — Tests whether the candidate sees that `{"foo": "bar"}` is valid JSON but not a valid report — `ai.responseParser.js` only proves the text is *syntactically* JSON; `ai.validator.js` is what proves it's the *right* JSON, and conflating the two would let a syntactically-valid-but-empty response through.
2. *"What would you change about this pipeline if you moved to a provider that supports native structured-output/schema-constrained generation?"* — Should identify: the response parser's fence-stripping/substring-extraction fallbacks would likely become unnecessary (the API guarantees valid JSON), but `ai.validator.js`'s schema and content checks would still be needed — provider-level JSON validity guarantees don't protect against a model returning conformant-but-wrong content (e.g., a valid-shaped report with fabricated evidence paths).

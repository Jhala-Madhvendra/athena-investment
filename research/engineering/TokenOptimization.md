# Engineering Concept: Token Optimization

## What it is

Every design decision that keeps the AI context and prompt small without losing the information the LLM actually needs to write a grounded report — deliberately excluding raw financial statements, full price history, full DCF sensitivity/scenario matrices, and duplicate/derivable fields from the context `ai.contextBuilder.js` sends the model.

## Why we use it

Two independent costs scale directly with prompt size: money (LLM APIs bill per input token) and reliability (a longer, noisier context gives a model more surface area to selectively misread or over-index on an irrelevant detail). Neither is hypothetical here — the sprint explicitly calls out cost efficiency as a design requirement, and the "only send what's needed" discipline is also what keeps the grounding guarantee tractable: a smaller, fully-vetted context is easier to reason about ("every field here is safe to cite") than a large one with parts nobody explicitly decided belonged.

## Alternatives considered

- **Send the full financial statements and let the LLM pick out what's relevant.** Rejected — this is the single biggest token-cost lever available and was rejected specifically because it also reopens exactly the risk the sprint's core principle is designed to prevent: an LLM "noticing" and interpreting a raw line item Athena's engines never validated for this purpose invites the AI to become a second, uncontrolled source of financial claims.
- **Send full 5-year daily price history instead of summarized period returns.** Rejected — `marketData.performance` (1M/3M/6M/1Y/5Y percentage returns, already computed by `market.service.js`) captures what a narrative report actually needs; ~1,260 daily OHLCV bars would add enormous token cost for information the report never uses at that granularity.
- **Send the full DCF sensitivity matrix and comps peer bundles.** Rejected — only headline outputs (intrinsic value, WACC, upside/downside; valuation range, implied-per-multiple values) are included; the underlying per-cell sensitivity grid and full peer financial bundles are Athena-internal calculation detail, not narrative-report content.

## Trade-offs

- **Pro:** the resulting context is roughly 1.6–2.0KB of JSON (~400–500 tokens by the standard chars/4 estimate) — small enough that the prompt-plus-context total comfortably fits well under typical context windows with room to spare, and cheap enough per call that persisting reports (rather than regenerating on every page view) is a genuine cost optimization rather than a necessity to avoid runaway spend.
- **Pro:** a smaller context is also a smaller attack surface for the evidence allow-list (`buildEvidenceAllowList`) — fewer possible citation paths means less for the model to potentially misuse, and a shorter list for `ai.validator.js` to check against.
- **Con:** some genuinely interesting detail is deliberately left out (e.g., the DCF's full year-by-year FCFF forecast, individual comps peer multiples) — a user who wants that level of detail still needs to visit the interactive DCF/Comps tabs; the AI report is a summary layer, not a replacement for them.

## How Athena implements it

Each `ai.contextBuilder.js` section builder hand-picks a small, named subset of its source service's full return value (e.g., `buildMarketDataSection` takes `price.current`/`fiftyTwoWeekHigh`/`fiftyTwoWeekLow`/`marketCap` from a much larger quote object, and drops `previousClose`/`open`/`dayHigh`/`dayLow`/`volume` entirely as not narratively relevant) rather than forwarding a service's response wholesale. Ratio leaves are flattened from `{label, value, unit, available}` down to a bare number (`flattenRatioGroup`), since the key name itself is already descriptive and `label`/`unit`/`available` are redundant for an LLM prompt even though they're useful for the interactive UI.

## Interview questions

1. *"How would you estimate the actual token cost of an AI research report generation, and where would you look to reduce it further if needed?"* — Should describe: the context (~400–500 tokens) plus the fixed system prompt (a few hundred tokens) plus `max_tokens` for the response (1800) gives a rough per-call ceiling; the biggest further lever, if needed, would be trimming the system prompt's rule text (already fairly compact) or dropping less-used context fields (e.g., `dividend`) rather than the currently-included headline figures.
2. *"Why flatten ratio values to bare numbers for the LLM context but keep the richer `{label, value, unit, available}` shape for the interactive Ratios tab?"* — Tests whether the candidate sees these are two different consumers with two different needs: a human glancing at a UI benefits from an explicit unit/availability badge next to each number; an LLM prompt already gets the semantic meaning from the JSON key name (`grossMargin`) and paying tokens to repeat "unit: percent" for every one of a dozen ratios is a real, avoidable cost with no corresponding benefit to the model's ability to interpret the figure correctly.

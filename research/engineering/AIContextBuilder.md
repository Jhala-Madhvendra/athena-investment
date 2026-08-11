# Engineering Concept: AI Context Builder

## What it is

`backend/ai/ai.contextBuilder.js` is a single function, `buildResearchContext(ticker, options)`, that calls six existing Athena services in-process (never over HTTP) — `company.service`, `ratio.service`, `analysis.service`, `market.service`, `valuation.service`, `comps.service`/`comps.peerSelector` — and assembles their outputs into one compact JSON object shaped for an LLM prompt, with every section independently wrapped as `{available: true, ...fields}` or `{available: false, reason}`.

```js
const [profile, ratios, analysis, marketData, dcf, comps] = await Promise.all([
  buildProfileSection(ticker),
  buildRatiosSection(ticker),
  buildAnalysisSection(ticker),
  buildMarketDataSection(ticker),
  buildDcfSection(ticker, options),
  buildCompsSection(ticker),
]);
```

## Why we use it

No backend aggregator existed before this sprint — Sprint 5's "unified overview" is a *frontend* composition (`Overview.jsx` firing five parallel `fetch()` calls). The AI report needs a single, compact, server-side object to hand an LLM (sending a browser five separate payloads is fine; sending an LLM five separate API round-trips per report generation is not), so this sprint had to build the first true backend aggregator. Building it as a pure aggregation layer — no new calculations, only composition of already-tested engines — keeps the new code's correctness question narrow: "did it read the existing services right," not "did it recompute anything right."

## Alternatives considered

- **HTTP self-calls to Athena's own REST endpoints** (`fetch('http://localhost:5000/api/ratios/...')`) instead of in-process function calls. Rejected: every one of the six services already exports plain, `req`/`res`-free async functions (confirmed by inspection before writing this file) — an HTTP round-trip to itself would add latency, a second point of failure, and awkward auth/networking for zero benefit over a direct `require()` and function call.
- **One big try/catch around the whole aggregation.** Rejected: a single failure (e.g., no comps peers available) would then take down sections that had nothing to do with it. Each section gets its own try/catch specifically so partial data degrades gracefully — a hard requirement from the sprint brief.
- **Auto-computing DCF/Comps exactly as the interactive tool does, with no fallback for missing user input.** Rejected for DCF's cost-of-debt gap specifically — see `research/finance/CostOfDebt.md` and the Considerations below; an AI-triggered report has no user to supply the value interactively, so the context builder accepts an optional override and falls back to a clearly-labeled illustrative estimate scoped only to this file.

## Trade-offs

- **Pro:** every section failure is isolated — a market-data outage doesn't block ratios, health score, or DCF from still producing a usable (partial) report.
- **Pro:** because every service call is a plain function import, the context builder is fully unit-testable by mocking six modules, with zero network or database dependency in the test itself (`ai.contextBuilder.test.js`, 10 tests).
- **Con:** the comps peer-selection heuristic (same sector, closest market cap, top 5) is a genuine departure from Sprint 7's "peer selection stays entirely user-controlled" principle — necessary because there's no user in an AI-triggered flow, but it means the AI report's Comps section is less rigorously vetted than a user-built one, and the context/report both say so explicitly (`peerSelectionMethod`, `considerations`).

## How Athena implements it

Six section builders, each independently try/caught, run in parallel via `Promise.all`. `buildDcfSection` additionally guards against fabricating company-specific assumptions: if any Athena-derived figure (revenue growth, EBIT margin, tax rate, etc.) is genuinely unavailable, DCF is marked unavailable rather than substituted; only `preTaxCostOfDebt` — the one input Athena's DCF module structurally never derives for anyone — gets an illustrative fallback, and only within this file. `buildEvidenceAllowList(context)` walks the assembled context and produces a flat list of dot-paths (e.g. `dcf.intrinsicValuePerShare`) that the prompt builder and validator both use to constrain the model's citations to real fields.

## Interview questions

1. *"Why does the context builder call `getDCFDefaults()` and then `calculateDCFValuation()` itself, instead of just reading whatever DCF result the interactive tool last computed?"* — Tests whether the candidate knows DCF results are never persisted in Athena (`research/product/DCFProductDesign.md`) — there's nothing to read; a fresh DCF has to be computed for the AI report the same way the interactive tool computes one on demand, just without a human supplying `preTaxCostOfDebt`.
2. *"The comps peer-selection heuristic picks peers by sector and market-cap proximity. What's the actual risk in shipping that, given Sprint 7 explicitly avoided automatic peer suggestion?"* — Should identify: Athena has no similarity-scoring data (confirmed in `comps.peerSelector.js`'s own doc comment), so an auto-selected peer set can be lower quality than a human-reviewed one; the mitigation is that the context/report both explicitly flag the peer set as auto-selected and unvetted, rather than presenting it with the same implied confidence as a user-built comps analysis.

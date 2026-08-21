# Scenario Comparison Engine

## Definition

`POST /api/portfolio/scenarios/compare` runs several named scenario definitions against the *same* portfolio snapshot and returns them side by side, plus a flat `comparisonTable` for direct display — the "Bull vs. Base vs. Bear" table/chart the sprint brief describes.

## Why it exists

Comparing scenarios one at a time (running `/run` three separate times and manually lining up the results) works but wastes both network round trips and, more importantly, the portfolio/company/beta context fetch — each `/run` call would independently re-fetch the same current holdings, sector/industry data, and betas that don't change between scenarios in the same comparison. It also pushes the "line these results up consistently" work onto the frontend for something the backend can guarantee by construction instead.

## Alternatives considered

- **N independent client-side calls to `/run`** — rejected: N times the network latency, N times the redundant portfolio-context fetch, and no server-guaranteed consistency that every scenario in the comparison was evaluated against the exact same snapshot of holdings (a holding could theoretically change between two sequential client calls).
- **Persisting comparison "sessions" server-side** — rejected as unnecessary infrastructure for a stateless, single-request comparison; see `research/product/AdvancedScenarioProductDesign.md` on why scenario persistence generally is deferred.
- **A single mega-endpoint that also handles sensitivity and presets** — rejected in favor of three small, single-purpose endpoints (`/run`, `/compare`, `/presets`) matching the sprint's "do not create unnecessary endpoints" guidance while still keeping each one's responsibility obvious from its name.

## Athena implementation

`portfolio.scenario.service.js`'s `compareScenarios(userId, {scenarios, benchmark, window})` calls `loadScenarioContext(userId)` **once**, then calls the same pure `runScenarioAgainstContext(context, scenarioDefinition)` used by `/run`, once per scenario in the request (`portfolio.scenario.service.test.js` asserts `portfolioService.getPortfolio`/`Company.find` are each called exactly once regardless of how many scenarios are compared). Historical context is likewise fetched once and shared across every scenario in the response, since it describes the portfolio's past, not any one scenario's hypothesis. The response's `comparisonTable` is a flat array (`name`, `scenarioPortfolioValueUSD`, `absoluteChangeUSD`, `percentageChange`) — no ranking, no "best"/"worst" verdict field; the frontend (`ScenarioComparisonView.jsx`) renders it as a table plus a horizontal bar chart with an explicit "largest modeled impact" framing rather than any evaluative label (see `research/product/AdvancedScenarioProductDesign.md` Section 9).

## Testing strategy

`portfolio.scenario.service.test.js`'s `compareScenarios` suite asserts the single-fetch behavior directly (call counts on the mocked I/O boundary), plus that the `comparisonTable` correctly reflects each scenario's own already-tested `runScenarioAgainstContext()` output — no separate comparison-specific math to verify, since comparison is explicitly "the same engine, run N times, context fetched once." `portfolio.scenario.validator.test.js` covers `validateCompareRequest`'s per-scenario error prefixing (`scenarios[1].rules must be...`) so a malformed scenario in a batch is traceable back to its index.

## Interview questions

1. **"Why does `/compare` fetch portfolio context once instead of reusing `/run`'s logic N times end-to-end?"** — Because the expensive part (fetching current holdings, sector/industry, and betas) doesn't vary between scenarios in the same comparison — only the rules do. Fetching it once and running the cheap, pure calculation N times against that shared snapshot is both faster and guarantees every scenario in the comparison was evaluated against identical portfolio data.
2. **"Why doesn't the comparison response rank scenarios as 'best' or 'worst'?"** — Because that would require Athena to assert an opinion about which outcome is more likely or more desirable — exactly what the sprint's no-recommendation, no-probability principles rule out. The response reports raw, comparable numbers per scenario; framing which one matters most is left entirely to the reader.
3. **"What guarantees the comparison table's numbers match what a separate `/run` call for the same scenario would return?"** — Both endpoints call the identical pure function, `runScenarioAgainstContext()`, on the identical context-loading path — there's no parallel calculation logic for comparison to accidentally drift out of sync with `/run`.

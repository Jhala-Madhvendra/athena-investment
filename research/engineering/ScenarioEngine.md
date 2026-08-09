# Engineering Concept: The Scenario Engine

## What it is

`backend/valuation/dcf/dcf.scenarios.js` runs the same deterministic DCF engine three times — Bear, Base, Bull — over systematically-shifted assumptions, rather than implementing three separate calculation paths. See `research/finance/ScenarioAnalysis.md` for the finance reasoning behind what varies and why.

## Why we use it

A scenario engine's entire value proposition collapses if its three outputs don't provably come from the same underlying math — a user needs to trust that "Bull Case: $112" and "Base Case: $96" differ *only* because of the stated revenue-growth and margin deltas, not because of a subtle divergence between two independently-written calculation paths. Reusing the exact same `calculateDCF()` function for all three, varying only the input object, makes that guarantee structural rather than something that has to be maintained by discipline across duplicated code.

## Alternatives considered

- **Three separate calculation functions** (`calculateBearCase()`, `calculateBaseCase()`, `calculateBullCase()`), each independently implementing the DCF math with different hardcoded assumptions. Rejected — triples the surface area for a bug, and any future change to the core DCF formula (a bug fix, a new line item) would need to be applied in three places instead of one, with no compiler or test to catch a missed spot.
- **A single function with a `scenario` enum parameter** that branches internally on `'bear' | 'base' | 'bull'`. Rejected in favor of the deltas being data (`SCENARIO_DELTAS`), not control flow — a `switch` statement hardcodes the *fact* that there are exactly three named scenarios into the function's logic, whereas `runScenarios(engineInput, deltas)` accepts any set of named deltas, making the three-scenario convention a caller-level default rather than an engine-level constraint (useful for tests that pass custom deltas, and would make adding a fourth named scenario a one-line config change rather than a new branch).

## Trade-offs

**For the reuse-the-engine approach:** zero duplicated DCF math; any core engine fix or feature automatically applies to all three scenarios; the scenario engine itself is tiny (`buildScenarioAssumptions()` plus a three-way `calculateDCF()` call) and easy to fully unit test, including a direct assertion that Bull > Base > Bear for the default deltas.

**Against it:** three full DCF calculations run per scenario request instead of one — a real but modest cost (pure in-memory arithmetic, no I/O per calculation), and one that would only matter at a request volume Athena isn't near. If scenario requests became a performance bottleneck, the fix is caching or parallelizing the three calls, not abandoning the reuse pattern.

## How Athena implements it

`buildScenarioAssumptions(baseAssumptions, deltas)` returns a new assumptions object with only `revenueGrowth` and `ebitMargin` shifted, applying the delta uniformly whether the underlying assumption is a scalar or a per-year array (`applyDelta()` branches on `Array.isArray`). `runScenarios(engineInput, deltas = SCENARIO_DELTAS)` calls `calculateDCF()` three times, once per named scenario, and returns all three full results together. `valuation.service.js`'s `calculateDCFScenarios()` is the only caller that adds market-comparison fields (current price, valuation gap) to each scenario's result — the scenario engine itself, like the core DCF engine, stays market-data-agnostic.

## Interview questions

1. *"Why not hardcode three functions — `calculateBull()`, `calculateBase()`, `calculateBear()` — if the business only ever needs exactly these three?"* — Because "the business only ever needs exactly these three" isn't actually guaranteed to stay true, and even if it were, three separate implementations of the same underlying DCF math is a maintenance liability regardless — a future bug fix to FCFF calculation would need to be applied and tested in three places instead of one. Modeling scenarios as *data* (a set of named deltas) fed into one reusable engine call keeps the "three named scenarios" convention at the calling layer, where it's easy to see and easy to change, rather than baked into the calculation engine's control flow.
2. *"How would you test that the scenario engine doesn't silently duplicate or diverge from the main DCF calculation logic?"* — By construction, not by a targeted test: since `runScenarios()` calls the exact same `calculateDCF()` function the main `/dcf` endpoint uses, any test that passes for the main engine already covers scenarios' calculation correctness. The scenario-specific tests only need to verify the *delta application* logic (does Bull actually add +2pp to revenue growth and margin, does Base apply a true no-op) and the expected *directional* relationship (Bull ≥ Base ≥ Bear for the default deltas) — not re-verify the DCF math itself.

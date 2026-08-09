# Engineering Concept: The Sensitivity Analysis Engine

## What it is

`backend/valuation/dcf/dcf.sensitivity.js` builds a two-dimensional grid (WACC × Terminal Growth Rate) by calling the deterministic DCF engine once per cell, rather than deriving the grid analytically or maintaining a separate calculation path. See `research/finance/SensitivityAnalysis.md` for the finance reasoning behind the choice of these two variables.

## Why we use it

Same underlying engineering reason as the scenario engine (`ScenarioEngine.md`): a sensitivity table that used different math than the headline DCF result would risk the two silently disagreeing, and a user comparing "the sensitivity table's center cell" against "the main result" needs those to be *guaranteed* identical, not just usually identical. Re-running the same `calculateDCF()` per cell makes that guarantee structural.

## Alternatives considered

- **Deriving the sensitivity grid analytically** from the Gordon Growth formula's partial derivatives with respect to WACC and `g`, rather than brute-force recalculating. Rejected — it would only capture the Terminal Value's sensitivity, not the *entire* DCF's (which also includes each forecast year's FCFF being independently discounted at the same WACC) — an analytical shortcut here would be subtly incomplete, whereas a full re-run captures every WACC-dependent piece of the calculation correctly by construction, at negligible extra computational cost (25 cells × pure in-memory arithmetic).
- **Pre-computing a fixed grid shape** rather than accepting a caller-supplied range. Rejected — `buildRangeAroundCenter()` and the `waccValues`/`terminalGrowthValues` parameters let the range be centered on whatever the user's actual base case is (not a fixed absolute range that might not even bracket their assumptions), and let the API accept explicit overrides for callers who want a different grid shape.

## Trade-offs

**For the brute-force-per-cell approach:** guaranteed consistency with the main DCF result; correctly and automatically captures *every* WACC-dependent effect (forecast-year discounting and terminal value both), not just the terminal value's; trivially handles the "some cells are mathematically invalid" case for free, since each cell independently runs the same validated `calculateDCF()` call and just reports `isValid: false` for a rejected combination rather than needing special-cased grid logic.

**Against it:** N×M DCF calculations per sensitivity request (25 for the default 5×5 grid) instead of one — still cheap in absolute terms for pure arithmetic with no I/O, but a real multiplier worth being aware of if grid sizes or request volume grow significantly.

## How Athena implements it

`buildRangeAroundCenter(center, steps, stepSize)` generates an evenly-spaced range centered on a given value (e.g., the user's actual computed base-case WACC), defaulting to 5 steps. `buildSensitivityMatrix(engineInput, {waccValues, terminalGrowthValues})` maps over every `(wacc, terminalGrowthRate)` pair, calling `calculateDCF()` with those two values overridden and everything else held at the base case, and records `{isValid, intrinsicValuePerShare, errors}` per cell — never throwing on an invalid combination, since `terminalGrowthRate >= wacc` is an expected, valid *outcome* for some cells in a wide-enough grid, not an engine failure.

## Interview questions

1. *"A sensitivity grid could be computed analytically from the Terminal Value formula's derivative instead of brute-force re-running the whole DCF per cell. Why didn't Athena do that?"* — An analytical shortcut based only on the Terminal Value formula would miss that WACC also changes the discount factor applied to every explicit forecast year's FCFF, not just the terminal value — it would be subtly incomplete. Re-running the full engine per cell is simple, provably correct (same code path as the headline result), and computationally cheap enough (pure arithmetic, no I/O) that the "waste" of recomputing the forecast years for every cell isn't a real cost worth engineering around.
2. *"How does the sensitivity engine handle a WACC/terminal-growth combination that's mathematically invalid?"* — It doesn't special-case it at all — `calculateDCF()`'s own validator already rejects `terminalGrowthRate >= wacc` for any single call, so a sensitivity cell with that combination just gets back `{isValid: false, errors: [...]}` the same way a single direct DCF request would. The matrix builder records that per-cell result rather than throwing, letting a grid legitimately contain a mix of valid and invalid cells — which the frontend renders as blank cells with an explanatory tooltip rather than crashing the whole table.

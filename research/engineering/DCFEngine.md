# Engineering Concept: The DCF Engine (Pure, Framework-Independent Core)

## What it is

`backend/valuation/dcf/dcf.engine.js` is the calculation core of Sprint 6: a set of functions that take a plain JavaScript object describing a company's historical financials, forecast assumptions, and capital structure, and return a plain object describing the full DCF result. It has zero dependencies on Express, MongoDB, or Yahoo Finance — no `require("mongoose")`, no `req`/`res`, no network calls anywhere in the file.

## Why we use it

Financial calculation logic is the highest-stakes, most test-critical code in a valuation feature — it needs to be trivially unit-testable (feed it an object, assert on the object it returns), independently verifiable against hand-worked examples, and safe to reuse from anywhere (an HTTP endpoint today, a batch job or CLI script tomorrow) without dragging along a database connection or an HTTP request/response cycle. Keeping I/O out of the calculation layer is what makes all of that possible.

## Alternatives considered

- **Calculate directly inside `valuation.controller.js` or `valuation.service.js`**, alongside the Mongoose queries and Yahoo fetches. Rejected — this is the pattern the codebase already avoids elsewhere (`ratio.formulas.js`, `analysis/trend.engine.js` are both similarly pure), and mixing I/O with financial arithmetic makes both harder to test: testing the math would require mocking a database, and testing the I/O would require also verifying arithmetic.
- **A single monolithic `calculateDCF()` function** doing forecasting, discounting, and terminal value inline. Rejected in favor of splitting into `dcf.formulas.js` (pure math primitives), `dcf.validator.js` (input validation), and `dcf.engine.js` (orchestration) — see `FinancialCalculationEngine.md` for the reasoning behind that specific split.

## Trade-offs

**For the pure-engine approach:** every formula and every orchestration step is independently unit-testable with hand-computed expected values (see `dcf.formulas.test.js`, `dcf.engine.test.js`); the engine can be reused unchanged by scenario analysis (`dcf.scenarios.js`) and sensitivity analysis (`dcf.sensitivity.js`) simply by calling it multiple times with varied inputs, rather than needing its own parallel calculation logic; determinism (`DeterministicCalculations.md`) is straightforward to guarantee and test when there's no I/O to make non-deterministic in the first place.

**Against it:** the boundary layer (`dcfInput.mapper.js`, `valuation.service.js`) has to do real work translating Mongoose documents and Yahoo-shaped API responses into the engine's plain-object contract — that translation is itself a place bugs can hide (and did: the CapEx sign convention bug was a boundary-layer bug, not a formula bug — see `dcf.formulas.js`'s documented sign contract and `FCFF.md`'s bug-history note).

## How Athena implements it

`calculateDCF(input)` is the main entry point: it runs `dcf.validator.js`'s `validateDCFInput()` first and returns `{isValid: false, errors}` immediately on any failure — the engine body never has to defensively handle malformed input, because validation is a hard gate before any arithmetic runs. On valid input, it forecasts FCFF year by year (`forecastFCFF()`), discounts each year and the terminal value, and returns a result object that includes not just the final `intrinsicValuePerShare` but the entire per-year waterfall (`forecastDetail`) — because Sprint 6's product requirement is calculation transparency, not just a final number, the engine's *output contract* had to support showing every intermediate step, not just the last one.

## Interview questions

1. *"Why does the DCF engine know nothing about where its input data comes from?"* — Separating pure calculation from I/O means the engine's correctness can be verified independently of the database, the market data provider, or the HTTP layer — a hand-computed test case is sufficient to prove the math is right, with no mocking required. It also means the same engine can be reused for scenario and sensitivity analysis by simply calling it with different inputs, rather than needing parallel calculation logic that could drift out of sync.
2. *"The engine returns `{isValid: false, errors}` instead of throwing an exception for invalid input. Why?"* — Invalid DCF assumptions (e.g., WACC ≤ terminal growth) are an expected, common outcome of user input, not an exceptional program state — modeling it as a normal return value keeps the calling code's control flow simple (`if (!result.isValid) return result;`) rather than requiring try/catch around every call, and makes the full set of possible outcomes visible in the function's return type rather than hidden in what it might throw.

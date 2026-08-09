# Engineering Concept: The Formulas / Engine / Validator Split

## What it is

A recurring three-file pattern across Athena's calculation-heavy modules (`ratio/`, `analysis/`, and now `valuation/dcf/`): a **formulas** module of small, pure, single-purpose functions; an **engine** (or calculator/service) module that orchestrates those formulas into a full result; and a **validator** module that checks input shape and financial sanity *before* the engine runs. `dcf.formulas.js` / `dcf.engine.js` / `dcf.validator.js` is Sprint 6's instance of a pattern `ratio.formulas.js` / `ratio.calculator.js` / `ratio.validator.js` already established.

## Why we use it

Financial calculations have three genuinely different concerns that change for different reasons and at different rates: the math itself (a formula rarely changes once it's correct), how the math is assembled into a domain-specific result (changes as product requirements evolve — e.g., adding per-year transparency to the DCF waterfall), and what counts as valid input (changes as new edge cases are discovered — e.g., adding the "WACC must exceed terminal growth" rule). Keeping these in separate files means a change to one doesn't risk an accidental change to another, and each is independently testable at the right grain: formulas get exhaustive unit tests with hand-computed values, the engine gets integration-style tests over realistic input, and the validator gets a battery of "here's exactly what should be rejected and why" tests.

## Alternatives considered

- **One file per domain** (a single `dcf.js` with everything). Rejected — as the DCF domain grew (formulas, historical calculation, forecasting, validation, scenarios, sensitivity), a single file would have become a multi-hundred-line mix of concerns that's harder to navigate and harder to test at the right granularity.
- **Validation inline inside the engine function**, as defensive `if` checks scattered through the calculation logic. Rejected — this is what `dcf.validator.js` deliberately replaces: one validation pass, at the top, with one clear list of everything that must be true, rather than validation logic interleaved with arithmetic where it's easy to miss a case.

## Trade-offs

**For the split:** each file has one job and is trivially testable at the right level of granularity (`dcf.formulas.test.js` never needs to construct a full realistic company; `dcf.validator.test.js` never needs to know how FCFF is actually computed). It also makes reuse safe — `dcf.scenarios.js` and `dcf.sensitivity.js` both call `dcf.engine.js`'s `calculateDCF()` directly rather than reimplementing any part of the pipeline, because the engine's public surface is small and well-defined.

**Against it:** more files and more `require()` boilerplate to navigate than a single-file implementation, and understanding one full calculation end-to-end requires reading across three files rather than one. In practice this cost is front-loaded (learning the pattern once) rather than recurring, since the same three-file shape repeats across `ratio/`, `analysis/`, and `valuation/dcf/`.

## How Athena implements it

`dcf.formulas.js` exports pure functions with no dependencies on each other's callers — `nopat()`, `fcff()`, `wacc()`, `terminalValueGordonGrowth()`, etc. — each independently correct and independently testable. `dcf.validator.js` imports only `isFiniteNumber` from formulas and validates the full engine input shape, returning `{isValid, errors}`. `dcf.engine.js` imports both, runs the validator first, then composes the formulas into `calculateHistoricalFCFF()` and `calculateDCF()`. No file in this trio ever imports Express, Mongoose, or a market data provider — that boundary is `dcfInput.mapper.js` and `valuation.service.js`'s job (see `DCFEngine.md`).

## Interview questions

1. *"You have a formula module, an engine module, and a validator module for the same domain. What's the concrete cost of merging them into one file, and is it worth it?"* — The concrete cost is losing independent testability at the right grain — a validator test would need to also exercise the full calculation pipeline just to check a rejected-input case, and a formula test would need to construct realistic multi-year DCF input just to verify a one-line arithmetic function. The split's cost (more files, more navigation) is real but front-loaded; the testing cost of merging them would recur on every new test written against the module.
2. *"How do you decide whether a new function belongs in the formulas file or the engine file?"* — If it's a self-contained calculation that takes primitive inputs and returns a primitive or simple object with no orchestration logic (no loops over years, no calling other functions in the same module), it belongs in formulas. If it composes multiple formula calls, loops over a forecast period, or makes a decision about *which* formula to call based on the shape of the input, it belongs in the engine.

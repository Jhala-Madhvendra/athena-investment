# Engineering Concept: Deterministic Calculations

## What it is

A deterministic calculation is one where the same input, called any number of times, always produces exactly the same output — no reliance on the current time, random numbers, external service state, or execution order. `dcf.engine.js`'s `calculateDCF()` is deterministic by construction: it's a pure function of its input object.

## Why we use it

A financial valuation tool that gives a different answer for the same inputs on two different calls is untrustworthy by definition — a user re-running the exact same DCF (same ticker, same assumptions) five minutes later needs to see the exact same number, or the tool's credibility is gone. Determinism is also what makes the engine cheaply and confidently testable: a test can assert `calculateDCF(input)` equals a specific expected object, once, and trust that assertion holds forever (barring an intentional code change) — no flaky tests, no "run it three times and take the majority."

## Alternatives considered

- **Caching a DCF result and serving it on repeat requests.** Rejected for a different reason than determinism (it's about performance/staleness, not correctness) — see `research/product/DCFProductDesign.md`'s persistence trade-off discussion. Determinism is actually what makes caching *safe* to consider later, if ever needed: a cached result is only valid to reuse if the same inputs are guaranteed to produce the same output.
- **Introducing "reasonable" internal defaults inside the engine** for missing assumptions, as a UX convenience. Rejected — this is the specific behavior `dcf.validator.js` exists to prevent (see `InputValidation.md`); a silent internal default would make the engine's output depend on undocumented internal state rather than purely on its declared input, undermining both determinism-as-a-property and the product's "no fabricated assumptions" principle at once.

## Trade-offs

**For strict determinism:** trivial, reliable testing (`dcf.engine.test.js` asserts `calculateDCF(validInput())` equals a second, separately-constructed identical call's result via `toEqual` — a direct determinism test, not just a spot-check of individual fields); safe reuse by scenario and sensitivity analysis, which both call the engine repeatedly with systematically varied inputs and need to trust that any output difference reflects the input difference, not calculation noise; a valuation that's fully explainable and reproducible by a third party given the same inputs.

**Against it:** none, really, for this domain — a DCF calculation has no legitimate reason to vary given identical inputs, unlike, say, a recommendation engine that might deliberately incorporate randomness for exploration. The only "cost" is discipline: every new function added to the engine must avoid `Date.now()`, `Math.random()`, or any implicit dependency on mutable external state, which requires attention during code review but imposes no runtime cost.

## How Athena implements it

The engine takes `calculatedAt: new Date().toISOString()` *out* of the pure calculation path entirely — it's added by `valuation.service.js`, one layer above the engine, precisely so `dcf.engine.js` itself never touches the wall clock. `dcf.formulas.js` and `dcf.engine.js` contain no `Math.random()`, no direct database or network calls, and no module-level mutable state that could leak between calls (contrast with `riskFreeRate.provider.js`'s intentional, isolated cache — a deliberate, documented exception at the I/O boundary, not inside the calculation core). The test suite verifies this property directly rather than just assuming it: `dcf.engine.test.js`'s "produces a deterministic, internally consistent valuation" test calls `calculateDCF()` twice with freshly-constructed but value-identical input and asserts the two results are `toEqual`.

## Interview questions

1. *"How would you prove, not just assert, that a calculation engine is deterministic?"* — Call it twice with separately-constructed but value-equal input and assert the outputs are deeply equal — exactly what `dcf.engine.test.js` does. A single call's output looking "reasonable" doesn't prove determinism; only a repeat-call comparison does.
2. *"Where does `new Date()` belong in a system with a deterministic calculation core, and why not just put a timestamp directly in the engine's output?"* — At the boundary layer that calls the engine (here, `valuation.service.js`), not inside the engine itself — even a single `new Date()` call inside `dcf.engine.js` would make its output depend on wall-clock time in addition to its declared input, breaking the "same input → same output, always" guarantee the whole module is designed around, and would make the determinism test itself fail intermittently depending on exact call timing.

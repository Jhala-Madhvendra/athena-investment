# Engineering Concept: The Formula Engine

## What it is

The Formula Engine is [ratio.formulas.js](../../backend/ratio/ratio.formulas.js) — a module of small, pure functions, one per financial ratio, each taking a single `statement` object and returning either a `number` or `null`. It contains **zero I/O**: no database calls, no HTTP, no imports of services. It doesn't even know what a "category" (profitability, liquidity, ...) is — that grouping lives one layer up, in the Calculation Layer.

```js
const grossMargin = (statement) => {
  const revenue = statement.incomeStatement.totalRevenue;
  const grossProfit = statement.incomeStatement.grossProfit;

  const ratio = safeDivide(grossProfit, revenue);
  return ratio === null ? null : ratio * 100;
};
```

Every formula shares one guard: `safeDivide(numerator, denominator)`, which returns `null` if either argument isn't a `number` or if the denominator is `0`. This single function is what makes "division by zero" and "missing field" a solved problem exactly once, instead of eleven times.

## Why we chose this design

**Pure functions are the cheapest possible unit of correctness to reason about and test.** A formula here has no hidden dependency — given the same statement object, it always returns the same result, with no mocking required to unit test it. That property matters a lot for a domain (financial math) where correctness bugs are silent and costly: a formula that's wrong doesn't crash, it just quietly reports the wrong number to an investor.

Isolating the *math* from the *response shape* (label, unit, rounding, `available` flag — all handled by the Calculation Layer, not here) also means a formula change never has to touch presentation code, and a presentation change never risks touching math. When Sprint 3 adds DCF valuation, it will very likely reuse `freeCashFlow` and other formulas from this exact file — that reuse is only possible because the functions have no coupling to the ratio-response format.

## Alternatives considered

- **A single big "calculateAllRatios" function with inline math.** Rejected: harder to test individual ratios, harder to extend, and any bug in one calculation risks silently breaking neighboring calculations sharing local variables.
- **A generic, config-driven formula engine** (e.g., an array of `{name, numeratorPath, denominatorPath, scale}` objects interpreted at runtime). This is a legitimate pattern at larger scale, but for 11 formulas it would trade a small amount of duplication for a layer of indirection (string-based field paths, a mini interpreter) that makes formulas harder to read, harder to debug, and loses compile-time/IDE navigation to the actual field names.
- **Ratios stored as MongoDB virtual fields or getters on the statement model.** Rejected — see the "why ratios aren't stored" discussion in the Sprint 2 architecture notes; coupling formulas to the Mongoose schema layer would make them harder to test in isolation and harder to reuse from a future service (e.g., a DCF engine) that isn't fetching a Mongoose document.

## Tradeoffs

- **Pro:** trivially testable, trivially extensible (new ratio = new function + one line in the calculator), no risk of one formula's bug leaking into another's.
- **Pro:** reusable outside the ratio API — any future feature (DCF, screening, alerts) can import `ratio.formulas.js` directly.
- **Con:** some repetition across formulas (each one re-reads statement fields rather than sharing a destructured context) — an accepted tradeoff for readability, since each formula is fully self-contained and can be read top-to-bottom without jumping elsewhere.
- **Con:** doesn't scale gracefully to hundreds of ratios without some organization (e.g., splitting into per-category formula files) — acceptable now, revisit if the formula count grows an order of magnitude.

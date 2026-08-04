# Engineering Concept: The Calculation Layer

## What it is

The Calculation Layer is [ratio.calculator.js](../../backend/ratio/ratio.calculator.js). It sits directly on top of the [[FormulaEngine]] and does two jobs the formulas themselves deliberately don't do:

1. **Group** individual formula results into the five business categories the API contract promises (`profitability`, `liquidity`, `solvency`, `cashFlow`, `efficiency`).
2. **Format** each raw number/`null` into a consistent response object via `buildRatio()`:

```js
const buildRatio = (label, value, unit) => ({
  label,
  value: typeof value === "number" ? Number(value.toFixed(4)) : null,
  unit,
  available: typeof value === "number",
});
```

So a raw `formulas.grossMargin(statement)` call returning `42.857142...` becomes:

```json
{ "label": "Gross Margin", "value": 42.8571, "unit": "percent", "available": true }
```

And a `null` result (missing data or division by zero) becomes:

```json
{ "label": "Gross Margin", "value": null, "unit": "percent", "available": false }
```

## Why we chose this design

This is the **Response Formatter** step called out explicitly in the sprint architecture (`Formula Calculator → Response Formatter → Frontend`). The key idea is that the frontend should never have to ask "is this a number, a string, `null`, or `undefined`, and what do I show if it's not there?" — the `available` flag answers that question once, on the backend, in one place. [FinancialAnalysis.jsx](../../frontend/src/components/FinancialAnalysis.jsx) can then render every single ratio card with the exact same code path, regardless of category or unit type, by branching only on `unit` (`percent` / `ratio` / `currency`) and `available`.

Keeping this as a separate module from `ratio.formulas.js` also means the **shape of the API response can evolve independently of the math**. If a future sprint wants to add a `trend` field (comparing this year's ratio to last year's) or a `benchmark` field (industry average), that change happens entirely in the Calculation Layer — the formulas don't need to know or care.

## Alternatives considered

- **Formatting inline inside each formula function.** Rejected: this would duplicate the `available`/rounding/unit logic eleven times and couple pure math to a specific response shape, making the formulas harder to reuse elsewhere (e.g., a future DCF engine that just wants the raw number).
- **Formatting on the frontend instead of the backend.** Rejected: it would push "is this ratio valid?" logic into the UI layer, and every future consumer of this API (a mobile client, a future public API, an AI report generator) would have to reimplement the same missing-data logic instead of getting it for free from the response.
- **A generic ratio-registry pattern** (declaring ratios as `{ key, category, unit, compute }` entries in a single array, then deriving both the calculator and the API response from that array via iteration). This is a reasonable evolution once ratio count grows large, but for 11 ratios across 5 fixed categories, explicit grouping functions (`calculateProfitability`, `calculateLiquidity`, ...) are more readable and let each category be extended independently without touching a shared registry.

## Tradeoffs

- **Pro:** one consistent response contract for every ratio, present and future — the frontend rendering code doesn't grow with each new ratio.
- **Pro:** `available: false` is an explicit signal, not an inferred one — no ambiguity between "this ratio is 0" and "this ratio couldn't be computed."
- **Con:** adding a new ratio requires touching two files (`ratio.formulas.js` for the math, `ratio.calculator.js` for the grouping/label/unit) rather than one — an acceptable, deliberate separation of concerns rather than a convenience shortcut.

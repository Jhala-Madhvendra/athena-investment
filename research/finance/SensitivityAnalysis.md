# Sensitivity Analysis

## 1. Definition

Sensitivity Analysis systematically re-runs a valuation across a range of values for its most consequential, most subjective assumptions, showing how much the output actually moves — turning "this DCF says $96/share" into "this DCF says somewhere between $70 and $157/share depending on two specific, named assumptions," which is a much more honest and useful statement.

## 2. The formula

Not a single formula — a grid. Athena's sensitivity table varies two variables independently:

```
For each (WACC, Terminal Growth Rate) pair in a grid:
    Intrinsic Value / Share = calculateDCF(..., wacc, terminalGrowthRate)
```

Every other assumption (revenue growth, margins, tax rate, capital structure) stays fixed at the base case's values.

## 3. Intuition

A DCF's single headline number invites false confidence — it looks precise (often to the cent) despite being built on assumptions nobody can know for certain. WACC and terminal growth are singled out as the two axes specifically because Terminal Value typically dominates Enterprise Value (see TerminalValue.md), and Terminal Value's formula divides by `(WACC − g)` — the single most sensitive relationship in the entire model. Varying these two, holding everything else fixed, isolates and visualizes exactly the assumptions that matter most.

## 4. Why investors use it

It answers the question a single-point DCF can't: "how wrong would I have to be for this conclusion to change?" If a stock trades well outside the *entire range* of the sensitivity grid, that's a much stronger, more assumption-robust signal than a single point estimate landing on one side of the price. If the stock's price sits comfortably inside the grid's range, that's useful information too — it says the valuation conclusion is genuinely sensitive to reasonable disagreement about WACC and terminal growth, not a settled question.

## 5. Assumptions

Assumes WACC and terminal growth are the two variables worth isolating — a defensible but not unique choice; a different sensitivity table (say, EBIT margin × revenue growth) would illuminate a different kind of uncertainty (operating assumptions rather than valuation-mechanics assumptions). Assumes the grid's range is wide enough to be informative but narrow enough to stay economically plausible — Athena defaults to ±2 percentage points around the base WACC (1pp steps) and ±1pp around the base terminal growth (0.5pp steps), a reasonable default the API also allows overriding.

## 6. Limitations

A 2-variable grid, by construction, doesn't show the effect of the *other* assumptions (revenue growth, margins) moving simultaneously — a full picture would require a much higher-dimensional sensitivity (or Monte Carlo simulation), which trades simplicity and readability for completeness. Some cells in the grid are mathematically invalid (terminal growth ≥ WACC) and must be handled explicitly rather than silently omitted or crashing the whole table.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.sensitivity.js`'s `buildSensitivityMatrix()` re-runs the existing, already-tested `calculateDCF()` once per grid cell — no separate calculation logic, so the sensitivity table is guaranteed to agree with the main DCF result by construction, not by coincidence:

```js
const buildSensitivityMatrix = (engineInput, { waccValues, terminalGrowthValues }) => ({
    waccValues, terminalGrowthValues,
    rows: waccValues.map((wacc) => ({
        wacc,
        cells: terminalGrowthValues.map((terminalGrowthRate) => {
            const result = calculateDCF({ ...engineInput, assumptions: { ...engineInput.assumptions, wacc, terminalGrowthRate } });
            return { wacc, terminalGrowthRate, isValid: result.isValid, intrinsicValuePerShare: result.isValid ? result.intrinsicValuePerShare : null, errors: result.errors };
        }),
    })),
});
```

Invalid cells (where `terminalGrowthRate >= wacc`) aren't special-cased in the matrix builder at all — `calculateDCF`'s own validator naturally rejects them per-cell, and the matrix just records `isValid: false` for that cell rather than crashing or silently omitting it. The frontend (`SensitivityTable.jsx`) renders those cells as a plain "—" with an explanatory tooltip, and highlights the cell matching the user's actual base-case WACC and terminal growth with a distinct border, so the grid's context (where "here" sits relative to the range) is never lost.

## 8. Common mistakes

- **Building a separate calculation path for the sensitivity table** instead of reusing the main engine — risks the table and the headline number silently disagreeing if one is updated and the other isn't. Athena avoids this by construction (same `calculateDCF()` call, different inputs).
- **Silently dropping invalid cells** instead of showing them as explicitly invalid — a blank cell with no explanation looks like a data-loading bug rather than a mathematically meaningful "not a valid combination."
- **Choosing a grid range so narrow it doesn't actually stress-test anything**, or so wide it includes economically implausible combinations (e.g., WACC below the risk-free rate) — the range itself needs to be a considered choice, not an arbitrary default.

## 9. Interview questions

*"Why WACC and terminal growth specifically, rather than revenue growth and EBIT margin, for the two-variable sensitivity grid?"* — Because Terminal Value dominates most DCF outputs, and its formula's denominator (`WACC − g`) is the single most sensitivity-concentrated relationship in the whole model — a small change in either variable near that boundary can swing the valuation far more than an equivalent change in a revenue-growth or margin assumption. It's the pair most likely to change the conclusion, which is what a sensitivity table should isolate.

*"How would you explain a sensitivity table to a stakeholder who just wants 'the number'?"* — I'd frame it as: the DCF doesn't produce one number, it produces a number *conditional on* two of its most uncertain inputs — and the table shows the honest range of outcomes across the plausible range of those inputs, which is more useful for a real decision than a false-precision single figure. If the stock's current price sits well outside that entire range, that's actually a stronger signal than any single point estimate would have been on its own.

# Terminal Value

## 1. Definition

Terminal Value is the estimated value, as of the end of the explicit forecast period, of every year of cash flow the company will generate *after* that — forever. A DCF can't forecast individual years indefinitely, so it forecasts explicitly for a finite window (Athena defaults to 5 years) and then collapses "everything after that" into one number.

## 2. The formula

Athena implements the Perpetual Growth (Gordon Growth) method:

```
Terminal Value = FCFF(n+1) / (WACC − g)
where FCFF(n+1) = FCFF(n) × (1 + g)
```

`n` is the final explicit forecast year, `g` is the terminal (perpetual) growth rate.

## 3. Intuition

The Gordon Growth formula is the closed-form value of a cash flow stream that starts at `FCFF(n+1)` and grows at a constant rate `g` forever, discounted at rate `WACC`. It's a geometric series that happens to have a clean algebraic sum precisely because growth and discounting are both constant — which is also exactly why the terminal growth rate must represent a sustainable, *forever* growth rate (something close to long-run GDP or inflation), not a continuation of a high-growth forecast period.

## 4. Why investors use it

In most DCFs, Terminal Value is the single largest component of Enterprise Value — often 60-80%+ of the total. That's not a flaw in the method; it's just mathematically what happens when you're valuing a going concern that (presumably) keeps generating cash indefinitely, and only a handful of years are forecast explicitly. Understanding this is essential to reading a DCF honestly: the "precision" of a 5-year explicit forecast is often dwarfed in influence by the terminal growth assumption's effect on this one number.

## 5. Assumptions

The core assumption is that by year `n`, the company has settled into a stable, mature growth rate that can plausibly continue forever — no company can grow faster than the economy indefinitely without eventually becoming larger than the economy itself, which is why `g` is almost always modest (commonly anchored to long-run inflation or GDP growth, roughly 2-3%). It also assumes WACC itself stays constant into perpetuity, and that margins/reinvestment needs in the terminal year are representative of the long-run steady state (not still ramping or still elevated from a growth phase).

## 6. Limitations

**WACC must be strictly greater than `g`.** If growth ever equals or exceeds the discount rate, the formula produces an undefined or negative present value for an infinite stream — nonsensical, since no real perpetuity can be worth more than infinity, and a shrinking or zero denominator is a mathematical breakdown, not a signal of extreme value. Athena's engine enforces this as a hard validation failure, never a computed-but-wrong number (see `dcf.validator.js`). Even well clear of that boundary, Terminal Value is *extremely* sensitive to small changes in the WACC-minus-g spread — the smaller that spread, the more explosive the sensitivity, which is exactly why Athena's sensitivity table (SensitivityAnalysis.md) uses WACC and terminal growth as its two axes rather than any other pair of assumptions.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`'s `terminalValueGordonGrowth()`:

```js
const terminalValueGordonGrowth = ({ finalYearFCFF, wacc, terminalGrowthRate }) => {
    if (waccRate <= terminalGrowthRate) return null; // last-resort guard
    const nextYearFCFF = finalYearFCFF * (1 + terminalGrowthRate);
    return nextYearFCFF / (waccRate - terminalGrowthRate);
};
```

The `wacc <= terminalGrowthRate` guard here is deliberately a *last resort* — the real enforcement happens earlier, in `dcf.validator.js`, which rejects this combination before the engine ever runs and returns a specific, human-readable error rather than a silently-null result. Because there's no live data source for a "correct" long-run growth rate, `dcfInput.mapper.js` pre-fills Terminal Growth Rate with a labeled `illustrative_default` (2.5%) rather than leaving it blank or fabricating a company-specific figure — see CAPM.md for the parallel reasoning applied to Equity Risk Premium.

## 8. Common mistakes

- **Setting `g` too close to WACC "to be optimistic."** Because the formula divides by `(WACC − g)`, a small `g` increase near that boundary causes a *disproportionate* jump in Terminal Value — an analyst chasing a higher valuation by nudging `g` up half a point can distort the whole model far more than they realize.
- **Using the explicit forecast's high growth rate as the terminal rate.** A company growing 15%/year in its explicit forecast almost certainly cannot sustain that forever; extending it into the terminal formula implies the company eventually becomes larger than the entire economy.
- **Ignoring how much of Enterprise Value comes from Terminal Value.** Treating a DCF's headline number as if it were mostly driven by the "precisely modeled" explicit years, when in most real models it's mostly driven by one perpetuity formula's two most subjective inputs.

## 9. Interview questions

*"Why must the terminal growth rate be strictly less than WACC, and what happens mathematically if it isn't?"* — The Gordon Growth formula is the closed-form sum of an infinite geometric series; that series only converges (has a finite sum) when the growth rate is less than the discount rate. If `g ≥ WACC`, the "sum" is either undefined (division by zero) or negative despite representing a growing, positive cash flow stream — a mathematical artifact, not a real economic signal, which is why Athena treats it as a hard validation error rather than a computed result.

*"Terminal Value often makes up 70%+ of a DCF's Enterprise Value. Does that undermine the usefulness of the explicit forecast years?"* — Not undermine, but it does mean the explicit years' real job is to get the company to a believable, stable *starting point* for the terminal formula (a representative margin, growth rate, and reinvestment level in year `n`), more than to precisely predict five years of cash flow. The honest takeaway is that a DCF's output is more a function of "what do you believe this business looks like once it matures" than of near-term forecasting precision — which argues for spending analytical effort on the terminal assumptions and the WACC-g sensitivity, not just the explicit-year growth rates.

# Engineering Concept: The Industry Benchmark Engine

## What it is

`backend/industry/industry.benchmark.js` and `industry.calculator.js` together form the deterministic core of Industry Intelligence: `industry.calculator.js` computes one company's per-metric bundle (reusing `ratio.formulas.js` and `comps.formulas.js`, never reimplementing them), and `industry.benchmark.js` aggregates a set of those bundles into universe statistics, then compares one target company against them. Neither file touches Express, MongoDB, or an external provider — the same "pure calculation layer" discipline `comps.engine.js` and `dcf.engine.js` already established.

## Why we use it

Reuse discipline is the load-bearing decision here. Athena already has a Ratio Engine for margins/returns and a Comps engine for trading multiples — building a third, parallel implementation of "operating margin" or "P/E" for Industry Intelligence would risk the two definitions quietly drifting apart (a classic reuse-vs-duplication failure mode). Instead, `industry.calculator.js` is a thin orchestrator: every formula call is a direct `require()` of the existing module, and the only genuinely new logic is the handful of things that don't already exist anywhere — revenue growth from two statements, a percentile-rank function, and materiality-threshold classification.

## Alternatives considered

- **Reimplementing margin/ROE/P/E calculations inside `industry.calculator.js`.** Rejected — this is precisely the duplication the Sprint 13 brief warns against ("Do not duplicate existing calculations"), and it would double the surface area that needs to stay correct if a formula's edge-case handling ever changes.
- **Computing industry statistics with a general-purpose stats library.** Rejected — `comps.statistics.js` already implements mean/median/percentile/summarize with the exact sample-size and outlier philosophy Athena wants (see `OutlierHandling.md`); pulling in a new dependency for functionality Athena already has, and has already tested, would be pure overhead.
- **One combined `industry.engine.js` file mixing calculation and aggregation.** Rejected in favor of splitting `industry.calculator.js` (per-company) from `industry.benchmark.js` (cross-company statistics) — they have genuinely different inputs (one statement bundle vs. an array of computed bundles) and different consumers (the target's own metrics are used directly; the universe's metrics are only ever consumed in aggregate).

## Trade-offs

**For reuse-first:** an outlier-handling override needed for debt-to-equity (see `OutlierHandling.md`'s new section) had to be layered *on top of* `ratio.formulas.debtToEquity()` rather than inside it, since that formula is shared with other Athena features that don't need the same exclusion rule. This is slightly more code in `industry.calculator.js` than a from-scratch implementation would need, in exchange for never risking two different "operating margin" numbers appearing in different parts of the app.

**Against it:** the calculator has to accept whatever shape the existing formula modules expect (statement documents shaped like `FinancialStatement`, not a custom Industry-specific input type) — slightly less flexibility than a purpose-built calculator would have, but it means a bug fix to `ratio.formulas.js` automatically propagates to Industry Intelligence without any additional change.

## How Athena implements it

`buildCompanyMetricBundle()` takes a ticker's latest and prior `FinancialStatement` plus a market cap, and returns nine metrics (`revenueGrowth`, `operatingMargin`, `netMargin`, `roe`, `roa`, `fcfMargin`, `debtToEquity`, `pe`, `evEbitda`), each as `{value, exclusionReason}` — never a bare number, never a silent `null`. `industry.benchmark.js`'s `summarizeMetric()` wraps `comps.statistics.summarize()` with a stricter gate (`MIN_UNIVERSE_SIZE = 4` applies to mean/median too, not just percentiles — see `research/finance/FinancialPercentiles.md`), `percentileRank()` is new (the inverse of `comps.statistics.percentile()`), and `compareToTarget()`/`classifyPosition()` produce the neutral-language comparison and strength/weakness classification the frontend renders directly.

## Interview questions

1. *"Why is `industry.calculator.js` a separate file from `industry.benchmark.js` instead of one module?"* — They operate on different shapes at different times: the calculator runs once per company (target or universe member) against raw statement data; the benchmark engine runs once per metric against an *array* of already-computed values. Testing them separately is also cleaner — the calculator's tests are about correct formula application to one company, the benchmark's tests are about correct statistics over a set.
2. *"How would you verify `industry.calculator.js` never silently duplicates logic already in `ratio.formulas.js`?"* — Every metric that has an existing formula (`operatingMargin`, `netMargin`, `roe`, `roa`, base `debtToEquity`) calls that formula directly rather than reimplementing the division — grep for `ratioFormulas.` and `compsFormulas.` in `industry.calculator.js` shows every metric's source. Only genuinely new logic (revenue growth from two statements, the debt-to-equity negative-equity override) has code that doesn't exist elsewhere.
3. *"What would break if `comps.formulas.priceToEarnings()`'s sign convention changed?"* — `industry.calculator.calculatePE()` would inherit the change automatically (it calls the function directly), which is the intended behavior — Sprint 13's P/E and Sprint 7's P/E should always agree, since they're computed by the same code.

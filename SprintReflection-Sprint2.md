# Sprint 2 Reflection — Financial Intelligence Engine (Ratio Analysis)

## What was built

A Ratio Engine that reads stored financial statements from MongoDB and computes 11 ratios across five categories — Profitability (Gross Margin, Operating Margin, Net Profit Margin, ROE, ROA), Liquidity (Current Ratio, Quick Ratio), Solvency (Debt to Equity, Debt Ratio), Cash Flow (Free Cash Flow), and Efficiency (Asset Turnover) — exposed via `GET /api/ratios/:ticker` and rendered as a new "Financial Analysis" tab alongside the existing statement tables. The module follows a strict one-directional pipeline (`financials.service → ratio.service → ratio.calculator → ratio.formulas`, formatted through `buildRatio`) and never talks to Yahoo Finance directly, per the architecture constraint. Error handling covers missing companies (404), missing/invalid statement shape (422), and division-by-zero / missing fields (silent `null` → "N/A" in the UI, never a crash).

## Finance concepts learned

Working through all 11 ratios surfaced a recurring theme: **no ratio is safe to read in isolation.** ROE looks great until you check Debt-to-Equity, because leverage inflates it (the DuPont decomposition — `ROE = Net Margin × Asset Turnover × Equity Multiplier` — is what actually explains *why*). Current Ratio looks fine until Quick Ratio reveals the liquidity is really just unsold inventory. Net Income growth looks healthy until Free Cash Flow reveals it isn't converting to actual cash. This is exactly why the ratios are grouped and displayed together rather than one at a time — the product decision and the finance concept reinforce each other directly (see [research/product/FinancialHealthDashboard.md](research/product/FinancialHealthDashboard.md)).

## Engineering concepts learned

The sprint's core engineering lesson was **separating pure computation from response formatting from validation**, each at the layer that can actually guarantee its own precondition:
- [research/engineering/FormulaEngine.md](research/engineering/FormulaEngine.md) — pure math functions with no I/O, trivially testable and reusable.
- [research/engineering/CalculationLayer.md](research/engineering/CalculationLayer.md) — the layer that turns raw numbers into a stable, frontend-friendly contract (`{label, value, unit, available}`).
- [research/engineering/Validation.md](research/engineering/Validation.md) — validation happens exactly once at each boundary (statement shape at the top, per-field safety inside `safeDivide`), so nothing downstream needs defensive checks for problems already ruled out upstream.

The single most reused piece of code in the whole module is `safeDivide` — one function eliminated an entire category of runtime crashes (`NaN`, `Infinity`, `TypeError` on `undefined`) across all eleven formulas.

## Product decisions

The decision to group ratios into the five standard analyst categories (rather than a flat list) was the main product call this sprint — it mirrors how ratios are actually taught and used professionally, and lets a user answer a narrower question ("is this company solvent?") without scanning unrelated numbers. The decision to explicitly mark `available: false` rather than omitting a ratio or showing `0` was equally deliberate — it keeps the UI honest about missing data instead of implying a company has zero debt when the data was simply never reported.

## Challenges faced

- Getting the negative-value semantics right: a negative Net Profit Margin (a real loss) and a negative Debt-to-Equity (negative equity, a distress signal) both had to be allowed through rather than filtered out as "invalid," while `NaN`/`Infinity` from a zero denominator had to be caught — the line between "unusual but true" and "not computable" isn't the same as "positive vs. negative."
- Keeping the Ratio Engine honestly decoupled from Yahoo Finance — it would have been easy to reach for a live quote for a "current" ratio value, but the architecture explicitly requires the engine to only ever read what's already been imported into MongoDB.

## Future improvements

- Add a caching layer (e.g., Redis, keyed by ticker + year + formula version) in front of `ratio.service.js` if ratio computation ever needs to scale beyond simple per-request math.
- Add trend data (this year vs. last year) and industry benchmarks to each ratio card — the `buildRatio()` response shape was deliberately left open to add fields like these without breaking the existing contract.
- Extend the Efficiency category (currently only Asset Turnover) with Inventory Turnover and Receivables Turnover as those fields become available from the provider.
- This Ratio Engine is the explicit foundation for Sprint 3's DCF valuation — `freeCashFlow` and the profitability formulas are expected to be reused directly rather than reimplemented.

## Interview story

*"In Sprint 2, I built a financial ratio engine for an investment research tool. The interesting engineering decision wasn't the math — it was where to put the guardrails. I split the code into a pure formula layer with no I/O, a formatting layer that turns raw numbers into a consistent API contract, and a validation layer that fails fast at the actual boundary where bad data enters — the statement shape, before any formula runs. That let me centralize every division-by-zero and missing-field edge case into one `safeDivide` helper instead of defending against it eleven separate times. The harder judgment call was recognizing that negative values aren't always errors — negative net income or negative equity are real, meaningful financial states the UI has to surface, not sanitize away. And architecturally, I made sure the ratio engine only ever reads from our own database, never from the upstream market-data provider directly — keeping the derived-data layer decoupled from the source-of-truth layer, which is also why I didn't persist the computed ratios themselves: they're cheap to recompute and would otherwise create a second, staleness-prone source of truth."*

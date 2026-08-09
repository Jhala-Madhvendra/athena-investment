# Sprint 6 Reflection — DCF Valuation Engine

*Note on file naming, continuing the convention `SprintReflection-Sprint5.md` established: the unsuffixed `SprintReflection.md` holds Sprint 3's reflection (an inherited naming accident), so this sprint's reflection follows the `SprintReflection-SprintN.md` pattern Sprint 2, 4, and 5 already use.*

## 1. What was built

A production-quality FCFF-based DCF valuation engine, end to end: a framework-independent calculation core (`backend/valuation/dcf/dcf.formulas.js`, `dcf.engine.js`, `dcf.validator.js`, `dcf.scenarios.js`, `dcf.sensitivity.js`), a service/controller/routes layer exposing four endpoints (`GET /:ticker/dcf/defaults`, `POST /:ticker/dcf`, `POST /:ticker/dcf/scenarios`, `POST /:ticker/dcf/sensitivity`), and a full frontend replacing the Sprint 5 "Coming Soon" placeholder — historical FCFF, an editable assumptions form with per-field source labeling, WACC breakdown, the full FCFF forecast waterfall, the DCF calculation chain, market price comparison, and Bull/Base/Bear scenarios plus a WACC × terminal-growth sensitivity heatmap. Two small, additive schema fields (`depreciationAndAmortization`, `dilutedSharesOutstanding`) and one new live data source (a 10-Year Treasury yield provider for CAPM's risk-free rate) were added along the way. 166 backend tests and 47 frontend tests cover it, all passing, plus a genuine pre-existing bug in Sprint 1/2's `ratio.formulas.js` Free Cash Flow card was found and fixed during this sprint's verification work.

## 2. Finance concepts learned

The single most important discipline this sprint enforced was keeping FCFF, FCFE, Enterprise Value, and Equity Value structurally distinct rather than treating them as interchangeable "cash flow" concepts — FCFF has to be capital-structure-neutral (computed top-down from EBIT, before any financing effects) specifically because it gets discounted at WACC, a blended rate; mixing FCFE with WACC or FCFF with cost of equity produces a number that isn't really Enterprise Value or Equity Value, just an internally inconsistent figure that happens to look like one. Terminal Value was the second real lesson — it typically dominates a DCF's output (often 60-80%+), and its Gordon Growth formula's `1/(WACC−g)` term means the two least-certain assumptions in the entire model (long-run growth and discount rate) have the most leverage over the final answer, which is the direct justification for why the sensitivity table uses exactly those two axes.

## 3. Engineering concepts learned

Determinism as a *provable* property, not just an assumed one — `dcf.engine.js`'s core test asserts two independently-constructed but value-identical calls produce `toEqual` results, which is what actually verifies "same input → same output," not just spot-checking that the numbers look reasonable. The formulas/engine/validator split (already established by `ratio.formulas.js` in earlier sprints) proved its worth directly when scenario and sensitivity analysis needed to reuse the exact same calculation core three and twenty-five times respectively, with zero duplicated DCF math — both `dcf.scenarios.js` and `dcf.sensitivity.js` are thin wrappers that vary the *input* to `calculateDCF()`, never reimplement any part of it. And the CapEx sign bug (next section) was a sharp lesson in the difference between "my test fixtures pass" and "this works against real data" — synthetic test data I wrote myself, using a positive CapEx value, happened to match the *documented contract* but not the *actual real-world sign convention*, and only live-testing against real AAPL data surfaced the mismatch.

## 4. Product decisions

No Buy/Sell language anywhere in the pipeline, enforced structurally (no code path maps a valuation gap to a recommendation string) and tested for at both the API and rendered-page level — a deliberate line between "analytical tool" and "financial adviser" that the sprint brief was explicit about and that seemed worth defending with tests, not just documentation. Labeling every assumption's source (`historical`/`derived`/`market`/`illustrative_default`/`required_user_input`) rather than presenting a flat, undifferentiated form — this ended up being the sprint's most consequential design decision, since it's what makes the "assumptions must be visible" product principle concrete rather than aspirational. Full reasoning in `research/product/DCFProductDesign.md`.

## 5. Important trade-offs

**Which "no live source" assumptions get a default vs. a hard stop.** Risk-Free Rate turned out to have a genuine live source (Yahoo's `^TNX` treasury yield) I hadn't initially planned for — adding it meant Beta and Risk-Free Rate are both real market data, while Equity Risk Premium and Terminal Growth Rate (no tradeable instrument exists for either) get a labeled illustrative default, and Pre-Tax Cost of Debt gets none at all, since there's no company-specific proxy for it whatsoever. This three-way split (live / illustrative / hard-required) was a genuine judgment call, made and then revisited once mid-sprint when the user pushed back on an initially-too-conservative "require everything" default. **Per-year assumption overrides deferred.** The engine and API both support per-year assumption arrays; the frontend applies one flat rate across the whole forecast. Building the per-year UI would have meaningfully expanded form complexity for a v1, and the backend already doesn't need to change when it's eventually added.

## 6. Difficult implementation decisions

Deciding where WACC gets computed was less obvious than it looks in hindsight — the engine's documented input contract (from the sprint brief itself) takes a single pre-computed `wacc` number, which meant WACC calculation had to live in `valuation.service.js`, one layer above the pure engine, rather than inside it — correct, but it meant the CAPM/cost-of-debt validation also had to live at that boundary layer (`valuation.validator.js`), genuinely separate from the engine's own validator (`dcf.validator.js`), which only makes sense once you see that the engine never sees Ke, Kd, or beta directly, only their already-blended result.

## 7. Bugs found and fixed (worth calling out explicitly)

Two real, financially-material bugs surfaced during this sprint's verification, not during initial implementation — both are worth naming because neither showed up in a syntax check or even a passing test suite built from synthetic fixtures:

- **CapEx sign convention.** Real Yahoo data reports `capitalExpenditure` as negative (an outflow). Both `dcf.engine.js`'s historical FCFF calculation and `dcfInput.mapper.js`'s suggested-default calculation initially subtracted the raw signed value — since subtracting a negative *adds* it, this silently inflated FCFF and every downstream number. Caught by live-testing against real AAPL data (`OCF + capitalExpenditure` matching Yahoo's own reported FCF exactly is what confirmed the sign convention empirically), fixed with an explicit `Math.abs()` normalization at the boundary, and locked in with regression tests using realistic negative fixtures.
- **Pre-existing bug in `ratio.formulas.js` (Sprint 1/2), same root cause.** The exact same sign issue existed in the app's original "Free Cash Flow" ratio card — `OCF − capitalExpenditure`, unmodified — meaning that card had likely been showing an inflated FCF figure since Sprint 1, undetected because that module had zero test coverage before this sprint. Fixed the same way, with a new `ratio/__tests__/ratio.formulas.test.js` this module never had.

Both are documented with their bug history directly in `research/finance/FCFF.md`, on the theory that a fixed bug with an honest paper trail is more useful to future readers than a silently-corrected one.

## 8. What was intentionally NOT built

Per-year assumption override UI (see Section 5). An FCFE-based valuation path (deliberately absent — `research/finance/FCFE.md` documents why, and the engine has no code path that could accidentally produce one). DCF result persistence/snapshots — every calculation is dynamic, recomputed from current stored financials, live market data, and the request's assumptions, on the reasoning that storing "the" DCF for a ticker would misleadingly imply one canonical answer. A dedicated PM-facing analytics event stream for the usage metrics named in `DCFProductDesign.md` Section 9 — those are proposed, not yet instrumented.

## 9. User assumptions being made

That users will actually read and act on the source-labeling badges rather than scrolling past them the way most people scroll past fine print — untested, and the single biggest open question about whether this sprint's core design bet paid off. That the ±2pp scenario delta and the default WACC/terminal-growth sensitivity range are wide enough to be informative without being so wide they include implausible combinations, for a *typical* company — neither is validated against real company volatility data. That a user who sees a large valuation gap correctly interprets it as "worth investigating further" rather than either "the market is wrong" or "this tool is broken."

## 10. What we'd validate with real users

Whether users can correctly describe, after using the feature, which numbers in their DCF were company facts versus their own judgment calls — the direct comprehension check for whether the labeled-assumption design is working or just adding visual clutter (see `DCFProductDesign.md` Q4). Whether the sensitivity table and scenario cards get genuinely used to stress-test a conclusion, or get ignored in favor of the single headline Intrinsic Value figure. Whether the illustrative-default values (5% ERP, 2.5% terminal growth) get edited at all, or whether users always just click through with them — informing whether the "starting point, not fact" framing is actually landing.

## 11. What would be improved with more time

Per-year assumption overrides in the UI. A live or historically-derived Equity Risk Premium source (even an approximation, like a rolling market-implied ERP) to shrink the "illustrative_default" surface area further. Instrumenting the usage metrics proposed in `DCFProductDesign.md` Section 9 so the open user-research questions in Section 10 have real answers instead of hypotheses. Extending the sensitivity table beyond the fixed 5×5 default to a user-adjustable range in the UI (the API already accepts explicit `waccValues`/`terminalGrowthValues` overrides; the frontend doesn't yet expose that).

## 12. Product Management interview questions

**Q1: A stakeholder asks why Athena doesn't just show a "Buy/Sell" badge like several competitor tools do.**
A: See `research/product/DCFProductDesign.md` Q1 — a badge implies a certainty the model doesn't have and creates real trust/regulatory risk; the valuation-gap framing preserves the nuance a binary would discard.

**Q2: How would you prioritize what to build next given limited engineering time?**
A: Assumption-edit-rate and scenario/sensitivity-engagement metrics first, before committing — but the working hypothesis is per-year assumption overrides, since the backend already supports it and it's the most direct way to let users express a more nuanced business view without leaving the tool.

**Q3: Pre-Tax Cost of Debt gets no default at all, but Equity Risk Premium and Terminal Growth get an "illustrative" one. Isn't that inconsistent?**
A: No — it's a deliberate line between broad market-level conventions with genuine reference points (ERP, terminal growth) and a company-specific figure Athena has no proxy for whatsoever (cost of debt). See `DCFProductDesign.md` Q3 for the full reasoning.

**Q4: What's the biggest product risk in this feature as shipped?**
A: That a user treats the headline Intrinsic Value number as authoritative despite every design choice working against that — see `DCFProductDesign.md` Q5. The mitigation was making the sensitivity table and scenario range unavoidable context (rendered automatically alongside the base result) rather than an optional deep-dive.

**Q5: If you had one more week, what would you build?**
A: Real usage instrumentation, not another feature — the assumption-edit-rate and engagement metrics from Section 9/10 above would tell us whether the transparency-first design is actually working before investing further in expanding it.

## 13. Finance interview questions

**Q1: Walk me through why FCFF gets discounted at WACC but never at cost of equity.**
A: FCFF is deliberately unlevered (computed before any financing effects); WACC blends the required returns of both debt and equity holders. Pairing an unlevered cash flow with a blended-but-capital-structure-aware rate is what correctly produces Enterprise Value — see `research/finance/FCFF.md` and `WACC.md`.

**Q2: Why is Terminal Value usually the largest component of a DCF's Enterprise Value, and does that undermine the value of the explicit forecast?**
A: It's mechanically expected — see `research/finance/TerminalValue.md`. It doesn't undermine the explicit forecast's value so much as reframe its job: getting the company to a believable, stable *starting point* for the terminal formula, more than precisely predicting near-term cash flow.

**Q3: What happens if terminal growth equals or exceeds WACC, and why does Athena treat that as a hard error rather than computing an answer?**
A: The Gordon Growth formula's infinite geometric series only converges when growth is strictly less than the discount rate — otherwise the "value" is undefined or nonsensically negative for a growing, positive cash flow. Athena's validator rejects it outright rather than surfacing a mathematically meaningless number (`research/finance/TerminalValue.md`).

**Q4: A company's CapEx line is reported as a negative number. What do you do with it, and why does it matter?**
A: Take the absolute value before subtracting it in the FCFF formula — the negative sign is the source's outflow convention, not a signal to add it back. This is a real bug Athena shipped and fixed this sprint (Section 7 above, `research/finance/FCFF.md`).

**Q5: Why does Athena use market value of equity but book value of debt in the same WACC formula?**
A: Market cap reflects current market pricing of equity claims; there's no equivalent live bond-pricing data source integrated, so book debt is used as a documented, honest proxy — reasonable for investment-grade issuers trading near par, a real limitation for distressed or long-duration debt (`research/finance/WACC.md`).

**Q6: What's the difference between FCFF and the "Free Cash Flow" (OCF − CapEx) figure Athena has shown since Sprint 1?**
A: OCF starts from Net Income, which already reflects after-tax interest expense — it's a levered figure. FCFF is deliberately computed before any financing effects. They're related but not interchangeable, and discounting the levered figure at WACC would be the exact FCFF/FCFE-mixing error the sprint brief warns against (`research/finance/FCFF.md`).

**Q7: Why does Athena's DCF form require Pre-Tax Cost of Debt with zero default, while other WACC inputs get a suggested starting value?**
A: There's no data source that's even a reasonable proxy for a specific company's borrowing cost — versus beta and the risk-free rate, which come from genuinely live instruments, or ERP, which at least has a widely-cited market-level convention. Guessing here would be fabrication, not a helpful starting point (`research/finance/CostOfDebt.md`).

**Q8: Why does Change in Net Working Capital get subtracted in the FCFF formula, and what does a positive value actually mean?**
A: A positive Change in NWC means the business tied up *more* cash in short-term operating capital (receivables/inventory growing faster than payables) — a real cash outflow that EBIT never captures, since a sale is recorded as revenue whether or not the cash has arrived yet. It's subtracted because it's cash the business consumed, not cash it generated (`research/finance/NetWorkingCapital.md`).

**Q9: Why does Athena use two different variables — WACC and terminal growth — for its sensitivity table specifically, instead of, say, revenue growth and margin?**
A: Because Terminal Value typically dominates Enterprise Value, and its formula's `(WACC − g)` denominator is the single most sensitivity-concentrated relationship in the whole model — small changes there move the output far more than an equivalent change in an operating assumption (`research/finance/SensitivityAnalysis.md`).

**Q10: Your DCF says a stock is worth $96 and it's trading at $313. What should an investor conclude?**
A: Not "sell" — the honest conclusion is that this specific model, with these specific assumptions, implies a lower value than the market is paying. The gap is a prompt to scrutinize which assumption is driving it (often via the sensitivity table), not a standalone verdict (`research/finance/IntrinsicValue.md`).

**Q11 (bonus): Why does Athena keep WACC and terminal growth fixed across the Bear/Base/Bull scenarios, even though a genuinely pessimistic scenario might justify a higher discount rate too?**
A: Mixing a business-performance story with a valuation-mechanics change would make the resulting number ambiguous — you couldn't tell whether a lower Bear Case value came from "the business underperforms" or "we also discounted it more harshly." Keeping WACC and terminal growth fixed isolates scenario analysis to the question it's meant to answer (`research/finance/ScenarioAnalysis.md`).

# Portfolio Stress Testing

## 1. Definition

Stress testing is the practice of subjecting a portfolio to a severe, hypothetical adverse condition — deliberately worse than typical day-to-day volatility — to see how badly it could be affected, rather than only modeling mild, "expected" moves. In Athena, this is a specific mode of use of the scenario engine (`AdvancedScenarioAnalysis.md`): applying a Bear Case, Market Correction, Technology Selloff, or Broad Market Stress preset (or a custom scenario with similarly severe shocks) and reading the result as a stress test rather than a routine "what if."

## 2. The formula

No separate formula from `AdvancedScenarioAnalysis.md`'s core calculation — stress testing is a *use*, not a distinct calculation path. What distinguishes it is the severity and breadth of the input rules (large negative shocks, often layered — Market -15% *and* Technology -25% *and* Financials -10% simultaneously) and the framing of the result: "how bad could this get under a plausible severe scenario," not "what's the expected outcome."

## 3. Intuition

Ordinary risk metrics (volatility, Sharpe, correlation — Sprint 14) describe how a portfolio has behaved historically under typical conditions. They say almost nothing about tail events, because by definition tail events are rare in the historical sample. Stress testing sidesteps that limitation by not relying on the historical sample at all — the user states the severe condition directly ("what if there's a 2008-style broad decline"), and Athena computes the exact, mechanical consequence for the portfolio as it exists today.

## 4. Why investors care

It answers a question Sprint 14's risk metrics structurally can't: "is my current position sizing survivable under a bad-but-plausible outcome, not just a statistically typical one?" A portfolio with excellent Sharpe Ratio and modest historical volatility can still be catastrophically exposed to a specific concentrated risk (e.g., 60% in one sector) that a stress test surfaces immediately and a backward-looking volatility number does not.

## 5. Assumptions

Severity is entirely user- or preset-defined — Athena does not claim any preset represents "the" worst case, a 1-in-N event, or any statistically calibrated tail. The Bear Case preset's -15%/-25%/-10% shocks (`BearBaseBullScenarios.md`) are a documented, editable starting point, not a regulatory or actuarially-derived stress scenario (contrast with bank regulatory stress tests, which use prescribed, standardized shock scenarios — Athena's presets are illustrative, not compliance artifacts).

## 6. Limitations

A stress test only stresses the specific rules the user (or preset) actually writes — it cannot surface a risk the user didn't think to specify. It also inherits every limitation of the underlying scenario engine (`AdvancedScenarioAnalysis.md` Section 6): no cross-holding correlation modeling, no path dependency, an instantaneous snapshot shock rather than a simulated decline-and-recovery path. A portfolio that "passes" a given stress scenario has not been proven safe in any general sense — only shown to survive that one specific, named hypothetical.

## 7. How Athena implements it

Identical code path to any scenario run (`portfolio.scenario.service.js` → `resolver.js` → `calculator.js`) — a stress test is simply a scenario whose rules happen to be severe. The presets (`portfolio.scenario.presets.js`) that best fit a stress-testing use case are `bear`, `marketCorrection`, `technologySelloff`, and `broadMarketStress`; nothing in the engine special-cases them as "stress" scenarios versus any other custom scenario a user builds.

## 8. Common mistakes

- **Treating a passed stress test as a safety guarantee** — it only demonstrates the modeled consequence of one specific hypothetical, not resilience to whatever actually happens.
- **Confusing Athena's illustrative presets with regulatory/actuarial stress scenarios** — a bank's CCAR/DFAST stress test is built from prescribed macro paths calibrated by regulators; Athena's presets are transparent, editable starting points with no such calibration claim.
- **Running only one stress scenario** and treating it as comprehensive — the sensitivity feature (`PortfolioScenarioSensitivity.md`) and scenario comparison exist specifically because a single stress number understates how differently a portfolio might respond to a slightly different severity or a different combination of factors.

## 9. Scenario vs. forecast

Identical distinction to `AdvancedScenarioAnalysis.md` Section 9 — a stress test is an intensified scenario, not a claim that the stressed condition will occur or is likely. "This portfolio would lose an estimated 22% under a broad market stress scenario" is a fact about the portfolio's current composition, conditional on an assumption the user chose; it is not a prediction that a 22% loss is coming.

## 10. How analysts use it

Risk desks and portfolio managers use stress testing precisely because backward-looking risk statistics under-sample rare, severe events — a portfolio's 1-year historical volatility says little about what happens in a genuine crisis, because genuine crises are (by construction) infrequent in any 1-year window. Running an explicit severe hypothetical bypasses the sampling problem entirely by asking a direct mechanical question instead of an inferential statistical one.

## 11. Interview questions

1. **"How is portfolio stress testing different from Sprint 14's historical risk metrics (volatility, max drawdown)?"** — Sprint 14's metrics are backward-looking and describe how the portfolio actually behaved over its historical window, which under-samples rare severe events. Stress testing is forward-looking and hypothetical — the user directly states a severe condition, and Athena computes its exact mechanical consequence for the current portfolio, independent of whether anything like it has happened historically.
2. **"Does a portfolio that survives Athena's Bear Case preset prove it's low-risk?"** — No — it only shows the modeled consequence of that one specific, editable hypothetical. A different combination of shocks, or a shock to a factor the preset doesn't cover, could produce a very different result. Stress testing narrows uncertainty about one named scenario; it doesn't eliminate it generally.
3. **"Why doesn't Athena claim its stress presets represent a '1-in-20-year event' or similar?"** — Because that would require statistical calibration Athena hasn't done and data (a long enough historical sample of genuinely comparable severe events) it doesn't have. The presets are disclosed as illustrative, editable starting points — claiming a specific probability or return period would be a fabricated precision Athena can't support.

# Historical Stress Context

## 1. Definition

Historical stress context is backward-looking information — historical volatility, historical beta, historical maximum drawdown, historical sector exposure — displayed *alongside* a hypothetical scenario result to help a reader judge plausibility, without ever being allowed to change the scenario's own numbers. It answers "what actually happened to this portfolio historically" as a clearly separate question from "what would happen under this hypothetical" (`AdvancedScenarioAnalysis.md`).

## 2. The formula

No new calculation — every figure in this block is lifted, unmodified, from Sprint 14/15's existing portfolio analytics response (`portfolio.analytics.service.js`'s `getPortfolioAnalytics()`): `risk.volatilityPercent`, `risk.beta`, `risk.maxDrawdown` (with peak/trough/recovery dates), and `performance.benchmark`. Nothing here is recomputed by the scenario engine.

## 3. Intuition

A scenario's assumption ("Market -20%") is more meaningful to a reader who can see, right next to it, "this portfolio's actual historical maximum drawdown was -18.4%, and its historical beta is 1.09" — is the entered shock roughly in line with what's actually happened before, or far more extreme? Historical context doesn't answer that judgment call for the reader (Athena states no opinion on plausibility), but it supplies the reference point needed to make it.

## 4. Why investors care

Raw hypothetical numbers in isolation are hard to calibrate — is a -30% single-stock shock aggressive or mild for this specific holding? Seeing the holding's own historical volatility and the portfolio's historical drawdown alongside the scenario answers that without Athena having to state an opinion ("this shock is realistic" / "this shock is extreme") it has no principled basis to hold.

## 5. Assumptions

The historical window (1m/3m/6m/1y/5y) and benchmark used for context match whatever the scenario request specifies (`window`/`benchmark` parameters), defaulting to 1 year — the same defaults Sprint 14/15's analytics endpoint already uses. If the portfolio has too little historical data for the requested window (fewer than Sprint 14's `MIN_OBSERVATIONS_FOR_SERIES` usable trading days), or no priced holdings at all, historical context is reported as unavailable rather than computed from an unreliably short sample.

## 6. Limitations

Historical drawdown/volatility describe what happened over one specific past window under whatever market conditions actually occurred during it — they carry no guarantee that a future stress event will resemble the past one, and Athena's historical context block says so explicitly ("Past behavior is not a prediction of future behavior"). A portfolio with a short trading history (few holdings, recently opened) will frequently show `available: false` — this is a disclosed data limitation, not an error.

## 7. How Athena implements it

`backend/portfolio/portfolio.scenario.service.js`'s `buildHistoricalContext()` calls `portfolioAnalyticsService.getPortfolioAnalytics(userId, {window, benchmark})` — Sprint 14/15's existing, already-cached (5-minute TTL) endpoint — and extracts only the fields relevant to scenario context, never recomputing volatility, beta, or drawdown itself. The scenario response carries `historicalContext` as a structurally separate top-level key from `scenario`/`holdingImpact`/`sectorImpact` — enforced at the API and UI layer (`ScenarioResult.jsx` renders them as two visually distinct cards) so the two can never be mistaken for one another, and there is no code path by which a value from `historicalContext` is read back into a rule's `shockPercent`.

## 8. Common mistakes

- **Using historical volatility/drawdown to auto-suggest or silently substitute a scenario shock value** — explicitly rejected by the sprint's core product principle (`AdvancedScenarioAnalysis.md` Section 5); a user's "-15%" input is always applied as "-15%," never replaced with a data-derived alternative.
- **Presenting historical context and scenario results in one merged block** — risks a reader conflating "what actually happened" with "what this hypothetical predicts," which is exactly the confusion the structural separation exists to prevent.
- **Claiming a historical drawdown "will repeat"** — Athena's historical context is retrospective description, never a repeated-event claim.

## 9. Scenario vs. forecast

Historical context is neither a scenario nor a forecast — it's a third category: **observed fact about the past**. "This portfolio's historical maximum drawdown was -18.4% (trough March 2026)" is a statement about what already happened, categorically different from both "if Market falls 20%, modeled impact is -23.6%" (a hypothetical) and any unconditional claim about the future (a forecast, which Athena never makes).

## 10. How analysts use it

Risk desks routinely calibrate a hypothetical stress scenario against a portfolio's or asset's own historical behavior — "is this shock roughly in line with, milder than, or more severe than what's actually happened before" — as a sanity check on whether a proposed scenario is a reasonable stress test or an implausible extreme, without ever assuming the historical episode will literally recur.

## 11. Interview questions

1. **"Why does Athena show historical volatility/beta/drawdown next to a scenario result instead of using them to set the shock value?"** — Because doing the latter would mean the user's stated hypothesis gets silently replaced by a data-derived one — defeating the entire point of a user-controlled, transparent scenario. Showing historical figures as separate context lets the reader calibrate plausibility themselves, without Athena making that judgment on their behalf.
2. **"What happens when a portfolio doesn't have enough historical data for the requested window?"** — Historical context reports `available: false` with an explanatory message ("Historical context unavailable for the selected period") rather than computing an unreliable figure from too few data points or silently omitting the section — the same "disclosed gap over a fabricated number" discipline Sprint 14 already established for its own analytics.
3. **"Is a portfolio's historical maximum drawdown a prediction of its next drawdown?"** — No — it's a description of one specific past period under whatever conditions actually occurred then. Athena states this limitation directly in the historical context block rather than letting a reader infer predictive power that isn't there.

# Engineering Concept: Portfolio Calculation Assumptions

## What it is

Every historical metric Sprint 14 computes - period return, annualized return, volatility, Sharpe Ratio, max drawdown, correlation - is built on one foundational assumption, stated once and referenced everywhere rather than re-derived per metric:

> Historical portfolio risk metrics are estimated using **today's** portfolio weights and each holding's **own historical price returns** - not a reconstruction of what this portfolio actually held or was worth on any past date.

This is surfaced in every `GET /api/portfolio/analytics` response as `assumptions.historicalWeightMethodology`, and in the frontend's `AssumptionsPanel.jsx`, which renders on every non-empty analytics view - not buried in a tooltip or a footnote.

## Why we use it

Athena's `Holding` model (Sprint 9) stores current lots - `{ticker, shares, averagePurchasePrice, purchaseDate}` - with no transaction ledger and no daily snapshot of what a user held on any given past date. Computing a "portfolio return series" therefore requires *some* assumption about historical weights, because the true historical weights simply aren't recorded anywhere. The engineering choice was never "should we approximate," it was "which approximation, and how loudly do we disclose it."

## Alternatives considered

- **Refuse to compute any historical metric at all, citing insufficient data.** Rejected - this would mean Sprint 14 ships with Volatility, Sharpe, Drawdown, and Correlation entirely unavailable, which defeats the sprint's purpose. The sprint brief is explicit on this exact point: "If transaction history is insufficient for true time-weighted or money-weighted returns: Do NOT fabricate one. Use the most defensible methodology supported by available data." Current-weights-applied-backward *is* that defensible methodology, chosen and disclosed rather than avoided.
- **Assume weights were constant at today's level for the entire window, without disclosing it.** This is functionally what Athena does - but doing it *silently* was rejected. The difference between this option and what Athena ships is entirely about disclosure: the same math, presented as a documented estimate versus presented as fact, is the difference between a defensible analytics feature and a misleading one.
- **Build a lightweight historical-holdings snapshot going forward** (e.g. a nightly job recording each user's weights) so *future* sprints have real historical weight data, even though *this* sprint still can't use it retroactively. Considered as a future direction, explicitly out of scope for Sprint 14 (see the sprint brief's REBALANCING section: "Do NOT implement portfolio rebalancing in Sprint 14... Future Sprint possibility: Transaction-aware portfolio analytics").

## Trade-offs

- **Pro:** every historical metric becomes available immediately, using data Athena already has (current holdings + historical prices, both already fetched for other features).
- **Pro:** the assumption is simple enough to state in one sentence and hold constant across every metric - a user only needs to internalize it once, not per-metric.
- **Con:** every historical number is systematically biased toward "what my portfolio would look like if I'd always held what I hold today" - a portfolio that was very differently allocated a year ago will show volatility/drawdown/correlation reflecting today's mix, not last year's actual experience. This is why `unrealizedReturnPercent` (Sprint 9's real cost-basis number) and `periodReturnPercent` (this estimate) are never merged into one figure - see PortfolioReturn.md.
- **Con:** the approximation gets *less* accurate the more a portfolio's composition has changed over the analysis window - a portfolio rebalanced last week has a much more misleading 1-year volatility estimate than one that's been stable all year, and Athena currently has no way to detect or flag which situation applies.

## How Athena implements it

Centralized in `portfolio.analytics.calculator.js`'s `buildPortfolioReturnSeries()` (the single function every historical metric is ultimately derived from) and its module-level doc comment, then threaded through to `assumptions.historicalWeightMethodology` in the API response and `AssumptionsPanel.jsx` in the UI. No individual metric (volatility, Sharpe, drawdown) re-explains this assumption in its own description text - each links back to the one shared statement, so there's a single place to update if the methodology ever changes.

## Interview questions

1. *"If you had one more sprint's worth of engineering time to improve this, what would you build first?"* — A daily (or transaction-triggered) snapshot of each user's actual holdings, so future analytics requests could use *real* historical weights for the period after the snapshot began, falling back to the current-weights approximation only for the pre-snapshot period. This wouldn't retroactively fix history that already happened before the snapshot existed, but it would mean the approximation's blast radius shrinks over time instead of applying to the entire window forever.
2. *"How would you explain to a non-technical stakeholder why this approximation is acceptable to ship?"* — Because the alternative isn't "accurate data instead of an estimate" - it's "no historical risk metrics at all." Given that Athena genuinely doesn't store historical holdings, disclosed estimates that get *directionally* useful answers (this portfolio's mix has historically been this volatile) are more valuable to a user than blank fields, as long as the disclosure is real and prominent rather than a buried caveat - which is exactly the bar the Assumptions panel is designed to clear.

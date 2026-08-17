# Sharpe Ratio

## 1. Definition

The **Sharpe Ratio** is a portfolio's return in excess of a risk-free rate, divided by its volatility - a risk-adjusted return: how much return was earned per unit of risk taken.

## 2. Formula

```
Sharpe Ratio = (Rp - Rf) / σp
```

where `Rp` is the portfolio's annualized return (over the analysis window), `Rf` is the risk-free rate, and `σp` is annualized portfolio volatility.

## 3. Intuition

A 12% return sounds good in isolation, but a 12% return earned with wild swings is a different achievement than a 12% return earned smoothly. Sharpe divides the "reward" (return above what a risk-free asset would have paid) by the "bumpiness" (volatility), producing one number that lets two portfolios with different returns and different volatilities be compared on a like-for-like basis.

## 4. Why investors care

It's the standard way to ask "was this return worth the risk?" without needing to eyeball a return number and a volatility number separately. A higher Sharpe Ratio means more return was generated per unit of volatility taken on.

## 5. Data required

Portfolio annualized return, portfolio annualized volatility (both from the same historical-series estimate - see PortfolioVolatility.md), and a risk-free rate.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.calculator.js`'s `calculateSharpeRatio()`:

```js
const calculateSharpeRatio = (annualizedReturnValue, riskFreeRate, volatility) => {
    if (!isFiniteNumber(annualizedReturnValue) || !isFiniteNumber(riskFreeRate) || !isFiniteNumber(volatility)) return null;
    if (volatility === 0) return null;
    return (annualizedReturnValue - riskFreeRate) / volatility;
};
```

The risk-free rate itself is fetched from `backend/valuation/providers/riskFreeRate.provider.js` - the same live 10-Year US Treasury yield (Yahoo `^TNX`) already used for DCF's CAPM cost-of-equity calculation in Sprint 6, reused rather than re-implemented.

## 7. Assumptions

- **Risk-free rate source.** Live 10-Year US Treasury yield when available (labeled `source: "market"`). If the live fetch fails, Athena falls back to a documented illustrative constant (`ILLUSTRATIVE_RISK_FREE_RATE = 0.04`, labeled `source: "illustrative_default"`) rather than fabricating a fresh live-looking number or refusing to compute Sharpe at all. Every API response states which one was used.
- **A single risk-free rate for every portfolio**, regardless of the portfolio's currency mix - the 10-Year Treasury is a US-market convention; a portfolio denominated primarily in another currency would, in principle, warrant that market's own risk-free instrument. Documented as a limitation, not silently corrected for.

## 8. Limitations

- **Zero volatility returns `null`, not `Infinity`.** A hypothetical zero-volatility portfolio would make the ratio mathematically undefined (division by zero); Athena reports this as "not available" rather than an infinite or fabricated number.
- **Inherits every limitation of the return and volatility estimates it's built from** - see PortfolioReturn.md and PortfolioVolatility.md. A Sharpe Ratio computed on a current-weights-approximated return series is itself an approximation, not a historically accurate risk-adjusted return.
- **Backward-looking**, like every metric on this page - a good historical Sharpe Ratio is not a guarantee of future risk-adjusted performance.

## 9. Common interpretation mistakes

- **Comparing Sharpe Ratios computed over different windows or different risk-free rate sources as if they were directly comparable.** Athena always surfaces both (`analysisPeriod`, `riskFreeRate`) precisely so this comparison isn't made blind.
- **Treating a negative Sharpe Ratio as "the portfolio lost money."** A negative Sharpe just means the portfolio's return was below the risk-free rate over the window - the portfolio could still have a positive return, just one smaller than what a risk-free asset would have paid.

## 10. Interview question

*"Why does Athena fall back to a hard-coded risk-free rate instead of just failing when the live rate is unavailable, when Sprint 6's DCF flow doesn't do that?"* — DCF is an interactive form: when the live risk-free rate is unavailable, it labels the field `"unavailable"` and leaves it for the user to type in, because a human is already sitting there filling in assumptions. Sharpe Ratio has no equivalent form - it's one number in a read-only analytics view - so leaving it permanently blank whenever the Treasury feed hiccups would silently degrade the page with no way for the user to supply a substitute. The illustrative fallback exists to keep the metric available, on the condition that it's honestly labeled (`"illustrative_default"`, never `"market"`) so nothing here is presented as live data it isn't.

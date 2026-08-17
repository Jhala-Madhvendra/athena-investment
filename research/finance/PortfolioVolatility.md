# Portfolio Volatility

## 1. Definition

**Portfolio volatility** is the annualized standard deviation of a portfolio's daily returns - a measure of how much the portfolio's value has historically fluctuated, not a measure of direction (up or down).

## 2. Formula

```
Return_t = Price_t / Price_(t-1) - 1                  (per holding, per day)
Rp_t = Σ wi × Ri,t                                     (portfolio return, day t)
Daily Std Dev = sample standard deviation of {Rp_t}
Annualized Volatility = Daily Std Dev × √252
```

252 is the approximate number of US trading days in a year - the standard annualization factor when returns are measured daily. A portfolio trading exclusively on exchanges with a different annual trading-day count would technically warrant a different multiplier; Athena uses 252 uniformly and documents this as an assumption rather than adjusting per-exchange.

## 3. Intuition

Two portfolios can have the identical average return and look completely different day to day - one might grind up 0.1% every day, the other might swing +3%/-3% and still average the same 0.1%. Volatility is the number that captures that difference: it says nothing about whether a portfolio is going up or down, only how bumpy the ride has been.

## 4. Why investors care

Volatility is the most common proxy for risk in finance - it's the denominator in the Sharpe Ratio, the basis for options pricing, and the single number most risk tools lead with. A high-volatility portfolio can produce the same return as a low-volatility one but require sitting through much larger drawdowns along the way.

## 5. Data required

Daily closing prices for every holding, over the selected analysis window (default 1 year), plus today's portfolio weights.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.calculator.js`:

```js
const calculateVolatility = (portfolioReturnSeries) => {
    const dailyStdDev = standardDeviation(portfolioReturnSeries.map((entry) => entry.return));
    return dailyStdDev === null ? null : dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
};
```

`portfolioReturnSeries` itself comes from `buildPortfolioReturnSeries()`, which applies **today's** holding weights to each holding's own historical daily returns (see PortfolioCalculationAssumptions.md) - not a reconstruction of what the portfolio actually did.

## 7. Assumptions

- Sample standard deviation (n-1 denominator), the conventional choice for a return series treated as a sample.
- 252 trading days/year for annualization, regardless of which exchanges the holdings trade on.
- Requires at least 10 observations in the aligned return series (`MIN_OBSERVATIONS_FOR_SERIES`); shorter or sparser windows return `null` rather than a volatility computed on too few points to be meaningful.

## 8. Limitations

- **Estimated, not historical.** Built from today's weights applied backward - a portfolio that was allocated very differently a year ago would show a volatility that reflects today's mix, not what actually happened.
- **Backward-looking.** Historical volatility is not a forecast of future volatility, even over the same window length.
- **Sensitive to the analysis window.** A 1-month window and a 5-year window on the same portfolio can report meaningfully different volatility, especially around a single sharp market move.

## 9. Common interpretation mistakes

- **Treating volatility as "riskiness" in the everyday sense.** A portfolio that only ever goes up steeply also has high volatility by this definition - volatility is symmetric, it doesn't distinguish upside swings from downside ones.
- **Comparing volatility across different windows without noting it.** 18% volatility over 1 month and 18% volatility over 5 years are not describing the same thing.

## 10. Interview question

*"Why annualize with √252 instead of just multiplying by 252?"* — Variance scales linearly with time (assuming independent daily returns), but standard deviation is the square root of variance, so it scales with the square root of time. Multiplying the daily standard deviation directly by 252 would overstate annual volatility by a factor of √252 ≈ 15.9x too much.

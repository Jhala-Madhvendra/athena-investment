# Portfolio Beta

## 1. Definition

**Beta** measures a portfolio's historical sensitivity to a benchmark's movements. A beta of 1.0 means the portfolio has historically moved in line with the benchmark; above 1.0 means historically larger moves in the same direction; below 1.0 means historically smaller moves.

## 2. Formula

Athena uses the weighted-average method:

```
βp = Σ wi × βi
```

where `wi` is a holding's portfolio weight and `βi` is that holding's own beta (sourced from Yahoo Finance).

The alternative - regressing the portfolio's own historical return series against a benchmark's historical return series - was considered and rejected for this version; see Section 7.

## 3. Intuition

If a portfolio is 60% in a stock with beta 1.2 and 40% in a stock with beta 0.8, the portfolio "inherits" a blend of both: 0.6×1.2 + 0.4×0.8 = 1.04. It's the same weighted-averaging idea as portfolio weight itself, applied to a risk statistic instead of a dollar value.

## 4. Why investors care

Beta is a quick answer to "if the market drops 10%, roughly how much has this portfolio historically tended to move?" It's a single-number summary of market sensitivity, distinct from volatility (which describes total movement, not movement relative to a benchmark).

## 5. Data required

Each held ticker's own beta (from the market data provider) and its current portfolio weight.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.risk.js`'s `calculatePortfolioBeta()`. A holding with no available beta is excluded from the weighted average (and reported in `excludedTickers`) rather than treated as beta 0 or beta 1, either of which would silently distort the result. If the holdings with a known beta represent less than 50% of total portfolio value, the function returns `null` rather than a number computed on too little coverage to be representative.

## 7. Assumptions

- **Method choice: weighted average of individual betas, not regression.** Regressing the portfolio's simulated historical return series (see PortfolioCalculationAssumptions.md) against a benchmark's return series was the alternative. It was not chosen for the first version because: (a) it requires the benchmark's own historical price series, adding another external dependency to every analytics request; (b) it would inherit the current-weights approximation twice over (once in building the portfolio series, once in the regression itself), compounding the same limitation rather than avoiding it; (c) each holding's own beta is already computed by Yahoo Finance with a standard, well-understood methodology, and reusing it costs zero extra API calls (the same quote fetch Sprint 9 already makes for pricing carries beta). This is a deliberate, documented tradeoff, not an oversight - a regression-based beta is a reasonable future enhancement.
- Each holding's beta is generally computed by the data provider against **that stock's own home-market index** (e.g. a US stock's beta is typically vs. the S&P 500, an NSE-listed stock's vs. NIFTY 50) - not necessarily against the same benchmark Athena selects for display purposes.

## 8. Limitations

- **Mixed-market portfolios blend betas measured against different indices.** A portfolio with both US and Indian holdings sums a "beta vs. S&P 500"-flavored number with a "beta vs. NIFTY 50"-flavored number - the weighted average is still informative directionally, but it isn't a single coherent "beta vs. one benchmark" in the way a from-scratch regression against one chosen benchmark would be.
- **Depends on provider data quality.** If Yahoo hasn't computed a beta for a given ticker (common for very recently listed or thinly traded stocks), that holding is excluded, which can materially change the result for a small portfolio.

## 9. Common interpretation mistakes

- **Reading beta as a risk score.** A beta below 1.0 is not automatically "safer" - it only describes historical sensitivity to the benchmark, not total volatility or downside risk.
- **Assuming portfolio beta and portfolio volatility measure the same thing.** A portfolio can have low beta (moves less than the benchmark) and still have high volatility (moves a lot in absolute terms, just less correlated with the specific benchmark chosen).

## 10. Interview question

*"Why does Athena's portfolio beta not depend on the benchmark's own historical prices?"* — Because the method is a weighted average of each holding's own already-computed beta, not a regression against the benchmark's return series. This is a deliberate design choice: it means a benchmark that fails to resolve (a bad ticker, a provider outage) degrades only the optional benchmark-comparison display, never the beta calculation itself - the two are decoupled by construction, not by luck.

# Correlation

## 1. Definition

**Correlation** measures how closely two holdings' returns have historically moved together, on a scale from -1 (perfectly opposite movement) through 0 (no linear relationship) to +1 (perfectly matched movement).

## 2. Formula

Pearson correlation coefficient:

```
ρij = Cov(Ri, Rj) / (σi × σj)
```

computed over each pair's **overlapping trading dates only** - not the whole-portfolio aligned date set used elsewhere in the analytics engine.

## 3. Intuition

Two holdings can each individually look fine on volatility and beta, and still combine into a riskier portfolio than either alone would suggest, if they tend to fall on the same days. Correlation is the number that captures "do these move together," which weight and volatility alone can't tell you.

## 4. Why investors care

Diversification's actual benefit comes from combining assets that don't move in lockstep - if two holdings are highly correlated, owning both provides much less risk reduction than the position count alone would suggest. Correlation is the diagnostic for that: it doesn't say a high correlation is bad (a highly-correlated pair might still be a deliberate, informed choice), only how related the holdings' historical movements have been.

## 5. Data required

Each pair of held tickers' daily returns, over the analysis window, matched to their overlapping trading dates.

## 6. How Athena calculates it

`backend/portfolio/portfolio.analytics.correlation.js`'s `calculatePairwiseCorrelation()`. Two design choices worth calling out:

- **Per-pair overlap, not portfolio-wide alignment.** If a portfolio holds a stock listed 6 months ago alongside two stocks with 5 years of history, correlating the two older stocks against each other uses their full 5-year overlap - it isn't truncated down to the newer stock's shorter history, which the portfolio-wide date alignment (used for volatility/drawdown) would otherwise imply.
- **A minimum-overlap floor.** Pairs with fewer than 20 overlapping trading days return `null` rather than a coefficient computed on too few points to be meaningful noise.

`calculateCorrelationMatrix()` builds the full pairwise grid, with 1 on the diagonal (a ticker is perfectly correlated with itself, definitionally, not computed).

## 7. Assumptions

- Correlation is computed on **daily returns**, not raw prices - price-level correlation between any two generally-rising assets tends toward spuriously high values regardless of their actual relationship.
- A constant (zero-variance) return series has undefined correlation and reports `null`, never a fabricated 0 or 1.

## 8. Limitations

- **Historical only.** Correlation between two assets can and does shift over time, especially during market stress, when historically uncorrelated assets can temporarily move together.
- **Linear relationships only.** Pearson correlation captures linear co-movement; two assets with a strong but non-linear relationship could show a low correlation coefficient despite a real relationship existing.
- **Inherits the current-weights limitation indirectly** - while the correlation calculation itself doesn't use portfolio weights (it's pairwise between two return series), which pairs get computed depends on which tickers the portfolio holds *today*.

## 9. Common interpretation mistakes

- **Requiring at least two holdings.** A single-holding portfolio has no pairs to correlate - Athena states this directly ("Correlation requires at least two holdings") rather than showing a meaningless 1x1 grid.
- **Treating a negative correlation as automatically desirable.** Diversification benefit exists on a spectrum below +1, not only at negative values - a correlation of +0.3 already provides real diversification benefit relative to +0.9.

## 10. Interview question

*"Why not just use the whole portfolio's aligned date set (the one built for volatility) for every correlation pair too?"* — Because that set is built for a different purpose: it requires enough tickers to have data on a given day to represent the *whole portfolio's* return, and gets progressively shorter the more holdings with different listing histories are added. Two tickers being correlated against each other only need *their own* overlapping history, which is often much longer than the whole-portfolio aligned set - using the shorter set would throw away real, usable data for no reason.

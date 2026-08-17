# Concentration Risk

## 1. Definition

**Concentration risk** is the risk that comes from having too much of a portfolio's value tied up in too few positions — the opposite of diversification.

## 2. The formula

```
Top Holding Weight = weight of the single largest position
Top 3 Weight = sum of the three largest positions' weights
```

Both are computed on ticker-grouped positions (see PortfolioWeight.md), not raw lots.

## 3. Intuition

If one stock is 75% of your portfolio, that single company's fortunes are effectively your portfolio's fortunes — a bad quarter for that one company can outweigh everything else you own put together. Concentration metrics make that visible as a single number instead of requiring you to eyeball a holdings table.

## 4. Why investors care

Diversification is one of the few genuinely free risk-reduction tools in investing — spreading capital across uncorrelated positions reduces portfolio volatility without necessarily reducing expected return. Concentration metrics are the diagnostic: they don't say whether concentration is good or bad (a high-conviction concentrated bet is a legitimate strategy), only how much of it exists.

## 5. Limitations

- **Purely value-based, not correlation-aware.** Five different holdings at 20% each look perfectly diversified by this metric even if all five are, say, semiconductor companies that move together — Athena's concentration measure has no sector, geography, or correlation dimension.
- **Only reflects priced positions.** An unpriced holding contributes no weight and is excluded from both `topHoldingWeightPercent` and `top3WeightPercent`, understating true concentration if a large-but-unpriceable position exists.
- **Says nothing about whether concentration is a problem.** Athena reports the number as a fact ("42% of portfolio value is concentrated in one holding"), never as advice ("you should diversify") — see WatchlistAndPortfolioProductDesign.md's product principle on analytical observations vs. recommendations.

## 6. How Athena implements it

`backend/portfolio/portfolio.calculator.js`'s `summarizePortfolio()`, using the same ticker-grouped positions as the largest/best/worst-performer logic:

```js
const top3WeightPercent = pricedPositionsByValue.slice(0, 3).reduce((sum, p) => sum + (p.weightPercent || 0), 0);

concentration: {
    topHoldingWeightPercent: largestHolding ? largestHolding.weightPercent : null,
    top3WeightPercent,
}
```

Verified live: a two-position portfolio (AAPL 75.4%, MSFT 24.6%) reported `topHoldingWeightPercent: 75.42` and `top3WeightPercent: 100` (since there were only two positions to sum).

## 7. Common mistakes

- **Counting lots instead of companies.** "I have 10 holdings" is not the same as "I have 10 companies" if several are multiple lots of the same stock — Athena nets by ticker specifically to avoid this false sense of diversification.
- **Treating a high concentration number as inherently bad.** It's a risk fact, not a verdict — a concentrated position can be entirely intentional.

## 8. Interview questions

1. *"Two portfolios both report a top-holding weight of 40%. Are they equally risky?"* — Not necessarily — this metric only measures value concentration, not correlation. If the 40% position sits alongside four other holdings from unrelated sectors, the overall portfolio may still be reasonably diversified in practice; if the other 60% is also concentrated in the same sector as the top holding, the real risk is much higher than the single-number metric suggests.
2. *"Why does concentration use ticker-grouped positions instead of raw holding lots?"* — Because "how many companies am I exposed to" is a company-level question — three lots of the same stock bought at different times is still one source of risk, not three independent ones. Grouping by ticker first (via `groupByTicker()`) avoids a misleadingly low concentration reading caused by lot-splitting.

## 9. Sprint 14 update: Top 5 and HHI

`GET /api/portfolio/analytics` extends this metric with `top5WeightPercent` (same idea as `top3WeightPercent`, one more position) and `hhi` (the Herfindahl-Hirschman Index - a single number that accounts for the *entire* weight distribution, not just the top few positions). See HHI.md for the full writeup. Sprint 9's original `topHoldingWeightPercent`/`top3WeightPercent` fields on `GET /api/portfolio` are unchanged - the analytics endpoint recomputes equivalent numbers (`top1WeightPercent`/`top3WeightPercent`) from the same ticker-grouped positions rather than duplicating the aggregation logic differently.

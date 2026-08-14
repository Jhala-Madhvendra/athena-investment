# Portfolio Return %

## 1. Definition

**Portfolio Return %** is the overall percentage gain or loss across every priced holding in a portfolio, measured against total capital invested.

## 2. The formula

```
Portfolio Return % = (Total Current Value − Total Cost Basis) / Total Cost Basis × 100
```

where both totals are summed across holdings — **not** an average of each holding's individual return %.

## 3. Intuition

A dollar gained in a $10,000 position matters ten times more to your actual wealth than a dollar gained in a $1,000 position. Summing dollars first and only then converting to a percentage automatically weights each holding by its size; averaging percentages first throws that weighting away and treats a tiny position's return as equally important as a huge one's.

## 4. Why investors care

It's the single number that answers "how is my money actually doing," and it's the one number naive averaging gets wrong. Concretely, verified live in Athena: a $1,500 AAPL position (two lots, blended +51.1%) and a $1,200 MSFT position (+23.1%) produced a portfolio return of **43.12%** — closer to AAPL's return because AAPL is the larger position, exactly as it should be.

## 5. Limitations

- **Not time-weighted or annualized.** A position bought yesterday and one held for five years both just show their raw % return since purchase — Athena doesn't compute an annualized (CAGR-style) or money-weighted (XIRR-style) return that accounts for *when* each lot was purchased. Two portfolios with identical dollar gains but very different holding periods will show the same Portfolio Return %, even though the annualized performance differs enormously.
- **Excludes unpriced holdings from the total**, rather than either fabricating a price or corrupting the total with a $0-value assumption — see below.
- **Ignores dividends**, same as UnrealizedGainLoss.md.

## 6. How Athena implements it

`backend/portfolio/portfolio.calculator.js`'s `summarizePortfolio()`:

```js
const priced = enrichedHoldings.filter((h) => h.currentValue !== null);
const totalCostBasis = priced.reduce((sum, h) => sum + h.costBasis, 0);
const totalCurrentValue = priced.reduce((sum, h) => sum + h.currentValue, 0);
const totalReturnPercent = calculateReturnPercent(totalCurrentValue, totalCostBasis);
```

A holding whose live price is unavailable is excluded from *both* totals (never just the numerator), so the denominator and numerator stay consistent — its cost basis is reported separately in `unpricedHoldings` instead of silently corrupting the return calculation. This was a deliberate design choice: including a holding's cost basis in the total while treating its unknown current value as $0 would make the portfolio look like it lost money on a position that simply couldn't be priced.

## 7. Common mistakes

- **Averaging per-holding returns.** `(51.1% + 23.1%) / 2 = 37.1%` — plausible-looking, and wrong. The real value-weighted answer was 43.12%.
- **Including an unpriced holding's cost basis in the denominator while treating its value as $0** — this silently manufactures a loss the portfolio never actually took.

## 8. Interview questions

1. *"Walk me through why averaging individual holding returns is wrong."* — Use the concrete numbers: a $100 position at +100% and a $10,000 position at −1% average to +49.5%, which suggests a big win — but the portfolio's actual dollar-weighted return is ~0% (roughly breakeven), because the huge position's small loss in dollar terms dwarfs the tiny position's percentage gain. Averaging percentages discards the fact that positions have different sizes.
2. *"Is Athena's Portfolio Return % the same thing as an annualized return (CAGR)?"* — No — it's a simple point-in-time (gain since purchase) / (cost basis) calculation with no time dimension. A position held one day and one held five years contribute to the total the same way, which is a documented limitation, not an oversight; a true annualized/money-weighted return would need each lot's purchase date factored in (essentially an XIRR calculation), which Athena doesn't attempt this sprint.

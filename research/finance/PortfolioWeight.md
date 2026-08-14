# Portfolio Weight

## 1. Definition

**Portfolio weight** is the share of your total portfolio's value that one holding (or one company's position) represents.

## 2. The formula

```
Holding Weight = Holding Current Value / Total Portfolio Current Value × 100
```

## 3. Intuition

If AAPL is worth $4,000 out of a $5,000 total portfolio, AAPL is 80% of your portfolio — regardless of how many shares that is or what you originally paid. Weight is always measured against *current* value, not cost basis, because it answers "how exposed am I to this company right now," not "how much did I originally allocate."

## 4. Why investors care

Weight is the raw input to concentration risk (see ConcentrationRisk.md) and the most direct signal of diversification. A portfolio can have ten holdings and still be effectively a single-stock bet if one position has grown to dominate the rest.

## 5. Limitations

- **Weight drifts on its own, with no new purchases.** If AAPL doubles while everything else is flat, AAPL's weight rises purely from price movement — Athena's weight is always "as of now," not "as of when you built the portfolio."
- **Unpriced holdings get no weight (`null`)**, not a zero weight — a $0 weight would wrongly suggest the position is worthless, when it's actually just unpriced right now.
- **Per-row weight (for the Holdings Table) is computed per lot**, so two lots of the same ticker each get their own weight that sums to the position's true weight — the "one position, not two" netting only happens for the intelligence metrics (largest holding, concentration), not the raw table rows, since each lot is independently editable/deletable. See PortfolioDataModel.md.

## 6. How Athena implements it

`backend/portfolio/portfolio.service.js`, after computing the portfolio summary:

```js
const holdingsWithWeight = enrichedHoldings.map((holding) => ({
    ...holding,
    weightPercent:
        holding.currentValue !== null && summary.totalCurrentValue > 0
            ? (holding.currentValue / summary.totalCurrentValue) * 100
            : null,
}));
```

For the ticker-grouped "largest holding" figure, `groupByTicker()` in `portfolio.calculator.js` nets multiple lots of the same ticker into one position first, so a stock bought in three separate lots is weighted once as one company, not artificially split into three smaller-looking positions.

## 7. Common mistakes

- **Computing weight from cost basis instead of current value** — this answers a different question ("how much did I plan to invest here") than the one that actually matters for risk ("how exposed am I right now"), and the two diverge the moment prices move.
- **Forgetting to net multiple lots of the same ticker** before computing "largest holding" — three $2,000 lots of the same stock is one $6,000 position, not three separate, individually-smaller-looking ones.

## 8. Interview questions

1. *"A user buys more of a stock they already own. Does its portfolio weight increase just from that purchase, or could it decrease?"* — It typically increases (more shares = more current value for that position), but not necessarily proportionally to the dollar amount added — if the stock's price has also moved since the earlier lot, or if other holdings have grown/shrunk in the meantime, the exact weight change depends on the whole portfolio's current value, not just the new purchase in isolation.
2. *"Why does Athena weight by current value instead of cost basis?"* — Risk exposure is a function of what a position is worth today, not what you paid — a stock that's tripled since purchase represents far more of your actual wealth at risk than its original cost basis would suggest, even though your cash outlay hasn't changed.

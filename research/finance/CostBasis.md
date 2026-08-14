# Cost Basis

## 1. Definition

**Cost basis** is the total amount you paid to acquire a holding — the reference point every gain/loss and return calculation is measured against.

## 2. The formula

```
Cost Basis = Shares × Average Purchase Price
```

## 3. Intuition

It's simply "what did this cost me." Not what it's worth now, not what you could sell it for — what you actually put in.

## 4. Why investors care

Every other performance number is relative to cost basis: no gain/loss, no return %, no "am I up or down" without it. It's also the number tax authorities care about (realized cost basis determines taxable gain on a sale) — though Athena never realizes a sale, so this is purely an unrealized/tracking concept here (see UnrealizedGainLoss.md).

## 5. Limitations

- Doesn't include commissions, fees, or reinvested-dividend cost-basis adjustments a real brokerage statement would track.
- A zero purchase price is valid (e.g. gifted shares) and produces a $0 cost basis — which then makes Return % undefined, not infinite (see UnrealizedGainLoss.md).
- When the same ticker is bought in multiple lots at different prices, each lot's cost basis is tracked and displayed separately; only when computing portfolio-level position weight/concentration are lots of the same ticker summed together — see PortfolioWeight.md.

## 6. How Athena implements it

`backend/portfolio/portfolio.calculator.js`:

```js
const calculateCostBasis = (shares, purchasePrice) => shares * purchasePrice;
```

A pure function — no I/O, unit-tested directly with plain numbers (`backend/portfolio/__tests__/portfolio.calculator.test.js`). Unlike current value, cost basis never depends on a live price fetch, so it's always knowable even for a holding whose current price is unavailable (see UnrealizedGainLoss.md's `unpricedHoldings`).

## 7. Common mistakes

- Confusing cost basis with current value — "I invested $1,500" (cost basis) is a different number from "this is worth $3,000 today" (current value); conflating them makes gain/loss meaningless.
- Forgetting that averaging *purchase prices* across multiple lots is not the same as averaging *returns* — two $1,000 lots at $50 and $150/share have a blended cost basis of $2,000 for 27 shares (~$74/share average), not a simple average of the two prices.

## 8. Interview questions

1. *"If a user enters a purchase price of $0, what should happen?"* — Athena explicitly allows it (validated as `>= 0`, not `> 0`) to support gifted/inherited shares. Cost basis becomes $0, gain/loss becomes the full current value, and Return % is reported as `null` rather than a fabricated `Infinity` — see `calculateReturnPercent` in UnrealizedGainLoss.md.
2. *"How would you extend this to account for transaction fees?"* — Add an optional `fees` field to the holding input, fold it into `calculateCostBasis` (`shares × price + fees`), and update the validator to accept it — the rest of the calculation chain (gain/loss, return, weight) requires no changes since they all consume `costBasis` as a single derived number, not the raw shares/price.

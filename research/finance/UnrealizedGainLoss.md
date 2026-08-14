# Unrealized Gain/Loss

## 1. Definition

**Unrealized gain/loss** is the paper profit or loss on a holding you still own — "unrealized" because nothing has been sold, so no gain or loss has actually been locked in yet.

## 2. The formula

```
Unrealized Gain/Loss = Current Value − Cost Basis
```

## 3. Intuition

If you paid $1,500 for shares now worth $2,000, you have a $500 unrealized gain — but it's only real on paper until you sell. The stock could fall back below your cost basis tomorrow and that $500 would disappear without you ever having collected it.

## 4. Why investors care

It's the most direct answer to "am I winning or losing on this position right now." It's also the number that becomes a *realized* gain or loss — and a taxable event — the moment a position is actually sold, which is precisely the line Athena stays on the correct side of by never modeling a sale at all (see WatchlistVsPortfolio.md).

## 5. Limitations

- **Ignores dividends received.** A position can have a negative unrealized price gain/loss while still having paid out income along the way — Athena doesn't track dividend cash flow, so total return (price + income) isn't captured, only price-based unrealized gain.
- **Undefined, not infinite, on a zero cost basis.** Gifted shares (cost basis $0) still have a well-defined gain/loss (= their full current value) but an undefined return percentage — see below.
- **Unknown, not zero, when the current price is unavailable.** A ticker Athena can't get a live quote for reports `gainLoss: null`, never `0` or a fabricated loss.

## 6. How Athena implements it

`backend/portfolio/portfolio.calculator.js`:

```js
const calculateGainLoss = (currentValue, costBasis) => (currentValue === null ? null : currentValue - costBasis);

const calculateReturnPercent = (currentValue, costBasis) => {
    if (currentValue === null) return null;
    if (costBasis === 0) return null; // undefined, not Infinity
    return ((currentValue - costBasis) / costBasis) * 100;
};
```

`enrichHolding()` also sets a `priceUnavailable: true` flag whenever `currentValue` is `null`, and the frontend renders `—` for that row's gain/loss/return rather than `null` or `NaN`. Verified live against real Yahoo data: a holding bought at $0 (gifted) showed `gainLoss: 2462.15` (the full current value) and `returnPercent: null`.

## 7. Common mistakes

- **Dividing by zero and getting `Infinity`.** A naive `(currentValue - costBasis) / costBasis` on a $0 cost basis produces `Infinity`, which is a worse failure than an honest "undefined" — Athena's formula explicitly guards this case.
- **Treating an unrealized gain as spendable.** It isn't cash; it's a mark-to-market snapshot that can reverse before you ever act on it.
- **Silently treating a missing price as $0 value**, which would report a holding as a total loss it never actually took — this is exactly why `currentValue` (and everything derived from it) is `null`, not `0`, when a price can't be fetched.

## 8. Interview questions

1. *"Why does Athena return `null` instead of `Infinity` for return % on a zero-cost-basis holding?"* — `Infinity` is technically what the math produces, but it's meaningless and would corrupt any downstream aggregation (e.g. it would poison a portfolio-level average). `null` correctly communicates "this number is undefined," and the frontend renders it as `—` rather than a broken value.
2. *"A user's holding shows `gainLoss: null` — what does that mean, and how is it different from a holding that's down 100%?"* — `null` means Athena couldn't get a live price for that ticker right now (data unavailable); a 100% loss means Athena *did* get a price and it's genuinely $0. Conflating the two would tell a user their investment is worthless when it's actually just a temporarily unavailable quote.

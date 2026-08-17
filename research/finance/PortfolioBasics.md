# Portfolio Basics

## 1. Definition

A **portfolio holding** in Athena is one purchase lot: a ticker, a number of shares, the price paid per share, and the date bought. "Your portfolio" is not a stored entity at all — it's the set of every holding lot that belongs to your user id, computed fresh on every request. There is no `Portfolio` collection to go stale or fall out of sync with its holdings.

## 2. The inputs

```
Holding = { ticker, shares, averagePurchasePrice, purchaseDate }
```

Every other portfolio number in Athena (cost basis, current value, gain/loss, return, weight, concentration) is *derived* from these four fields plus one live number Athena fetches itself: the current market price.

## 3. Intuition

Four numbers are enough to answer "how is this investment doing?" as long as you also know what it's worth today. Athena deliberately doesn't ask for anything more (no fees, no lot-accounting method) — see Limitations.

## 4. Why investors care

This is the smallest set of facts that makes cost basis, gain/loss, and return all calculable. It mirrors what a brokerage confirmation slip actually records.

## 5. Limitations

- **No transaction fees or commissions.** Cost basis is `shares × price` only — a real brokerage cost basis often includes fees, which Athena doesn't ask for or track.
- **No lot-accounting method (FIFO/LIFO/specific-lot).** Multiple lots of the same ticker are tracked as separate rows and netted for display (see PortfolioWeight.md), but Athena never picks "which lot" was sold for tax purposes, because Athena has no sell/realize concept at all — see WatchlistVsPortfolio.md and the sprint's explicit "no brokerage integration, no order execution" boundary.
- **Zero purchase price is allowed** (e.g. gifted shares) but makes Return % undefined rather than infinite — see UnrealizedGainLoss.md.
- ~~Single-currency assumption~~ **Fixed.** Earlier versions summed portfolio-level totals as raw numbers across holdings with no FX conversion — correct only for an all-one-currency portfolio, silently wrong for a mixed NASDAQ/NSE portfolio (a ₹9,260 holding was counted as if it were $9,260). Portfolio-level totals, weights, and concentration are now computed from each holding's value converted to USD via a live exchange rate; a holding's own per-row figures stay in its native currency. See PortfolioCurrencyNormalization.md.

## 6. How Athena implements it

`backend/portfolio/holding.model.js` is the only persisted shape. `backend/portfolio/portfolio.calculator.js` (pure functions, no I/O) derives everything else from a holding plus a live price fetched via `market.service.getCurrentMarketData(ticker)` in `portfolio.service.js`. Negative/zero shares are rejected in `portfolio.validator.js`; short selling is explicitly not supported.

## 7. Common mistakes

- Assuming "portfolio" is a document you could look up by id — it isn't; it's always `{holdings for this userId}`, computed on read.
- Forgetting that a missing live price degrades that one holding to `null` current value rather than crashing the whole portfolio view — see UnrealizedGainLoss.md's handling of `priceUnavailable`.

## 8. Interview questions

1. *"Why doesn't Athena have a `Portfolio` collection?"* — Nothing about a portfolio needs its own identity or fields beyond "the holdings that belong to this user" — a wrapper collection would be pure indirection. This mirrors how Sprint 6's DCF results are also never persisted, only computed per request.
2. *"What happens if a user holds the same stock across two lots at very different prices?"* — Both lots are stored and displayed individually (editable/deletable independently), but weighting, concentration, and best/worst-performer logic net them into one position first — see PortfolioWeight.md.

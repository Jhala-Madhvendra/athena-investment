# Portfolio Monitoring

## 1. Definition

Portfolio monitoring flags meaningful changes in a user's own holdings: a position becoming too large a share of the portfolio (concentration risk), a position moving significantly into gain or loss relative to cost basis, or a holding's value changing significantly since it was last observed.

## 2. Why investors care

Unlike Market/Financial/Business/News alerts (facts about a company, true for every investor), portfolio alerts are facts about *this specific investor's own exposure* — the same 5% AAPL price move means something very different to someone for whom AAPL is 3% of their portfolio versus 60% of it. Surfacing that personal context is something no ticker-level dashboard can do.

## 3. Formula

```
Position weight %  = positionCurrentValue / totalPortfolioCurrentValue * 100
Return %            = (currentValue - costBasis) / costBasis * 100
Value % change       = (currentValue_now - currentValue_lastObserved) / currentValue_lastObserved * 100
```

Multiple lots of the same ticker are netted into one position (`portfolio.calculator.js`'s `groupByTicker`) before any of the above is computed — two AAPL purchases are one investment for concentration/weighting purposes, not two independent ones (see `research/engineering/PortfolioDataModel.md`).

## 4. Appropriate comparison period

Concentration and gain/loss are point-in-time facts, not period comparisons — "AAPL is 38% of your portfolio right now" doesn't need a "versus what" baseline, it's simply true or false against a fixed threshold. Value-change, in contrast, genuinely needs a "since when" baseline, which is why it's the one portfolio rule backed by a persisted snapshot (`PortfolioAlertSnapshot`) rather than a stateless threshold check — see `research/engineering/SnapshotArchitecture.md`.

## 5. Limitations

- Concentration and return% are computed only from priced holdings (`priceUnavailable` lots are excluded, never treated as worthless) — a portfolio with several unpriced positions could understate true concentration risk in the priced subset.
- No correlation awareness: five holdings at 20% each look perfectly diversified by weight alone even if they're all the same sector and move together (see `research/finance/ConcentrationRisk.md`'s own documented limitation, inherited unchanged here).
- Assumes a single-currency portfolio for aggregate totals, the same limitation Sprint 9's Portfolio domain already carries.

## 6. False positives

A stock the user *intends* to hold concentrated (a conviction position, or a founder's own company stock) will repeatedly trigger `HIGH_CONCENTRATION` — this is deliberately not suppressed, since Athena has no way to distinguish an intentional concentration from an accidental one, and the alert is descriptive ("AAPL represents 38% of your tracked portfolio value"), never advisory ("you should diversify") — see the Product Decisions section of `research/product/WatchlistAndPortfolioProductDesign.md` for the underlying principle this alert category inherits.

## 7. How Athena implements it

`backend/alerts/alert.engine.js`'s `evaluatePortfolioRules` takes the already-fetched `getPortfolio(userId)` holdings/summary (no extra live-quote fetch — Portfolio rules reuse whatever `runMonitoring` already loaded for the ticker union) and nets lots via `portfolio.calculator.js`'s exported `groupByTicker`. Concentration (`≥25%` MEDIUM, `≥40%` HIGH) and gain/loss (`≥20%` either direction) are stateless threshold checks, deduplicated by calendar day. Value-change (`≥10%`) is the one rule that reads and writes `PortfolioAlertSnapshot`, scoped `{userId, ticker}` — genuinely personal data, unlike the shared market-history cache Market rules reuse.

## 8. Common mistakes

- Computing portfolio weight against total *cost basis* instead of total *current value* — weight should answer "how much of my portfolio's current worth is in this position," not "how much did I originally spend on it," and the two diverge exactly when it matters most (a position that's grown a lot is a bigger share of *today's* portfolio than its cost basis alone would suggest).
- Fabricating a zero value for an unpriced holding instead of excluding it — that would understate both total portfolio value and (silently) overstate every other position's weight.

## 9. Interview questions

1. *"Why do concentration and gain/loss not need a stored snapshot, but value-change does?"* — Concentration and gain/loss are threshold checks against the current state alone ("is this true right now"); value-change is inherently a comparison against a *prior* observation ("how much has this changed since I last checked"), which requires persisting what that prior observation was.
2. *"Two users both hold AAPL at 25% of their portfolio. Do they get the same alert?"* — The alert *text* would be similar, but the underlying `Alert` documents are entirely separate, scoped to each user's own `userId` — portfolio facts are inherently personal (this user's shares, this user's cost basis), unlike a Market alert about AAPL's price, which is the same fact for every user and could in principle be computed once.
3. *"Why doesn't Athena suppress repeated concentration alerts for a stock the user clearly intends to hold concentrated?"* — Athena has no signal that distinguishes intentional conviction from accidental drift, and inventing one (e.g., "you've dismissed this alert 3 times, stop showing it") would be a real feature but a materially different one from what Sprint 11 scoped — the alert stays purely descriptive and lets the user's own dismiss action manage frequency instead.
4. *"How does multi-lot netting affect this category specifically?"* — Without netting, three small AAPL lots would each individually be under the concentration threshold while collectively representing a much larger position — `groupByTicker` ensures the concentration and value-change rules see one true AAPL position, not three understated fragments of it.

# Portfolio Currency Normalization

## 1. Definition

**Currency normalization** is converting every holding's value into one common currency (USD) before combining them across holdings — required any time a portfolio holds tickers from more than one currency, because dollar-denominated and rupee-denominated numbers cannot be meaningfully summed as raw figures.

## 2. The bug this fixes

`portfolio.calculator.js`'s portfolio-level totals (`totalCurrentValue`, `weightPercent`, concentration) used to sum each holding's `currentValue` directly, regardless of currency:

```
AAPL: $3,000
TCS.BO: ₹9,260
"totalCurrentValue": 12,260        ← wrong: adds dollars and rupees as if both were dollars
```

Displayed with a `$` prefix, this told a user their portfolio was worth $12,260 when the true figure was closer to $3,106 (₹9,260 is roughly $106 at typical exchange rates). Every weight built on top of this total was equally wrong — TCS.BO appeared to be ~75% of the portfolio when its real weight was under 4%.

## 3. The fix

```
AAPL: $3,000 (rate 1, already USD)
TCS.BO: ₹9,260 × (1 / 87.5 INR-per-USD) ≈ $105.83
"totalCurrentValue": 3,105.83        ← correct
```

Every holding's `costBasis`/`currentValue` stays in its own native currency (correct, unchanged, still shown per-row exactly as before). A parallel `costBasisUSD`/`currentValueUSD` pair is computed using a live FX rate, and every cross-holding aggregate — portfolio totals, `weightPercent`, concentration, HHI, sector/industry exposure, and (via reused weights) Sprint 14's volatility/beta/Sharpe/drawdown/correlation weighting — is built from the USD fields, never the native ones.

## 4. Why this matters

Every downstream feature that compares holdings against each other (concentration, exposure, the entire portfolio analytics risk engine) is only as correct as the weights it's built on. A currency-blind weight doesn't just mislabel one number — it silently corrupts every metric computed from "how much of the portfolio is this holding," which turned out to be nearly everything in Sprint 14.

## 5. Data required

Each holding's currency (already fetched alongside its live price - Sprint 9's existing quote fetch) and a live USD exchange rate for every currency actually held.

## 6. How Athena implements it

`backend/market/providers/fxRate.provider.js` fetches Yahoo Finance FX pair quotes (`USD<currency>=X`, e.g. `USDINR=X`) through the same raw provider `riskFreeRate.provider.js` already uses for `^TNX` - a currency pair isn't a `Company`, so it can't go through `market.service`'s normal per-ticker path. Cached per currency for 30 minutes, same TTL rationale as the risk-free rate: a shared macro value, not per-user or per-holding.

`portfolio.service.js`'s `fetchFxRatesByCurrency()` fetches one rate per **unique currency actually held** (deduplicated exactly like `fetchQuotesByTicker()` dedupes by ticker - see `BatchDataFetching.md`), then passes the resolved rate into `portfolio.calculator.enrichHolding(holding, price, fxRateToUSD)`.

## 7. Assumptions

- **USD is the base/reporting currency**, matching the frontend's existing default `$` formatting.
- **Today's exchange rate is used for both cost basis and current value**, not the rate at the original purchase date (Athena has no historical FX data). This means the fix reports "what this position is worth in USD today" correctly, but does not capture FX-driven gain/loss (a holding's true USD return also depends on how its currency moved since purchase, which Athena doesn't attempt to isolate) - documented as a known limitation, not claimed as more precise than it is.
- A single holding's own `returnPercent` is completely unaffected by any of this - it's a same-currency ratio (both numerator and denominator in the holding's own currency), so FX conversion cancels out entirely.

## 8. Limitations

- **No historical FX rates** - see Assumptions above. A future improvement would fetch the FX rate as of each lot's purchase date for a true FX-adjusted cost basis.
- **A missing FX rate excludes a holding from USD totals**, reported separately as `fxUnavailableHoldings` (distinct from `unpricedHoldings`, since these are two different failure reasons) - the holding's native-currency row still displays normally, only the cross-holding aggregate is affected.

## 11. Same bug class, found and fixed elsewhere

Two other cross-company market-cap comparisons had the identical currency-blind bug, found by inspection after fixing Portfolio and fixed the same way (via `fxRate.provider.js`'s shared `attachMarketCapUSD()` helper, so the FX-fetching logic isn't duplicated per caller):

- `industry.peerDiscovery.rankByMarketCapProximity()` (Sprint 13) - ranked Industry Intelligence's "Potential Peers" suggestions by raw, currency-mixed `marketCap`. Now ranks on `marketCapUSD`; `industry.service.js`'s new `rankSuggestedPeers()` wrapper normalizes before calling the (still pure) ranking function.
- `ai.contextBuilder.selectAutoPeers()` (Sprint 8) - auto-selected comparable companies for the AI equity research report's Comps section the same currency-blind way. A company with a large raw market-cap number in a non-USD currency could be auto-selected as a "closest peer" over a genuinely closer USD-denominated company. Fixed identically.

Both peer tables also now surface each company's `currency` in the API response, so a non-USD market cap is labeled rather than silently displayed as if it were USD (`PotentialPeersTable.jsx`).

## 9. Common interpretation mistakes

- **Assuming a portfolio's `$` total was always accurate** just because it displayed a plausible-looking number - a currency-blind sum of a handful of holdings can still look like a believable total, especially before comparing it against what the individual rows actually show.
- **Treating `fxUnavailableHoldings` the same as `unpricedHoldings`.** A holding can have a perfectly good, known price and still be excluded from USD totals if only its exchange rate couldn't be fetched - two different gaps, reported separately on purpose.

## 10. Interview question

*"Why convert at the point of aggregation instead of storing holdings in a single currency from the start?"* — Because the source of truth for "what currency is this holding in" is the live market quote, not something the user enters — a ticker's trading currency isn't a fact Athena should ask the user to specify or guess at holding-creation time, and it can only be known once cost basis/current value are already being computed anyway. Converting at aggregation time (in the service layer, using an already-resolved rate) keeps `portfolio.calculator.js` pure - it does simple multiplication by an already-fetched number, never a fetch itself - matching the same "pure calculator, impure service" split established for every other calculator module in this codebase.

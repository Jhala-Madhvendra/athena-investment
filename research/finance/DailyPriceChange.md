# Daily Price Change

## 1. What is it?

The difference between a stock's current trading price and its previous trading session's closing price, shown both as an absolute amount and as a percentage.

## 2. Why does it matter?

It's the most immediate, most frequently checked signal of how a stock is trading *today*, distinct from its longer-term performance (covered separately in [[StockReturns]]). It's the number a headline or a ticker display leads with because it answers "what happened since I last looked."

## 3. How do investors use it?

- A quick pulse check when opening a position's page — is the stock up or down right now.
- Combined with news flow to understand same-day reaction to an event (earnings release, guidance change, broader market move).
- As context alongside longer-period returns — a stock can be up on the day while down significantly over the past year, and both facts matter for different questions.

## 4. What are its limitations?

- It's the single noisiest, least representative window available — one day of price action reflects short-term supply/demand, order flow, and sentiment far more than it reflects anything about the underlying business.
- It says nothing about *why* the price moved — the same +2% could reflect a company-specific catalyst or the entire market moving together.
- Comparing daily change across stocks without also considering typical volatility is misleading — a 3% daily move is unremarkable for a small, volatile stock and unusual for a large, stable one.

## 5. How is it calculated?

```
Change = Current Price − Previous Close
Change (%) = (Change / Previous Close) × 100
```

This is the one calculation Athena performs client-side rather than sourcing pre-computed from an API — deliberately, since it's simple arithmetic on two numbers (`price.current`, `price.previousClose`) already present in the market snapshot response, not a duplicated financial formula. Every other metric on the dashboard is read directly off an API response; this is the sole exception, and it's flagged as such in the code.

## 6. How does Athena use it?

Shown in `CompanyHeader` at the top of the Overview dashboard — the current price with the day's change directly beneath it, colored green (`good`) for a gain and red (`critical`) for a loss, matching the app's validated sentiment palette used everywhere else CAGR/trend direction is colored.

## 7. What can cause the metric to be misleading?

- A large daily move can be almost entirely a broad market or sector effect rather than anything specific to the company — reacting to it in isolation, without checking whether peers moved similarly, risks misattributing the cause.
- Low-volume or thinly-traded stocks can show an exaggerated daily change on a small number of trades that isn't representative of where the stock would trade with normal liquidity.
- A change calculated against a stale or delayed previous close (e.g., around a stock split, spin-off, or dividend ex-date) can appear far larger or smaller than the actual economic move.

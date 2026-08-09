# Capital Asset Pricing Model (CAPM)

## 1. Definition

CAPM is the standard model for estimating the return equity investors require for holding a specific stock, given the risk-free return available elsewhere and how much riskier this particular stock is than the market as a whole. Athena uses it to compute Cost of Equity (Ke), one of the two inputs (with Cost of Debt) that feed WACC.

## 2. The formula

```
Ke = Risk-Free Rate + Beta × Equity Risk Premium
```

## 3. Intuition

An investor won't buy a risky stock unless it's expected to pay more than a genuinely risk-free asset (a government bond). How much more depends on two things: how much extra return the *stock market as a whole* pays over the risk-free rate (the Equity Risk Premium), and how much riskier *this specific stock* is relative to the market (Beta). A beta of 1.0 says "moves with the market, demand the full market premium." A beta of 1.5 says "swings 50% more than the market, demand 50% more premium." A beta below 1.0 says the opposite.

## 4. Why investors use it

CAPM is the bridge between "how risky is this stock" (a single number, beta) and "what return should I require to hold it" (a percentage). It's simple, widely taught, widely used in practice, and — crucially for a DCF — it gives an unambiguous, reproducible way to arrive at Ke instead of an analyst just picking a number that "feels right."

## 5. Assumptions

CAPM assumes beta (typically measured from historical price co-movement) is a stable, forward-looking estimate of the stock's future volatility relative to the market — a genuinely debatable assumption, since beta is backward-looking by construction. It also assumes the Equity Risk Premium is a knowable constant, when in reality it's an estimate that varies by source, methodology, and time period (estimates commonly range roughly 4–6% for the U.S. market, with no single "correct" figure).

## 6. Limitations

Real-world stock returns don't purely track a single "market beta" factor — decades of empirical finance (Fama-French and successors) show size, value, momentum, and other factors also explain returns beyond CAPM's single variable. CAPM is a simplification, not a complete model of required return, and beta itself is sensitive to the lookback window and benchmark index used to estimate it — two data providers can report meaningfully different betas for the same stock.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`'s `costOfEquityCAPM()`:

```js
const costOfEquityCAPM = ({ riskFreeRate, beta, equityRiskPremium }) =>
    riskFreeRate + beta * equityRiskPremium;
```

All three inputs are explicit, user-visible, individually labeled assumptions — never combined into an opaque "Ke" the user can't inspect:

- **Beta**: fetched live from Yahoo Finance (`market/mappers/yahooMarketData.mapper.js`'s `riskMetrics.beta`), labeled `source: "market"` in the DCF defaults response — pre-filled, but always editable.
- **Risk-Free Rate**: fetched live as the 10-Year US Treasury yield via a dedicated `backend/valuation/providers/riskFreeRate.provider.js`, which queries Yahoo's `^TNX` symbol directly (bypassing the normal per-company market-data path, since a treasury yield isn't a "company"). Labeled `source: "market"` when available, `"unavailable"` if the live fetch fails — never a hardcoded fallback number.
- **Equity Risk Premium**: Athena has no live ERP data source (there is no single "market price" for the ERP the way there is for a treasury yield). It's pre-filled with a commonly-cited illustrative figure (5%), explicitly labeled `source: "illustrative_default"` — visually distinguished in the UI from the live-sourced fields — so the user consciously reviews it rather than mistaking it for real-time data.

## 8. Common mistakes

- **Treating a data provider's beta as ground truth.** Different providers compute beta over different lookback windows and against different benchmark indices — Athena labels its beta "Live Market Data" but explicitly invites the user to override it, rather than presenting it as unquestionable.
- **Using a single global ERP for every market/currency.** Equity risk premia differ by country and market maturity; Athena's illustrative 5% is a US-market-style default, clearly flagged as such rather than silently applied to every ticker regardless of listing.
- **Forgetting CAPM only produces Cost of *Equity*.** It's tempting to stop there and use Ke as the DCF's discount rate directly — but Ke prices equity risk only; the DCF needs WACC, which blends Ke with the after-tax cost of debt (see WACC.md).

## 9. Interview questions

*"Where does each of the three CAPM inputs come from in Athena, and why are they sourced differently?"* — Beta and the risk-free rate both have genuine live market instruments (a stock's price history, a traded Treasury yield) — Athena fetches both live. The Equity Risk Premium has no equivalent tradeable instrument; it's a modeled/estimated figure across the whole field of finance, so Athena pre-fills a commonly-cited illustrative number rather than fabricating a "live" source that doesn't exist, and labels it distinctly so the user knows the difference.

*"A stock has a beta of 0.7. What does that say about its expected return relative to the market, and is that necessarily a bad thing for an investor?"* — A beta of 0.7 says CAPM expects it to require a lower return than the market (moves less, in either direction). That's not inherently bad — a defensive stock with low beta can be exactly what a risk-averse investor or a diversifying portfolio wants; a low beta lowering the DCF's WACC also, all else equal, increases its intrinsic value relative to a higher-beta company with identical cash flows.

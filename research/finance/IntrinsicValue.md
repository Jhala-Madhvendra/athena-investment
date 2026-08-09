# Intrinsic Value Per Share

## 1. Definition

Intrinsic Value Per Share is a DCF's final output: an estimate of what one share of the company is actually worth, based on the cash the business is expected to generate — as distinct from the stock's current *market price*, which reflects whatever the market happens to be paying for it right now.

## 2. The formula

```
Intrinsic Value Per Share = Equity Value / Diluted Shares Outstanding
```

## 3. Intuition

Equity Value (EquityValue.md) is the total dollar value attributable to all shareholders combined. Dividing by the number of shares that value is split across converts a company-level number into a per-share number directly comparable to what you'd pay to buy one share on the market — the same conversion any per-share metric (EPS, book value per share) performs.

## 4. Why investors use it

Comparing Intrinsic Value to the current Market Price (Athena calls this comparison the "valuation gap" — `(Intrinsic − Market) / Market × 100`) is the entire payoff of running a DCF: it's a structured, assumption-transparent answer to "is this stock's current price high, low, or reasonable relative to what the underlying business can generate in cash." It is **not** a prediction of where the price will go, and Athena is explicit about that distinction (Section 6).

## 5. Assumptions

Uses **diluted** shares outstanding specifically — not basic — because diluted share count accounts for the effect of stock options, RSUs, and convertible securities that would increase the share count if exercised/converted, giving a more conservative (and more accurate) per-share value than basic shares would. Assumes the diluted share count is a stable, current figure — a company that's actively buying back or issuing large amounts of stock will see this number drift between reporting periods.

## 6. Limitations — and the product principle behind them

**Diluted shares outstanding cannot be silently substituted with a fallback.** If Athena's data source doesn't have this figure for a given ticker, `dcf.validator.js` rejects the calculation outright with a specific error, rather than guessing or falling back to basic shares — a wrong share count would silently corrupt the one number the whole feature exists to produce.

**The valuation gap is presented as a gap, never a recommendation.** Athena's DCF explicitly never outputs "Buy," "Sell," "Strong Buy," or "Strong Sell" anywhere in the API response, the UI copy, or the underlying formulas — this is enforced structurally (there is no code path that maps a valuation gap to a recommendation string) and tested for directly (both the backend and frontend test suites assert no such language appears anywhere in a DCF response or rendered page). Every DCF result also carries an explicit disclaimer: *"DCF valuation is highly sensitive to assumptions and should not be interpreted as a guaranteed future price."* DCF is a highly assumption-sensitive analytical tool, not a financial-advice engine — see `research/product/DCFProductDesign.md` for the full reasoning.

## 7. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`:

```js
const intrinsicValuePerShare = (equityValueAmount, dilutedShares) => safeDivide(equityValueAmount, dilutedShares);
const upsideDownsidePercent = (intrinsicValue, marketPrice) =>
    marketPrice > 0 ? ((intrinsicValue - marketPrice) / marketPrice) * 100 : null;
```

`upsideDownsidePercent` deliberately lives *outside* the pure DCF engine, in `valuation.service.js` — the engine itself never sees or needs a live market price (it's a valuation of the business, not a comparison to the market), and the market-price comparison is layered on afterward using a live quote. If a live price isn't available for a ticker, the comparison degrades to `null` rather than blocking or corrupting the underlying intrinsic value calculation — the two are computed and can fail independently.

## 8. Common mistakes

- **Treating Intrinsic Value as more certain than it is.** It's the output of a model built on assumptions the user controls — DCF is famous among practitioners for being extremely sensitive to small input changes (see SensitivityAnalysis.md), which is exactly why Athena surfaces every input's source (historical, derived, market, illustrative, or required) rather than presenting one clean final number.
- **Converting a valuation gap directly into a trading signal.** A large "undervalued" gap could reflect a genuine mispricing, or it could reflect an assumption set that's simply too optimistic relative to what the market (which prices in information beyond a single analyst's model) believes is realistic — the gap is a prompt to investigate further, not a conclusion.
- **Using basic shares instead of diluted.** Overstates per-share value by ignoring the dilutive effect of options, RSUs, and convertibles.

## 9. Interview questions

*"Your DCF says a stock is worth $96 and it's trading at $313. What should an investor actually conclude from that?"* — Not "sell" or "the market is wrong" — the honest conclusion is that *this specific model, with these specific assumptions,* implies a lower value than the market is currently paying. That gap could mean the assumptions are too conservative (the market has priced in a better growth/margin story than the model's inputs assumed), or it could genuinely reflect the market overvaluing the stock — the DCF output is a prompt to scrutinize which specific assumption is driving the gap (often via the sensitivity table), not a standalone verdict. This is exactly why Athena frames it as a "valuation gap," never a buy/sell signal.

*"Why does Athena refuse to substitute a default value when diluted shares outstanding is missing, when it's willing to suggest defaults for other inputs like terminal growth rate?"* — Because diluted shares is a factual, objective data point about the company (not a judgment call or forecast assumption), and there's no legitimate "reasonable illustrative" stand-in for a specific company's actual share count the way there is for a broad market-level assumption like terminal growth. Guessing a share count would directly fabricate the denominator of the one number the whole feature is built to produce — Athena treats that as a hard stop, not a soft default.

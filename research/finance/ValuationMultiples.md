# Valuation Multiples: Enterprise-Value vs. Equity-Value

## 1. Definition

A valuation multiple is a ratio of price to some financial metric, used to compare how "expensively" different companies are valued on a standardized basis. Every multiple Athena calculates falls into exactly one of two families, and the single most important rule in Comparable Company Analysis is: **never mix them.**

## 2. The two families

```
ENTERPRISE-VALUE MULTIPLES          EQUITY-VALUE MULTIPLES
  Numerator: Enterprise Value         Numerator: Market Cap (Equity Value)
  Belongs to: debt + equity holders   Belongs to: equity holders only
  Denominator: pre-interest metric    Denominator: post-interest / equity-scaled metric
  ─────────────────────────────       ─────────────────────────────
  EV/EBITDA                           P/E   (Price / Net Income)
  EV/Revenue                          P/B   (Price / Book Value)
                                       P/S   (Price / Revenue)
```

## 3. Intuition

Enterprise Value is the value of the whole operating business — what it would cost to buy the company outright, assuming the debt and buying out the equity (see `EnterpriseValue.md`). Equity Value is what's left over for shareholders *after* debt holders are paid (see `EquityValue.md`): `Equity Value = Enterprise Value − Net Debt`. A multiple's numerator and denominator have to agree on which of these two things they're measuring — pairing an "everyone's claim" numerator (EV) with an "only equity holders'" denominator (Net Income, which is *after* interest expense has already been paid to debt holders) mixes two incompatible units and produces a number that means nothing.

## 4. Why investors use this distinction

It's what makes multiples comparable across companies with different capital structures at all. Two operationally identical companies, one all-equity-financed and one carrying significant debt, will show similar EV/EBITDA (both sides capital-structure-neutral) but very different P/E (the levered one's Net Income is depressed by interest expense, inflating its P/E for the same underlying business quality). Using the right family for the right comparison — or the right conversion when moving between them — is what keeps a Comps analysis honest.

## 5. When it is useful

Enterprise multiples are the right choice whenever comparing companies with meaningfully different debt loads. Equity multiples are simpler and sufficient whenever debt levels across the peer group are similar, or when the question genuinely is "what is the equity worth," not "what is the business worth."

## 6. When it can be misleading

Applying an Enterprise-Value multiple's result as if it were already an Equity Value (or vice versa) is not a minor error — it's a unit-mismatch that can overstate or understate implied value per share by exactly the size of the company's net debt (or net cash) position, scaled per share. For a heavily-levered company, this mistake alone can produce a wildly wrong implied share price.

## 7. What makes a company comparable

This doc covers the mechanics of the two multiple families; `ComparableCompanyAnalysis.md` and `PeerSelection.md` cover the judgment of *which companies* belong in a peer group at all (industry, business model, revenue scale, market cap, geography, growth profile).

## 8. How Athena implements it

`backend/valuation/comps/comps.valuation.js`'s `MULTIPLE_DEFINITIONS` tags every multiple with a `basis: "equity" | "enterprise"`, and `calculateImpliedValuation()` branches on it:

```js
return definition.basis === "enterprise"
    ? buildEnterpriseValuation(definition, selectedPeerStatistic, targetMetricValue, targetMetrics)
    : buildEquityValuation(definition, selectedPeerStatistic, targetMetricValue, targetMetrics);
```

`buildEnterpriseValuation()` is the *only* code path that calls `dcf.formulas.js`'s `netDebt()`/`equityValue()` — the Enterprise-to-Equity bridge — reusing the exact same relationship DCF already established rather than re-deriving it. `buildEquityValuation()` has no access to Net Debt at all; there is structurally no way for an equity multiple to accidentally get bridged a second time, and no way for an enterprise multiple to skip the bridge. This is enforced by the code's shape, not by a comment or a runtime check that could be bypassed.

## 9. Common mistakes

- **Applying EV/EBITDA or EV/Revenue directly as Equity Value.** The exact mistake this doc exists to prevent — see Section 6.
- **Applying P/E, P/B, or P/S to Enterprise Value.** The mirror-image mistake — these multiples were never scaled to include debt holders' claim in the first place.
- **Assuming a company's EV and Equity Value (market cap) are close enough to ignore the difference.** They diverge by exactly Net Debt, which can be a large fraction of Enterprise Value for a leveraged company.

## 10. Interview questions

*"Someone hands you an EV/EBITDA multiple and asks for the implied stock price. Walk through every step."* — Multiply the multiple by the target's EBITDA to get Implied Enterprise Value. Subtract Net Debt (Total Debt − Cash) to get Implied Equity Value — this step is not optional and is where most of the real mistakes happen. Divide by diluted shares outstanding to get Implied Value Per Share. Skipping the Net Debt step and dividing Enterprise Value directly by shares outstanding is the single most common error made by someone new to this.

*"Why doesn't Athena's engine have a shared function that both equity and enterprise multiples call?"* — Because the two paths are supposed to diverge — an equity multiple should never have access to a Net Debt bridge, and an enterprise multiple should never be able to skip it. Structurally separating `buildEquityValuation()` from `buildEnterpriseValuation()` in `comps.valuation.js` makes the Enterprise-vs-Equity mistake a type of bug that literally cannot compile into existence, rather than one that has to be caught by a reviewer or a test.

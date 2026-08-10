# Price-to-Sales (P/S) Ratio

## 1. Definition

Price-to-Sales compares a company's Market Capitalization (Equity Value) to its Revenue. It's the equity-side counterpart to EV/Revenue: "how many times its revenue is the equity alone valued at?"

## 2. The formula

```
P/S = Market Capitalization / Revenue
```

## 3. Intuition

P/S is an **equity multiple** — the numerator is Market Cap, which belongs only to equity holders, and Athena pairs it only with Revenue (never Enterprise Value) to keep both sides of the ratio on the same "who does this belong to" basis. Because Revenue itself is capital-structure-neutral, P/S and EV/Revenue will produce different implied values for companies with meaningfully different debt loads — which is exactly why they're kept as two distinct, separately-reported multiples rather than treated as interchangeable.

## 4. Why investors use it

Same core appeal as EV/Revenue — Revenue is available even for unprofitable companies and is comparatively hard to distort via accounting choices — but computed directly against the price a share actually trades at, without needing a Net Debt figure at all. It's a quick, low-input way to gauge equity valuation for a growth or pre-profit company.

## 5. When it is useful

- Valuing pre-profit or early-growth companies where P/E is unusable.
- Comparing companies with essentially no debt, where P/S and EV/Revenue should track closely (a large divergence between the two is itself informative — it signals a meaningful net debt or net cash position).
- As a quick, low-effort screen before a more detailed enterprise-value-based analysis.

## 6. When it can be misleading

- **Ignores capital structure entirely** — two companies with identical Revenue and identical P/S, but very different debt loads, do not have equally risky equity; P/S doesn't capture that difference the way EV/Revenue implicitly can.
- **Zero revenue makes it undefined** — Athena's `priceToSales()` returns `null` rather than dividing by zero (see `OutlierHandling.md`).
- Carries the same margin-blindness limitation as EV/Revenue (see `EVRevenue.md`) — it says nothing about how efficiently that revenue turns into profit.

## 7. What makes a company comparable

Same general factors as any Comps multiple (`ComparableCompanyAnalysis.md`), plus the same margin-trajectory caveat as EV/Revenue. Additionally, since P/S doesn't account for leverage the way EV/Revenue does, a P/S-based peer group should ideally have broadly similar debt levels — otherwise the multiple is comparing equity claims on very differently-risked capital structures.

## 8. How Athena implements it

Computed in `comps.engine.js`'s `buildCompanyMetrics()` via `comps.formulas.js`'s `priceToSales()`, returning `null` with a stated `excludedReason` when Revenue isn't positive. As an **equity multiple**, its target-company application in `comps.valuation.js` goes straight to Implied Equity Value (`selected statistic × target Revenue`) — no Enterprise-Value bridge, no Net Debt involved, unlike EV/Revenue.

## 9. Common mistakes

- **Confusing P/S with EV/Revenue** and using them interchangeably — they are numerically different for any company with nonzero net debt, and mixing which one a peer statistic came from with which one the target metric belongs to would silently corrupt the calculation. Athena's `MULTIPLE_DEFINITIONS` in `comps.valuation.js` keeps them as entirely separate multiple keys (`ps` vs. `evRevenue`) specifically to prevent this.
- **Applying an Enterprise-Value bridge to P/S's result** — P/S already produces Equity Value directly; running it through `Enterprise Value − Net Debt` a second time would double-count net debt.
- **Treating P/S as a substitute for margin analysis** rather than a companion to it.

## 10. Interview questions

*"P/S and EV/Revenue for the same company give different multiples — why, and which one should you trust?"* — They differ by exactly the company's net debt (or net cash) position, scaled by Revenue. Neither is "more correct" — they answer different questions: P/S values just the equity claim as priced today, EV/Revenue values the whole operating business independent of financing. For a company with meaningful debt, its P/S will look cheaper than its EV/Revenue for a structural reason (the equity is riskier, levered by that debt), not because the company is genuinely undervalued.

*"Why is P/S kept as a separate multiple in Athena's engine rather than derived from EV/Revenue?"* — Because the two travel through genuinely different code paths — P/S applies directly to produce Equity Value, EV/Revenue must bridge through Net Debt first — and conflating them structurally would risk exactly the Enterprise-vs-Equity mixing mistake `ValuationMultiples.md` calls out as the single most important invariant in the whole model.

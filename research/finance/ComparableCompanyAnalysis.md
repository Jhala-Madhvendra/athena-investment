# Comparable Company Analysis (Trading Comps)

## 1. Definition

Comparable Company Analysis ("Comps") estimates what a company is worth by looking at how the market is currently pricing *other, similar* publicly traded companies, then applying that pricing to the target company's own financials. It is a **relative valuation** method — it answers *"what is the market currently paying for businesses like this one?"*, not *"what is this business intrinsically worth?"* (that second question is DCF's job — see Section 3 below and `DCF.md`).

## 2. The formula (the whole pipeline)

```
Peer Trading Multiples (P/E, EV/EBITDA, EV/Revenue, P/B, P/S)
  ↓ exclude non-meaningful observations (negative earnings, negative EBITDA, ...)
  ↓ aggregate the rest (Min / Max / Mean / Median / P25 / P75)
Selected Peer Statistic (Median by default)
  × Target's own metric (Net Income, EBITDA, Revenue, Book Value)
  = Implied Enterprise Value or Implied Equity Value
  (Enterprise-basis multiples bridge through Enterprise Value − Net Debt = Equity Value)
  ÷ Diluted Shares Outstanding
  = Implied Value Per Share
```

Every applicable multiple produces its own Implied Value Per Share; Athena reports the resulting **range** (Low / Median / High), never a single collapsed number. Each step has its own doc: `PERatio.md`, `EVEBITDA.md`, `EVRevenue.md`, `PriceToBook.md`, `PriceToSales.md`, `TradingMultiples.md`, `PeerSelection.md`.

## 3. Intuition

DCF and Comps ask genuinely different questions:

| | DCF | Comps |
|---|---|---|
| Question | "What could this business be worth based on its own future cash flows?" | "What is the market currently paying for similar businesses?" |
| Method | Intrinsic valuation — bottom-up, from the target's own financials | Relative valuation — anchored to how peers currently trade |
| Depends on | The target's own forecast assumptions | The peer group being correctly priced and genuinely comparable |
| Can be wrong because | The forecast/discount-rate assumptions are wrong | The peer group is mispriced, or isn't actually comparable |

Neither is "more correct" — they can legitimately disagree, and Athena's DCF-vs-Comps comparison (see `ComparableCompaniesProductDesign.md`) deliberately does not resolve that disagreement in either direction.

## 4. Why investors use it

Comps is fast, grounded in real, observable market prices (unlike DCF's forecast assumptions), and answers the question most relevant to a near-term transaction: "what would the market pay for this, based on what it's paying for comparable businesses today?" It's the standard first pass in equity research, M&A, and IPO pricing precisely because it requires fewer subjective long-run assumptions than a DCF.

## 5. When it is useful

- When there is a real, liquid set of comparable public companies to anchor to.
- For a quick sanity check against a DCF's intrinsic value — large divergence between the two is worth investigating, not necessarily a sign either is wrong.
- When near-term market sentiment (which a DCF, if built on normalized long-run assumptions, may deliberately not capture) is itself relevant to the question being asked.

## 6. When it can be misleading

- When the "peer group" isn't actually comparable — different growth rates, margins, capital intensity, or business models produce different multiples for entirely rational reasons, not mispricing.
- When the whole peer group (and thus the whole market) is over- or under-priced — Comps will faithfully reproduce that mispricing rather than reveal it, which DCF, being independent of market prices, does not.
- When a small peer group is dominated by one or two outlier multiples — this is why Athena defaults to median over mean and reports the full Min/Max/Mean/Median/P25/P75 spread rather than a single averaged figure (see `TradingMultiples.md`).

## 7. What makes a company comparable

There is no formula for this — it is a judgment call the sprint brief is explicit Athena does not make automatically (see `PeerSelection.md`). Factors an analyst should weigh:

- **Industry and business model** — a hardware company and a software company can share a "Technology" sector label yet have utterly different margin structures and multiples.
- **Revenue scale** — a company at $50M revenue and one at $50B revenue rarely deserve the same multiple, even in the same industry.
- **Market capitalization** — proxies for how liquid, how covered by analysts, and how mature the company is.
- **Geography** — different markets price risk, growth, and capital differently.
- **Growth profile** — see Section 9's "higher growth deserves a higher multiple" note below.

## 8. How Athena implements it

The calculation is a pure, deterministic engine (`backend/valuation/comps/comps.engine.js`, composed from `comps.formulas.js`, `comps.statistics.js`, and `comps.valuation.js` — see `ComparableValuationEngine.md`) that takes plain target/peer financial bundles and a selected statistic, and returns a fully structured result: every company's derived metrics and multiples, per-multiple peer statistics with excluded observations explained, and the target's implied valuation under every applicable multiple. `comps.service.js` is the only layer that touches stored financial statements, live market quotes, and the HTTP boundary — mirroring the exact separation DCF already established (`DCFEngine.md`). Exposed via `POST /api/valuation/:ticker/comps` (the calculation) and `GET /api/valuation/:ticker/comps/available-peers` (candidate peer discovery — see `PeerSelectionEngine.md`).

## 9. Common mistakes

- **Applying an Enterprise Value multiple's result directly as Equity Value** (or vice versa) — see `ValuationMultiples.md` for why this is the single most important invariant in the whole model, and how Athena's `comps.valuation.js` enforces it structurally (there is no code path that skips the Enterprise-Value-to-Equity-Value bridge for an enterprise multiple).
- **Fabricating a multiple for a company with negative or zero earnings/EBITDA/book value/revenue** — Athena returns `null` and a stated reason instead (see `OutlierHandling.md`).
- **Treating a high-growth company and a mature company as equally comparable on the same multiple** — a faster-growing company rationally deserves a higher multiple (more of its value sits in future, not current, earnings); comparing it at face value against a slow-grower's multiple systematically understates or overstates the implied value.
- **Collapsing five different methodologies' implied values into one "the" number** — Athena reports a range and every methodology's individual result, and never auto-selects a favorite (see `ComparableCompaniesProductDesign.md`).

## 10. Interview questions

*"Walk me through how Athena's Comps engine goes from a peer list to an implied value per share."* — For each selected peer and the target, compute Enterprise Value (Market Cap + Debt − Cash) and an EBITDA proxy (Operating Income + D&A), then five multiples (P/E, EV/EBITDA, EV/Revenue, P/B, P/S) — each returning `null` when its denominator isn't a positive number. Aggregate each multiple's *valid* peer observations into Min/Max/Mean/Median/P25/P75. Apply the selected statistic (Median by default) to the target's own metric: equity multiples produce Implied Equity Value directly; enterprise multiples produce Implied Enterprise Value first, then bridge to equity via Enterprise Value − Net Debt (reusing `dcf.formulas.js`'s `netDebt`/`equityValue`, since it's the same relationship regardless of how EV was derived). Divide by diluted shares for Implied Value Per Share, and report the range across every applicable methodology.

*"Why would a DCF and a Comps valuation for the same company disagree?"* — They're answering different questions with different failure modes. DCF can be "wrong" if its forecast assumptions or discount rate are wrong; Comps can be "wrong" if the peer group is mispriced or not actually comparable. A gap between them isn't a bug to resolve — it's information: either the market is pricing the peer group differently than the target's own fundamentals justify, or the DCF's assumptions diverge from what the market currently believes. Athena presents both, side by side, and explicitly does not adjudicate which one is "right."

*"Why does a faster-growing company deserve a higher multiple, all else equal?"* — A multiple like P/E capitalizes a *single year's* earnings into a price; a company growing its earnings faster will have materially larger earnings in future years, so the market rationally pays more per dollar of *today's* earnings for it. Comparing a 5%-grower and a 30%-grower on the same raw multiple, without adjusting for that, is comparing two different economic realities as if they were one.

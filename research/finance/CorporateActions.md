# Corporate Actions

## 1. What it means

A corporate action is a decision by a company's board/management that directly changes the company's capital structure, ownership, or governance — mergers and acquisitions, dividends, share buybacks, stock splits, and leadership appointments/departures are the most common. Unlike a routine operating update, a corporate action is a discrete, deliberate event with mechanical, often immediate, financial consequences.

## 2. Why investors care

Corporate actions can change what an investor actually owns (a merger converts shares into cash or acquirer stock), how much cash flows back to shareholders (dividends, buybacks), or who is making strategic decisions on the investor's behalf (leadership changes) — none of which require waiting for a quarterly filing to matter. They're also one of the few news categories with a near-mechanical, well-understood market reaction pattern, which is why analysts track them separately from general news noise.

## 3. How analysts use it

For M&A: analysts model the target's takeover premium and the acquirer's pro-forma combined financials, and watch for deal-break risk (regulatory, financing, shareholder approval). For capital allocation (dividends/buybacks): analysts read the *size and trend* as a signal of management's confidence in future cash generation and treat a change in policy (a cut, a resumption, a new authorization) as more informative than the absolute amount. For leadership changes: analysts assess execution/strategy continuity risk, weighting a departure differently depending on whether it's planned succession or abrupt.

## 4. How it relates to financial statements

Every corporate action eventually lands on a financial statement: an acquisition creates goodwill and changes consolidated revenue/expenses going forward; a buyback reduces shares outstanding (and therefore mechanically raises EPS even with flat net income) and shows up as a financing cash outflow; a dividend is a financing cash outflow and a reduction in retained earnings. The corporate action is the *announcement*; the statement is where its financial footprint is eventually recorded.

## 5. How it can affect valuation

- **M&A** changes the valuation subject entirely — a standalone DCF for a target being acquired becomes largely irrelevant once a deal price is set; the analysis shifts to deal-close probability and premium/spread.
- **Buybacks** raise EPS and can raise per-share intrinsic value in a DCF (fewer shares over the same equity value) without changing the underlying business — a distinction Athena's `EquityValue.md`/`DCF.md` engines already respect by valuing total equity before dividing by share count.
- **Dividends** are a direct input to the Dividend Discount Model family and to `DividendYield.md`, and a policy change updates the FCFE-to-shareholder assumption directly.
- **Leadership changes** rarely have a mechanical valuation formula attached — their effect is usually applied through a wider or narrower discount rate / risk premium to reflect changed execution confidence.

## 6. Limitations

- **Announced intent isn't completion** — an announced merger can fall through; an authorized buyback isn't a commitment to actually execute it.
- **Motive is often opaque** — a buyback can signal confidence, or simply be the least-bad use of excess cash with no better investment on offer; the headline alone doesn't distinguish these.
- **Leadership-change impact is genuinely hard to quantify** — unlike a dividend or buyback, there's no clean formula for "how many basis points of discount rate does a CFO departure justify."

## 7. How Athena uses it

Athena's classifier maps corporate-action language into three of its ten fixed categories rather than one catch-all: `Acquisition / Merger` (acquire, merger, takeover, buyout), `Capital Allocation` (buyback, share repurchase, dividend), and `Leadership` (CEO/CFO, appointed, resigned, board of directors) — see `backend/news/news.classifier.js`. Keeping these separate, rather than one generic "Corporate Action" bucket, matches how analysts actually reason about them: an acquisition, a buyback, and a CEO exit have almost nothing in common analytically beyond both being deliberate management decisions.

## 8. Interview questions

1. *"Why does a share buyback raise EPS even if net income doesn't change?"* — EPS = net income ÷ shares outstanding; a buyback reduces the denominator (shares outstanding) while the numerator (net income) is unaffected, so EPS rises mechanically, independent of any change in actual profitability.
2. *"Why does Athena classify Acquisition/Merger, Capital Allocation, and Leadership as three separate categories instead of one 'Corporate Actions' bucket?"* — Because they carry different analytical implications and different keyword signals with almost no overlap; collapsing them into one category would force a user filtering for "recent buybacks" to also wade through leadership and M&A headlines, defeating the point of category filtering.

# Market Reaction

## 1. Definition

How a stock's price moved in the trading sessions following an earnings-related event — presented strictly as an observed correlation, never as a causal claim.

## 2. Formula

```
1-day return %  = (reactionDayClose - baselineClose) / baselineClose * 100
5-day return %  = (closeFiveSessionsLater - baselineClose) / baselineClose * 100
```

Where `baselineClose` is the last close *before* the anchor date and `reactionDayClose` is the first close *on or after* it — see §6 for what "anchor date" actually means in Athena.

## 3. Intuition

Markets are forward-looking and often react quickly to new information. Measuring the price move around a dated event is a way to see whether the market found that information meaningfully different from what it already expected — without ever claiming to know *why* it moved that way.

## 4. Why investors care

Comparing reported results to the market's reaction is a useful (if imperfect) cross-check — a company that reports strong numbers but sees shares fall may have missed a specific expectation Athena doesn't have visibility into (e.g. consensus estimates, which Athena does not store); a company with soft numbers whose shares rise may already have had that weakness priced in.

## 5. Which financial statements are used

None directly — this combines Sprint 4's Market Intelligence (`MarketHistory`, daily OHLC bars) with Sprint 10's News & Event Intelligence (classified news articles), not a financial statement.

## 6. How Athena calculates it — and its central limitation

**Athena has no earnings-release date anywhere in its data.** `FinancialStatement` (`backend/financials/financials.model.js`) stores only a fiscal `year`; there is no filing date, no report date. Approximating with fiscal-year-end would be actively wrong — annual reports (10-Ks) typically file 60-90 days *after* fiscal year end, so "market reaction to FYE" would measure the wrong window entirely.

Instead, `backend/earnings/earnings.marketReaction.js` anchors on the **most recent stored "Earnings"-category news article** for the ticker (reusing Sprint 10's News domain — `newsService.getNews(ticker, {category: "Earnings"})` — never a direct provider call). The API response labels this explicitly:

```json
{ "basis": "most recent Earnings-category news article", "anchorDate": "2026-02-13", ... }
```

— and the frontend renders it as "Measured from [date] - most recent Earnings-category news article," never as "the earnings release date."

## 7. Limitations

- The anchor is a *news article's publish date*, not a verified earnings-release date — if no Earnings-category article has been retrieved for a ticker (or the News pipeline's classifier missed one), market reaction is unavailable, not silently wrong.
- **This is correlation, not causation, and is presented as such everywhere it appears.** A move following an earnings-adjacent date could be driven by broader market conditions, sector news, or anything else happening the same week — Athena makes no attempt to isolate an earnings-specific component of the move.
- 1-day and 5-day are *trading-session* windows, not calendar-day windows (matching `research/finance/MarketEventAnalysis.md`'s own convention) — a Friday anchor's "1-day" reaction is the next Monday's close.

## 8. Common interpretation mistakes

- Reading "shares moved X% following the earnings-related news" as "earnings caused the X% move" — the brief is explicit that this distinction must never be blurred, and Athena's own UI copy is written to avoid it.
- Assuming a missing market reaction means something went wrong — it usually just means no Earnings-category news has been retrieved for that ticker yet (news is fetched on-demand, not pre-loaded for every company).

## 9. Interview question

*"Why not just use the fiscal year-end date as a proxy for the earnings release date?"* — Because it would be a specific, confidently-wrong number, not an approximation in the right neighborhood — a 10-K typically files 60-90 days after fiscal year end, so measuring "market reaction" from FYE would capture an arbitrary market window that has nothing to do with when the results were actually reported. Anchoring on an actual dated news event, even an imperfect proxy, is closer to the real thing and is honestly labeled as a proxy rather than presented as ground truth.

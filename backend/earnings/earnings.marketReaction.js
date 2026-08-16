/**
 * Earnings Market Reaction
 *
 * Athena has no earnings-release date anywhere in its data -
 * backend/financials/financials.model.js stores only a fiscal `year`, no
 * filing or report date. Approximating with fiscal-year-end would be
 * materially wrong (annual reports typically file 60-90 days after FYE).
 * Instead, this module anchors on the most recent stored "Earnings"-
 * category news article for the ticker - reusing the News domain's
 * already-fetched articles rather than querying it separately (see
 * earnings.service.js) - and measures the stock's move around THAT date.
 * The response labels this explicitly as `basis` and never as "the
 * earnings release date."
 *
 * Never claims causation: the frontend renders this as "shares moved X%
 * following [date]," never "earnings caused shares to move X%" - see
 * research/finance/MarketReaction.md.
 */

const round = (value, decimals = 2) =>
    typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;

const HISTORY_PERIOD = "5y";
const MARKET_REACTION_BASIS = "most recent Earnings-category news article";

const unavailable = (reason) => ({
    available: false,
    reason,
    basis: null,
    anchorDate: null,
    oneDayReturnPercent: null,
    fiveDayReturnPercent: null,
});

const percentReturn = (startClose, endClose) => {
    if (typeof startClose !== "number" || typeof endClose !== "number" || startClose === 0) {
        return null;
    }
    const value = ((endClose - startClose) / startClose) * 100;
    return Number.isFinite(value) ? round(value) : null;
};

/**
 * @param {Array} earningsArticles - Earnings-category news articles,
 *   most-recent-first (as returned by newsService.getNews)
 * @param {Array} bars - ascending-by-date daily bars, `{date: "YYYY-MM-DD",
 *   close, ...}` (marketService.getHistoricalPrices shape)
 * @returns {{available: boolean, reason: string|null, basis: string|null,
 *   anchorDate: string|null, oneDayReturnPercent: number|null,
 *   fiveDayReturnPercent: number|null}}
 */
const computeMarketReaction = (earningsArticles, bars) => {
    const latestArticle = earningsArticles?.[0];
    if (!latestArticle?.publishedAt) {
        return unavailable("No Earnings-category news has been retrieved for this company yet.");
    }

    if (!Array.isArray(bars) || bars.length === 0) {
        return unavailable("No market price history is available for this company yet.");
    }

    const anchorDateString = new Date(latestArticle.publishedAt).toISOString().slice(0, 10);
    // First trading day on/after the news date - the "reaction day."
    const anchorIndex = bars.findIndex((bar) => bar.date >= anchorDateString);

    if (anchorIndex === -1) {
        return unavailable("No trading data is available on or after the earnings-related news date yet.");
    }
    if (anchorIndex === 0) {
        return unavailable("No trading data is available before the earnings-related news date to measure a reaction from.");
    }

    // Last close BEFORE the reaction day is the baseline every return below is measured against.
    const baselineBar = bars[anchorIndex - 1];
    const reactionBar = bars[anchorIndex];
    // 5 trading sessions elapsed from the baseline, matching alert.engine.js's own
    // fiveDayMovePercent window definition (bars 5 indices apart).
    const fiveDayBar = bars[anchorIndex + 4] || null;

    return {
        available: true,
        reason: null,
        basis: MARKET_REACTION_BASIS,
        anchorDate: reactionBar.date,
        oneDayReturnPercent: percentReturn(baselineBar.close, reactionBar.close),
        fiveDayReturnPercent: fiveDayBar ? percentReturn(baselineBar.close, fiveDayBar.close) : null,
    };
};

module.exports = { computeMarketReaction, HISTORY_PERIOD, MARKET_REACTION_BASIS };

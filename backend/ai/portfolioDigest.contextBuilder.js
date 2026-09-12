/**
 * Portfolio Digest Context Builder
 *
 * Reuses portfolio.service.js's getPortfolio (not a new portfolio-fetching
 * path) for holdings/summary, and for each held ticker pulls only cheap,
 * already-cached data - news.service.js's getRecentArticlesForContext,
 * the exact DB-only helper ai.contextBuilder.js already uses for its own
 * "recentEvents" section, never a live provider refresh. Deliberately NOT
 * the full per-ticker research context (ai.contextBuilder.js's
 * buildResearchContext) - that's sized for one deep single-ticker report,
 * not N holdings in a single compact digest prompt.
 */

const portfolioService = require("../portfolio/portfolio.service");
const newsService = require("../news/news.service");

const RECENT_NEWS_PER_HOLDING = 2;
const MAX_HOLDINGS_IN_DIGEST = 20;

/**
 * @param {string} userId
 * @returns {Promise<{hasHoldings: boolean, summary: object|null, holdings: object[]}>}
 */
const buildDigestContext = async (userId) => {
    const { holdings, summary } = await portfolioService.getPortfolio(userId);

    if (holdings.length === 0) {
        return { hasHoldings: false, summary: null, holdings: [] };
    }

    // Nets multiple lots of the same ticker (dollar-cost-averaging) into one
    // row - a digest describes positions, not individual purchase lots.
    const byTicker = new Map();
    holdings.forEach((holding) => {
        if (!byTicker.has(holding.ticker)) byTicker.set(holding.ticker, holding);
    });
    const positions = [...byTicker.values()]
        .sort((a, b) => (b.currentValueUSD || 0) - (a.currentValueUSD || 0))
        .slice(0, MAX_HOLDINGS_IN_DIGEST);

    const digestHoldings = await Promise.all(
        positions.map(async (position) => {
            const articles = await newsService.getRecentArticlesForContext(position.ticker, RECENT_NEWS_PER_HOLDING);
            return {
                ticker: position.ticker,
                weightPercent: position.weightPercent,
                returnPercent: position.returnPercent,
                recentNews: articles.map((article) => ({ title: article.title, publishedAt: article.publishedAt, url: article.url })),
            };
        })
    );

    return {
        hasHoldings: true,
        summary: {
            totalCurrentValue: summary.totalCurrentValue,
            totalGainLoss: summary.totalGainLoss,
            totalReturnPercent: summary.totalReturnPercent,
            bestPerformingHolding: summary.bestPerformingHolding,
            worstPerformingHolding: summary.worstPerformingHolding,
        },
        holdings: digestHoldings,
    };
};

module.exports = { buildDigestContext, MAX_HOLDINGS_IN_DIGEST };

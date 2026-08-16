/**
 * Earnings Service
 *
 * Orchestrates Earnings Intelligence: pulls already-stored/cached data from
 * existing services (Financials, News - Market added in a later phase),
 * runs the deterministic period/calculator/signal pipeline, and returns
 * the formatted response. Makes no direct external-provider calls anywhere
 * in this file - see research/engineering/ServiceReuse.md.
 */

const financialsService = require("../financials/financials.service");
const newsService = require("../news/news.service");
const marketService = require("../market/market.service");
const periods = require("./earnings.periods");
const calculator = require("./earnings.calculator");
const signalsEngine = require("./earnings.signals");
const marketReactionEngine = require("./earnings.marketReaction");
const validator = require("./earnings.validator");
const formatter = require("./earnings.formatter");
const logger = require("../utils/logger");

class NoFinancialStatementsError extends Error {
    constructor(ticker) {
        super(
            `No financial statements are available for ${ticker}. Import financial statements before requesting earnings intelligence.`
        );
        this.name = "NoFinancialStatementsError";
        this.statusCode = 404;
    }
}

const RELATED_NEWS_LIMIT = 5;
const RELATED_NEWS_CATEGORY = "Earnings";

/**
 * Earnings-related news, reusing Sprint 10's News domain (never a direct
 * provider call from here - see backend/news/news.service.js's own
 * provider-refresh TTL). Best-effort: a news lookup failure degrades to an
 * empty list rather than failing the whole earnings response, matching the
 * degrade-not-fail pattern used throughout Athena (see
 * alert.service.js/evaluateTicker, watchlist.service.js). Also doubles as
 * the input to earnings.marketReaction.js - its most-recent article is the
 * reaction anchor - so this is fetched once, not once per consumer.
 */
const getRelatedNews = async (ticker) => {
    try {
        const { articles } = await newsService.getNews(ticker, {
            category: RELATED_NEWS_CATEGORY,
            limit: RELATED_NEWS_LIMIT,
        });
        return articles;
    } catch (error) {
        logger.warn({ err: error, ticker }, "Could not load earnings-related news");
        return [];
    }
};

/** Best-effort: reuses market.service.js's own DB-cached history (never a direct provider call from here). A failure here degrades to an "unavailable" market reaction, not a failed earnings response. */
const getPriceHistory = async (ticker) => {
    try {
        return await marketService.getHistoricalPrices(ticker, marketReactionEngine.HISTORY_PERIOD);
    } catch (error) {
        logger.warn({ err: error, ticker }, "Could not load market price history for earnings market reaction");
        return [];
    }
};

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/**
 * @param {string} ticker
 * @returns {Promise<object>} the formatted GET /api/earnings/:ticker payload
 */
const getEarningsIntelligence = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    // financialsService.getFinancialStatementsByTicker already throws
    // CompanyNotFoundError (404) if the ticker itself hasn't been
    // imported - matches ratio.service.js/analysis.service.js, which
    // likewise require statements to already exist rather than
    // auto-importing (that auto-import behavior is specific to
    // financials.controller.js's own raw statements page).
    const statements = await financialsService.getFinancialStatementsByTicker(normalizedTicker);

    const validation = validator.validateStatementsAvailable(statements);
    if (!validation.isValid) {
        throw new NoFinancialStatementsError(normalizedTicker);
    }

    const resolvedPeriods = periods.resolvePeriods(statements);
    const metrics = calculator.calculateEarningsMetrics(resolvedPeriods.latest, resolvedPeriods.previous);
    const signals = signalsEngine.computeSignals(metrics);

    const [relatedNews, priceHistory] = await Promise.all([getRelatedNews(normalizedTicker), getPriceHistory(normalizedTicker)]);
    const marketReaction = marketReactionEngine.computeMarketReaction(relatedNews, priceHistory);

    return formatter.formatEarningsResponse({
        ticker: normalizedTicker,
        periods: resolvedPeriods,
        metrics,
        signals,
        relatedNews,
        marketReaction,
    });
};

module.exports = { getEarningsIntelligence, NoFinancialStatementsError };

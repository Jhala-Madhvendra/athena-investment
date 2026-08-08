const Company = require("../models/company.model");
const MarketHistory = require("./market.model");
const marketDataProvider = require("./providers/marketData.provider.registry");

class CompanyNotFoundError extends Error {
    constructor(ticker) {
        super(`Company ${ticker} was not found. Resolve or import the company before requesting market data.`);
        this.name = "CompanyNotFoundError";
        this.statusCode = 404;
    }
}

class InvalidPeriodError extends Error {
    constructor(period) {
        super(`Invalid period "${period}". Supported periods are 1m, 3m, 6m, 1y, 5y.`);
        this.name = "InvalidPeriodError";
        this.statusCode = 400;
    }
}

const PERIOD_TO_YAHOO_RANGE = { "1m": "1mo", "3m": "3mo", "6m": "6mo", "1y": "1y", "5y": "5y" };
const PERIOD_ORDER = ["1m", "3m", "6m", "1y", "5y"];
const PERIOD_LABELS = { "1m": "1M", "3m": "3M", "6m": "6M", "1y": "1Y", "5y": "5Y" };
const MAX_PERIOD = "5y";
const COVERAGE_BUFFER_DAYS = 5;
const FRESHNESS_THRESHOLD_DAYS = 5;
const QUOTE_CACHE_TTL_MS = 60 * 1000;

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const findCompanyByTicker = async (ticker) => {
    const company = await Company.findOne({ ticker });

    if (!company) {
        throw new CompanyNotFoundError(ticker);
    }

    return company;
};

const assertValidPeriod = (period) => {
    if (!PERIOD_TO_YAHOO_RANGE[period]) {
        throw new InvalidPeriodError(period);
    }
};

const getRequiredStartDate = (period) => {
    const start = new Date();

    switch (period) {
        case "1m":
            start.setUTCMonth(start.getUTCMonth() - 1);
            break;
        case "3m":
            start.setUTCMonth(start.getUTCMonth() - 3);
            break;
        case "6m":
            start.setUTCMonth(start.getUTCMonth() - 6);
            break;
        case "1y":
            start.setUTCFullYear(start.getUTCFullYear() - 1);
            break;
        case "5y":
            start.setUTCFullYear(start.getUTCFullYear() - 5);
            break;
        default:
            throw new InvalidPeriodError(period);
    }

    return start.toISOString().slice(0, 10);
};

const addDaysToDateString = (dateString, days) => {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

/**
 * Data is considered fresh enough when the earliest stored bar reaches back to
 * (roughly) the requested period's start date and the latest bar is recent -
 * avoids a full re-fetch on every request while staying correct for new tickers.
 */
const isCoverageSufficient = (sortedRecords, requiredStartDate) => {
    if (!sortedRecords.length) {
        return false;
    }

    const earliestDate = sortedRecords[0].date;
    const latestDate = sortedRecords[sortedRecords.length - 1].date;
    const daysSinceLatest = (Date.now() - new Date(`${latestDate}T00:00:00.000Z`).getTime()) / 86400000;

    return earliestDate <= addDaysToDateString(requiredStartDate, COVERAGE_BUFFER_DAYS) &&
        daysSinceLatest <= FRESHNESS_THRESHOLD_DAYS;
};

const refreshHistoricalPrices = async (normalizedTicker, companyId) => {
    const bars = await marketDataProvider.getHistoricalPrices(normalizedTicker, PERIOD_TO_YAHOO_RANGE[MAX_PERIOD]);

    if (!bars.length) {
        return;
    }

    await Promise.all(
        bars.map((bar) =>
            MarketHistory.findOneAndUpdate(
                { ticker: normalizedTicker, date: bar.date },
                { ...bar, ticker: normalizedTicker, companyId, source: "yahoo" },
                { upsert: true, runValidators: true }
            )
        )
    );
};

/**
 * Fetches daily historical prices for the requested period, backfilling and
 * caching data in MarketHistory. Always refreshes using the max supported
 * period (5y) so a single refresh satisfies every shorter period afterwards.
 */
const getHistoricalPrices = async (ticker, period) => {
    const normalizedTicker = normalizeTicker(ticker);
    assertValidPeriod(period);

    const company = await findCompanyByTicker(normalizedTicker);
    const requiredStartDate = getRequiredStartDate(period);

    const existingRecords = await MarketHistory.find({ ticker: normalizedTicker }).sort({ date: 1 }).lean();

    if (!isCoverageSufficient(existingRecords, requiredStartDate)) {
        await refreshHistoricalPrices(normalizedTicker, company._id);
    }

    return MarketHistory.find({ ticker: normalizedTicker, date: { $gte: requiredStartDate } })
        .sort({ date: 1 })
        .select("date open high low close adjClose volume -_id")
        .lean();
};

const calculateReturn = (startPrice, endPrice) => {
    if (typeof startPrice !== "number" || typeof endPrice !== "number") {
        return null;
    }

    if (startPrice === 0) {
        return null;
    }

    return Number((((endPrice - startPrice) / startPrice) * 100).toFixed(2));
};

/**
 * Computes % return for one or all supported periods. Fetches the 5y window
 * once (getHistoricalPrices already guarantees full coverage/backfill) and
 * slices sub-windows locally instead of issuing a request per period.
 */
const getPerformance = async (ticker, period) => {
    if (period) {
        assertValidPeriod(period);
    }

    const periodsToCompute = period ? [period] : PERIOD_ORDER;
    const fullHistory = await getHistoricalPrices(ticker, MAX_PERIOD);

    const performance = {};

    periodsToCompute.forEach((p) => {
        const requiredStartDate = getRequiredStartDate(p);
        const windowed = fullHistory.filter((bar) => bar.date >= requiredStartDate);

        performance[PERIOD_LABELS[p]] = windowed.length >= 2
            ? calculateReturn(windowed[0].close, windowed[windowed.length - 1].close)
            : null;
    });

    return performance;
};

const quoteCache = new Map();

/** Live market snapshot (price/valuation/dividend), short-TTL in-memory cached to avoid duplicate Yahoo hits. */
const getCurrentMarketData = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    await findCompanyByTicker(normalizedTicker);

    const cached = quoteCache.get(normalizedTicker);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const quote = await marketDataProvider.getQuote(normalizedTicker);
    quoteCache.set(normalizedTicker, { data: quote, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });

    return quote;
};

module.exports = {
    getCurrentMarketData,
    getHistoricalPrices,
    getPerformance,
    CompanyNotFoundError,
    InvalidPeriodError,
    SUPPORTED_PERIODS: PERIOD_ORDER,
};

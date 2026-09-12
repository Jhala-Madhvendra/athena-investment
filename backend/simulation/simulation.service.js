/**
 * Simulation Service
 *
 * Owns PaperPortfolio CRUD, plus getSyntheticPortfolio - the paper-portfolio
 * equivalent of portfolio.service.js's getPortfolio(userId), sourced from a
 * PaperPortfolio doc's embedded holdings instead of the real Holding
 * collection. Returns the SAME {holdings, summary} shape so
 * simulation.analytics.service.js and simulation.scenario.service.js can
 * build on it exactly the way portfolio.analytics.service.js and
 * portfolio.scenario.service.js build on the real getPortfolio - without
 * this module reimplementing any of portfolio.calculator.js's math.
 *
 * portfolio.service.js's own quote/FX-fetch helpers (fetchQuotesByTicker,
 * fetchFxRatesByCurrency) are private, not exported, so the small amount of
 * I/O glue below is re-authored here rather than imported - only the glue,
 * never the math, which comes from portfolio.calculator.js unmodified.
 */

const PaperPortfolio = require("./paperPortfolio.model");
const marketService = require("../market/market.service");
const fxRateProvider = require("../market/providers/fxRate.provider");
const portfolioCalculator = require("../portfolio/portfolio.calculator");
const { validateCreatePortfolioRequest, validateUpdatePortfolioRequest } = require("./simulation.validator");

class PaperPortfolioNotFoundError extends Error {
    constructor() {
        super("Paper portfolio not found.");
        this.name = "PaperPortfolioNotFoundError";
        this.statusCode = 404;
    }
}

class PaperPortfolioValidationError extends Error {
    constructor(errors) {
        super("Paper portfolio validation failed.");
        this.name = "PaperPortfolioValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const createPortfolio = async (userId, { name, holdings }) => {
    const validation = validateCreatePortfolioRequest({ name, holdings });
    if (!validation.isValid) {
        throw new PaperPortfolioValidationError(validation.errors);
    }

    return PaperPortfolio.create({ userId, ...validation.normalized });
};

const listPortfolios = async (userId) =>
    PaperPortfolio.find({ userId }).select("name holdings createdAt updatedAt").sort({ createdAt: -1 }).lean();

/** Loads + ownership-checks a paper portfolio; throws PaperPortfolioNotFoundError if missing or not owned by userId. */
const loadOwnedPortfolio = async (userId, id) => {
    const portfolio = await PaperPortfolio.findOne({ _id: id, userId });

    if (!portfolio) {
        throw new PaperPortfolioNotFoundError();
    }

    return portfolio;
};

const updatePortfolio = async (userId, id, { name, holdings }) => {
    const validation = validateUpdatePortfolioRequest({ name, holdings });
    if (!validation.isValid) {
        throw new PaperPortfolioValidationError(validation.errors);
    }

    const portfolio = await PaperPortfolio.findOneAndUpdate({ _id: id, userId }, validation.normalized, { new: true });

    if (!portfolio) {
        throw new PaperPortfolioNotFoundError();
    }

    return portfolio;
};

const deletePortfolio = async (userId, id) => {
    const portfolio = await PaperPortfolio.findOneAndDelete({ _id: id, userId });

    if (!portfolio) {
        throw new PaperPortfolioNotFoundError();
    }

    return portfolio;
};

/** One live quote per unique ticker - same dedup shape as portfolio.service.js's fetchQuotesByTicker. */
const fetchQuotesByTicker = async (tickers) => {
    const uniqueTickers = [...new Set(tickers)];
    const entries = await Promise.all(
        uniqueTickers.map(async (ticker) => {
            const quote = await marketService.getCurrentMarketData(ticker).catch(() => null);
            return [ticker, { price: quote?.price?.current ?? null, currency: quote?.currency ?? null }];
        })
    );
    return new Map(entries);
};

/** One live FX-to-USD rate per unique currency actually held - same dedup shape as portfolio.service.js's fetchFxRatesByCurrency. */
const fetchFxRatesByCurrency = async (currencies) => {
    const uniqueCurrencies = [...new Set(currencies)];
    const entries = await Promise.all(
        uniqueCurrencies.map(async (currency) => [currency, await fxRateProvider.getRateToUSD(currency)])
    );
    return new Map(entries);
};

/**
 * The paper-portfolio equivalent of portfolio.service.js's getPortfolio(userId).
 * Each holding's cost basis is built from its `assumedPrice` (defaulting to
 * the live price when omitted, flagged via `assumedPriceDefaulted`) rather
 * than a real purchase price - see paperHolding.model.js.
 *
 * @param {{holdings: {ticker: string, shares: number, assumedPrice: number|null}[]}} paperPortfolioDoc
 * @returns {Promise<{holdings: object[], summary: object}>}
 */
const getSyntheticPortfolio = async (paperPortfolioDoc) => {
    const holdings = paperPortfolioDoc.holdings || [];

    if (holdings.length === 0) {
        return { holdings: [], summary: portfolioCalculator.summarizePortfolio([]) };
    }

    const quotesByTicker = await fetchQuotesByTicker(holdings.map((h) => h.ticker));
    const fxRatesByCurrency = await fetchFxRatesByCurrency([...quotesByTicker.values()].map((q) => q.currency));

    const enrichedHoldings = holdings.map((holding) => {
        const quote = quotesByTicker.get(holding.ticker);
        const currency = quote?.currency ?? null;
        const fxRateToUSD = fxRatesByCurrency.get(currency) ?? null;
        const livePrice = quote?.price ?? null;

        const assumedPriceDefaulted = holding.assumedPrice === null || holding.assumedPrice === undefined;
        const resolvedAssumedPrice = assumedPriceDefaulted ? livePrice : holding.assumedPrice;

        // Guard rather than delegate straight to enrichHolding when the cost
        // basis price is unknown: JS coerces `shares * null` to 0, which
        // would silently report a fully-unpriced holding as having a $0
        // cost basis instead of an unknown one.
        const enriched = isFiniteNumber(resolvedAssumedPrice)
            ? portfolioCalculator.enrichHolding({ ticker: holding.ticker, shares: holding.shares, averagePurchasePrice: resolvedAssumedPrice }, livePrice, fxRateToUSD)
            : {
                  ticker: holding.ticker,
                  shares: holding.shares,
                  averagePurchasePrice: null,
                  currentPrice: null,
                  costBasis: null,
                  currentValue: null,
                  costBasisUSD: null,
                  currentValueUSD: null,
                  gainLoss: null,
                  returnPercent: null,
                  priceUnavailable: true,
                  fxRateUnavailable: true,
              };

        return { ...enriched, currency, assumedPriceDefaulted };
    });

    const summary = portfolioCalculator.summarizePortfolio(enrichedHoldings);

    const holdingsWithWeight = enrichedHoldings.map((holding) => ({
        ...holding,
        weightPercent:
            holding.currentValueUSD !== null && summary.totalCurrentValue > 0
                ? (holding.currentValueUSD / summary.totalCurrentValue) * 100
                : null,
    }));

    return { holdings: holdingsWithWeight, summary };
};

module.exports = {
    createPortfolio,
    listPortfolios,
    loadOwnedPortfolio,
    updatePortfolio,
    deletePortfolio,
    getSyntheticPortfolio,
    PaperPortfolioNotFoundError,
    PaperPortfolioValidationError,
};

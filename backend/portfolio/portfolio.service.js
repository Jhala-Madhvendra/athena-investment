/**
 * Portfolio Service
 *
 * Owns Holding CRUD and assembles the portfolio view. All valuation math
 * is delegated to portfolio.calculator.js (pure functions) - this module's
 * only job is fetching a user's own holdings, fetching one live price per
 * unique ticker (never per lot), and handing both to the calculator.
 */

const Holding = require("./holding.model");
const marketService = require("../market/market.service");
const fxRateProvider = require("../market/providers/fxRate.provider");
const calculator = require("./portfolio.calculator");
const { validateHoldingInput } = require("./portfolio.validator");
const portfolioAccountService = require("./portfolioAccount.service");
const dividendService = require("./dividend.service");

class HoldingNotFoundError extends Error {
    constructor() {
        super("Holding not found.");
        this.name = "HoldingNotFoundError";
        this.statusCode = 404;
    }
}

class HoldingValidationError extends Error {
    constructor(errors) {
        super("Holding validation failed.");
        this.name = "HoldingValidationError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

const addHolding = async (userId, { ticker, shares, averagePurchasePrice, purchaseDate, portfolioId }) => {
    const validation = validateHoldingInput({ shares, averagePurchasePrice, purchaseDate });
    if (!validation.isValid) {
        throw new HoldingValidationError(validation.errors);
    }

    const resolvedPortfolioId = await portfolioAccountService.resolveWritablePortfolioId(userId, portfolioId);

    return Holding.create({ userId, ticker, portfolioId: resolvedPortfolioId, ...validation.normalized });
};

const updateHolding = async (userId, holdingId, { shares, averagePurchasePrice, purchaseDate }) => {
    const validation = validateHoldingInput({ shares, averagePurchasePrice, purchaseDate });
    if (!validation.isValid) {
        throw new HoldingValidationError(validation.errors);
    }

    // Scoped by {_id, userId} together - a guessed/enumerated id belonging to
    // another user matches nothing here, never leaking a "found but not
    // yours" distinction.
    const holding = await Holding.findOneAndUpdate({ _id: holdingId, userId }, validation.normalized, { new: true });

    if (!holding) {
        throw new HoldingNotFoundError();
    }

    return holding;
};

const deleteHolding = async (userId, holdingId) => {
    const holding = await Holding.findOneAndDelete({ _id: holdingId, userId });

    if (!holding) {
        throw new HoldingNotFoundError();
    }

    return holding;
};

/**
 * Fetches one live quote per unique ticker (not per lot) - a user with 3
 * AAPL lots costs one AAPL price lookup. Carries the quote's trading
 * currency through for display - Athena's aggregate totals assume a
 * single-currency portfolio (see PortfolioBasics.md's "Limitations"
 * section); surfacing each holding's currency at least keeps the per-row
 * numbers honest for a user mixing e.g. USD and INR-listed tickers.
 */
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

/**
 * One live FX-to-USD rate per unique currency actually held (not per
 * ticker) - same dedup shape as fetchQuotesByTicker, since several
 * holdings commonly share a currency (e.g. two US stocks both need only
 * one implicit USD "rate"). `currency` may be `null` (quote fetch failed
 * entirely) - fxRateProvider.getRateToUSD(null) resolves that to 1, the
 * same "treat unspecified as USD" default the frontend's formatCurrency
 * already uses, so this doesn't invent an inconsistent new convention.
 */
const fetchFxRatesByCurrency = async (currencies) => {
    const uniqueCurrencies = [...new Set(currencies)];
    const entries = await Promise.all(
        uniqueCurrencies.map(async (currency) => [currency, await fxRateProvider.getRateToUSD(currency)])
    );
    return new Map(entries);
};

/**
 * @param {string} userId
 * @param {string|null} [portfolioId] - scopes to one account when given; aggregates across every account when omitted (see the bookkeeping-depth plan's "Scope decision" - Analytics/Scenario rely on this default and pass nothing).
 */
const getPortfolio = async (userId, portfolioId = null) => {
    await portfolioAccountService.ensureLegacyDataAssigned(userId);

    const filter = portfolioId ? { userId, portfolioId } : { userId };
    const holdings = await Holding.find(filter).sort({ createdAt: 1 }).lean();

    const dividendIncomeUSD = await dividendService.getTotalDividendIncome(userId, { portfolioId });

    if (holdings.length === 0) {
        const summary = calculator.summarizePortfolio([]);
        return {
            holdings: [],
            summary: { ...summary, ...calculator.calculateTotalReturn(summary.totalGainLoss, dividendIncomeUSD, summary.totalCostBasis) },
        };
    }

    const quotesByTicker = await fetchQuotesByTicker(holdings.map((h) => h.ticker));
    const fxRatesByCurrency = await fetchFxRatesByCurrency([...quotesByTicker.values()].map((q) => q.currency));

    const enrichedHoldings = holdings.map((holding) => {
        const quote = quotesByTicker.get(holding.ticker);
        const currency = quote?.currency ?? null;
        const fxRateToUSD = fxRatesByCurrency.get(currency) ?? null;
        return { ...calculator.enrichHolding(holding, quote?.price ?? null, fxRateToUSD), currency };
    });
    const baseSummary = calculator.summarizePortfolio(enrichedHoldings);
    const summary = {
        ...baseSummary,
        ...calculator.calculateTotalReturn(baseSummary.totalGainLoss, dividendIncomeUSD, baseSummary.totalCostBasis),
    };

    // Weight is cross-holding by definition - must compare USD-normalized value, never native currency (see portfolio.calculator.js's currency-normalization note).
    const holdingsWithWeight = enrichedHoldings.map((holding) => ({
        ...holding,
        weightPercent:
            holding.currentValueUSD !== null && summary.totalCurrentValue > 0
                ? (holding.currentValueUSD / summary.totalCurrentValue) * 100
                : null,
    }));

    return { holdings: holdingsWithWeight, summary };
};

const getPortfolioSummary = async (userId, portfolioId = null) => {
    const { summary } = await getPortfolio(userId, portfolioId);
    return summary;
};

module.exports = {
    addHolding,
    updateHolding,
    deleteHolding,
    getPortfolio,
    getPortfolioSummary,
    fetchQuotesByTicker,
    HoldingNotFoundError,
    HoldingValidationError,
};

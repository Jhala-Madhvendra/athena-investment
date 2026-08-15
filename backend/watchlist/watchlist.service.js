/**
 * Watchlist Service
 *
 * Owns only the Watchlist document itself (add/remove/list tickers).
 * Every displayed metric is fetched live from the engines Athena already
 * built in Sprints 2-6 - this module never recomputes a ratio, a health
 * score, or a DCF value itself. See WatchlistArchitecture.md.
 */

const Watchlist = require("./watchlist.model");
const Company = require("../models/company.model");
const marketService = require("../market/market.service");
const analysisService = require("../analysis/analysis.service");
const valuationService = require("../valuation/valuation.service");
const newsService = require("../news/news.service");
const { ILLUSTRATIVE_CREDIT_SPREAD, FALLBACK_COST_OF_DEBT } = require("../ai/ai.contextBuilder");

class DuplicateCompanyError extends Error {
    constructor(ticker) {
        super(`${ticker} is already in your watchlist.`);
        this.name = "DuplicateCompanyError";
        this.statusCode = 409;
    }
}

class CompanyNotInWatchlistError extends Error {
    constructor(ticker) {
        super(`${ticker} is not in your watchlist.`);
        this.name = "CompanyNotInWatchlistError";
        this.statusCode = 404;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const addCompany = async (userId, ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    let watchlist = await Watchlist.findOne({ userId });
    if (!watchlist) {
        watchlist = new Watchlist({ userId, companies: [] });
    }

    if (watchlist.companies.some((company) => company.ticker === normalizedTicker)) {
        throw new DuplicateCompanyError(normalizedTicker);
    }

    watchlist.companies.push({ ticker: normalizedTicker, addedAt: new Date() });
    await watchlist.save();

    return watchlist;
};

const removeCompany = async (userId, ticker) => {
    const normalizedTicker = normalizeTicker(ticker);
    const watchlist = await Watchlist.findOne({ userId });

    const index = watchlist ? watchlist.companies.findIndex((company) => company.ticker === normalizedTicker) : -1;

    if (index === -1) {
        throw new CompanyNotInWatchlistError(normalizedTicker);
    }

    watchlist.companies.splice(index, 1);
    await watchlist.save();

    return watchlist;
};

/**
 * Illustrative DCF intrinsic value + valuation gap for a watchlist row.
 * Mirrors the same "no zero-input DCF exists" defaulting pattern Sprint 8's
 * ai.contextBuilder.buildDcfSection already established (same illustrative
 * credit-spread constants, reused not reimplemented) rather than inventing
 * a second way to guess a cost of debt. Never throws - an unavailable DCF
 * degrades the row, it doesn't fail the whole watchlist.
 */
const getIllustrativeDcf = async (ticker) => {
    try {
        const defaults = await valuationService.getDCFDefaults(ticker);
        const { suggestedAssumptions, waccInputs } = defaults;

        const requiredDerived = [
            "revenueGrowth",
            "ebitMargin",
            "taxRate",
            "depreciationPercentRevenue",
            "capexPercentRevenue",
            "workingCapitalPercentRevenue",
            "terminalGrowthRate",
            "forecastYears",
        ];
        const missingDerived = requiredDerived.some((key) => suggestedAssumptions[key]?.value == null);
        const missingWaccInputs = ["riskFreeRate", "beta", "equityRiskPremium"].some(
            (key) => waccInputs[key]?.value == null
        );

        if (missingDerived || missingWaccInputs) {
            return { available: false, reason: "Insufficient data for an illustrative DCF." };
        }

        const riskFreeRate = waccInputs.riskFreeRate.value;
        const preTaxCostOfDebt =
            typeof riskFreeRate === "number" ? riskFreeRate + ILLUSTRATIVE_CREDIT_SPREAD : FALLBACK_COST_OF_DEBT;

        const requestAssumptions = {
            revenueGrowth: suggestedAssumptions.revenueGrowth.value,
            ebitMargin: suggestedAssumptions.ebitMargin.value,
            taxRate: suggestedAssumptions.taxRate.value,
            depreciationPercentRevenue: suggestedAssumptions.depreciationPercentRevenue.value,
            capexPercentRevenue: suggestedAssumptions.capexPercentRevenue.value,
            workingCapitalPercentRevenue: suggestedAssumptions.workingCapitalPercentRevenue.value,
            terminalGrowthRate: suggestedAssumptions.terminalGrowthRate.value,
            forecastYears: suggestedAssumptions.forecastYears.value,
            riskFreeRate,
            beta: waccInputs.beta.value,
            equityRiskPremium: waccInputs.equityRiskPremium.value,
            preTaxCostOfDebt,
        };

        const result = await valuationService.calculateDCFValuation(ticker, requestAssumptions);

        if (!result.isValid) {
            return { available: false, reason: (result.errors || []).join("; ") || "DCF could not be calculated." };
        }

        return {
            available: true,
            intrinsicValuePerShare: result.intrinsicValuePerShare,
            valuationGapPercent: result.upsideDownsidePercent,
            assumptionsSource: "illustrative_default",
            calculatedAt: result.calculatedAt,
        };
    } catch (error) {
        return { available: false, reason: "DCF could not be calculated." };
    }
};

/** One enriched watchlist row. Never throws - a failure in any one data source degrades that field, not the whole row. */
const buildWatchlistRow = async (ticker, addedAt) => {
    const [company, quote, performance, analysis, dcf, latestArticle] = await Promise.all([
        Company.findOne({ ticker }).select("name exchange").lean(),
        marketService.getCurrentMarketData(ticker).catch(() => null),
        marketService
            .getPerformance(ticker, "1y")
            .then((result) => result["1Y"])
            .catch(() => null),
        analysisService.calculateAnalysis(ticker, {}).catch(() => null),
        getIllustrativeDcf(ticker),
        // DB-only lookup (news.service.js's getLatestStoredArticle never
        // triggers a provider call) - the watchlist page must stay cheap,
        // it doesn't refresh news on every load. See NewsCaching.md.
        newsService.getLatestStoredArticle(ticker),
    ]);

    const dailyChangePercent =
        quote?.price?.current != null && quote?.price?.previousClose
            ? ((quote.price.current - quote.price.previousClose) / quote.price.previousClose) * 100
            : null;

    const analysisAvailable = Boolean(analysis && !analysis.error);

    return {
        ticker,
        name: company?.name ?? null,
        exchange: company?.exchange ?? null,
        addedAt,
        price: {
            current: quote?.price?.current ?? null,
            dailyChangePercent,
            marketCap: quote?.price?.marketCap ?? null,
            asOf: quote?.asOf ?? null,
        },
        peRatio: quote?.valuation?.peRatio ?? null,
        oneYearReturnPercent: performance ?? null,
        financialHealthScore: analysisAvailable ? analysis.healthScore.overall : null,
        revenueCAGRPercent: analysisAvailable ? analysis.growth.revenueCAGR : null,
        financialStatementPeriod: analysisAvailable ? analysis.period.endYear : null,
        dcf,
        latestEvent: latestArticle
            ? {
                  title: latestArticle.title,
                  category: latestArticle.category,
                  publishedAt: latestArticle.publishedAt,
                  url: latestArticle.url,
              }
            : null,
        dataFreshness: {
            marketData: quote?.asOf ?? null,
            financialStatements: analysisAvailable ? `FY${analysis.period.endYear}` : null,
            valuation: dcf.available ? dcf.calculatedAt : null,
        },
    };
};

const getWatchlistWithMetrics = async (userId) => {
    const watchlist = await Watchlist.findOne({ userId }).lean();

    if (!watchlist || watchlist.companies.length === 0) {
        return { name: watchlist?.name ?? "My Watchlist", companies: [] };
    }

    const companies = await Promise.all(
        watchlist.companies.map((company) => buildWatchlistRow(company.ticker, company.addedAt))
    );

    return { name: watchlist.name, companies };
};

module.exports = {
    addCompany,
    removeCompany,
    getWatchlistWithMetrics,
    DuplicateCompanyError,
    CompanyNotInWatchlistError,
};

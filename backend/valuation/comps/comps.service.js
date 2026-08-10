/**
 * Comps Service
 *
 * Orchestrates the Comparable Company Analysis domain: resolves the target
 * and each requested peer against Athena's existing Company/Financial
 * Statements/Market Data modules (never touching Yahoo Finance directly -
 * see financials.service.js and market.service.js), builds the plain
 * bundles comps.engine.js expects, and augments the engine's pure result
 * with data the engine deliberately doesn't know about (current market
 * price, per-multiple upside/downside, the relative-valuation disclaimer).
 *
 * Nothing here is persisted - every call recalculates from current stored
 * financials + a live market quote + the peers/statistic in the request.
 * See research/product/ComparableCompaniesProductDesign.md.
 *
 * PEER DATA AVAILABILITY
 * -----------------------
 * The target must have financial statements imported, or the whole
 * request fails (mirrors dcf: valuation.service.js's NoFinancialDataError) -
 * there's nothing to value without it. A peer that has no company record
 * or no financial statements imported is NOT fatal to the request - it's
 * excluded from the analysis and reported in `unavailablePeers` with a
 * reason, never silently dropped or fabricated. If too few peers end up
 * with usable data (fewer than comps.validator's MIN_PEERS), the request
 * fails with a clear explanation rather than silently comparing against
 * a single company.
 */

const companyService = require("../../services/company.service");
const financialsService = require("../../financials/financials.service");
const marketService = require("../../market/market.service");
const compsInputMapper = require("../mappers/compsInput.mapper");
const dcfFormulas = require("../dcf/dcf.formulas");
const { calculateComps } = require("./comps.engine");
const { validatePeers, validateStatistic, MIN_PEERS } = require("./comps.validator");

const DISCLAIMER =
    "Comparable Company Analysis is a relative valuation - it reflects how the market is currently pricing the " +
    "selected peer companies, not an independent estimate of intrinsic value. It is not investment advice, and " +
    "the implied values here are analytical outputs, not price targets.";

class NoFinancialDataError extends Error {
    constructor(ticker) {
        super(
            `No financial statements are available for ${ticker}. Import financial statements before requesting a Comparable Company Analysis.`
        );
        this.name = "NoFinancialDataError";
        this.statusCode = 404;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const latestStatementOf = (statements) => {
    const sortedAscending = [...statements].sort((first, second) => first.year - second.year);
    return sortedAscending[sortedAscending.length - 1];
};

/** Loads the target's bundle. Throws NoFinancialDataError if no statements exist - the request cannot proceed without a target to value. */
const loadTargetBundle = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    const statements = await financialsService.getFinancialStatementsByTicker(normalizedTicker);

    if (!statements || statements.length === 0) {
        throw new NoFinancialDataError(normalizedTicker);
    }

    const [company, quote] = await Promise.all([
        companyService.getCompanyDetails(normalizedTicker),
        marketService.getCurrentMarketData(normalizedTicker).catch(() => null),
    ]);

    return compsInputMapper.buildCompanyBundle({
        ticker: normalizedTicker,
        company,
        latestStatement: latestStatementOf(statements),
        quote,
    });
};

/**
 * Loads one peer's bundle. Never throws - a peer with no company record or
 * no imported financial statements resolves to {bundle: null, reason}
 * instead of failing the whole request.
 */
const loadPeerBundle = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    try {
        const statements = await financialsService.getFinancialStatementsByTicker(normalizedTicker);

        if (!statements || statements.length === 0) {
            return {
                ticker: normalizedTicker,
                bundle: null,
                reason: `No financial statements are available for ${normalizedTicker} in Athena.`,
            };
        }

        const [company, quote] = await Promise.all([
            companyService.getCompanyDetails(normalizedTicker),
            marketService.getCurrentMarketData(normalizedTicker).catch(() => null),
        ]);

        return {
            ticker: normalizedTicker,
            bundle: compsInputMapper.buildCompanyBundle({
                ticker: normalizedTicker,
                company,
                latestStatement: latestStatementOf(statements),
                quote,
            }),
            reason: null,
        };
    } catch (error) {
        return { ticker: normalizedTicker, bundle: null, reason: error.message };
    }
};

/** Augments the engine's pure per-multiple results with the target's live market price and upside/downside - the engine itself never sees market price. */
const withMarketComparison = (impliedValuations, currentMarketPrice) => {
    const augmented = {};

    Object.entries(impliedValuations).forEach(([key, valuation]) => {
        augmented[key] = {
            ...valuation,
            currentMarketPrice,
            upsideDownsidePercent:
                valuation.isApplicable && currentMarketPrice != null
                    ? dcfFormulas.upsideDownsidePercent(valuation.impliedValuePerShare, currentMarketPrice)
                    : null,
        };
    });

    return augmented;
};

/**
 * POST /:ticker/comps
 * @param {string} targetTicker
 * @param {unknown} requestPeers - raw `peers` array from the request body
 * @param {unknown} requestStatistic - raw `statistic` from the request body (optional, defaults to "median")
 * @returns {Promise<object>} full comps result, or {isValid: false, errors} on validation/data failure
 */
const calculateComparableCompanyAnalysis = async (targetTicker, requestPeers, requestStatistic) => {
    const normalizedTarget = normalizeTicker(targetTicker);

    const statisticValidation = validateStatistic(requestStatistic);
    const peersValidation = validatePeers(normalizedTarget, requestPeers);

    const structuralErrors = [...peersValidation.errors, ...statisticValidation.errors];
    if (structuralErrors.length > 0) {
        return { isValid: false, errors: structuralErrors };
    }

    const targetBundle = await loadTargetBundle(normalizedTarget);

    const peerResults = await Promise.all(peersValidation.peers.map(loadPeerBundle));
    const usablePeerBundles = peerResults.filter((result) => result.bundle).map((result) => result.bundle);
    const unavailablePeers = peerResults
        .filter((result) => !result.bundle)
        .map((result) => ({ ticker: result.ticker, reason: result.reason }));

    if (usablePeerBundles.length < MIN_PEERS) {
        return {
            isValid: false,
            errors: [
                `At least ${MIN_PEERS} peers with usable financial data are required - only ${usablePeerBundles.length} of the selected peers have data available.`,
                ...unavailablePeers.map((peer) => `${peer.ticker}: ${peer.reason}`),
            ],
        };
    }

    const engineResult = calculateComps({
        target: targetBundle,
        peers: usablePeerBundles,
        statistic: statisticValidation.statistic,
    });

    const currentMarketPrice = targetBundle.price ?? null;

    return {
        isValid: true,
        ticker: normalizedTarget,
        targetFiscalYear: targetBundle.fiscalYear,
        target: engineResult.target,
        peers: engineResult.peers,
        unavailablePeers,
        notes: peersValidation.notes,
        peerStatistics: engineResult.peerStatistics,
        statistic: engineResult.statistic,
        impliedValuations: withMarketComparison(engineResult.impliedValuations, currentMarketPrice),
        valuationRange: engineResult.valuationRange,
        currentMarketPrice,
        marketDataAsOf: targetBundle.marketDataAsOf,
        disclaimer: DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

module.exports = {
    calculateComparableCompanyAnalysis,
    DISCLAIMER,
    NoFinancialDataError,
};

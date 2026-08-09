/**
 * Valuation Service
 *
 * Orchestrates the DCF domain: loads stored financial statements and live
 * market data, computes WACC from user-supplied CAPM/cost-of-debt inputs,
 * assembles the pure dcf.engine.js input, and augments the engine's result
 * with data the engine deliberately doesn't know about (current market
 * price, upside/downside, the assumption-sensitivity disclaimer).
 *
 * Nothing here is persisted - every call recalculates from current stored
 * financials + a live market quote + the assumptions in the request. See
 * research/product/DCFProductDesign.md for why DCF results aren't cached
 * or stored like other Athena data.
 */

const financialsService = require("../financials/financials.service");
const marketService = require("../market/market.service");
const { calculateDCF, calculateHistoricalFCFF } = require("./dcf/dcf.engine");
const formulas = require("./dcf/dcf.formulas");
const dcfScenarios = require("./dcf/dcf.scenarios");
const dcfSensitivity = require("./dcf/dcf.sensitivity");
const dcfInputMapper = require("./mappers/dcfInput.mapper");

const DISCLAIMER =
    "DCF valuation is highly sensitive to assumptions and should not be interpreted as a guaranteed future price.";

class NoFinancialDataError extends Error {
    constructor(ticker) {
        super(`No financial statements are available for ${ticker}. Import financial statements before requesting a DCF valuation.`);
        this.name = "NoFinancialDataError";
        this.statusCode = 404;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/**
 * Loads statements (required) and a market quote (best-effort - a live
 * quote failure shouldn't necessarily block a defaults lookup or a DCF run
 * that doesn't end up needing it, but WACC/market-price fields degrade to
 * "unavailable" rather than throwing).
 */
const loadValuationContext = async (ticker) => {
    const normalizedTicker = normalizeTicker(ticker);

    const [statements, quote] = await Promise.all([
        financialsService.getFinancialStatementsByTicker(normalizedTicker),
        marketService.getCurrentMarketData(normalizedTicker).catch(() => null),
    ]);

    if (!statements || statements.length === 0) {
        throw new NoFinancialDataError(normalizedTicker);
    }

    const sortedAscending = [...statements].sort((first, second) => first.year - second.year);
    const latestStatement = sortedAscending[sortedAscending.length - 1];

    return { normalizedTicker, statements: sortedAscending, latestStatement, quote };
};

/** GET /:ticker/dcf/defaults */
const getDCFDefaults = async (ticker) => {
    const { normalizedTicker, statements, latestStatement, quote } = await loadValuationContext(ticker);

    return dcfInputMapper.buildDefaults({ ticker: normalizedTicker, statements, latestStatement, quote });
};

/**
 * Shared by every endpoint that needs a full engine input: computes WACC
 * from the request's CAPM/cost-of-debt inputs and the company's capital
 * structure, then assembles {historicalFinancials, assumptions,
 * capitalStructure} - the exact shape dcf.engine.js expects.
 *
 * Returns `waccErrors` instead of throwing so callers can surface a 422
 * with a clear message rather than a generic 500.
 */
const assembleEngineInput = (context, requestAssumptions) => {
    const { normalizedTicker, latestStatement, quote } = context;

    const historicalFinancials = dcfInputMapper.buildHistoricalFinancials(latestStatement);
    const capitalStructure = dcfInputMapper.buildCapitalStructure(latestStatement);
    const waccWeights = dcfInputMapper.buildWaccCapitalWeights(latestStatement, quote);

    const { riskFreeRate, beta, equityRiskPremium, preTaxCostOfDebt, taxRate } = requestAssumptions;

    const costOfEquity = formulas.costOfEquityCAPM({ riskFreeRate, beta, equityRiskPremium });
    const afterTaxCostOfDebt = formulas.afterTaxCostOfDebt(preTaxCostOfDebt, taxRate);
    const waccValue = formulas.wacc({
        marketValueOfEquity: waccWeights.marketValueOfEquity,
        marketValueOfDebt: waccWeights.marketValueOfDebt,
        costOfEquity,
        afterTaxCostOfDebt,
    });

    const waccErrors = [];
    if (costOfEquity === null) {
        waccErrors.push(
            "Cost of equity (CAPM) could not be calculated - riskFreeRate, beta, and equityRiskPremium must all be finite numbers."
        );
    }
    if (afterTaxCostOfDebt === null) {
        waccErrors.push("After-tax cost of debt could not be calculated - preTaxCostOfDebt and taxRate must be finite numbers.");
    }
    if (costOfEquity !== null && afterTaxCostOfDebt !== null && waccValue === null) {
        waccErrors.push(
            "WACC could not be calculated - market value of equity (market capitalization) or debt is missing or invalid. " +
                (waccWeights.marketValueOfEquity == null
                    ? `Live market capitalization is unavailable for ${normalizedTicker}.`
                    : "Debt or equity weighting could not be determined.")
        );
    }

    const engineInput = {
        historicalFinancials,
        assumptions: {
            revenueGrowth: requestAssumptions.revenueGrowth,
            ebitMargin: requestAssumptions.ebitMargin,
            depreciationPercentRevenue: requestAssumptions.depreciationPercentRevenue,
            capexPercentRevenue: requestAssumptions.capexPercentRevenue,
            workingCapitalPercentRevenue: requestAssumptions.workingCapitalPercentRevenue,
            taxRate,
            wacc: waccValue,
            terminalGrowthRate: requestAssumptions.terminalGrowthRate,
            forecastYears: requestAssumptions.forecastYears,
        },
        capitalStructure,
    };

    const waccBreakdown = {
        costOfEquity,
        afterTaxCostOfDebt,
        marketValueOfEquity: waccWeights.marketValueOfEquity,
        marketValueOfDebt: waccWeights.marketValueOfDebt,
        wacc: waccValue,
    };

    return { engineInput, waccBreakdown, waccErrors };
};

/** Augments a calculateDCF() result with market-comparison fields the engine deliberately doesn't compute. */
const withMarketComparison = (result, currentMarketPrice) => {
    if (!result.isValid) {
        return result;
    }

    return {
        ...result,
        currentMarketPrice,
        upsideDownsidePercent: formulas.upsideDownsidePercent(result.intrinsicValuePerShare, currentMarketPrice),
    };
};

/**
 * POST /:ticker/dcf
 * @param {string} ticker
 * @param {object} requestAssumptions - validated by valuation.validator.js at the controller layer for WACC inputs
 * @returns {Promise<object>} engine result augmented with market comparison, or {isValid: false, errors} on failure
 */
const calculateDCFValuation = async (ticker, requestAssumptions) => {
    const context = await loadValuationContext(ticker);
    const { engineInput, waccBreakdown, waccErrors } = assembleEngineInput(context, requestAssumptions);

    if (waccErrors.length > 0) {
        return { isValid: false, errors: waccErrors };
    }

    const result = calculateDCF(engineInput);

    if (!result.isValid) {
        return result;
    }

    const currentMarketPrice = context.quote?.price?.current ?? null;

    return {
        ...withMarketComparison(result, currentMarketPrice),
        ticker: context.normalizedTicker,
        historicalFCFF: calculateHistoricalFCFF(context.statements),
        waccBreakdown,
        disclaimer: DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

/**
 * POST /:ticker/dcf/scenarios
 * Runs Bear/Base/Bull off the same WACC and capital structure as the base case -
 * only revenue growth and EBIT margin vary (see dcf.scenarios.js).
 */
const calculateDCFScenarios = async (ticker, requestAssumptions) => {
    const context = await loadValuationContext(ticker);
    const { engineInput, waccBreakdown, waccErrors } = assembleEngineInput(context, requestAssumptions);

    if (waccErrors.length > 0) {
        return { isValid: false, errors: waccErrors };
    }

    const currentMarketPrice = context.quote?.price?.current ?? null;
    const results = dcfScenarios.runScenarios(engineInput);

    const firstError = [results.bear, results.base, results.bull].find((r) => !r.isValid);
    if (firstError) {
        return { isValid: false, errors: firstError.errors };
    }

    return {
        isValid: true,
        ticker: context.normalizedTicker,
        waccBreakdown,
        deltas: dcfScenarios.SCENARIO_DELTAS,
        scenarios: {
            bear: withMarketComparison(results.bear, currentMarketPrice),
            base: withMarketComparison(results.base, currentMarketPrice),
            bull: withMarketComparison(results.bull, currentMarketPrice),
        },
        disclaimer: DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

/**
 * POST /:ticker/dcf/sensitivity
 * Two-variable WACC x Terminal Growth grid, centered on the base case's
 * computed WACC and the request's terminal growth rate unless the caller
 * supplies explicit ranges.
 */
const calculateDCFSensitivity = async (ticker, requestAssumptions, rangeOverrides = {}) => {
    const context = await loadValuationContext(ticker);
    const { engineInput, waccErrors } = assembleEngineInput(context, requestAssumptions);

    if (waccErrors.length > 0) {
        return { isValid: false, errors: waccErrors };
    }

    const waccValues =
        rangeOverrides.waccValues || dcfSensitivity.buildRangeAroundCenter(engineInput.assumptions.wacc, 5, 0.01);
    const terminalGrowthValues =
        rangeOverrides.terminalGrowthValues ||
        dcfSensitivity.buildRangeAroundCenter(engineInput.assumptions.terminalGrowthRate, 5, 0.005);

    const matrix = dcfSensitivity.buildSensitivityMatrix(engineInput, { waccValues, terminalGrowthValues });

    return {
        isValid: true,
        ticker: context.normalizedTicker,
        baseWacc: engineInput.assumptions.wacc,
        baseTerminalGrowthRate: engineInput.assumptions.terminalGrowthRate,
        matrix,
        disclaimer: DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

module.exports = {
    getDCFDefaults,
    calculateDCFValuation,
    calculateDCFScenarios,
    calculateDCFSensitivity,
    DISCLAIMER,
    NoFinancialDataError,
};

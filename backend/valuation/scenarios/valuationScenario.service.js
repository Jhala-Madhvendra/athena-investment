/**
 * Valuation Scenario Service
 *
 * Persistence + comparison + backtesting on top of the existing, unmodified
 * valuation.service.js. Nothing here recomputes DCF math itself - every
 * number comes from calling calculateDCFValuation, exactly as the existing
 * POST /:ticker/dcf endpoint does.
 *
 * SAVE-TIME VALIDATION REUSE
 * ---------------------------
 * saveScenario runs a full calculateDCFValuation call BEFORE persisting
 * anything - both to reject invalid assumptions using the engine's own
 * validation (rather than re-implementing it) and to capture priceAtSave /
 * impliedValuePerShareAtSave "for free" from a calculation that already has
 * to happen.
 *
 * PRODUCT BOUNDARY
 * -----------------
 * Every payload returned here (save/list/compare/backtest) reports labeled
 * numbers only - price, implied value, percentage change - never
 * "correct"/"incorrect"/"validated" framing. See
 * research/product/ProductBoundaries.md: Athena describes, it never tells a
 * user whether their past reasoning was right.
 */

const ValuationScenario = require("./valuationScenario.model");
const valuationService = require("../valuation.service");

class ScenarioAssumptionsInvalidError extends Error {
    constructor(errors) {
        super("DCF assumptions failed validation.");
        this.name = "ScenarioAssumptionsInvalidError";
        this.statusCode = 422;
        this.errors = errors;
    }
}

class ScenarioNotFoundError extends Error {
    constructor() {
        super("Saved valuation scenario not found.");
        this.name = "ScenarioNotFoundError";
        this.statusCode = 404;
    }
}

class BacktestUnavailableError extends Error {
    constructor(errors) {
        super("This saved scenario could not be re-evaluated against current data.");
        this.name = "BacktestUnavailableError";
        this.statusCode = 502;
        this.errors = errors;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/**
 * @param {string} userId
 * @param {string} ticker
 * @param {{name: string, assumptions: object}} input
 * @returns {Promise<{scenario: object, dcfResult: object}>}
 */
const saveScenario = async (userId, ticker, { name, assumptions }) => {
    const normalizedTicker = normalizeTicker(ticker);
    const result = await valuationService.calculateDCFValuation(normalizedTicker, assumptions);

    if (!result.isValid) {
        throw new ScenarioAssumptionsInvalidError(result.errors);
    }

    const scenario = await ValuationScenario.create({
        userId,
        ticker: normalizedTicker,
        name,
        assumptions,
        priceAtSave: result.currentMarketPrice,
        impliedValuePerShareAtSave: result.intrinsicValuePerShare,
    });

    return { scenario, dcfResult: result };
};

/** @returns {Promise<object[]>} saved scenarios for this user+ticker, newest first */
const listScenarios = async (userId, ticker) =>
    ValuationScenario.find({ userId, ticker: normalizeTicker(ticker) })
        .sort({ createdAt: -1 })
        .lean();

const deleteScenario = async (userId, ticker, id) => {
    const scenario = await ValuationScenario.findOneAndDelete({ _id: id, userId, ticker: normalizeTicker(ticker) });

    if (!scenario) {
        throw new ScenarioNotFoundError();
    }

    return scenario;
};

/**
 * Runs every requested saved + ad-hoc assumption set through
 * calculateDCFValuation and returns them side by side. A requested savedId
 * that doesn't exist (or isn't owned by this user) is reported as
 * unavailable rather than failing the whole comparison - the same
 * "exclude and explain" discipline used elsewhere in Athena (e.g.
 * industry.discovery.js's importSelectedCompanies).
 *
 * @param {string} userId
 * @param {string} ticker
 * @param {{savedIds: string[], adHoc: {name: string, assumptions: object}[]}} input
 */
const compareScenarios = async (userId, ticker, { savedIds, adHoc }) => {
    const normalizedTicker = normalizeTicker(ticker);

    const savedDocs = savedIds.length
        ? await ValuationScenario.find({ _id: { $in: savedIds }, userId, ticker: normalizedTicker }).lean()
        : [];
    const savedDocsById = new Map(savedDocs.map((doc) => [String(doc._id), doc]));

    const unavailable = savedIds
        .filter((id) => !savedDocsById.has(id))
        .map((id) => ({ id, reason: "Saved scenario not found, or does not belong to this ticker/user." }));

    const entries = [
        ...savedIds.filter((id) => savedDocsById.has(id)).map((id) => ({ source: "saved", id, name: savedDocsById.get(id).name, assumptions: savedDocsById.get(id).assumptions })),
        ...adHoc.map((entry) => ({ source: "adHoc", id: null, name: entry.name, assumptions: entry.assumptions })),
    ];

    const results = await Promise.all(
        entries.map(async (entry) => ({
            source: entry.source,
            id: entry.id,
            name: entry.name,
            result: await valuationService.calculateDCFValuation(normalizedTicker, entry.assumptions),
        }))
    );

    const comparisonTable = results.map(({ source, id, name, result }) => ({
        source,
        id,
        name,
        isValid: result.isValid,
        intrinsicValuePerShare: result.isValid ? result.intrinsicValuePerShare : null,
        currentMarketPrice: result.isValid ? result.currentMarketPrice : null,
        upsideDownsidePercent: result.isValid ? result.upsideDownsidePercent : null,
    }));

    return {
        ticker: normalizedTicker,
        results,
        comparisonTable,
        unavailable,
        disclaimer: valuationService.DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

/**
 * Compares a saved assumption set's implied value and the market price at
 * save time against the SAME assumption set re-run against CURRENT
 * financials/market data. Reports labeled numbers only - never a
 * right/wrong verdict on the original reasoning.
 *
 * @param {string} userId
 * @param {string} ticker
 * @param {string} id
 */
const backtestScenario = async (userId, ticker, id) => {
    const normalizedTicker = normalizeTicker(ticker);
    const scenario = await ValuationScenario.findOne({ _id: id, userId, ticker: normalizedTicker }).lean();

    if (!scenario) {
        throw new ScenarioNotFoundError();
    }

    const result = await valuationService.calculateDCFValuation(normalizedTicker, scenario.assumptions);

    if (!result.isValid) {
        throw new BacktestUnavailableError(result.errors);
    }

    const currentPrice = result.currentMarketPrice;
    const priceChangeSinceSavePercent =
        typeof scenario.priceAtSave === "number" && typeof currentPrice === "number" && scenario.priceAtSave !== 0
            ? ((currentPrice - scenario.priceAtSave) / scenario.priceAtSave) * 100
            : null;

    return {
        ticker: normalizedTicker,
        scenarioId: scenario._id,
        scenarioName: scenario.name,
        savedAt: scenario.createdAt,
        priceAtSave: scenario.priceAtSave,
        impliedValuePerShareAtSave: scenario.impliedValuePerShareAtSave,
        currentPrice,
        impliedValuePerShareNow: result.intrinsicValuePerShare,
        upsideDownsidePercentNow: result.upsideDownsidePercent,
        priceChangeSinceSavePercent,
        assumptions: scenario.assumptions,
        disclaimer: valuationService.DISCLAIMER,
        calculatedAt: new Date().toISOString(),
    };
};

module.exports = {
    saveScenario,
    listScenarios,
    deleteScenario,
    compareScenarios,
    backtestScenario,
    ScenarioAssumptionsInvalidError,
    ScenarioNotFoundError,
    BacktestUnavailableError,
};

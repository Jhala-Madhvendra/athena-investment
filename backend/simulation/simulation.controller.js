const simulationService = require("./simulation.service");
const simulationAnalyticsService = require("./simulation.analytics.service");
const simulationScenarioService = require("./simulation.scenario.service");
const { validateAnalyticsQuery } = require("../portfolio/portfolio.analytics.validator");
const {
    isValidPortfolioId,
    validateScenarioRequest,
    validateCompareRequest,
} = require("./simulation.validator");
const { sendServiceError } = require("../utils/httpErrors");

const requireValidPortfolioId = (req, res) => {
    if (!isValidPortfolioId(req.params.id)) {
        res.status(400).json({ message: "A valid paper portfolio id is required." });
        return false;
    }
    return true;
};

const createPortfolio = async (req, res) => {
    try {
        const portfolio = await simulationService.createPortfolio(req.userId, {
            name: req.body?.name,
            holdings: req.body?.holdings,
        });
        return res.status(201).json({ portfolio });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const listPortfolios = async (req, res) => {
    try {
        const portfolios = await simulationService.listPortfolios(req.userId);
        return res.status(200).json({ portfolios });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

/** GET /portfolios/:id - the portfolio's live-priced holdings/summary (getSyntheticPortfolio), not just the stored doc. */
const getPortfolio = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    try {
        const portfolio = await simulationService.loadOwnedPortfolio(req.userId, req.params.id);
        const { holdings, summary } = await simulationService.getSyntheticPortfolio(portfolio);

        return res.status(200).json({
            id: portfolio._id,
            name: portfolio.name,
            createdAt: portfolio.createdAt,
            updatedAt: portfolio.updatedAt,
            holdings,
            summary,
        });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const updatePortfolio = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    try {
        const portfolio = await simulationService.updatePortfolio(req.userId, req.params.id, {
            name: req.body?.name,
            holdings: req.body?.holdings,
        });
        return res.status(200).json({ portfolio });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deletePortfolio = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    try {
        await simulationService.deletePortfolio(req.userId, req.params.id);
        return res.status(200).json({ message: "Paper portfolio removed." });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getAnalytics = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    const validation = validateAnalyticsQuery({ window: req.query.window, benchmark: req.query.benchmark });
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid analytics query.", errors: validation.errors });
    }

    try {
        const analytics = await simulationAnalyticsService.getSimulationAnalytics(req.userId, req.params.id, {
            window: validation.window,
            benchmark: validation.benchmark,
        });
        return res.status(200).json(analytics);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const runScenario = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    const validation = validateScenarioRequest(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid scenario request.", errors: validation.errors });
    }

    try {
        const result = await simulationScenarioService.runSyntheticScenario(req.userId, req.params.id, validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const compareScenarios = async (req, res) => {
    if (!requireValidPortfolioId(req, res)) return;

    const validation = validateCompareRequest(req.body);
    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid scenario comparison request.", errors: validation.errors });
    }

    try {
        const result = await simulationScenarioService.compareSyntheticScenarios(req.userId, req.params.id, validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

module.exports = {
    createPortfolio,
    listPortfolios,
    getPortfolio,
    updatePortfolio,
    deletePortfolio,
    getAnalytics,
    runScenario,
    compareScenarios,
};

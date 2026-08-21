const scenarioService = require("./portfolio.scenario.service");
const { validateScenarioRequest, validateCompareRequest } = require("./portfolio.scenario.validator");
const { sendServiceError } = require("../utils/httpErrors");

const runScenario = async (req, res) => {
    const validation = validateScenarioRequest(req.body);

    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid scenario request.", errors: validation.errors });
    }

    try {
        const result = await scenarioService.runScenario(req.userId, validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const compareScenarios = async (req, res) => {
    const validation = validateCompareRequest(req.body);

    if (!validation.isValid) {
        return res.status(400).json({ message: "Invalid scenario comparison request.", errors: validation.errors });
    }

    try {
        const result = await scenarioService.compareScenarios(req.userId, validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const getPresets = async (_req, res) => {
    return res.status(200).json(scenarioService.getPresets());
};

module.exports = { runScenario, compareScenarios, getPresets };

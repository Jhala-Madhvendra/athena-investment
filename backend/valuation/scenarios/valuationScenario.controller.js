const companyService = require("../../services/company.service");
const scenarioService = require("./valuationScenario.service");
const { validateSaveRequest, validateCompareRequest } = require("./valuationScenario.validator");
const { sendServiceError, resolveTickerParam: resolveTickerParamShared } = require("../../utils/httpErrors");

const resolveTickerParam = (query) => resolveTickerParamShared(query, companyService);

const saveScenario = async (req, res) => {
    const validation = validateSaveRequest(req.body);

    if (!validation.isValid) {
        return res.status(422).json({ message: "Saved scenario failed validation.", errors: validation.errors });
    }

    try {
        const resolvedTicker = await resolveTickerParam(req.params.ticker);
        const result = await scenarioService.saveScenario(req.userId, resolvedTicker, validation.normalized);
        return res.status(201).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const listScenarios = async (req, res) => {
    try {
        const resolvedTicker = await resolveTickerParam(req.params.ticker);
        const scenarios = await scenarioService.listScenarios(req.userId, resolvedTicker);
        return res.status(200).json({ scenarios });
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const deleteScenario = async (req, res) => {
    try {
        const resolvedTicker = await resolveTickerParam(req.params.ticker);
        await scenarioService.deleteScenario(req.userId, resolvedTicker, req.params.id);
        return res.status(204).send();
    } catch (error) {
        return sendServiceError(res, error, 500);
    }
};

const compareScenarios = async (req, res) => {
    const validation = validateCompareRequest(req.body);

    if (!validation.isValid) {
        return res.status(422).json({ message: "Scenario comparison request failed validation.", errors: validation.errors });
    }

    try {
        const resolvedTicker = await resolveTickerParam(req.params.ticker);
        const result = await scenarioService.compareScenarios(req.userId, resolvedTicker, validation.normalized);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const backtestScenario = async (req, res) => {
    try {
        const resolvedTicker = await resolveTickerParam(req.params.ticker);
        const result = await scenarioService.backtestScenario(req.userId, resolvedTicker, req.params.id);
        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = {
    saveScenario,
    listScenarios,
    deleteScenario,
    compareScenarios,
    backtestScenario,
};

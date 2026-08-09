const companyService = require("../services/company.service");
const valuationService = require("./valuation.service");
const { validateDCFRequestBody, validateSensitivityRangeOverrides } = require("./valuation.validator");

const sendServiceError = (res, error, fallbackStatusCode) => {
    const statusCode = error.statusCode || fallbackStatusCode;

    return res.status(statusCode).json({
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
    });
};

const resolveTickerParam = async (query) => {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
        const error = new Error("A valid ticker or company name is required.");
        error.statusCode = 400;
        throw error;
    }

    const ticker = await companyService.resolveTicker(normalizedQuery);

    if (!ticker) {
        const error = new Error("Company name or ticker could not be resolved.");
        error.statusCode = 404;
        throw error;
    }

    return ticker;
};

const getDCFDefaults = async (req, res) => {
    const { ticker } = req.params;

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const defaults = await valuationService.getDCFDefaults(resolvedTicker);

        return res.status(200).json(defaults);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const calculateDCF = async (req, res) => {
    const { ticker } = req.params;
    const requestValidation = validateDCFRequestBody(req.body);

    if (!requestValidation.isValid) {
        return res.status(422).json({
            message: "DCF assumptions failed validation.",
            errors: requestValidation.errors,
        });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await valuationService.calculateDCFValuation(resolvedTicker, req.body);

        if (!result.isValid) {
            return res.status(422).json({
                message: "DCF calculation failed validation.",
                errors: result.errors,
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const calculateScenarios = async (req, res) => {
    const { ticker } = req.params;
    const requestValidation = validateDCFRequestBody(req.body);

    if (!requestValidation.isValid) {
        return res.status(422).json({
            message: "DCF assumptions failed validation.",
            errors: requestValidation.errors,
        });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await valuationService.calculateDCFScenarios(resolvedTicker, req.body);

        if (!result.isValid) {
            return res.status(422).json({
                message: "Scenario calculation failed validation.",
                errors: result.errors,
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

const calculateSensitivity = async (req, res) => {
    const { ticker } = req.params;
    const requestValidation = validateDCFRequestBody(req.body);
    const rangeValidation = validateSensitivityRangeOverrides(req.body);
    const errors = [...requestValidation.errors, ...rangeValidation.errors];

    if (errors.length > 0) {
        return res.status(422).json({
            message: "DCF assumptions failed validation.",
            errors,
        });
    }

    try {
        const resolvedTicker = await resolveTickerParam(ticker);
        const result = await valuationService.calculateDCFSensitivity(resolvedTicker, req.body, {
            waccValues: req.body.waccValues,
            terminalGrowthValues: req.body.terminalGrowthValues,
        });

        if (!result.isValid) {
            return res.status(422).json({
                message: "Sensitivity calculation failed validation.",
                errors: result.errors,
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        return sendServiceError(res, error, 502);
    }
};

module.exports = {
    getDCFDefaults,
    calculateDCF,
    calculateScenarios,
    calculateSensitivity,
};

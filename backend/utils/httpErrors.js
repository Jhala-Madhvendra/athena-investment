const env = require("../config/env");
const logger = require("./logger");

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Sends an error response for a caught controller error.
 * Always logs the full error server-side. Only echoes the raw error
 * message to the client when it's a deliberate business error (has an
 * explicit statusCode) or when running outside production - unexpected
 * errors get a generic message in production so internals never leak.
 */
const sendServiceError = (res, error, fallbackStatusCode) => {
    const statusCode = error.statusCode || fallbackStatusCode;
    const isTrustedError = Boolean(error.statusCode);

    logger.error({ err: error, statusCode }, error.message);

    const message = isTrustedError || !env.isProduction ? error.message : GENERIC_MESSAGE;

    return res.status(statusCode).json({
        message,
        ...(error.errors ? { errors: error.errors } : {}),
    });
};

const resolveTickerParam = async (query, companyService) => {
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

module.exports = { sendServiceError, resolveTickerParam, GENERIC_MESSAGE };

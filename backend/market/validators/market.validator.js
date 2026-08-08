const { SUPPORTED_PERIODS } = require("../market.service");

const DEFAULT_PERIOD = "1y";

/** @returns {{ isValid: boolean, period: string, error: string|null }} */
const validatePeriod = (period) => {
    if (period === undefined) {
        return { isValid: true, period: DEFAULT_PERIOD, error: null };
    }

    if (typeof period !== "string" || !SUPPORTED_PERIODS.includes(period.toLowerCase())) {
        return {
            isValid: false,
            period: null,
            error: `Invalid period "${period}". Supported periods are ${SUPPORTED_PERIODS.join(", ")}.`,
        };
    }

    return { isValid: true, period: period.toLowerCase(), error: null };
};

module.exports = { validatePeriod, DEFAULT_PERIOD };

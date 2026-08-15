const { CATEGORIES } = require("./news.classifier");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const isValidIsoDate = (value) => typeof value === "string" && !Number.isNaN(new Date(value).getTime());

/**
 * @param {object} query - req.query for GET /api/news/:ticker
 * @returns {{isValid: boolean, errors: string[], limit: number, category?: string, from?: string, to?: string}}
 */
const validateNewsQuery = (query = {}) => {
    const errors = [];

    let limit = DEFAULT_LIMIT;
    if (query.limit !== undefined) {
        const parsed = Number(query.limit);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
            errors.push(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
        } else {
            limit = parsed;
        }
    }

    let category;
    if (query.category !== undefined) {
        if (!CATEGORIES.includes(query.category)) {
            errors.push(`category must be one of: ${CATEGORIES.join(", ")}.`);
        } else {
            category = query.category;
        }
    }

    let from;
    if (query.from !== undefined) {
        if (!isValidIsoDate(query.from)) {
            errors.push("from must be a valid ISO date.");
        } else {
            from = query.from;
        }
    }

    let to;
    if (query.to !== undefined) {
        if (!isValidIsoDate(query.to)) {
            errors.push("to must be a valid ISO date.");
        } else {
            to = query.to;
        }
    }

    if (from && to && new Date(from) > new Date(to)) {
        errors.push("from must not be after to.");
    }

    return { isValid: errors.length === 0, errors, limit, category, from, to };
};

module.exports = { validateNewsQuery };

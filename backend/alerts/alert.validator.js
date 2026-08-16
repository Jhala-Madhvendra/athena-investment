/**
 * Manual validation, same {isValid, errors, normalized} shape as
 * portfolio.validator.js / dcf.validator.js - no Joi/Zod anywhere in this
 * codebase, no reason to introduce one here.
 */

const mongoose = require("mongoose");
const { ALERT_TYPES, ALERT_SEVERITIES } = require("./alert.model");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const TICKER_PATTERN = /^[A-Z0-9.-]+$/;

/** GET /api/alerts query params: type, severity, unread, ticker, limit, page. */
const validateListQuery = (query = {}) => {
    const errors = [];
    const normalized = { limit: DEFAULT_LIMIT, page: 1 };

    if (query.type !== undefined) {
        if (!ALERT_TYPES.includes(query.type)) {
            errors.push(`type must be one of: ${ALERT_TYPES.join(", ")}`);
        } else {
            normalized.type = query.type;
        }
    }

    if (query.severity !== undefined) {
        if (!ALERT_SEVERITIES.includes(query.severity)) {
            errors.push(`severity must be one of: ${ALERT_SEVERITIES.join(", ")}`);
        } else {
            normalized.severity = query.severity;
        }
    }

    if (query.unread !== undefined) {
        if (query.unread !== "true" && query.unread !== "false") {
            errors.push("unread must be 'true' or 'false'.");
        } else {
            normalized.unread = query.unread === "true";
        }
    }

    if (query.ticker !== undefined) {
        const ticker = typeof query.ticker === "string" ? query.ticker.trim().toUpperCase() : "";
        if (!TICKER_PATTERN.test(ticker)) {
            errors.push("ticker is not a valid ticker symbol.");
        } else {
            normalized.ticker = ticker;
        }
    }

    if (query.limit !== undefined) {
        const limit = Number(query.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
            errors.push(`limit must be an integer between 1 and ${MAX_LIMIT}.`);
        } else {
            normalized.limit = limit;
        }
    }

    if (query.page !== undefined) {
        const page = Number(query.page);
        if (!Number.isInteger(page) || page < 1) {
            errors.push("page must be a positive integer.");
        } else {
            normalized.page = page;
        }
    }

    return { isValid: errors.length === 0, errors, normalized };
};

const isValidAlertId = (id) => mongoose.Types.ObjectId.isValid(id);

const MAX_TICKERS = 50;

/** GET /api/alerts/counts?tickers=AAPL,MSFT,... - powers the Watchlist/Portfolio compact indicators. Capped so one caller can't force an unbounded aggregate query. */
const validateTickersQuery = (query = {}) => {
    const errors = [];
    const raw = typeof query.tickers === "string" ? query.tickers : "";
    const tickers = raw
        .split(",")
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean);

    if (tickers.length === 0) {
        errors.push("tickers is required (comma-separated ticker symbols).");
    } else if (tickers.length > MAX_TICKERS) {
        errors.push(`tickers must contain at most ${MAX_TICKERS} symbols.`);
    } else if (tickers.some((ticker) => !TICKER_PATTERN.test(ticker))) {
        errors.push("tickers contains an invalid ticker symbol.");
    }

    return { isValid: errors.length === 0, errors, normalized: { tickers: [...new Set(tickers)] } };
};

module.exports = { validateListQuery, isValidAlertId, validateTickersQuery };

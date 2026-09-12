/**
 * Validates GET /api/screener's query params.
 *
 * `limit` is clamped, not rejected, when it exceeds SCREENER_LIMIT_MAX - the
 * cap exists to bound how many companies get scored per request (each
 * scored company triggers a financial-data read via analysisService, which
 * is the operating cost this endpoint has to stay bounded against), not to
 * police the caller, so a too-large request still succeeds at the cap
 * rather than failing outright.
 */

const SORTABLE_FIELDS = ["healthScore", "marketCap", "name"];
const SORT_DIRECTIONS = ["asc", "desc"];
const DEFAULT_SORT_BY = "healthScore";
const DEFAULT_SORT_DIRECTION = "desc";
const SCREENER_LIMIT_DEFAULT = 20;
const SCREENER_LIMIT_MAX = 20;
const MAX_TEXT_FILTER_LENGTH = 100;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const parseOptionalNumber = (raw) => {
    if (raw === undefined || raw === null || raw === "") return { present: false, value: null };
    const value = Number(raw);
    return { present: true, value };
};

/**
 * @param {object} query - req.query
 * @returns {{isValid: boolean, errors: string[], normalized: object}}
 */
const validateScreenerQuery = (query) => {
    const errors = [];
    const raw = typeof query === "object" && query !== null ? query : {};

    const sector = typeof raw.sector === "string" && raw.sector.trim() ? raw.sector.trim().slice(0, MAX_TEXT_FILTER_LENGTH) : null;
    const industry = typeof raw.industry === "string" && raw.industry.trim() ? raw.industry.trim().slice(0, MAX_TEXT_FILTER_LENGTH) : null;

    const minMarketCap = parseOptionalNumber(raw.minMarketCap);
    const maxMarketCap = parseOptionalNumber(raw.maxMarketCap);
    if (minMarketCap.present && (!isFiniteNumber(minMarketCap.value) || minMarketCap.value < 0)) {
        errors.push("minMarketCap must be a non-negative number.");
    }
    if (maxMarketCap.present && (!isFiniteNumber(maxMarketCap.value) || maxMarketCap.value < 0)) {
        errors.push("maxMarketCap must be a non-negative number.");
    }
    if (minMarketCap.present && maxMarketCap.present && isFiniteNumber(minMarketCap.value) && isFiniteNumber(maxMarketCap.value) && minMarketCap.value > maxMarketCap.value) {
        errors.push("minMarketCap must not be greater than maxMarketCap.");
    }

    const minHealthScore = parseOptionalNumber(raw.minHealthScore);
    const maxHealthScore = parseOptionalNumber(raw.maxHealthScore);
    [
        ["minHealthScore", minHealthScore],
        ["maxHealthScore", maxHealthScore],
    ].forEach(([label, parsed]) => {
        if (parsed.present && (!isFiniteNumber(parsed.value) || parsed.value < 0 || parsed.value > 100)) {
            errors.push(`${label} must be a number between 0 and 100.`);
        }
    });
    if (
        minHealthScore.present &&
        maxHealthScore.present &&
        isFiniteNumber(minHealthScore.value) &&
        isFiniteNumber(maxHealthScore.value) &&
        minHealthScore.value > maxHealthScore.value
    ) {
        errors.push("minHealthScore must not be greater than maxHealthScore.");
    }

    const sortBy = raw.sortBy === undefined || raw.sortBy === "" ? DEFAULT_SORT_BY : String(raw.sortBy);
    if (!SORTABLE_FIELDS.includes(sortBy)) {
        errors.push(`sortBy must be one of ${SORTABLE_FIELDS.join(", ")}.`);
    }

    const sortDirection = raw.sortDirection === undefined || raw.sortDirection === "" ? DEFAULT_SORT_DIRECTION : String(raw.sortDirection);
    if (!SORT_DIRECTIONS.includes(sortDirection)) {
        errors.push(`sortDirection must be one of ${SORT_DIRECTIONS.join(", ")}.`);
    }

    const rawLimit = parseOptionalNumber(raw.limit);
    let limit = SCREENER_LIMIT_DEFAULT;
    if (rawLimit.present) {
        if (!isFiniteNumber(rawLimit.value) || rawLimit.value < 1) {
            errors.push("limit must be a positive number.");
        } else {
            limit = Math.min(Math.floor(rawLimit.value), SCREENER_LIMIT_MAX);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized: {
            sector,
            industry,
            minMarketCap: minMarketCap.present ? minMarketCap.value : null,
            maxMarketCap: maxMarketCap.present ? maxMarketCap.value : null,
            minHealthScore: minHealthScore.present ? minHealthScore.value : null,
            maxHealthScore: maxHealthScore.present ? maxHealthScore.value : null,
            sortBy,
            sortDirection,
            limit,
        },
    };
};

module.exports = {
    validateScreenerQuery,
    SORTABLE_FIELDS,
    SORT_DIRECTIONS,
    SCREENER_LIMIT_DEFAULT,
    SCREENER_LIMIT_MAX,
};

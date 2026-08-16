/**
 * Earnings Periods
 *
 * Resolves the latest reported financial period and its comparison period
 * from a ticker's stored financial statements. Athena only stores annual
 * statements today - backend/financials/providers/yahooFinance.provider.js
 * requests only Yahoo's `annual*` timeseries fields, and FinancialStatement
 * (backend/financials/financials.model.js) has no quarter or filing-date
 * field. `periodType` is threaded through the response explicitly so
 * QUARTERLY/TTM support can be added later without changing this module's
 * shape - see research/engineering/PeriodComparison.md.
 */

const PERIOD_TYPES = { ANNUAL: "ANNUAL", QUARTERLY: "QUARTERLY", TTM: "TTM" };

const formatAnnualLabel = (year) => (typeof year === "number" ? `FY${year}` : null);

const sortDescendingByYear = (statements) =>
    [...statements].filter((statement) => statement && typeof statement.year === "number").sort((a, b) => b.year - a.year);

const emptyResult = () => ({
    periodType: PERIOD_TYPES.ANNUAL,
    latest: null,
    previous: null,
    latestPeriodLabel: null,
    previousPeriodLabel: null,
    comparisonAvailable: false,
    comparisonType: null,
});

/**
 * @param {Array} statements - FinancialStatement documents, any order (as
 *   returned by financialsService.getFinancialStatementsByTicker)
 * @returns {{periodType: string, latest: object|null, previous: object|null,
 *   latestPeriodLabel: string|null, previousPeriodLabel: string|null,
 *   comparisonAvailable: boolean, comparisonType: string|null}}
 */
const resolvePeriods = (statements) => {
    if (!Array.isArray(statements) || statements.length === 0) {
        return emptyResult();
    }

    const sorted = sortDescendingByYear(statements);
    const latest = sorted[0] || null;
    const previous = sorted[1] || null;

    if (!latest) {
        return emptyResult();
    }

    return {
        periodType: PERIOD_TYPES.ANNUAL,
        latest,
        previous,
        latestPeriodLabel: formatAnnualLabel(latest.year),
        previousPeriodLabel: previous ? formatAnnualLabel(previous.year) : null,
        comparisonAvailable: Boolean(previous),
        comparisonType: previous ? "YoY" : null,
    };
};

module.exports = { resolvePeriods, formatAnnualLabel, PERIOD_TYPES };

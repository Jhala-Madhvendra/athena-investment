/**
 * Comps Valuation
 *
 * Applies a selected peer statistic (mean/median/p25/p75) for one trading
 * multiple to the target company's own metric, producing an implied
 * valuation. Pure and deterministic - no Express, no MongoDB.
 *
 * Enterprise multiples (EV/EBITDA, EV/Revenue) produce an Implied
 * Enterprise Value first, then bridge to Equity Value via the same
 * Net Debt relationship dcf.formulas.js already uses for DCF
 * (Equity Value = EV - Net Debt) - reused here rather than re-derived,
 * since it's the same finance relationship regardless of how EV was
 * produced (discounted cash flows vs. a peer multiple).
 * Equity multiples (P/E, P/B, P/S) produce Implied Equity Value directly -
 * bridging them through Enterprise Value would double-count or misapply
 * net debt, see research/finance/ValuationMultiples.md.
 */

const dcfFormulas = require("../dcf/dcf.formulas");
const { isFiniteNumber, safeDivide } = require("./comps.formulas");

const MULTIPLE_DEFINITIONS = {
    pe: { label: "P/E", basis: "equity", targetMetric: "netIncome" },
    evEbitda: { label: "EV/EBITDA", basis: "enterprise", targetMetric: "ebitda" },
    evRevenue: { label: "EV/Revenue", basis: "enterprise", targetMetric: "revenue" },
    pb: { label: "P/B", basis: "equity", targetMetric: "bookValue" },
    ps: { label: "P/S", basis: "equity", targetMetric: "revenue" },
};

const buildEnterpriseValuation = (definition, selectedPeerStatistic, targetMetricValue, targetMetrics) => {
    const impliedEnterpriseValue = selectedPeerStatistic * targetMetricValue;
    const netDebtValue = dcfFormulas.netDebt(targetMetrics.debt, targetMetrics.cash);

    if (netDebtValue === null) {
        return {
            isApplicable: false,
            multiple: definition.label,
            basis: definition.basis,
            selectedPeerStatistic,
            targetMetric: targetMetricValue,
            impliedEnterpriseValue,
            impliedEquityValue: null,
            impliedValuePerShare: null,
            reason: "Target debt/cash is not available - cannot bridge Implied Enterprise Value to Implied Equity Value.",
        };
    }

    const impliedEquityValue = dcfFormulas.equityValue(impliedEnterpriseValue, netDebtValue);
    const impliedValuePerShare = safeDivide(impliedEquityValue, targetMetrics.dilutedShares);

    return {
        isApplicable: impliedValuePerShare !== null,
        multiple: definition.label,
        basis: definition.basis,
        selectedPeerStatistic,
        targetMetric: targetMetricValue,
        impliedEnterpriseValue,
        netDebt: netDebtValue,
        impliedEquityValue,
        impliedValuePerShare,
        reason:
            impliedValuePerShare === null
                ? "Diluted shares outstanding is not available for the target - cannot compute Implied Value Per Share."
                : null,
    };
};

const buildEquityValuation = (definition, selectedPeerStatistic, targetMetricValue, targetMetrics) => {
    const impliedEquityValue = selectedPeerStatistic * targetMetricValue;
    const impliedValuePerShare = safeDivide(impliedEquityValue, targetMetrics.dilutedShares);

    return {
        isApplicable: impliedValuePerShare !== null,
        multiple: definition.label,
        basis: definition.basis,
        selectedPeerStatistic,
        targetMetric: targetMetricValue,
        impliedEquityValue,
        impliedValuePerShare,
        reason:
            impliedValuePerShare === null
                ? "Diluted shares outstanding is not available for the target - cannot compute Implied Value Per Share."
                : null,
    };
};

/**
 * @param {string} multipleKey - one of MULTIPLE_DEFINITIONS' keys
 * @param {number|null} selectedPeerStatistic - the chosen peer statistic value for this multiple (e.g. peerStatistics.pe.median)
 * @param {object} targetMetrics - {netIncome, ebitda, revenue, bookValue, debt, cash, dilutedShares}
 * @returns {object} implied valuation breakdown - {isApplicable: false, reason} when it can't be computed, never a fabricated number
 */
const calculateImpliedValuation = (multipleKey, selectedPeerStatistic, targetMetrics) => {
    const definition = MULTIPLE_DEFINITIONS[multipleKey];

    if (!definition) {
        return { isApplicable: false, reason: `Unknown multiple "${multipleKey}".` };
    }

    const targetMetricValue = targetMetrics?.[definition.targetMetric];

    if (!isFiniteNumber(selectedPeerStatistic)) {
        return {
            isApplicable: false,
            multiple: definition.label,
            basis: definition.basis,
            reason: `No valid peer ${definition.label} observations are available to apply to the target.`,
        };
    }

    if (!isFiniteNumber(targetMetricValue)) {
        return {
            isApplicable: false,
            multiple: definition.label,
            basis: definition.basis,
            reason: `Target ${definition.targetMetric} is not available - cannot apply the ${definition.label} multiple.`,
        };
    }

    return definition.basis === "enterprise"
        ? buildEnterpriseValuation(definition, selectedPeerStatistic, targetMetricValue, targetMetrics)
        : buildEquityValuation(definition, selectedPeerStatistic, targetMetricValue, targetMetrics);
};

module.exports = { MULTIPLE_DEFINITIONS, calculateImpliedValuation };

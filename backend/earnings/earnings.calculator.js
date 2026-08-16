/**
 * Earnings Calculator
 *
 * Deterministic period-over-period math for Earnings Intelligence. Builds
 * on backend/ratio/ratio.formulas.js for every margin/ROE/ROA/FCF formula
 * rather than reimplementing them (see research/engineering/ServiceReuse.md)
 * - this module only adds what ratio.formulas.js doesn't already have:
 * variance (absolute/percent change) between two periods, percentage-POINT
 * change for metrics already expressed as a percent, FCF Conversion, and
 * the neutral "earnings quality" observations described in the Sprint 12
 * brief. No LLM call anywhere in this file - every observation is a fixed
 * template driven by the sign/magnitude of an already-computed number.
 */

const ratioFormulas = require("../ratio/ratio.formulas");

const round = (value, decimals = 2) =>
    typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;

const safeDivide = (numerator, denominator) => {
    if (typeof numerator !== "number" || typeof denominator !== "number" || denominator === 0) {
        return null;
    }
    return numerator / denominator;
};

/**
 * Percent change from previous to latest. A change from a zero or negative
 * base is treated as undefined rather than a misleading number (e.g. a
 * swing from -$10M to $5M is not meaningfully "a -150% decline") - this
 * mirrors alert.engine.js's own `percentChange` convention and
 * trend.engine.js's `calculateYoYGrowth`, so "meaningful change" means the
 * same thing everywhere in Athena. See research/finance/YoYGrowth.md.
 */
const percentChange = (previous, latest) => {
    if (typeof previous !== "number" || typeof latest !== "number" || previous <= 0) {
        return null;
    }
    const change = ((latest - previous) / previous) * 100;
    return Number.isFinite(change) ? change : null;
};

const absoluteChange = (previous, latest) => {
    if (typeof previous !== "number" || typeof latest !== "number") {
        return null;
    }
    const change = latest - previous;
    return Number.isFinite(change) ? change : null;
};

/** {absoluteChange, percentChange} for a plain currency/count metric (revenue, net income, FCF, debt, cash...). */
const variance = (previous, latest) => ({
    absoluteChange: round(absoluteChange(previous, latest)),
    percentChange: round(percentChange(previous, latest)),
});

/**
 * Percentage-POINT change for a metric already expressed as a percent (a
 * margin, ROE, ROA) - deliberately distinct from variance()'s relative
 * percentChange. 30.1% -> 28.4% is "-1.7 percentage points", never "-2%"
 * (see the Sprint 12 brief's Margin Analysis section).
 */
const marginPointChange = (previousPercent, latestPercent) => {
    if (typeof previousPercent !== "number" || typeof latestPercent !== "number") {
        return null;
    }
    const change = latestPercent - previousPercent;
    return Number.isFinite(change) ? round(change) : null;
};

/**
 * FCF Conversion = Free Cash Flow / Net Income. Computed whenever both
 * inputs are present and netIncome isn't exactly zero (true divide-by-
 * zero) - including when netIncome is negative, per the brief: "Do not
 * label negative conversion automatically as fraudulent or problematic."
 * A static, deterministic caveat is attached (not an AI judgment) when the
 * sign makes the ratio's usual "cents of cash per dollar of profit"
 * reading not apply. See research/finance/FCFConversion.md.
 */
const fcfConversion = (freeCashFlow, netIncome) => {
    if (typeof freeCashFlow !== "number" || typeof netIncome !== "number" || netIncome === 0) {
        return { value: null, available: false, caveat: null };
    }

    const value = freeCashFlow / netIncome;
    const caveat =
        netIncome < 0
            ? "Net income was negative this period, so FCF Conversion's usual 'cents of cash per dollar of profit' reading does not apply - see research/finance/FCFConversion.md."
            : null;

    return { value: round(value), available: true, caveat };
};

// ---------------------------------------------------------------------------
// Metric builders
// ---------------------------------------------------------------------------

const getIncomeValue = (statement, field) => (statement ? (statement.incomeStatement?.[field] ?? null) : null);
const getBalanceValue = (statement, field) => (statement ? (statement.balanceSheet?.[field] ?? null) : null);

const buildVarianceMetric = (label, unit, latestValue, previousValue) => ({
    label,
    unit,
    latest: round(latestValue),
    previous: round(previousValue),
    ...variance(previousValue, latestValue),
    available: typeof latestValue === "number",
});

const buildMarginMetric = (label, latestStatement, previousStatement, marginFn) => {
    const latestValue = latestStatement ? marginFn(latestStatement) : null;
    const previousValue = previousStatement ? marginFn(previousStatement) : null;

    return {
        label,
        unit: "percent",
        latest: round(latestValue),
        previous: round(previousValue),
        pointChange: marginPointChange(previousValue, latestValue),
        available: typeof latestValue === "number",
    };
};

/**
 * EPS is treated more strictly than every other metric here: it is only
 * marked `available` when BOTH periods report a value. Athena's per-share
 * fields are the most frequently sparse in the underlying provider data
 * (see the Sprint 12 brief's "EPS if reliably available"), and a lone
 * latest-period EPS with no comparison is less useful than the same
 * situation for revenue/income/cash, which are still meaningful on their
 * own as "the latest reported figure."
 */
const buildEpsMetric = (label, latestValue, previousValue) => {
    const bothAvailable = typeof latestValue === "number" && typeof previousValue === "number";

    return {
        label,
        unit: "currency",
        latest: round(latestValue),
        previous: round(previousValue),
        absoluteChange: bothAvailable ? round(absoluteChange(previousValue, latestValue)) : null,
        percentChange: bothAvailable ? round(percentChange(previousValue, latestValue)) : null,
        available: bothAvailable,
    };
};

const fcfMarginPercent = (statement) => {
    if (!statement) return null;
    const fcf = ratioFormulas.freeCashFlow(statement);
    const revenue = statement.incomeStatement?.totalRevenue;
    const ratio = safeDivide(fcf, revenue);
    return ratio === null ? null : ratio * 100;
};

const netDebtValue = (statement) => {
    const debt = getBalanceValue(statement, "totalDebt");
    const cash = getBalanceValue(statement, "cashAndCashEquivalents");
    return typeof debt === "number" && typeof cash === "number" ? debt - cash : null;
};

const computeGrowthMetrics = (latestStatement, previousStatement) => ({
    revenue: buildVarianceMetric(
        "Revenue",
        "currency",
        getIncomeValue(latestStatement, "totalRevenue"),
        getIncomeValue(previousStatement, "totalRevenue")
    ),
    operatingIncome: buildVarianceMetric(
        "Operating Income",
        "currency",
        getIncomeValue(latestStatement, "operatingIncome"),
        getIncomeValue(previousStatement, "operatingIncome")
    ),
    netIncome: buildVarianceMetric(
        "Net Income",
        "currency",
        getIncomeValue(latestStatement, "netIncome"),
        getIncomeValue(previousStatement, "netIncome")
    ),
});

const computeProfitabilityMetrics = (latestStatement, previousStatement) => ({
    operatingMargin: buildMarginMetric("Operating Margin", latestStatement, previousStatement, ratioFormulas.operatingMargin),
    netMargin: buildMarginMetric("Net Profit Margin", latestStatement, previousStatement, ratioFormulas.netProfitMargin),
    returnOnEquity: buildMarginMetric("Return on Equity (ROE)", latestStatement, previousStatement, ratioFormulas.returnOnEquity),
    returnOnAssets: buildMarginMetric("Return on Assets (ROA)", latestStatement, previousStatement, ratioFormulas.returnOnAssets),
});

const computeCashFlowMetrics = (latestStatement, previousStatement) => {
    const latestFcf = latestStatement ? ratioFormulas.freeCashFlow(latestStatement) : null;
    const previousFcf = previousStatement ? ratioFormulas.freeCashFlow(previousStatement) : null;
    const latestNetIncome = getIncomeValue(latestStatement, "netIncome");

    return {
        freeCashFlow: buildVarianceMetric("Free Cash Flow", "currency", latestFcf, previousFcf),
        fcfMargin: buildMarginMetric("FCF Margin", latestStatement, previousStatement, fcfMarginPercent),
        fcfConversion: fcfConversion(latestFcf, latestNetIncome),
    };
};

const computeBalanceSheetMetrics = (latestStatement, previousStatement) => ({
    totalDebt: buildVarianceMetric(
        "Total Debt",
        "currency",
        getBalanceValue(latestStatement, "totalDebt"),
        getBalanceValue(previousStatement, "totalDebt")
    ),
    cash: buildVarianceMetric(
        "Cash & Equivalents",
        "currency",
        getBalanceValue(latestStatement, "cashAndCashEquivalents"),
        getBalanceValue(previousStatement, "cashAndCashEquivalents")
    ),
    netDebt: buildVarianceMetric("Net Debt", "currency", netDebtValue(latestStatement), netDebtValue(previousStatement)),
});

const computePerShareMetrics = (latestStatement, previousStatement) => ({
    basicEPS: buildEpsMetric(
        "Basic EPS",
        getIncomeValue(latestStatement, "basicEPS"),
        getIncomeValue(previousStatement, "basicEPS")
    ),
    dilutedEPS: buildEpsMetric(
        "Diluted EPS",
        getIncomeValue(latestStatement, "dilutedEPS"),
        getIncomeValue(previousStatement, "dilutedEPS")
    ),
});

// ---------------------------------------------------------------------------
// Earnings quality observations (rule-based, not AI - see module header)
// ---------------------------------------------------------------------------

const describeChange = (label, percentValue) =>
    `${label} ${percentValue >= 0 ? "grew" : "declined"} ${round(Math.abs(percentValue))}%`;

/** Net Income vs Free Cash Flow: two different measures of profitability that can legitimately diverge (working capital timing, non-cash items). */
const observeNetIncomeVsFcf = (netIncomeMetric, fcfMetric) => {
    const netIncomeChange = netIncomeMetric?.percentChange;
    const fcfChange = fcfMetric?.percentChange;
    if (typeof netIncomeChange !== "number" || typeof fcfChange !== "number") {
        return null;
    }

    const divergent = netIncomeChange >= 0 !== fcfChange >= 0;

    return {
        type: "netIncomeVsFcf",
        text: `${describeChange("Net income", netIncomeChange)} while ${describeChange("free cash flow", fcfChange).toLowerCase()}.${
            divergent ? " These two measures of profitability moved in different directions this period." : ""
        }`,
    };
};

/** Revenue growth vs profit growth: whether profit is growing faster or slower than the top line - a margin observation stated as a growth-rate comparison. */
const observeRevenueVsProfitGrowth = (revenueMetric, netIncomeMetric) => {
    const revenueChange = revenueMetric?.percentChange;
    const netIncomeChange = netIncomeMetric?.percentChange;
    if (typeof revenueChange !== "number" || typeof netIncomeChange !== "number") {
        return null;
    }

    const gapPoints = netIncomeChange - revenueChange;
    let relation;
    if (Math.abs(gapPoints) < 1) {
        relation = "roughly in line with revenue growth";
    } else if (gapPoints > 0) {
        relation = "ahead of revenue growth, consistent with margin expansion";
    } else {
        relation = "behind revenue growth, consistent with margin contraction";
    }

    return {
        type: "revenueVsProfitGrowth",
        text: `${describeChange("Revenue", revenueChange)} while ${describeChange("net income", netIncomeChange).toLowerCase()} - profit growth was ${relation}.`,
    };
};

/** Debt vs cash flow: debt taken in isolation is not good/bad (per the brief) - it is only contextualized against the cash generation available to service it. */
const observeDebtVsCashFlow = (debtMetric, fcfMetric) => {
    const debtChange = debtMetric?.percentChange;
    const fcfChange = fcfMetric?.percentChange;
    if (typeof debtChange !== "number" || typeof fcfChange !== "number") {
        return null;
    }

    const debtDirection = debtChange >= 0 ? "increased" : "decreased";
    const fcfDirection = fcfChange >= 0 ? "increased" : "decreased";
    let note = "";
    if (debtChange > 0 && fcfChange < 0) {
        note = " - a combination worth watching, since debt servicing draws on cash generation.";
    } else if (debtChange < 0 && fcfChange > 0) {
        note = " - the company reduced leverage while generating more cash.";
    }

    return {
        type: "debtVsCashFlow",
        text: `Total debt ${debtDirection} ${round(Math.abs(debtChange))}% and free cash flow ${fcfDirection} ${round(Math.abs(fcfChange))}% over the same period${note}`,
    };
};

const computeQualityObservations = ({ growth, cashFlow, balanceSheet }) =>
    [
        observeNetIncomeVsFcf(growth?.netIncome, cashFlow?.freeCashFlow),
        observeRevenueVsProfitGrowth(growth?.revenue, growth?.netIncome),
        observeDebtVsCashFlow(balanceSheet?.totalDebt, cashFlow?.freeCashFlow),
    ].filter(Boolean);

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @param {object|null} latestStatement - FinancialStatement document
 * @param {object|null} previousStatement - the comparison period's
 *   FinancialStatement document, or null if none exists (see
 *   earnings.periods.js) - every metric below degrades gracefully to
 *   "available: false" / null change fields rather than throwing.
 */
const calculateEarningsMetrics = (latestStatement, previousStatement) => {
    const growth = computeGrowthMetrics(latestStatement, previousStatement);
    const profitability = computeProfitabilityMetrics(latestStatement, previousStatement);
    const cashFlow = computeCashFlowMetrics(latestStatement, previousStatement);
    const balanceSheet = computeBalanceSheetMetrics(latestStatement, previousStatement);
    const perShare = computePerShareMetrics(latestStatement, previousStatement);
    const qualityObservations = computeQualityObservations({ growth, cashFlow, balanceSheet });

    return { growth, profitability, cashFlow, balanceSheet, perShare, qualityObservations };
};

module.exports = {
    percentChange,
    absoluteChange,
    variance,
    marginPointChange,
    fcfConversion,
    computeGrowthMetrics,
    computeProfitabilityMetrics,
    computeCashFlowMetrics,
    computeBalanceSheetMetrics,
    computePerShareMetrics,
    computeQualityObservations,
    calculateEarningsMetrics,
};

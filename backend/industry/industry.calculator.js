/**
 * Industry Calculator
 *
 * Computes one company's (target or universe member) per-metric bundle for
 * Industry Intelligence. Deliberately reuses existing engines rather than
 * recalculating anything:
 *  - ratio.formulas.js for margins, ROE, ROA, debt-to-equity, free cash flow
 *  - comps.formulas.js for EBITDA, Enterprise Value, P/E, EV/EBITDA (the
 *    same deterministic methodology Sprint 7 Comps uses, rather than
 *    trusting a provider's own trailing P/E field, which can mix TTM and
 *    annual data inconsistently across companies)
 *  - trend.engine.js's calculateYoYGrowth for revenue growth
 *
 * Every metric is either a finite number or null with a stated
 * exclusionReason - never a fabricated value, never a silently-dropped one.
 */

const ratioFormulas = require("../ratio/ratio.formulas");
const compsFormulas = require("../valuation/comps/comps.formulas");
const trendEngine = require("../analysis/trend.engine");

/**
 * Canonical catalog of every metric Industry Intelligence supports -
 * consumed by industry.service.js (to know which metric keys to
 * benchmark), industry.formatter.js (labels/units for the API response),
 * and GET /api/industry/:ticker/metrics. `type` distinguishes
 * financial-statement-derived metrics (freshness = fiscal year) from
 * market-quote-derived ones (freshness = quote timestamp) - see Sprint
 * 13's DATA FRESHNESS section.
 */
const METRIC_DEFINITIONS = {
    revenueGrowth: { label: "Revenue Growth", unit: "percent", category: "growth", type: "financial" },
    operatingMargin: { label: "Operating Margin", unit: "percent", category: "profitability", type: "financial" },
    netMargin: { label: "Net Margin", unit: "percent", category: "profitability", type: "financial" },
    roe: { label: "Return on Equity (ROE)", unit: "percent", category: "profitability", type: "financial" },
    roa: { label: "Return on Assets (ROA)", unit: "percent", category: "profitability", type: "financial" },
    fcfMargin: { label: "Free Cash Flow Margin", unit: "percent", category: "profitability", type: "financial" },
    debtToEquity: { label: "Debt to Equity", unit: "ratio", category: "leverage", type: "financial" },
    pe: { label: "P/E", unit: "multiple", category: "valuation", type: "market" },
    evEbitda: { label: "EV/EBITDA", unit: "multiple", category: "valuation", type: "market" },
};

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const round = (value, decimals = 4) => (isFiniteNumber(value) ? Number(value.toFixed(decimals)) : null);

const metricResult = (value, exclusionReason = null) => ({
    value: isFiniteNumber(value) ? value : null,
    exclusionReason: isFiniteNumber(value) ? null : exclusionReason,
});

/** Revenue growth (YoY %) from the two most recent annual statements. Requires both years - no synthetic single-year growth. */
const calculateRevenueGrowth = (latestStatement, priorStatement) => {
    const latestRevenue = latestStatement?.incomeStatement?.totalRevenue;
    const priorRevenue = priorStatement?.incomeStatement?.totalRevenue;

    if (!priorStatement) {
        return metricResult(null, "A prior-year financial statement is not available to calculate growth.");
    }

    if (!isFiniteNumber(priorRevenue) || priorRevenue <= 0) {
        return metricResult(null, "Prior-year revenue is not available or is zero/negative - growth is not meaningful.");
    }

    const [growth] = trendEngine.calculateYoYGrowth([priorRevenue, latestRevenue]);
    return metricResult(isFiniteNumber(growth) ? round(growth * 100, 2) : null, "Revenue growth could not be calculated.");
};

/** Free Cash Flow Margin (%) = Free Cash Flow / Revenue. Reuses ratio.formulas.freeCashFlow(); revenue must be positive for the margin to be meaningful. */
const calculateFCFMargin = (statement) => {
    const revenue = statement?.incomeStatement?.totalRevenue;
    const fcf = ratioFormulas.freeCashFlow(statement);

    if (!isFiniteNumber(fcf)) {
        return metricResult(null, "Free cash flow is not available.");
    }

    const margin = compsFormulas.safeDivide(fcf, revenue);
    return metricResult(
        isFiniteNumber(margin) ? round(margin * 100, 2) : null,
        !isFiniteNumber(revenue) ? "Revenue is not available." : "Revenue is zero or negative - FCF margin is not meaningful."
    );
};

/**
 * Debt-to-Equity, with an outlier override: ratio.formulas.debtToEquity()
 * only excludes a zero denominator, but a company with negative
 * shareholders' equity produces a ratio with no meaningful interpretation
 * for benchmarking (a distress signal, not a leverage comparison), so it
 * is excluded here even though the raw formula would return a number.
 */
const calculateDebtToEquity = (statement) => {
    const equity = statement?.balanceSheet?.totalStockholderEquity;

    if (!isFiniteNumber(equity)) {
        return metricResult(null, "Shareholders' equity is not available.");
    }

    if (equity <= 0) {
        return metricResult(null, "Shareholders' equity is zero or negative - debt-to-equity is not meaningful for benchmarking.");
    }

    return metricResult(round(ratioFormulas.debtToEquity(statement), 4), "Total debt is not available.");
};

/** P/E via comps.formulas - Market Cap / Net Income, deterministic and consistent with Sprint 7 Comps rather than a provider's own trailing P/E field. */
const calculatePE = (marketCap, statement) => {
    const netIncome = statement?.incomeStatement?.netIncome;
    const value = compsFormulas.priceToEarnings(marketCap, netIncome);

    if (value !== null) {
        return metricResult(round(value, 4));
    }

    if (!isFiniteNumber(marketCap)) return metricResult(null, "Market capitalization is not available.");
    if (!isFiniteNumber(netIncome) || netIncome <= 0) {
        return metricResult(null, "Net income is zero or negative - P/E is not meaningful.");
    }
    return metricResult(null, "P/E could not be calculated.");
};

/** EV/EBITDA via comps.formulas - same EBITDA proxy (EBIT + D&A) and EV bridge (Market Cap + Debt - Cash) as Sprint 7 Comps. */
const calculateEvEbitda = (marketCap, statement) => {
    const operatingIncome = statement?.incomeStatement?.operatingIncome;
    const depreciationAndAmortization = statement?.cashFlow?.depreciationAndAmortization;
    const debt = statement?.balanceSheet?.totalDebt;
    const cash = statement?.balanceSheet?.cashAndCashEquivalents;

    const ebitdaValue = compsFormulas.ebitda(operatingIncome, depreciationAndAmortization);
    const enterpriseValueAmount = compsFormulas.enterpriseValue(marketCap, debt, cash);
    const value = compsFormulas.evToEbitda(enterpriseValueAmount, ebitdaValue);

    if (value !== null) {
        return metricResult(round(value, 4));
    }

    if (enterpriseValueAmount === null) {
        return metricResult(null, "Enterprise Value could not be computed (missing market cap, debt, or cash).");
    }
    if (!isFiniteNumber(ebitdaValue) || ebitdaValue <= 0) {
        return metricResult(null, "EBITDA is zero or negative - EV/EBITDA is not meaningful.");
    }
    return metricResult(null, "EV/EBITDA could not be calculated.");
};

const buildRatioMetric = (label, formula, statement) => {
    const value = formula(statement);
    return metricResult(
        isFiniteNumber(value) ? round(value, 2) : null,
        `${label} could not be calculated - required financial statement fields are not available.`
    );
};

/**
 * Builds the full metric bundle for one company (target or a universe
 * member). `latestStatement`/`priorStatement` are FinancialStatement
 * documents (prior may be null/undefined). `quote` is a market.service
 * quote (may be null if unavailable) - metrics requiring it degrade to
 * excluded/null individually rather than failing the whole bundle.
 *
 * @param {object} params
 * @param {string} params.ticker
 * @param {string|null} params.name
 * @param {number|null} params.marketCap
 * @param {object} params.latestStatement
 * @param {object|null} params.priorStatement
 * @returns {object} {ticker, name, marketCap, fiscalYear, priorFiscalYear, metrics: {...}}
 */
const buildCompanyMetricBundle = ({ ticker, name, marketCap, latestStatement, priorStatement }) => ({
    ticker,
    name: name ?? null,
    marketCap: isFiniteNumber(marketCap) ? marketCap : null,
    fiscalYear: latestStatement?.year ?? null,
    priorFiscalYear: priorStatement?.year ?? null,
    metrics: {
        revenueGrowth: calculateRevenueGrowth(latestStatement, priorStatement),
        operatingMargin: buildRatioMetric("Operating margin", ratioFormulas.operatingMargin, latestStatement),
        netMargin: buildRatioMetric("Net margin", ratioFormulas.netProfitMargin, latestStatement),
        roe: buildRatioMetric("Return on equity", ratioFormulas.returnOnEquity, latestStatement),
        roa: buildRatioMetric("Return on assets", ratioFormulas.returnOnAssets, latestStatement),
        fcfMargin: calculateFCFMargin(latestStatement),
        debtToEquity: calculateDebtToEquity(latestStatement),
        pe: calculatePE(marketCap, latestStatement),
        evEbitda: calculateEvEbitda(marketCap, latestStatement),
    },
});

module.exports = {
    METRIC_DEFINITIONS,
    buildCompanyMetricBundle,
    calculateRevenueGrowth,
    calculateFCFMargin,
    calculateDebtToEquity,
    calculatePE,
    calculateEvEbitda,
};

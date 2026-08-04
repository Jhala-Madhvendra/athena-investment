const formulas = require("./ratio.formulas");

const buildRatio = (label, value, unit) => ({
    label,
    value: typeof value === "number" ? Number(value.toFixed(4)) : null,
    unit,
    available: typeof value === "number",
});

const calculateProfitability = (statement) => ({
    grossMargin: buildRatio(
        "Gross Margin",
        formulas.grossMargin(statement),
        "percent"
    ),
    operatingMargin: buildRatio(
        "Operating Margin",
        formulas.operatingMargin(statement),
        "percent"
    ),
    netProfitMargin: buildRatio(
        "Net Profit Margin",
        formulas.netProfitMargin(statement),
        "percent"
    ),
    returnOnEquity: buildRatio(
        "Return on Equity (ROE)",
        formulas.returnOnEquity(statement),
        "percent"
    ),
    returnOnAssets: buildRatio(
        "Return on Assets (ROA)",
        formulas.returnOnAssets(statement),
        "percent"
    ),
});

const calculateLiquidity = (statement) => ({
    currentRatio: buildRatio(
        "Current Ratio",
        formulas.currentRatio(statement),
        "ratio"
    ),
    quickRatio: buildRatio(
        "Quick Ratio",
        formulas.quickRatio(statement),
        "ratio"
    ),
});

const calculateSolvency = (statement) => ({
    debtToEquity: buildRatio(
        "Debt to Equity",
        formulas.debtToEquity(statement),
        "ratio"
    ),
    debtRatio: buildRatio(
        "Debt Ratio",
        formulas.debtRatio(statement),
        "ratio"
    ),
});

const calculateCashFlow = (statement) => ({
    freeCashFlow: buildRatio(
        "Free Cash Flow",
        formulas.freeCashFlow(statement),
        "currency"
    ),
});

const calculateEfficiency = (statement) => ({
    assetTurnover: buildRatio(
        "Asset Turnover",
        formulas.assetTurnover(statement),
        "ratio"
    ),
});

const calculateRatios = (statement) => ({
    profitability: calculateProfitability(statement),
    liquidity: calculateLiquidity(statement),
    solvency: calculateSolvency(statement),
    cashFlow: calculateCashFlow(statement),
    efficiency: calculateEfficiency(statement),
});

module.exports = {
    calculateRatios,
};

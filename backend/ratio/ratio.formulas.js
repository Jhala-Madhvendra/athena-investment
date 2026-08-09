const safeDivide = (numerator, denominator) => {
    if (typeof numerator !== "number" || typeof denominator !== "number") {
        return null;
    }

    if (denominator === 0) {
        return null;
    }

    return numerator / denominator;
};

const grossMargin = (statement) => {
    const revenue = statement.incomeStatement.totalRevenue;
    const grossProfit = statement.incomeStatement.grossProfit;

    const ratio = safeDivide(grossProfit, revenue);
    return ratio === null ? null : ratio * 100;
};

const operatingMargin = (statement) => {
    const revenue = statement.incomeStatement.totalRevenue;
    const operatingIncome = statement.incomeStatement.operatingIncome;

    const ratio = safeDivide(operatingIncome, revenue);
    return ratio === null ? null : ratio * 100;
};

const netProfitMargin = (statement) => {
    const revenue = statement.incomeStatement.totalRevenue;
    const netIncome = statement.incomeStatement.netIncome;

    const ratio = safeDivide(netIncome, revenue);
    return ratio === null ? null : ratio * 100;
};

const returnOnEquity = (statement) => {
    const netIncome = statement.incomeStatement.netIncome;
    const equity = statement.balanceSheet.totalStockholderEquity;

    const ratio = safeDivide(netIncome, equity);
    return ratio === null ? null : ratio * 100;
};

const returnOnAssets = (statement) => {
    const netIncome = statement.incomeStatement.netIncome;
    const assets = statement.balanceSheet.totalAssets;

    const ratio = safeDivide(netIncome, assets);
    return ratio === null ? null : ratio * 100;
};

const currentRatio = (statement) => {
    const currentAssets = statement.balanceSheet.currentAssets;
    const currentLiabilities = statement.balanceSheet.currentLiabilities;

    return safeDivide(currentAssets, currentLiabilities);
};

const quickRatio = (statement) => {
    const cash = statement.balanceSheet.cashAndCashEquivalents;
    const receivables = statement.balanceSheet.accountsReceivable;
    const currentLiabilities = statement.balanceSheet.currentLiabilities;

    const numerator = typeof cash === "number" && typeof receivables === "number" ? cash + receivables : null;
    return safeDivide(numerator, currentLiabilities);
};

const debtToEquity = (statement) => {
    const totalDebt = statement.balanceSheet.totalDebt;
    const equity = statement.balanceSheet.totalStockholderEquity;

    return safeDivide(totalDebt, equity);
};

const debtRatio = (statement) => {
    const totalDebt = statement.balanceSheet.totalDebt;
    const assets = statement.balanceSheet.totalAssets;

    return safeDivide(totalDebt, assets);
};

const freeCashFlow = (statement) => {
    const operatingCashFlow = statement.cashFlow.operatingCashFlow;
    const capitalExpenditure = statement.cashFlow.capitalExpenditure;

    if (typeof operatingCashFlow !== "number" || typeof capitalExpenditure !== "number") {
        return null;
    }

    // capitalExpenditure is stored as a negative outflow (standard cash-flow-statement
    // sign, confirmed against Yahoo's own reported FCF: OCF + capitalExpenditure matches
    // it exactly). Subtracting it unmodified would ADD the outflow back instead of
    // reducing it, so the magnitude is normalized here regardless of the stored sign.
    return operatingCashFlow - Math.abs(capitalExpenditure);
};

const assetTurnover = (statement) => {
    const revenue = statement.incomeStatement.totalRevenue;
    const assets = statement.balanceSheet.totalAssets;

    return safeDivide(revenue, assets);
};

module.exports = {
    grossMargin,
    operatingMargin,
    netProfitMargin,
    returnOnEquity,
    returnOnAssets,
    currentRatio,
    quickRatio,
    debtToEquity,
    debtRatio,
    freeCashFlow,
    assetTurnover,
};

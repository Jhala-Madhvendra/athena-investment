const statementFieldMappings = {
    incomeStatement: {
        totalRevenue: "annualTotalRevenue",
        costOfRevenue: "annualCostOfRevenue",
        grossProfit: "annualGrossProfit",
        totalOperatingExpenses: "annualOperatingExpense",
        operatingIncome: "annualOperatingIncome",
        pretaxIncome: "annualPretaxIncome",
        taxProvision: "annualTaxProvision",
        netIncome: "annualNetIncome",
        basicEPS: "annualBasicEPS",
        dilutedEPS: "annualDilutedEPS",
        dilutedSharesOutstanding: "annualDilutedAverageShares",
    },
    balanceSheet: {
        cashAndCashEquivalents: "annualCashCashEquivalentsAndShortTermInvestments",
        totalAssets: "annualTotalAssets",
        totalLiabilities: "annualTotalLiabilitiesNetMinorityInterest",
        totalDebt: "annualTotalDebt",
        totalStockholderEquity: "annualStockholdersEquity",
        currentAssets: "annualCurrentAssets",
        currentLiabilities: "annualCurrentLiabilities",
        accountsReceivable: "annualAccountsReceivable",
    },
    cashFlow: {
        operatingCashFlow: "annualOperatingCashFlow",
        capitalExpenditure: "annualCapitalExpenditure",
        investingCashFlow: "annualInvestingCashFlow",
        financingCashFlow: "annualFinancingCashFlow",
        freeCashFlow: "annualFreeCashFlow",
        depreciationAndAmortization: "annualDepreciationAmortizationDepletion",
    },
};

const createStatement = (ticker, year) => ({
    ticker: ticker.toUpperCase(),
    year,
    incomeStatement: Object.fromEntries(
        Object.keys(statementFieldMappings.incomeStatement).map((field) => [field, null])
    ),
    balanceSheet: Object.fromEntries(
        Object.keys(statementFieldMappings.balanceSheet).map((field) => [field, null])
    ),
    cashFlow: Object.fromEntries(
        Object.keys(statementFieldMappings.cashFlow).map((field) => [field, null])
    ),
    source: "Yahoo Finance",
});

const getYear = (entry) => {
    const date = new Date(entry.asOfDate);
    const year = date.getUTCFullYear();

    return Number.isNaN(year) ? null : year;
};

const getSeriesEntries = (result, yahooField) => {
    const series = result.find((item) => Array.isArray(item[yahooField]));

    return series?.[yahooField] || [];
};

const mapYahooFinanceFinancials = (response, ticker) => {
    const result = response?.timeseries?.result;

    if (!Array.isArray(result)) {
        return [];
    }

    const statementsByYear = new Map();

    Object.entries(statementFieldMappings).forEach(([statementName, fields]) => {
        Object.entries(fields).forEach(([athenaField, yahooField]) => {
            getSeriesEntries(result, yahooField).forEach((entry) => {
                const year = getYear(entry);

                if (!year) {
                    return;
                }

                const statement =
                    statementsByYear.get(year) || createStatement(ticker, year);

                statement[statementName][athenaField] = entry.reportedValue?.raw ?? null;
                statementsByYear.set(year, statement);
            });
        });
    });

    return [...statementsByYear.values()].sort((first, second) => second.year - first.year);
};

module.exports = mapYahooFinanceFinancials;

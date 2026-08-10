const FinancialStatementsProvider = require("../../financials/providers/financialStatementsProvider");
const { twelveDataGet } = require("./twelveDataClient");

const toNumberOrNull = (value) => (typeof value === "number" ? value : null);

const buildIncomeStatement = (entry) => {
    const grossProfit = toNumberOrNull(entry.gross_profit);
    const operatingIncome = toNumberOrNull(entry.operating_income);

    return {
        totalRevenue: toNumberOrNull(entry.sales),
        costOfRevenue: toNumberOrNull(entry.cost_of_goods),
        grossProfit,
        totalOperatingExpenses:
            grossProfit !== null && operatingIncome !== null ? grossProfit - operatingIncome : null,
        operatingIncome,
        pretaxIncome: toNumberOrNull(entry.pretax_income),
        taxProvision: toNumberOrNull(entry.income_tax),
        netIncome: toNumberOrNull(entry.net_income),
        basicEPS: toNumberOrNull(entry.eps_basic),
        dilutedEPS: toNumberOrNull(entry.eps_diluted),
        dilutedSharesOutstanding: toNumberOrNull(entry.diluted_shares_outstanding),
    };
};

const buildBalanceSheet = (entry) => {
    const currentAssets = entry.assets?.current_assets || {};
    const nonCurrentLiabilities = entry.liabilities?.non_current_liabilities || {};
    const currentLiabilities = entry.liabilities?.current_liabilities || {};
    const shortTermDebt = toNumberOrNull(currentLiabilities.short_term_debt);
    const longTermDebt = toNumberOrNull(nonCurrentLiabilities.long_term_debt);

    return {
        cashAndCashEquivalents: toNumberOrNull(currentAssets.cash_and_cash_equivalents),
        totalAssets: toNumberOrNull(entry.assets?.total_assets),
        totalLiabilities: toNumberOrNull(entry.liabilities?.total_liabilities),
        totalDebt:
            shortTermDebt !== null || longTermDebt !== null
                ? (shortTermDebt || 0) + (longTermDebt || 0)
                : null,
        totalStockholderEquity: toNumberOrNull(entry.shareholders_equity?.total_shareholders_equity),
        currentAssets: toNumberOrNull(currentAssets.total_current_assets),
        currentLiabilities: toNumberOrNull(currentLiabilities.total_current_liabilities),
        accountsReceivable: toNumberOrNull(currentAssets.accounts_receivable),
    };
};

const buildCashFlow = (entry) => ({
    operatingCashFlow: toNumberOrNull(entry.operating_activities?.operating_cash_flow),
    capitalExpenditure: toNumberOrNull(entry.investing_activities?.capital_expenditures),
    investingCashFlow: toNumberOrNull(entry.investing_activities?.investing_cash_flow),
    financingCashFlow: toNumberOrNull(entry.financing_activities?.financing_cash_flow),
    freeCashFlow: toNumberOrNull(entry.free_cash_flow),
    depreciationAndAmortization: toNumberOrNull(entry.operating_activities?.depreciation),
});

class TwelveDataFinancialStatementsProvider extends FinancialStatementsProvider {
    async getAnnualFinancialStatements(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();

        const [incomeResponse, balanceResponse, cashFlowResponse] = await Promise.all([
            twelveDataGet("/income_statement", { symbol: normalizedTicker }),
            twelveDataGet("/balance_sheet", { symbol: normalizedTicker }),
            twelveDataGet("/cash_flow", { symbol: normalizedTicker }),
        ]);

        const statementsByYear = new Map();

        const getStatement = (year) => {
            if (!statementsByYear.has(year)) {
                statementsByYear.set(year, {
                    ticker: normalizedTicker,
                    year,
                    incomeStatement: null,
                    balanceSheet: null,
                    cashFlow: null,
                    source: "Twelve Data",
                });
            }
            return statementsByYear.get(year);
        };

        (incomeResponse?.income_statement || []).forEach((entry) => {
            if (!entry.year) return;
            getStatement(entry.year).incomeStatement = buildIncomeStatement(entry);
        });

        (balanceResponse?.balance_sheet || []).forEach((entry) => {
            if (!entry.year) return;
            getStatement(entry.year).balanceSheet = buildBalanceSheet(entry);
        });

        (cashFlowResponse?.cash_flow || []).forEach((entry) => {
            if (!entry.year) return;
            getStatement(entry.year).cashFlow = buildCashFlow(entry);
        });

        return [...statementsByYear.values()]
            .filter((statement) => statement.incomeStatement && statement.balanceSheet && statement.cashFlow)
            .sort((a, b) => b.year - a.year);
    }
}

module.exports = TwelveDataFinancialStatementsProvider;

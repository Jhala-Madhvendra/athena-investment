const YahooFinanceProvider = require("./yahooFinance.provider");

const createFinancialStatementsProvider = () => {
    const providerName = (process.env.FINANCIAL_STATEMENTS_PROVIDER || "yahoo").toLowerCase();

    switch (providerName) {
        case "yahoo":
            return new YahooFinanceProvider();
        default:
            throw new Error(`Unsupported financial statements provider: ${providerName}`);
    }
};

module.exports = createFinancialStatementsProvider();

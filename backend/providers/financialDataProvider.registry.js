const YahooFinanceProvider = require("./yahoo/yahooFinance.provider");
const TwelveDataFinancialDataProvider = require("./twelvedata/twelveDataFinancialData.provider");

const createFinancialDataProvider = () => {
    const providerName = (process.env.FINANCIAL_DATA_PROVIDER || "yahoo").toLowerCase();

    switch (providerName) {
        case "yahoo":
            return new YahooFinanceProvider();
        case "twelvedata":
            return new TwelveDataFinancialDataProvider();
        default:
            throw new Error(`Unsupported financial data provider: ${providerName}`);
    }
};

module.exports = createFinancialDataProvider();

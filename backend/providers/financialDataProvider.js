class FinancialDataProvider {
    async getCompanyProfile(ticker) {
        throw new Error("getCompanyProfile must be implemented by a financial data provider.");
    }

    async searchTickerByName(name) {
        throw new Error("searchTickerByName must be implemented by a financial data provider.");
    }
}

module.exports = FinancialDataProvider;

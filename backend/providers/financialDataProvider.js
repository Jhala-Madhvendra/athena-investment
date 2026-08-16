class FinancialDataProvider {
    async getCompanyProfile(ticker) {
        throw new Error("getCompanyProfile must be implemented by a financial data provider.");
    }

    async searchTickerByName(name) {
        throw new Error("searchTickerByName must be implemented by a financial data provider.");
    }

    /**
     * Optional capability - not every provider supports discovering
     * companies by sector/industry classification (e.g. Twelve Data's free
     * tier has no equivalent to Yahoo's screener). A provider that doesn't
     * implement this should be surfaced as "not supported," never silently
     * return an empty list that looks like "no companies found."
     */
    async searchCompaniesByClassification({ industry, sector }) {
        const error = new Error("Company discovery by industry/sector is not supported by the current financial data provider.");
        error.statusCode = 501;
        throw error;
    }
}

module.exports = FinancialDataProvider;

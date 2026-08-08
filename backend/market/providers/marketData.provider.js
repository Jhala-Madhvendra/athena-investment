class MarketDataProvider {
    async getQuote(ticker) {
        throw new Error("getQuote must be implemented by a market data provider.");
    }

    async getHistoricalPrices(ticker, range) {
        throw new Error("getHistoricalPrices must be implemented by a market data provider.");
    }
}

module.exports = MarketDataProvider;

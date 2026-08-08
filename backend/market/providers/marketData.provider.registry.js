const YahooMarketDataProvider = require("./yahooMarketData.provider");

const createMarketDataProvider = () => {
    const providerName = (process.env.MARKET_DATA_PROVIDER || "yahoo").toLowerCase();

    switch (providerName) {
        case "yahoo":
            return new YahooMarketDataProvider();
        default:
            throw new Error(`Unsupported market data provider: ${providerName}`);
    }
};

module.exports = createMarketDataProvider();

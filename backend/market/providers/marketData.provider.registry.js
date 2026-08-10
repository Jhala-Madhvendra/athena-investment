const YahooMarketDataProvider = require("./yahooMarketData.provider");
const TwelveDataMarketDataProvider = require("../../providers/twelvedata/twelveDataMarketData.provider");

const createMarketDataProvider = () => {
    const providerName = (process.env.MARKET_DATA_PROVIDER || "yahoo").toLowerCase();

    switch (providerName) {
        case "yahoo":
            return new YahooMarketDataProvider();
        case "twelvedata":
            return new TwelveDataMarketDataProvider();
        default:
            throw new Error(`Unsupported market data provider: ${providerName}`);
    }
};

module.exports = createMarketDataProvider();

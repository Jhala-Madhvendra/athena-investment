const YahooNewsProvider = require("./yahooNews.provider");
const MarketauxNewsProvider = require("./marketauxNews.provider");
const MockNewsProvider = require("./mockNews.provider");
const env = require("../../config/env");
const logger = require("../../utils/logger");

const createNewsProvider = () => {
    const providerName = env.newsProvider;

    if (providerName === "mock") {
        logger.warn('NEWS_PROVIDER=mock - serving development-only fixture news, never real articles.');
    }

    switch (providerName) {
        case "yahoo":
            return new YahooNewsProvider();
        case "marketaux":
            return new MarketauxNewsProvider();
        case "mock":
            return new MockNewsProvider();
        default:
            throw new Error(`Unsupported news provider: ${providerName}`);
    }
};

module.exports = createNewsProvider();

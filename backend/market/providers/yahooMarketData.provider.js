const MarketDataProvider = require("./marketData.provider");
const getYahooAuthentication = require("../../providers/yahoo/yahooAuth");
const { mapYahooQuote, mapYahooHistoricalPrices } = require("../mappers/yahooMarketData.mapper");
const fetchWithTimeout = require("../../utils/fetchWithTimeout");

class YahooMarketDataProvider extends MarketDataProvider {
    async getQuote(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();
        const { cookie, crumb } = await getYahooAuthentication();
        const url = new URL(
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(normalizedTicker)}`
        );

        url.searchParams.set("modules", "price,summaryDetail,defaultKeyStatistics");
        url.searchParams.set("crumb", crumb);

        const response = await fetchWithTimeout(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
                Cookie: cookie,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Yahoo Finance request failed for ${normalizedTicker} with status ${response.status}.`
            );
        }

        const yahooResponse = await response.json();

        if (yahooResponse.quoteSummary?.error) {
            throw new Error(
                yahooResponse.quoteSummary.error.description ||
                    `Yahoo Finance could not find ${normalizedTicker}.`
            );
        }

        const quote = mapYahooQuote(yahooResponse, normalizedTicker);

        if (!quote) {
            throw new Error(`Yahoo Finance returned no market data for ${normalizedTicker}.`);
        }

        return quote;
    }

    async getHistoricalPrices(ticker, yahooRange) {
        const normalizedTicker = ticker.trim().toUpperCase();
        const { cookie, crumb } = await getYahooAuthentication();
        const url = new URL(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedTicker)}`
        );

        url.searchParams.set("range", yahooRange);
        url.searchParams.set("interval", "1d");
        url.searchParams.set("crumb", crumb);

        const response = await fetchWithTimeout(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
                Cookie: cookie,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Yahoo Finance request failed for ${normalizedTicker} with status ${response.status}.`
            );
        }

        const yahooResponse = await response.json();

        if (yahooResponse.chart?.error) {
            throw new Error(
                yahooResponse.chart.error.description ||
                    `Yahoo Finance could not find historical prices for ${normalizedTicker}.`
            );
        }

        return mapYahooHistoricalPrices(yahooResponse);
    }
}

module.exports = YahooMarketDataProvider;

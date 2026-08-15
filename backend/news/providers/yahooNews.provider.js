const NewsProvider = require("./newsProvider");
const fetchWithTimeout = require("../../utils/fetchWithTimeout");

// Same unauthenticated v1/finance/search endpoint
// backend/providers/yahoo/yahooFinance.provider.js's searchTickerByName
// already uses - it doubles as a news search when newsCount > 0. No
// cookie/crumb required (unlike quoteSummary), so no dependency on
// yahooAuth.js. Unofficial/scraped, same reliability tier as the rest of
// Athena's Yahoo integration.
const NEWS_COUNT = 25;

class YahooNewsProvider extends NewsProvider {
    get providerName() {
        return "yahoo";
    }

    async getNewsForTicker(ticker) {
        const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
        url.searchParams.set("q", ticker);
        url.searchParams.set("quotesCount", "0");
        url.searchParams.set("newsCount", String(NEWS_COUNT));

        const response = await fetchWithTimeout(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance news request failed for ${ticker} with status ${response.status}.`);
        }

        const yahooResponse = await response.json();
        return Array.isArray(yahooResponse.news) ? yahooResponse.news : [];
    }
}

module.exports = YahooNewsProvider;

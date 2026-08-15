const NewsProvider = require("./newsProvider");

/**
 * Development-only fixture provider. Returns deterministic, clearly-fake
 * articles - never real news - so local development and tests work without
 * any external network call or API key. news.normalizer.js stamps every
 * article's `provider` field with "mock", and
 * newsProvider.registry.js logs a warning on startup when this provider is
 * active, so mock data can never be silently mistaken for real news.
 */
class MockNewsProvider extends NewsProvider {
    get providerName() {
        return "mock";
    }

    async getNewsForTicker(ticker, companyName) {
        const label = companyName || ticker;
        const now = Date.now();
        const HOUR_MS = 60 * 60 * 1000;

        return [
            {
                id: `mock-${ticker}-earnings`,
                title: `${label} reports quarterly earnings ahead of analyst estimates`,
                description: `${label} posted quarterly revenue and EPS both ahead of consensus, citing stronger-than-expected demand.`,
                url: `https://example.com/mock-news/${ticker.toLowerCase()}/earnings`,
                source: "Athena Mock Wire",
                publishedAt: new Date(now - 2 * HOUR_MS).toISOString(),
            },
            {
                id: `mock-${ticker}-leadership`,
                title: `${label} appoints new independent board director`,
                description: `${label} named a new independent director to its board, effective next quarter.`,
                url: `https://example.com/mock-news/${ticker.toLowerCase()}/leadership`,
                source: "Athena Mock Wire",
                publishedAt: new Date(now - 26 * HOUR_MS).toISOString(),
            },
            {
                id: `mock-${ticker}-partnership`,
                title: `${label} expands distribution partnership into new region`,
                description: `${label} confirmed an expanded distribution partnership aimed at broadening its market reach.`,
                url: `https://example.com/mock-news/${ticker.toLowerCase()}/partnership`,
                source: "Athena Mock Wire",
                publishedAt: new Date(now - 3 * 24 * HOUR_MS).toISOString(),
            },
        ];
    }
}

module.exports = MockNewsProvider;

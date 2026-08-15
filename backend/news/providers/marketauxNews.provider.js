const NewsProvider = require("./newsProvider");
const fetchWithTimeout = require("../../utils/fetchWithTimeout");
const env = require("../../config/env");

// Marketaux is a dedicated financial news API - richer than Yahoo's search
// feed (includes a description/snippet), but requires a free API key from
// marketaux.com. Check their current free-tier request limits when you sign
// up; Athena doesn't hard-code a specific quota here since it's not ours to
// promise. See backend/.env.example for setup.
const ARTICLES_PER_REQUEST = 20;

class MarketauxNewsProvider extends NewsProvider {
    get providerName() {
        return "marketaux";
    }

    async getNewsForTicker(ticker) {
        if (!env.marketauxApiKey) {
            throw new Error(
                'MARKETAUX_API_KEY is not configured. Set it in backend/.env, or switch NEWS_PROVIDER to "yahoo" or "mock".'
            );
        }

        const url = new URL("https://api.marketaux.com/v1/news/all");
        url.searchParams.set("symbols", ticker);
        url.searchParams.set("filter_entities", "true");
        url.searchParams.set("language", "en");
        url.searchParams.set("limit", String(ARTICLES_PER_REQUEST));
        url.searchParams.set("api_token", env.marketauxApiKey);

        const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });

        if (!response.ok) {
            throw new Error(`Marketaux news request failed for ${ticker} with status ${response.status}.`);
        }

        const marketauxResponse = await response.json();

        if (marketauxResponse.error) {
            throw new Error(marketauxResponse.error.message || `Marketaux returned an error for ${ticker}.`);
        }

        return Array.isArray(marketauxResponse.data) ? marketauxResponse.data : [];
    }
}

module.exports = MarketauxNewsProvider;

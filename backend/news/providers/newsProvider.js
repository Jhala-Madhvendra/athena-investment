/**
 * News Provider (abstract base)
 *
 * Same shape as backend/providers/financialDataProvider.js and
 * backend/ai/providers/llmProvider.js: a thin interface every concrete news
 * integration implements, so news.service.js never depends on a specific
 * vendor's API shape. Swapping providers is a one-env-var change (see
 * newsProvider.registry.js), not a rewrite of the news domain.
 */
class NewsProvider {
    /**
     * The provider name persisted on every article/API response (e.g.
     * "yahoo", "marketaux", "mock") - concrete providers implement this as
     * a getter, mirroring LLMProvider.modelName.
     */
    get providerName() {
        throw new Error("providerName must be implemented by a news provider.");
    }

    /**
     * @param {string} ticker - normalized ticker
     * @param {string} [companyName] - best-known company name, for providers that search by name/keyword
     * @returns {Promise<object[]>} raw, provider-specific article objects - normalization into
     *   Athena's internal schema happens one layer up, in news.normalizer.js.
     */
    async getNewsForTicker(ticker, companyName) {
        throw new Error("getNewsForTicker must be implemented by a news provider.");
    }
}

module.exports = NewsProvider;

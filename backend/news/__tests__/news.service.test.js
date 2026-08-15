jest.mock("../../models/company.model", () => ({ findOne: jest.fn() }));
jest.mock("../news.model", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    aggregate: jest.fn(),
}));
jest.mock("../providers/newsProvider.registry", () => ({
    providerName: "yahoo",
    getNewsForTicker: jest.fn(),
}));

const Company = require("../../models/company.model");
const NewsArticle = require("../news.model");
const newsProvider = require("../providers/newsProvider.registry");
const newsService = require("../news.service");

/** Chainable mock matching Mongoose's find()/findOne().sort().limit().select().lean() usage in news.service.js */
const chainable = (result) => {
    const chain = {
        sort: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        select: jest.fn(() => chain),
        lean: jest.fn(() => Promise.resolve(result)),
    };
    return chain;
};

const YAHOO_RAW_ARTICLE = {
    uuid: "uuid-1",
    title: "Apple reports record quarterly earnings",
    publisher: "Reuters",
    link: "https://example.com/apple-earnings",
    providerPublishTime: Math.floor(Date.now() / 1000),
};

beforeEach(() => {
    Company.findOne.mockReturnValue(chainable({ name: "Apple Inc.", ticker: "AAPL" }));
    NewsArticle.updateOne.mockResolvedValue({});
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getNews", () => {
    it("throws CompanyNotFoundError for an unknown ticker", async () => {
        Company.findOne.mockReturnValue(chainable(null));

        await expect(newsService.getNews("ZZZZ")).rejects.toThrow(newsService.CompanyNotFoundError);
    });

    it("serves cached articles without calling the provider when the cache is fresh", async () => {
        NewsArticle.findOne.mockReturnValue(chainable({ retrievedAt: new Date() }));
        NewsArticle.find.mockReturnValue(chainable([{ title: "Cached article" }]));

        const result = await newsService.getNews("AAPL");

        expect(newsProvider.getNewsForTicker).not.toHaveBeenCalled();
        expect(result.articles).toEqual([{ title: "Cached article" }]);
        expect(result.provider).toBe("yahoo");
    });

    it("refreshes from the provider and persists a new article when the cache is empty", async () => {
        NewsArticle.findOne.mockReturnValue(chainable(null));
        NewsArticle.find
            .mockReturnValueOnce(chainable([])) // persistArticles: no existing articles for this ticker
            .mockReturnValueOnce(chainable([{ title: "Apple reports record quarterly earnings" }])); // final listing
        NewsArticle.create.mockResolvedValue({
            _id: "new-id",
            provider: "yahoo",
            providerArticleId: "uuid-1",
            canonicalUrl: "https://example.com/apple-earnings",
            title: "Apple reports record quarterly earnings",
            publishedAt: new Date(),
        });
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        const result = await newsService.getNews("AAPL");

        expect(newsProvider.getNewsForTicker).toHaveBeenCalledWith("AAPL", "Apple Inc.");
        expect(NewsArticle.create).toHaveBeenCalledTimes(1);
        expect(NewsArticle.create.mock.calls[0][0]).toMatchObject({
            tickers: ["AAPL"],
            category: expect.any(String),
            classificationConfidence: expect.stringMatching(/high|low/),
        });
        expect(result.articles).toEqual([{ title: "Apple reports record quarterly earnings" }]);
    });

    it("merges a duplicate article into the existing document instead of inserting a new row", async () => {
        NewsArticle.findOne.mockReturnValue(chainable(null));
        NewsArticle.find
            .mockReturnValueOnce(
                chainable([
                    {
                        _id: "existing-id",
                        provider: "yahoo",
                        providerArticleId: "uuid-1",
                        canonicalUrl: "https://example.com/apple-earnings",
                        title: "Apple reports record quarterly earnings",
                        publishedAt: new Date(),
                    },
                ])
            )
            .mockReturnValueOnce(chainable([]));
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        await newsService.getNews("AAPL");

        expect(NewsArticle.create).not.toHaveBeenCalled();
        expect(NewsArticle.updateOne).toHaveBeenCalledWith(
            { _id: "existing-id" },
            {
                $addToSet: { tickers: "AAPL" },
                $set: { category: expect.any(String), classificationConfidence: expect.stringMatching(/high|low/) },
            }
        );
    });

    it("re-syncs an existing article's category on merge, so a classifier improvement applies to already-stored duplicates", async () => {
        // The stored article predates a keyword-list update and was
        // (incorrectly, at the time) classified as "Other" - a merge should
        // overwrite it with whatever the current classifier now produces
        // for this same title/description, not leave the stale category.
        // refreshNews (unlike getNews) only calls NewsArticle.find once -
        // inside persistArticles's existing-articles lookup - so this needs
        // exactly one mockReturnValueOnce, not two: an unconsumed second
        // queued value would leak into the next test (mockReturnValueOnce
        // queues survive clearAllMocks(), unlike mockReturnValue's default).
        NewsArticle.findOne.mockReturnValue(chainable(null));
        NewsArticle.find.mockReturnValueOnce(
            chainable([
                {
                    _id: "existing-id",
                    provider: "yahoo",
                    providerArticleId: "uuid-1",
                    canonicalUrl: "https://example.com/apple-earnings",
                    title: "Apple reports record quarterly earnings",
                    publishedAt: new Date(),
                },
            ])
        );
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        await newsService.refreshNews("AAPL");

        const [, updatePayload] = NewsArticle.updateOne.mock.calls[0];
        expect(updatePayload.$set.category).toBe("Earnings");
        expect(["high", "low"]).toContain(updatePayload.$set.classificationConfidence);
    });

    it("degrades to cached articles when the provider refresh fails", async () => {
        NewsArticle.findOne.mockReturnValue(chainable(null));
        NewsArticle.find.mockReturnValue(chainable([{ title: "Stale but still shown" }]));
        newsProvider.getNewsForTicker.mockRejectedValue(new Error("Provider timed out"));

        const result = await newsService.getNews("AAPL");

        expect(result.articles).toEqual([{ title: "Stale but still shown" }]);
    });

    it("applies category and date filters to the stored-article query", async () => {
        NewsArticle.findOne.mockReturnValue(chainable({ retrievedAt: new Date() }));
        const articlesChain = chainable([]);
        NewsArticle.find.mockReturnValue(articlesChain);

        await newsService.getNews("AAPL", { category: "Earnings", from: "2026-08-01", to: "2026-08-10", limit: 5 });

        const queryArg = NewsArticle.find.mock.calls[0][0];
        expect(queryArg.category).toBe("Earnings");
        expect(queryArg.publishedAt.$gte).toEqual(new Date("2026-08-01"));
        expect(queryArg.publishedAt.$lte).toEqual(new Date("2026-08-10"));
        expect(articlesChain.limit).toHaveBeenCalledWith(5);
    });
});

describe("refreshNews", () => {
    it("always calls the provider, ignoring the cache TTL", async () => {
        NewsArticle.find.mockReturnValue(chainable([]));
        NewsArticle.create.mockResolvedValue({
            _id: "new-id",
            provider: "yahoo",
            providerArticleId: "uuid-1",
            canonicalUrl: "https://example.com/apple-earnings",
            title: "Apple reports record quarterly earnings",
            publishedAt: new Date(),
        });
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        const result = await newsService.refreshNews("AAPL");

        expect(newsProvider.getNewsForTicker).toHaveBeenCalledTimes(1);
        expect(result.inserted).toBe(1);
        expect(result.merged).toBe(0);
    });

    it("propagates a provider timeout instead of silently swallowing it", async () => {
        newsProvider.getNewsForTicker.mockRejectedValue(new Error("Provider timed out"));

        await expect(newsService.refreshNews("AAPL")).rejects.toThrow("Provider timed out");
    });
});

describe("persistArticles edge cases (via refreshNews)", () => {
    it("does nothing and reports zero inserted/merged when the provider returns no usable articles", async () => {
        newsProvider.getNewsForTicker.mockResolvedValue([{ title: "No url or date - dropped by the normalizer" }]);

        const result = await newsService.refreshNews("AAPL");

        expect(NewsArticle.find).not.toHaveBeenCalled();
        expect(NewsArticle.create).not.toHaveBeenCalled();
        expect(result.inserted).toBe(0);
        expect(result.merged).toBe(0);
    });

    it("merges instead of failing when a concurrent refresh races on canonicalUrl's unique index", async () => {
        NewsArticle.find.mockReturnValue(chainable([]));
        const duplicateKeyError = new Error("E11000 duplicate key error");
        duplicateKeyError.code = 11000;
        NewsArticle.create.mockRejectedValue(duplicateKeyError);
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        const result = await newsService.refreshNews("AAPL");

        expect(NewsArticle.updateOne).toHaveBeenCalledWith(
            { canonicalUrl: "https://example.com/apple-earnings" },
            {
                $addToSet: { tickers: "AAPL" },
                $set: { category: expect.any(String), classificationConfidence: expect.stringMatching(/high|low/) },
            }
        );
        expect(result.inserted).toBe(0);
        expect(result.merged).toBe(1);
    });

    it("propagates a non-duplicate-key write error instead of swallowing it", async () => {
        NewsArticle.find.mockReturnValue(chainable([]));
        NewsArticle.create.mockRejectedValue(new Error("Validation failed"));
        newsProvider.getNewsForTicker.mockResolvedValue([YAHOO_RAW_ARTICLE]);

        await expect(newsService.refreshNews("AAPL")).rejects.toThrow("Validation failed");
    });
});

describe("getRecentArticlesForContext", () => {
    it("returns the most recent N stored articles for the AI context builder", async () => {
        const chain = chainable([{ title: "Recent article" }]);
        NewsArticle.find.mockReturnValue(chain);

        const result = await newsService.getRecentArticlesForContext("AAPL", 5);

        expect(chain.limit).toHaveBeenCalledWith(5);
        expect(result).toEqual([{ title: "Recent article" }]);
    });

    it("never throws - returns an empty array when the DB read fails", async () => {
        NewsArticle.find.mockImplementation(() => {
            throw new Error("DB unavailable");
        });

        await expect(newsService.getRecentArticlesForContext("AAPL", 5)).resolves.toEqual([]);
    });
});

describe("getCategorySummary", () => {
    it("returns category counts and a total", async () => {
        NewsArticle.aggregate.mockResolvedValue([
            { _id: "Earnings", count: 3 },
            { _id: "Other", count: 1 },
        ]);

        const result = await newsService.getCategorySummary("AAPL");

        expect(result.categories).toEqual([
            { category: "Earnings", count: 3 },
            { category: "Other", count: 1 },
        ]);
        expect(result.total).toBe(4);
    });
});

describe("getLatestStoredArticle", () => {
    it("never throws - returns null when the DB read fails", async () => {
        NewsArticle.findOne.mockImplementation(() => {
            throw new Error("DB unavailable");
        });

        await expect(newsService.getLatestStoredArticle("AAPL")).resolves.toBeNull();
    });

    it("returns the most recent stored article", async () => {
        NewsArticle.findOne.mockReturnValue(chainable({ title: "Latest article" }));

        const result = await newsService.getLatestStoredArticle("AAPL");

        expect(result).toEqual({ title: "Latest article" });
    });
});

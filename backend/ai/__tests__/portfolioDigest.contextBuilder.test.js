jest.mock("../../portfolio/portfolio.service", () => ({ getPortfolio: jest.fn() }));
jest.mock("../../news/news.service", () => ({ getRecentArticlesForContext: jest.fn() }));

const portfolioService = require("../../portfolio/portfolio.service");
const newsService = require("../../news/news.service");
const { buildDigestContext } = require("../portfolioDigest.contextBuilder");

afterEach(() => {
    jest.clearAllMocks();
});

describe("buildDigestContext", () => {
    it("reports hasHoldings:false and skips news lookups when the portfolio is empty", async () => {
        portfolioService.getPortfolio.mockResolvedValue({ holdings: [], summary: {} });

        const context = await buildDigestContext("user1");

        expect(context).toEqual({ hasHoldings: false, summary: null, holdings: [] });
        expect(newsService.getRecentArticlesForContext).not.toHaveBeenCalled();
    });

    it("nets multiple lots of the same ticker into one row", async () => {
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [
                { ticker: "AAPL", currentValueUSD: 1000, weightPercent: 40, returnPercent: 10 },
                { ticker: "AAPL", currentValueUSD: 500, weightPercent: 20, returnPercent: 5 },
            ],
            summary: { totalCurrentValue: 1500 },
        });
        newsService.getRecentArticlesForContext.mockResolvedValue([]);

        const context = await buildDigestContext("user1");

        expect(context.holdings).toHaveLength(1);
        expect(newsService.getRecentArticlesForContext).toHaveBeenCalledTimes(1);
    });

    it("sorts holdings by value descending and caps at MAX_HOLDINGS_IN_DIGEST", async () => {
        const { MAX_HOLDINGS_IN_DIGEST } = require("../portfolioDigest.contextBuilder");
        const holdings = Array.from({ length: MAX_HOLDINGS_IN_DIGEST + 5 }, (_, i) => ({
            ticker: `T${i}`,
            currentValueUSD: i,
            weightPercent: 1,
            returnPercent: 1,
        }));
        portfolioService.getPortfolio.mockResolvedValue({ holdings, summary: {} });
        newsService.getRecentArticlesForContext.mockResolvedValue([]);

        const context = await buildDigestContext("user1");

        expect(context.holdings).toHaveLength(MAX_HOLDINGS_IN_DIGEST);
        expect(context.holdings[0].ticker).toBe(`T${holdings.length - 1}`); // highest value first
    });

    it("includes recent news title/publishedAt/url per holding, from the DB-only helper", async () => {
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [{ ticker: "AAPL", currentValueUSD: 1000, weightPercent: 100, returnPercent: 5 }],
            summary: {},
        });
        newsService.getRecentArticlesForContext.mockResolvedValue([
            { title: "Apple reports earnings", publishedAt: "2026-08-01T00:00:00.000Z", url: "https://example.com/a", description: "ignored" },
        ]);

        const context = await buildDigestContext("user1");

        expect(context.holdings[0].recentNews).toEqual([
            { title: "Apple reports earnings", publishedAt: "2026-08-01T00:00:00.000Z", url: "https://example.com/a" },
        ]);
        expect(newsService.getRecentArticlesForContext).toHaveBeenCalledWith("AAPL", 2);
    });

    it("includes only the summarized subset of summary fields", async () => {
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [{ ticker: "AAPL", currentValueUSD: 1000, weightPercent: 100, returnPercent: 5 }],
            summary: {
                totalCurrentValue: 1000,
                totalGainLoss: 50,
                totalReturnPercent: 5,
                bestPerformingHolding: { ticker: "AAPL" },
                worstPerformingHolding: { ticker: "AAPL" },
                numberOfHoldings: 1,
                unpricedHoldings: [],
            },
        });
        newsService.getRecentArticlesForContext.mockResolvedValue([]);

        const context = await buildDigestContext("user1");

        expect(Object.keys(context.summary).sort()).toEqual(
            ["totalCurrentValue", "totalGainLoss", "totalReturnPercent", "bestPerformingHolding", "worstPerformingHolding"].sort()
        );
    });
});

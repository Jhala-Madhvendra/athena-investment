jest.mock("../../financials/financials.service", () => ({ getFinancialStatementsByTicker: jest.fn() }));
jest.mock("../../news/news.service", () => ({ getNews: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getHistoricalPrices: jest.fn() }));

const financialsService = require("../../financials/financials.service");
const newsService = require("../../news/news.service");
const marketService = require("../../market/market.service");
const earningsService = require("../earnings.service");

const DEFAULT_INCOME_STATEMENT = {
    totalRevenue: 1000,
    operatingIncome: 300,
    netIncome: 200,
    basicEPS: 2.5,
    dilutedEPS: 2.4,
};
const DEFAULT_BALANCE_SHEET = { totalDebt: 300, totalStockholderEquity: 400, totalAssets: 1200, cashAndCashEquivalents: 100 };
const DEFAULT_CASH_FLOW = { operatingCashFlow: 240, capitalExpenditure: -60 };

const buildStatement = (year, overrides = {}) => ({
    year,
    ticker: "AAPL",
    source: "Yahoo Finance",
    incomeStatement: { ...DEFAULT_INCOME_STATEMENT, ...(overrides.incomeStatement || {}) },
    balanceSheet: { ...DEFAULT_BALANCE_SHEET, ...(overrides.balanceSheet || {}) },
    cashFlow: { ...DEFAULT_CASH_FLOW, ...(overrides.cashFlow || {}) },
});

beforeEach(() => {
    jest.clearAllMocks();
    newsService.getNews.mockResolvedValue({ articles: [] });
    marketService.getHistoricalPrices.mockResolvedValue([]);
});

describe("getEarningsIntelligence", () => {
    it("throws NoFinancialStatementsError (404) when no statements are stored", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([]);

        await expect(earningsService.getEarningsIntelligence("AAPL")).rejects.toMatchObject({
            name: "NoFinancialStatementsError",
            statusCode: 404,
        });
    });

    it("propagates CompanyNotFoundError from financialsService unchanged", async () => {
        class CompanyNotFoundError extends Error {
            constructor() {
                super("Company AAPL was not found.");
                this.statusCode = 404;
            }
        }
        financialsService.getFinancialStatementsByTicker.mockRejectedValue(new CompanyNotFoundError());

        await expect(earningsService.getEarningsIntelligence("AAPL")).rejects.toThrow("Company AAPL was not found.");
    });

    it("returns a full earnings payload with two periods of statements", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([
            buildStatement(2026, { incomeStatement: { totalRevenue: 1200, operatingIncome: 360, netIncome: 240 } }),
            buildStatement(2025),
        ]);
        newsService.getNews.mockResolvedValue({
            articles: [{ title: "AAPL beats estimates", description: null, source: "Yahoo", publishedAt: "2026-02-01", category: "Earnings", url: "https://example.com/a" }],
        });

        const result = await earningsService.getEarningsIntelligence("aapl");

        expect(result.ticker).toBe("AAPL");
        expect(result.period.latestPeriod).toBe("FY2026");
        expect(result.period.previousPeriod).toBe("FY2025");
        expect(result.period.comparisonAvailable).toBe(true);
        expect(result.growth.revenue.percentChange).toBe(20);
        expect(result.signals.growth.revenue).toBe("Improving");
        expect(result.relatedNews).toHaveLength(1);
        expect(result.relatedNews[0].title).toBe("AAPL beats estimates");
        expect(result.marketReaction.available).toBe(false);
        expect(newsService.getNews).toHaveBeenCalledWith("AAPL", { category: "Earnings", limit: 5 });
    });

    it("degrades gracefully to a single-period response with no comparison when only one statement exists", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([buildStatement(2026)]);

        const result = await earningsService.getEarningsIntelligence("AAPL");

        expect(result.period.comparisonAvailable).toBe(false);
        expect(result.growth.revenue.available).toBe(true);
        expect(result.growth.revenue.percentChange).toBeNull();
        expect(result.signals.growth.revenue).toBeNull();
    });

    it("returns an empty related-news list instead of failing when the News domain throws", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([buildStatement(2026), buildStatement(2025)]);
        newsService.getNews.mockRejectedValue(new Error("news provider down"));

        const result = await earningsService.getEarningsIntelligence("AAPL");

        expect(result.relatedNews).toEqual([]);
        expect(result.ticker).toBe("AAPL");
    });

    it("computes an available market reaction from the same Earnings news article used for relatedNews, plus market price history", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([buildStatement(2026), buildStatement(2025)]);
        newsService.getNews.mockResolvedValue({
            articles: [{ title: "AAPL beats estimates", publishedAt: "2026-02-01T00:00:00.000Z", category: "Earnings", url: "https://example.com/a" }],
        });
        marketService.getHistoricalPrices.mockResolvedValue([
            { date: "2026-01-30", close: 100 },
            { date: "2026-02-02", close: 110 },
        ]);

        const result = await earningsService.getEarningsIntelligence("AAPL");

        expect(marketService.getHistoricalPrices).toHaveBeenCalledWith("AAPL", "5y");
        expect(result.marketReaction.available).toBe(true);
        expect(result.marketReaction.oneDayReturnPercent).toBe(10);
        expect(result.dataFreshness.marketObservationDate).toBe("2026-02-02");
    });

    it("degrades to an unavailable market reaction instead of failing the whole response when market.service throws", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([buildStatement(2026), buildStatement(2025)]);
        newsService.getNews.mockResolvedValue({
            articles: [{ title: "AAPL beats estimates", publishedAt: "2026-02-01T00:00:00.000Z", category: "Earnings", url: "https://example.com/a" }],
        });
        marketService.getHistoricalPrices.mockRejectedValue(new Error("market provider down"));

        const result = await earningsService.getEarningsIntelligence("AAPL");

        expect(result.marketReaction.available).toBe(false);
        expect(result.ticker).toBe("AAPL");
    });
});

jest.mock("../alert.model", () => ({ create: jest.fn() }));
jest.mock("../portfolioAlertSnapshot.model", () => ({ find: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock("../../watchlist/watchlist.model", () => ({ findOne: jest.fn() }));
jest.mock("../../market/market.service", () => ({ getHistoricalPrices: jest.fn() }));
jest.mock("../../financials/financials.service", () => ({ getFinancialStatementsByTicker: jest.fn() }));
jest.mock("../../news/news.service", () => ({ getImportantArticlesSince: jest.fn() }));
jest.mock("../../portfolio/portfolio.service", () => ({ getPortfolio: jest.fn() }));
jest.mock("../alert.engine", () => ({
    evaluateMarketRules: jest.fn(() => []),
    evaluateFinancialRules: jest.fn(() => []),
    evaluateBusinessRules: jest.fn(() => []),
    evaluateNewsRules: jest.fn(() => []),
    evaluatePortfolioRules: jest.fn(() => ({ candidates: [], snapshotUpdates: [] })),
}));
jest.mock("../alert.deduplicator", () => ({ insertIfNew: jest.fn() }));
jest.mock("../alert.repository");

const Alert = require("../alert.model");
const PortfolioAlertSnapshot = require("../portfolioAlertSnapshot.model");
const Watchlist = require("../../watchlist/watchlist.model");
const marketService = require("../../market/market.service");
const financialsService = require("../../financials/financials.service");
const newsService = require("../../news/news.service");
const portfolioService = require("../../portfolio/portfolio.service");
const engine = require("../alert.engine");
const dedup = require("../alert.deduplicator");
const repository = require("../alert.repository");
const alertService = require("../alert.service");

const emptyPortfolio = { holdings: [], summary: { totalCurrentValue: 0 } };
const chainableFindOne = (doc) => ({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(doc) })) });
const chainableFind = (docs) => ({ lean: jest.fn().mockResolvedValue(docs) });

beforeEach(() => {
    jest.clearAllMocks();
    marketService.getHistoricalPrices.mockResolvedValue([]);
    financialsService.getFinancialStatementsByTicker.mockResolvedValue([]);
    newsService.getImportantArticlesSince.mockResolvedValue([]);
    portfolioService.getPortfolio.mockResolvedValue(emptyPortfolio);
    Watchlist.findOne.mockReturnValue(chainableFindOne(null));
    PortfolioAlertSnapshot.find.mockReturnValue(chainableFind([]));
    PortfolioAlertSnapshot.findOneAndUpdate.mockResolvedValue({});
});

describe("runMonitoring - tracked ticker resolution", () => {
    it("unions Watchlist and Portfolio tickers, deduplicating a ticker present in both", async () => {
        Watchlist.findOne.mockReturnValue(chainableFindOne({ companies: [{ ticker: "AAPL" }, { ticker: "MSFT" }] }));
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [{ ticker: "AAPL" }, { ticker: "GOOG" }],
            summary: { totalCurrentValue: 100 },
        });

        const result = await alertService.runMonitoring("user1");

        expect(result.tickersMonitored.sort()).toEqual(["AAPL", "GOOG", "MSFT"]);
        expect(marketService.getHistoricalPrices).toHaveBeenCalledTimes(3);
    });

    it("returns no tickers and creates no alerts when neither Watchlist nor Portfolio has anything tracked", async () => {
        const result = await alertService.runMonitoring("user1");

        expect(result.tickersMonitored).toEqual([]);
        expect(result.alertsCreated).toBe(0);
        expect(marketService.getHistoricalPrices).not.toHaveBeenCalled();
    });
});

describe("runMonitoring - per-ticker degradation", () => {
    it("continues monitoring other tickers when one ticker's evaluation throws entirely", async () => {
        Watchlist.findOne.mockReturnValue(chainableFindOne({ companies: [{ ticker: "BADCO" }, { ticker: "AAPL" }] }));
        marketService.getHistoricalPrices.mockImplementation(async (ticker) => {
            if (ticker === "BADCO") throw new Error("provider is down");
            return [];
        });

        await expect(alertService.runMonitoring("user1")).resolves.toBeDefined();
        // Both tickers still got a chance to run their other data sources.
        expect(financialsService.getFinancialStatementsByTicker).toHaveBeenCalledWith("BADCO");
        expect(financialsService.getFinancialStatementsByTicker).toHaveBeenCalledWith("AAPL");
    });

    it("degrades a single failing data source to an empty list rather than failing the whole ticker", async () => {
        Watchlist.findOne.mockReturnValue(chainableFindOne({ companies: [{ ticker: "AAPL" }] }));
        financialsService.getFinancialStatementsByTicker.mockRejectedValue(new Error("no financials imported yet"));

        await alertService.runMonitoring("user1");

        expect(engine.evaluateFinancialRules).toHaveBeenCalledWith({ ticker: "AAPL", statements: [] });
    });
});

describe("runMonitoring - candidate persistence and dedup", () => {
    it("inserts every candidate the engine returns and counts only the ones that weren't duplicates", async () => {
        Watchlist.findOne.mockReturnValue(chainableFindOne({ companies: [{ ticker: "AAPL" }] }));
        engine.evaluateMarketRules.mockReturnValue([{ rule: "PRICE_MOVE_1D", ticker: "AAPL" }]);
        engine.evaluateNewsRules.mockReturnValue([{ rule: "IMPORTANT_NEWS_EVENT", ticker: "AAPL" }]);
        dedup.insertIfNew
            .mockResolvedValueOnce({ _id: "a1" }) // PRICE_MOVE_1D - genuinely new
            .mockResolvedValueOnce(null); // IMPORTANT_NEWS_EVENT - already alerted (dedup hit)

        const result = await alertService.runMonitoring("user1");

        expect(dedup.insertIfNew).toHaveBeenCalledTimes(2);
        expect(result.alertsCreated).toBe(1);
        expect(result.alerts).toEqual([{ _id: "a1" }]);
    });

    it("attaches the calling user's id to every candidate before inserting", async () => {
        Watchlist.findOne.mockReturnValue(chainableFindOne({ companies: [{ ticker: "AAPL" }] }));
        engine.evaluateMarketRules.mockReturnValue([{ rule: "PRICE_MOVE_1D", ticker: "AAPL" }]);
        dedup.insertIfNew.mockResolvedValue({ _id: "a1" });

        await alertService.runMonitoring("user42");

        expect(dedup.insertIfNew).toHaveBeenCalledWith(Alert, expect.objectContaining({ userId: "user42", rule: "PRICE_MOVE_1D" }));
    });
});

describe("runMonitoring - portfolio snapshot persistence", () => {
    it("upserts a PortfolioAlertSnapshot for every snapshot update the engine returns", async () => {
        portfolioService.getPortfolio.mockResolvedValue({
            holdings: [{ ticker: "AAPL", currentValue: 1000 }],
            summary: { totalCurrentValue: 1000 },
        });
        engine.evaluatePortfolioRules.mockReturnValue({
            candidates: [],
            snapshotUpdates: [{ ticker: "AAPL", currentValue: 1000, returnPercent: 10, weightPercent: 100 }],
        });

        await alertService.runMonitoring("user1");

        expect(PortfolioAlertSnapshot.findOneAndUpdate).toHaveBeenCalledWith(
            { userId: "user1", ticker: "AAPL" },
            expect.objectContaining({ currentValue: 1000, returnPercent: 10, weightPercent: 100 }),
            { upsert: true }
        );
    });

    it("does not query PortfolioAlertSnapshot at all when the user has no holdings", async () => {
        await alertService.runMonitoring("user1");

        expect(PortfolioAlertSnapshot.find).not.toHaveBeenCalled();
    });
});

describe("read/dismiss lifecycle", () => {
    it("markAsRead throws AlertNotFoundError when the repository finds nothing", async () => {
        repository.markRead.mockResolvedValue(null);

        await expect(alertService.markAsRead("user1", "missing-id")).rejects.toThrow(alertService.AlertNotFoundError);
    });

    it("markAsRead returns the updated alert on success", async () => {
        repository.markRead.mockResolvedValue({ _id: "a1", isRead: true });

        await expect(alertService.markAsRead("user1", "a1")).resolves.toEqual({ _id: "a1", isRead: true });
    });

    it("dismissAlert throws AlertNotFoundError when the repository finds nothing", async () => {
        repository.dismiss.mockResolvedValue(null);

        await expect(alertService.dismissAlert("user1", "missing-id")).rejects.toThrow(alertService.AlertNotFoundError);
    });
});

describe("read-side delegation", () => {
    it("getAlerts returns the repository's alerts/total alongside the requested page/limit", async () => {
        repository.findAlerts.mockResolvedValue({ alerts: [{ _id: "a1" }], total: 1 });

        const result = await alertService.getAlerts("user1", { page: 2, limit: 10 });

        expect(result).toEqual({ alerts: [{ _id: "a1" }], total: 1, page: 2, limit: 10 });
    });

    it("getUnreadCount wraps the repository's count in a {count} envelope", async () => {
        repository.countUnread.mockResolvedValue(7);

        await expect(alertService.getUnreadCount("user1")).resolves.toEqual({ count: 7 });
    });

    it("getAlertCountsByTicker delegates straight to the repository", async () => {
        const map = new Map([["AAPL", 3]]);
        repository.countByTicker.mockResolvedValue(map);

        await expect(alertService.getAlertCountsByTicker("user1", ["AAPL"])).resolves.toBe(map);
        expect(repository.countByTicker).toHaveBeenCalledWith("user1", ["AAPL"]);
    });
});

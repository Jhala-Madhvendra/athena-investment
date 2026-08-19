jest.mock("../transaction.model", () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({ getHistoricalPrices: jest.fn() }));

const Transaction = require("../transaction.model");
const marketService = require("../../market/market.service");
const portfolioHistoryService = require("../portfolioHistory.service");

const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });
const chainableLean = (docs) => ({ lean: jest.fn(() => Promise.resolve(docs)) });
const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

const bar = (date, close) => ({ date, close });

afterEach(() => {
    jest.clearAllMocks();
});

describe("getReconstructionStatus", () => {
    it("reports no ledger for a user with zero transactions", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean(null));
        Transaction.countDocuments.mockResolvedValue(0);

        const result = await portfolioHistoryService.getReconstructionStatus("user1");

        expect(result).toEqual({ hasTransactions: false, analyticsStartDate: null, transactionCount: 0 });
    });

    it("reports the earliest transaction date as analyticsStartDate", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-03-15T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(4);

        const result = await portfolioHistoryService.getReconstructionStatus("user1");

        expect(result).toEqual({ hasTransactions: true, analyticsStartDate: "2025-03-15", transactionCount: 4 });
    });
});

describe("getHoldingsAt", () => {
    it("returns hasTransactionHistory:false (not a confirmed-empty portfolio) when the user has no ledger", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean(null));
        Transaction.countDocuments.mockResolvedValue(0);

        const result = await portfolioHistoryService.getHoldingsAt("user1", "2025-06-01");

        expect(result).toEqual({
            asOfDate: "2025-06-01",
            holdings: {},
            hasTransactionHistory: false,
            analyticsStartDate: null,
            beforeAnalyticsStartDate: null,
        });
    });

    it("reconstructs holdings and flags a date before the ledger began", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-03-01T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(1);
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-03-01T00:00:00Z"), createdAt: new Date("2025-03-01") }])
        );

        const beforeLedger = await portfolioHistoryService.getHoldingsAt("user1", "2025-01-01");
        expect(beforeLedger.holdings).toEqual({});
        expect(beforeLedger.beforeAnalyticsStartDate).toBe(true);

        const afterPurchase = await portfolioHistoryService.getHoldingsAt("user1", "2025-06-01");
        expect(afterPurchase.holdings).toEqual({ AAPL: 10 });
        expect(afterPurchase.beforeAnalyticsStartDate).toBe(false);
    });
});

describe("buildTransactionAwareReturnSeries", () => {
    it("is unavailable when the user has no transaction ledger", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean(null));
        Transaction.countDocuments.mockResolvedValue(0);

        const result = await portfolioHistoryService.buildTransactionAwareReturnSeries("user1", "1y");

        expect(result.available).toBe(false);
        expect(result.reason).toMatch(/No transaction history/);
        expect(marketService.getHistoricalPrices).not.toHaveBeenCalled();
    });

    it("computes a clean daily return for a period with no transactions and full price coverage", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-01-01T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(1);
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01T00:00:00Z"), createdAt: new Date("2025-01-01") }])
        );
        marketService.getHistoricalPrices.mockResolvedValue([bar("2025-01-01", 100), bar("2025-01-02", 110)]);

        const result = await portfolioHistoryService.buildTransactionAwareReturnSeries("user1", "1y");

        expect(result.available).toBe(true);
        expect(result.series).toHaveLength(1);
        expect(result.series[0].date).toBe("2025-01-02");
        expect(result.series[0].return).toBeCloseTo(0.1, 9);
        expect(result.excludedTransactionDays).toBe(0);
        expect(result.excludedMissingPriceDays).toBe(0);
    });

    it("excludes a day whose holdings changed (a transaction occurred) instead of computing a distorted return", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-01-01T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(2);
        Transaction.find.mockReturnValue(
            chainableLean([
                { _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01T00:00:00Z"), createdAt: new Date("2025-01-01") },
                { _id: "2", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: new Date("2025-01-02T00:00:00Z"), createdAt: new Date("2025-01-02") },
            ])
        );
        // Jan 1 -> Jan 2 spans the second BUY, so that pair must be excluded even though both dates have prices.
        marketService.getHistoricalPrices.mockResolvedValue([bar("2025-01-01", 100), bar("2025-01-02", 100), bar("2025-01-03", 105)]);

        const result = await portfolioHistoryService.buildTransactionAwareReturnSeries("user1", "1y");

        expect(result.excludedTransactionDays).toBe(1);
        expect(result.series.find((entry) => entry.date === "2025-01-02")).toBeUndefined();
        expect(result.series).toHaveLength(1);
        expect(result.series[0].date).toBe("2025-01-03");
        expect(result.series[0].return).toBeCloseTo(0.05, 9);
    });

    it("excludes a date pair where a held ticker's price is missing on one side, without dropping the rest of the series", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-01-01T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(2);
        Transaction.find.mockReturnValue(
            chainableLean([
                { _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01T00:00:00Z"), createdAt: new Date("2025-01-01T00:00:00Z") },
                { _id: "2", ticker: "MSFT", type: "BUY", quantity: 5, transactionDate: new Date("2025-01-01T00:00:00Z"), createdAt: new Date("2025-01-01T00:00:01Z") },
            ])
        );
        marketService.getHistoricalPrices.mockImplementation((ticker) =>
            Promise.resolve(
                ticker === "AAPL"
                    ? [bar("2025-01-01", 100), bar("2025-01-02", 105), bar("2025-01-03", 110)]
                    : [bar("2025-01-01", 50), bar("2025-01-02", 52)] // MSFT has no bar for Jan 3
            )
        );

        const result = await portfolioHistoryService.buildTransactionAwareReturnSeries("user1", "1y");

        // Jan1->Jan2: both tickers priced on both days (holdings constant, no txn since Jan1) - usable.
        expect(result.series).toHaveLength(1);
        expect(result.series[0].date).toBe("2025-01-02");
        expect(result.series[0].return).toBeCloseTo(1310 / 1250 - 1, 9);
        // Jan2->Jan3: MSFT has no Jan 3 price - excluded, not guessed at.
        expect(result.excludedMissingPriceDays).toBe(1);
        expect(result.excludedTransactionDays).toBe(0);
    });

    it("flags windowClipped when priced data reaches further back than the ledger's first transaction", async () => {
        Transaction.findOne.mockReturnValue(chainableSortLean({ transactionDate: new Date("2025-02-01T00:00:00Z") }));
        Transaction.countDocuments.mockResolvedValue(1);
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-02-01T00:00:00Z"), createdAt: new Date("2025-02-01") }])
        );
        marketService.getHistoricalPrices.mockResolvedValue([bar("2025-01-01", 90), bar("2025-02-01", 100), bar("2025-02-02", 101)]);

        const result = await portfolioHistoryService.buildTransactionAwareReturnSeries("user1", "1y");

        expect(result.windowClipped).toBe(true);
        expect(result.series.some((entry) => entry.date < "2025-02-01")).toBe(false);
    });
});

describe("getTransactionsVersion", () => {
    it("returns a stable string for no transactions", async () => {
        Transaction.find.mockReturnValue(chainableSelectLean([]));
        await expect(portfolioHistoryService.getTransactionsVersion("user1")).resolves.toBe("none");
    });

    it("changes when a transaction's fields change", async () => {
        Transaction.find.mockReturnValue(
            chainableSelectLean([{ ticker: "AAPL", type: "BUY", quantity: 10, price: 100, transactionDate: new Date("2025-01-01"), updatedAt: new Date("2025-01-01") }])
        );
        const v1 = await portfolioHistoryService.getTransactionsVersion("user1");

        Transaction.find.mockReturnValue(
            chainableSelectLean([{ ticker: "AAPL", type: "BUY", quantity: 20, price: 100, transactionDate: new Date("2025-01-01"), updatedAt: new Date("2025-01-02") }])
        );
        const v2 = await portfolioHistoryService.getTransactionsVersion("user1");

        expect(v1).not.toBe(v2);
    });
});

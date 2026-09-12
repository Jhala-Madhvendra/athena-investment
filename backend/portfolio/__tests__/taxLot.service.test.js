jest.mock("../transaction.service", () => ({ getTransactions: jest.fn() }));
jest.mock("../portfolio.service", () => ({ fetchQuotesByTicker: jest.fn() }));

const transactionService = require("../transaction.service");
const portfolioService = require("../portfolio.service");
const taxLotService = require("../taxLot.service");

const buy = (ticker, date, price, quantity) => ({ ticker, type: "BUY", price, quantity, transactionDate: new Date(date) });
const sell = (ticker, date, price, quantity) => ({ ticker, type: "SELL", price, quantity, transactionDate: new Date(date) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("getRealizedGains", () => {
    it("groups transactions by ticker and FIFO-matches each independently", async () => {
        transactionService.getTransactions.mockResolvedValue([
            buy("AAPL", "2025-01-01", 100, 10),
            sell("AAPL", "2025-06-01", 150, 10),
            buy("MSFT", "2025-01-01", 200, 5),
            sell("MSFT", "2025-06-01", 180, 5),
        ]);

        const result = await taxLotService.getRealizedGains("user1", {});

        expect(result.realizedLots).toHaveLength(2);
        expect(result.summary.totalRealizedGain).toBe(500 - 100); // AAPL +500, MSFT -100
    });

    it("passes ticker and portfolioId through to transactionService.getTransactions", async () => {
        transactionService.getTransactions.mockResolvedValue([]);

        await taxLotService.getRealizedGains("user1", { ticker: "AAPL", portfolioId: "acct-2" });

        expect(transactionService.getTransactions).toHaveBeenCalledWith("user1", { ticker: "AAPL", portfolioId: "acct-2" });
    });

    it("filters realized lots to a given tax year by sell date", async () => {
        transactionService.getTransactions.mockResolvedValue([
            buy("AAPL", "2024-01-01", 100, 5),
            sell("AAPL", "2024-06-01", 150, 5), // 2024
            buy("AAPL", "2025-01-01", 100, 5),
            sell("AAPL", "2025-06-01", 150, 5), // 2025
        ]);

        const result = await taxLotService.getRealizedGains("user1", { taxYear: 2025 });

        expect(result.realizedLots).toHaveLength(1);
        expect(new Date(result.realizedLots[0].sellDate).getUTCFullYear()).toBe(2025);
    });

    it("separates short-term and long-term gains in the summary", async () => {
        transactionService.getTransactions.mockResolvedValue([
            buy("AAPL", "2023-01-01", 100, 5),
            sell("AAPL", "2025-01-02", 150, 5), // long-term, +250
            buy("MSFT", "2025-01-01", 100, 5),
            sell("MSFT", "2025-03-01", 110, 5), // short-term, +50
        ]);

        const result = await taxLotService.getRealizedGains("user1", {});

        expect(result.summary.longTermGain).toBe(250);
        expect(result.summary.shortTermGain).toBe(50);
    });

    it("returns an empty result when there are no transactions", async () => {
        transactionService.getTransactions.mockResolvedValue([]);

        const result = await taxLotService.getRealizedGains("user1", {});

        expect(result.realizedLots).toEqual([]);
        expect(result.summary.totalRealizedGain).toBe(0);
    });
});

describe("getOpenLots", () => {
    it("prices remaining open lots via portfolioService.fetchQuotesByTicker", async () => {
        transactionService.getTransactions.mockResolvedValue([buy("AAPL", "2025-01-01", 100, 10)]);
        portfolioService.fetchQuotesByTicker.mockResolvedValue(new Map([["AAPL", { price: 150, currency: "USD" }]]));

        const result = await taxLotService.getOpenLots("user1", {});

        expect(result.openLots).toHaveLength(1);
        expect(result.openLots[0]).toMatchObject({ quantityRemaining: 10, costBasis: 1000, currentPrice: 150, currentValue: 1500, unrealizedGainLoss: 500 });
    });

    it("skips the quote fetch entirely when there are no open lots", async () => {
        transactionService.getTransactions.mockResolvedValue([buy("AAPL", "2025-01-01", 100, 10), sell("AAPL", "2025-06-01", 150, 10)]);

        const result = await taxLotService.getOpenLots("user1", {});

        expect(result.openLots).toEqual([]);
        expect(portfolioService.fetchQuotesByTicker).not.toHaveBeenCalled();
    });

    it("degrades a lot gracefully when its price fetch fails", async () => {
        transactionService.getTransactions.mockResolvedValue([buy("ZZZZ", "2025-01-01", 100, 5)]);
        portfolioService.fetchQuotesByTicker.mockResolvedValue(new Map([["ZZZZ", { price: null, currency: null }]]));

        const result = await taxLotService.getOpenLots("user1", {});

        expect(result.openLots[0].currentValue).toBeNull();
        expect(result.openLots[0].unrealizedGainLoss).toBeNull();
    });
});

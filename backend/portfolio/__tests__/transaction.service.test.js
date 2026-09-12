jest.mock("../transaction.model", () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../portfolioAccount.service", () => ({
    resolveWritablePortfolioId: jest.fn(),
    ensureLegacyDataAssigned: jest.fn(),
}));

const Transaction = require("../transaction.model");
const marketService = require("../../market/market.service");
const portfolioAccountService = require("../portfolioAccount.service");
const transactionService = require("../transaction.service");

const chainableLean = (docs) => ({ lean: jest.fn(() => Promise.resolve(docs)) });
const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

beforeEach(() => {
    portfolioAccountService.resolveWritablePortfolioId.mockResolvedValue("default-account");
    portfolioAccountService.ensureLegacyDataAssigned.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("addTransaction", () => {
    it("throws TransactionValidationError for invalid input without touching the database", async () => {
        await expect(
            transactionService.addTransaction("user1", { ticker: "AAPL", type: "BUY", quantity: -1, price: 100, transactionDate: "2025-01-01" })
        ).rejects.toThrow(transactionService.TransactionValidationError);
        expect(Transaction.find).not.toHaveBeenCalled();
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it("creates a BUY with no prior history", async () => {
        Transaction.find.mockReturnValue(chainableLean([]));
        Transaction.create.mockResolvedValue({ _id: "t1", ticker: "AAPL" });

        await transactionService.addTransaction("user1", { ticker: "AAPL", type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" });

        expect(Transaction.find).toHaveBeenCalledWith({ userId: "user1", ticker: "AAPL", portfolioId: "default-account" });
        expect(Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", ticker: "AAPL", type: "BUY", quantity: 10, price: 100, portfolioId: "default-account" })
        );
    });

    it("scopes the negative-holdings sibling check to the same account, not other accounts", async () => {
        Transaction.find.mockReturnValue(chainableLean([]));
        Transaction.create.mockResolvedValue({ _id: "t1" });
        portfolioAccountService.resolveWritablePortfolioId.mockResolvedValue("acct-2");

        await transactionService.addTransaction("user1", {
            ticker: "AAPL",
            type: "BUY",
            quantity: 10,
            price: 100,
            transactionDate: "2025-01-01",
            portfolioId: "acct-2",
        });

        expect(portfolioAccountService.resolveWritablePortfolioId).toHaveBeenCalledWith("user1", "acct-2");
        expect(Transaction.find).toHaveBeenCalledWith({ userId: "user1", ticker: "AAPL", portfolioId: "acct-2" });
    });

    it("allows a SELL that does not exceed prior holdings", async () => {
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") }])
        );
        Transaction.create.mockResolvedValue({ _id: "t2" });

        await transactionService.addTransaction("user1", { ticker: "AAPL", type: "SELL", quantity: 5, price: 100, transactionDate: "2025-02-01" });

        expect(Transaction.create).toHaveBeenCalled();
    });

    it("rejects a SELL that exceeds the quantity held at that point, without creating it", async () => {
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "1", ticker: "AAPL", type: "BUY", quantity: 5, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") }])
        );

        await expect(
            transactionService.addTransaction("user1", { ticker: "AAPL", type: "SELL", quantity: 8, price: 100, transactionDate: "2025-02-01" })
        ).rejects.toThrow(transactionService.InsufficientHoldingsError);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it("rejects a SELL for a ticker with no prior holdings at all", async () => {
        Transaction.find.mockReturnValue(chainableLean([]));

        await expect(
            transactionService.addTransaction("user1", { ticker: "ZZZZ", type: "SELL", quantity: 1, price: 100, transactionDate: "2025-01-01" })
        ).rejects.toThrow(transactionService.InsufficientHoldingsError);
    });
});

describe("updateTransaction", () => {
    it("throws TransactionValidationError for invalid input without touching the database", async () => {
        await expect(
            transactionService.updateTransaction("user1", "t1", { type: "BUY", quantity: 0, price: 100, transactionDate: "2025-01-01" })
        ).rejects.toThrow(transactionService.TransactionValidationError);
        expect(Transaction.findOne).not.toHaveBeenCalled();
    });

    it("throws TransactionNotFoundError when the transaction doesn't belong to the caller", async () => {
        Transaction.findOne.mockReturnValue(chainableLean(null));

        await expect(
            transactionService.updateTransaction("user1", "t1", { type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" })
        ).rejects.toThrow(transactionService.TransactionNotFoundError);
    });

    it("rejects an edit that would make a later transaction invalid, even though the edited row looks fine alone", async () => {
        // Existing: BUY 10 AAPL (Jan), SELL 8 AAPL (Mar) - valid today. Editing Jan's BUY down to 5 breaks Mar's SELL.
        Transaction.findOne.mockReturnValue(
            chainableLean({ _id: "jan", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") })
        );
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "mar", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: new Date("2025-03-01"), createdAt: new Date("2025-03-01") }])
        );

        await expect(
            transactionService.updateTransaction("user1", "jan", { type: "BUY", quantity: 5, price: 100, transactionDate: "2025-01-01" })
        ).rejects.toThrow(transactionService.InsufficientHoldingsError);
        expect(Transaction.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("applies a valid edit, scoped by {_id, userId}", async () => {
        Transaction.findOne.mockReturnValue(
            chainableLean({ _id: "t1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") })
        );
        Transaction.find.mockReturnValue(chainableLean([]));
        Transaction.findOneAndUpdate.mockResolvedValue({ _id: "t1", quantity: 20 });

        const result = await transactionService.updateTransaction("user1", "t1", { type: "BUY", quantity: 20, price: 100, transactionDate: "2025-01-01" });

        expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: "t1", userId: "user1" },
            expect.objectContaining({ quantity: 20 }),
            { new: true }
        );
        expect(result.quantity).toBe(20);
    });

    it("excludes the transaction being edited from its own siblings query", async () => {
        Transaction.findOne.mockReturnValue(
            chainableLean({ _id: "t1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") })
        );
        Transaction.find.mockReturnValue(chainableLean([]));
        Transaction.findOneAndUpdate.mockResolvedValue({ _id: "t1" });

        await transactionService.updateTransaction("user1", "t1", { type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" });

        expect(Transaction.find).toHaveBeenCalledWith({
            userId: "user1",
            ticker: "AAPL",
            portfolioId: undefined,
            _id: { $ne: "t1" },
        });
    });
});

describe("deleteTransaction", () => {
    it("throws TransactionNotFoundError when the transaction doesn't belong to the caller", async () => {
        Transaction.findOne.mockReturnValue(chainableLean(null));

        await expect(transactionService.deleteTransaction("user1", "t1")).rejects.toThrow(transactionService.TransactionNotFoundError);
    });

    it("rejects deleting a BUY that a later SELL depends on", async () => {
        Transaction.findOne.mockReturnValue(
            chainableLean({ _id: "jan", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") })
        );
        Transaction.find.mockReturnValue(
            chainableLean([{ _id: "mar", ticker: "AAPL", type: "SELL", quantity: 8, transactionDate: new Date("2025-03-01"), createdAt: new Date("2025-03-01") }])
        );

        await expect(transactionService.deleteTransaction("user1", "jan")).rejects.toThrow(transactionService.InsufficientHoldingsError);
        expect(Transaction.findOneAndDelete).not.toHaveBeenCalled();
    });

    it("deletes when the remaining timeline stays valid, scoped by {_id, userId}", async () => {
        Transaction.findOne.mockReturnValue(
            chainableLean({ _id: "t1", ticker: "AAPL", type: "BUY", quantity: 10, transactionDate: new Date("2025-01-01"), createdAt: new Date("2025-01-01") })
        );
        Transaction.find.mockReturnValue(chainableLean([]));
        Transaction.findOneAndDelete.mockResolvedValue({ _id: "t1" });

        await transactionService.deleteTransaction("user1", "t1");

        expect(Transaction.findOneAndDelete).toHaveBeenCalledWith({ _id: "t1", userId: "user1" });
    });
});

describe("getTransaction", () => {
    it("throws TransactionNotFoundError when not owned by the caller", async () => {
        Transaction.findOne.mockReturnValue(chainableLean(null));
        await expect(transactionService.getTransaction("user1", "t1")).rejects.toThrow(transactionService.TransactionNotFoundError);
    });

    it("returns the transaction when owned", async () => {
        Transaction.findOne.mockReturnValue(chainableLean({ _id: "t1", ticker: "AAPL" }));
        await expect(transactionService.getTransaction("user1", "t1")).resolves.toMatchObject({ _id: "t1" });
    });
});

describe("getTransactions", () => {
    it("lists all of a user's transactions sorted chronologically, enriched with each ticker's currency", async () => {
        Transaction.find.mockReturnValue(chainableSortLean([{ _id: "t1", ticker: "AAPL" }]));
        marketService.getCurrentMarketData.mockResolvedValue({ currency: "USD" });

        const result = await transactionService.getTransactions("user1", {});

        expect(Transaction.find).toHaveBeenCalledWith({ userId: "user1" });
        expect(result).toEqual([{ _id: "t1", ticker: "AAPL", currency: "USD" }]);
    });

    it("looks up currency once per unique ticker, not once per transaction", async () => {
        Transaction.find.mockReturnValue(
            chainableSortLean([
                { _id: "t1", ticker: "TCS.BO" },
                { _id: "t2", ticker: "TCS.BO" },
            ])
        );
        marketService.getCurrentMarketData.mockResolvedValue({ currency: "INR" });

        const result = await transactionService.getTransactions("user1", {});

        expect(marketService.getCurrentMarketData).toHaveBeenCalledTimes(1);
        expect(result.every((t) => t.currency === "INR")).toBe(true);
    });

    it("defaults currency to null when the market lookup fails", async () => {
        Transaction.find.mockReturnValue(chainableSortLean([{ _id: "t1", ticker: "ZZZZ" }]));
        marketService.getCurrentMarketData.mockRejectedValue(new Error("not found"));

        const result = await transactionService.getTransactions("user1", {});

        expect(result).toEqual([{ _id: "t1", ticker: "ZZZZ", currency: null }]);
    });

    it("skips the currency lookup entirely when there are no transactions", async () => {
        Transaction.find.mockReturnValue(chainableSortLean([]));

        const result = await transactionService.getTransactions("user1", {});

        expect(result).toEqual([]);
        expect(marketService.getCurrentMarketData).not.toHaveBeenCalled();
    });

    it("filters by ticker when provided", async () => {
        Transaction.find.mockReturnValue(chainableSortLean([]));

        await transactionService.getTransactions("user1", { ticker: "AAPL" });

        expect(Transaction.find).toHaveBeenCalledWith({ userId: "user1", ticker: "AAPL" });
    });

    it("filters by portfolioId when provided, aggregates across accounts when omitted", async () => {
        Transaction.find.mockReturnValue(chainableSortLean([]));

        await transactionService.getTransactions("user1", { portfolioId: "acct-2" });

        expect(Transaction.find).toHaveBeenCalledWith({ userId: "user1", portfolioId: "acct-2" });
    });
});

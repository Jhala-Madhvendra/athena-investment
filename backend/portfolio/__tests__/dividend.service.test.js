jest.mock("../dividend.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
}));
jest.mock("../portfolioAccount.service", () => ({
    resolveWritablePortfolioId: jest.fn(),
    ensureLegacyDataAssigned: jest.fn(),
}));

const Dividend = require("../dividend.model");
const portfolioAccountService = require("../portfolioAccount.service");
const dividendService = require("../dividend.service");

const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });
const chainableSelectLean = (docs) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

beforeEach(() => {
    portfolioAccountService.resolveWritablePortfolioId.mockResolvedValue("default-account");
    portfolioAccountService.ensureLegacyDataAssigned.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("addDividend", () => {
    it("throws DividendValidationError for invalid input without touching the database", async () => {
        await expect(
            dividendService.addDividend("user1", { ticker: "AAPL", amountPerShare: -1, shares: 10, payDate: "2025-01-01" })
        ).rejects.toThrow(dividendService.DividendValidationError);
        expect(Dividend.create).not.toHaveBeenCalled();
    });

    it("stamps the resolved portfolioId onto a new dividend", async () => {
        Dividend.create.mockResolvedValue({ _id: "d1" });

        await dividendService.addDividend("user1", { ticker: "AAPL", amountPerShare: 1, shares: 10, payDate: "2025-01-01" });

        expect(portfolioAccountService.resolveWritablePortfolioId).toHaveBeenCalledWith("user1", undefined);
        expect(Dividend.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", ticker: "AAPL", portfolioId: "default-account", totalAmount: 10 })
        );
    });
});

describe("updateDividend / deleteDividend", () => {
    it("throws DividendNotFoundError when updating a dividend not owned by the caller", async () => {
        Dividend.findOneAndUpdate.mockResolvedValue(null);

        await expect(
            dividendService.updateDividend("user1", "d1", { amountPerShare: 1, shares: 10, payDate: "2025-01-01" })
        ).rejects.toThrow(dividendService.DividendNotFoundError);
    });

    it("throws DividendNotFoundError when deleting a dividend not owned by the caller", async () => {
        Dividend.findOneAndDelete.mockResolvedValue(null);

        await expect(dividendService.deleteDividend("user1", "d1")).rejects.toThrow(dividendService.DividendNotFoundError);
    });

    it("deletes when owned, scoped by {_id, userId}", async () => {
        Dividend.findOneAndDelete.mockResolvedValue({ _id: "d1" });

        await dividendService.deleteDividend("user1", "d1");

        expect(Dividend.findOneAndDelete).toHaveBeenCalledWith({ _id: "d1", userId: "user1" });
    });
});

describe("getDividends", () => {
    it("backfills legacy data then lists a user's dividends, newest pay date first", async () => {
        Dividend.find.mockReturnValue(chainableSortLean([{ _id: "d1" }]));

        const result = await dividendService.getDividends("user1");

        expect(portfolioAccountService.ensureLegacyDataAssigned).toHaveBeenCalledWith("user1");
        expect(Dividend.find).toHaveBeenCalledWith({ userId: "user1" });
        expect(result).toEqual([{ _id: "d1" }]);
    });

    it("filters by ticker and portfolioId when provided", async () => {
        Dividend.find.mockReturnValue(chainableSortLean([]));

        await dividendService.getDividends("user1", { ticker: "AAPL", portfolioId: "acct-2" });

        expect(Dividend.find).toHaveBeenCalledWith({ userId: "user1", ticker: "AAPL", portfolioId: "acct-2" });
    });
});

describe("getTotalDividendIncome", () => {
    it("sums totalAmount across the user's dividends", async () => {
        Dividend.find.mockReturnValue(chainableSelectLean([{ totalAmount: 50 }, { totalAmount: 25 }]));

        const result = await dividendService.getTotalDividendIncome("user1");

        expect(result).toBe(75);
    });

    it("returns 0 when there are no dividends", async () => {
        Dividend.find.mockReturnValue(chainableSelectLean([]));

        const result = await dividendService.getTotalDividendIncome("user1");

        expect(result).toBe(0);
    });
});

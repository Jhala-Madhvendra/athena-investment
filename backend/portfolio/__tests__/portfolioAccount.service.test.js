jest.mock("../portfolioAccount.model", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    deleteOne: jest.fn(),
}));
jest.mock("../holding.model", () => ({ exists: jest.fn(), updateMany: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../transaction.model", () => ({ exists: jest.fn(), updateMany: jest.fn(), countDocuments: jest.fn() }));
jest.mock("../dividend.model", () => ({ exists: jest.fn(), updateMany: jest.fn(), countDocuments: jest.fn() }));

const PortfolioAccount = require("../portfolioAccount.model");
const Holding = require("../holding.model");
const Transaction = require("../transaction.model");
const Dividend = require("../dividend.model");
const portfolioAccountService = require("../portfolioAccount.service");

const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("getOrCreateDefaultAccount", () => {
    it("returns the existing default account without creating a second one", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-1", isDefault: true });

        const result = await portfolioAccountService.getOrCreateDefaultAccount("user1");

        expect(result._id).toBe("acct-1");
        expect(PortfolioAccount.create).not.toHaveBeenCalled();
    });

    it("creates a 'My Portfolio' default account on first access", async () => {
        PortfolioAccount.findOne.mockResolvedValue(null);
        PortfolioAccount.create.mockResolvedValue({ _id: "acct-new", name: "My Portfolio", isDefault: true });

        const result = await portfolioAccountService.getOrCreateDefaultAccount("user1");

        expect(PortfolioAccount.create).toHaveBeenCalledWith({ userId: "user1", name: "My Portfolio", isDefault: true });
        expect(result.name).toBe("My Portfolio");
    });
});

describe("resolveWritablePortfolioId", () => {
    it("falls back to the default account when no portfolioId is given", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "default-acct", isDefault: true });

        const result = await portfolioAccountService.resolveWritablePortfolioId("user1", null);

        expect(result).toBe("default-acct");
    });

    it("verifies ownership of an explicitly-given portfolioId", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-2" });

        const result = await portfolioAccountService.resolveWritablePortfolioId("user1", "acct-2");

        expect(PortfolioAccount.findOne).toHaveBeenCalledWith({ _id: "acct-2", userId: "user1" });
        expect(result).toBe("acct-2");
    });

    it("throws PortfolioAccountNotFoundError for an id that doesn't belong to the caller", async () => {
        PortfolioAccount.findOne.mockResolvedValue(null);

        await expect(portfolioAccountService.resolveWritablePortfolioId("user1", "not-mine")).rejects.toThrow(
            portfolioAccountService.PortfolioAccountNotFoundError
        );
    });
});

describe("ensureLegacyDataAssigned", () => {
    it("is a no-op when nothing is unassigned", async () => {
        Holding.exists.mockResolvedValue(null);
        Transaction.exists.mockResolvedValue(null);
        Dividend.exists.mockResolvedValue(null);

        await portfolioAccountService.ensureLegacyDataAssigned("user1");

        expect(PortfolioAccount.findOne).not.toHaveBeenCalled();
        expect(Holding.updateMany).not.toHaveBeenCalled();
    });

    it("backfills every legacy collection onto the default account when unassigned rows exist", async () => {
        Holding.exists.mockResolvedValue({ _id: "h1" });
        Transaction.exists.mockResolvedValue(null);
        Dividend.exists.mockResolvedValue(null);
        PortfolioAccount.findOne.mockResolvedValue({ _id: "default-acct", isDefault: true });
        Holding.updateMany.mockResolvedValue({});
        Transaction.updateMany.mockResolvedValue({});
        Dividend.updateMany.mockResolvedValue({});

        await portfolioAccountService.ensureLegacyDataAssigned("user1");

        expect(Holding.updateMany).toHaveBeenCalledWith({ userId: "user1", portfolioId: null }, { portfolioId: "default-acct" });
        expect(Transaction.updateMany).toHaveBeenCalledWith({ userId: "user1", portfolioId: null }, { portfolioId: "default-acct" });
        expect(Dividend.updateMany).toHaveBeenCalledWith({ userId: "user1", portfolioId: null }, { portfolioId: "default-acct" });
    });

    it("is idempotent - calling it again after backfill finds nothing left to assign", async () => {
        Holding.exists.mockResolvedValue(null);
        Transaction.exists.mockResolvedValue(null);
        Dividend.exists.mockResolvedValue(null);

        await portfolioAccountService.ensureLegacyDataAssigned("user1");
        await portfolioAccountService.ensureLegacyDataAssigned("user1");

        expect(Holding.updateMany).not.toHaveBeenCalled();
    });
});

describe("listAccounts", () => {
    it("backfills legacy data then returns the user's accounts sorted by creation", async () => {
        Holding.exists.mockResolvedValue(null);
        Transaction.exists.mockResolvedValue(null);
        Dividend.exists.mockResolvedValue(null);
        PortfolioAccount.find.mockReturnValue(chainableSortLean([{ _id: "acct-1", name: "My Portfolio" }]));

        const result = await portfolioAccountService.listAccounts("user1");

        expect(PortfolioAccount.find).toHaveBeenCalledWith({ userId: "user1" });
        expect(result).toEqual([{ _id: "acct-1", name: "My Portfolio" }]);
    });

    it("creates the default account and re-queries when a brand-new user has none yet (no legacy data to backfill either)", async () => {
        Holding.exists.mockResolvedValue(null);
        Transaction.exists.mockResolvedValue(null);
        Dividend.exists.mockResolvedValue(null);
        PortfolioAccount.find
            .mockReturnValueOnce(chainableSortLean([]))
            .mockReturnValueOnce(chainableSortLean([{ _id: "acct-new", name: "My Portfolio", isDefault: true }]));
        PortfolioAccount.findOne.mockResolvedValue(null);
        PortfolioAccount.create.mockResolvedValue({ _id: "acct-new", name: "My Portfolio", isDefault: true });

        const result = await portfolioAccountService.listAccounts("user1");

        expect(PortfolioAccount.create).toHaveBeenCalledWith({ userId: "user1", name: "My Portfolio", isDefault: true });
        expect(result).toEqual([{ _id: "acct-new", name: "My Portfolio", isDefault: true }]);
    });
});

describe("createAccount / renameAccount", () => {
    it("rejects an empty name without touching the database", async () => {
        await expect(portfolioAccountService.createAccount("user1", { name: "  " })).rejects.toThrow(
            portfolioAccountService.PortfolioAccountValidationError
        );
        expect(PortfolioAccount.create).not.toHaveBeenCalled();
    });

    it("creates a named, non-default account", async () => {
        PortfolioAccount.create.mockResolvedValue({ _id: "acct-2", name: "Retirement" });

        await portfolioAccountService.createAccount("user1", { name: "Retirement" });

        expect(PortfolioAccount.create).toHaveBeenCalledWith({ userId: "user1", name: "Retirement" });
    });

    it("throws PortfolioAccountNotFoundError when renaming an account not owned by the caller", async () => {
        PortfolioAccount.findOneAndUpdate.mockResolvedValue(null);

        await expect(portfolioAccountService.renameAccount("user1", "acct-2", { name: "New Name" })).rejects.toThrow(
            portfolioAccountService.PortfolioAccountNotFoundError
        );
    });
});

describe("deleteAccount", () => {
    it("throws PortfolioAccountNotFoundError when not owned by the caller", async () => {
        PortfolioAccount.findOne.mockResolvedValue(null);

        await expect(portfolioAccountService.deleteAccount("user1", "acct-2")).rejects.toThrow(
            portfolioAccountService.PortfolioAccountNotFoundError
        );
    });

    it("rejects deleting the default account", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-1", isDefault: true });
        PortfolioAccount.countDocuments.mockResolvedValue(2);

        await expect(portfolioAccountService.deleteAccount("user1", "acct-1")).rejects.toThrow(
            portfolioAccountService.PortfolioAccountValidationError
        );
        expect(PortfolioAccount.deleteOne).not.toHaveBeenCalled();
    });

    it("rejects deleting the user's only account", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-1", isDefault: false });
        PortfolioAccount.countDocuments.mockResolvedValue(1);

        await expect(portfolioAccountService.deleteAccount("user1", "acct-1")).rejects.toThrow(
            portfolioAccountService.PortfolioAccountValidationError
        );
    });

    it("rejects deleting an account that still has holdings/transactions/dividends", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-2", isDefault: false });
        PortfolioAccount.countDocuments.mockResolvedValue(2);
        Holding.countDocuments.mockResolvedValue(1);
        Transaction.countDocuments.mockResolvedValue(0);
        Dividend.countDocuments.mockResolvedValue(0);

        await expect(portfolioAccountService.deleteAccount("user1", "acct-2")).rejects.toThrow(
            portfolioAccountService.PortfolioAccountValidationError
        );
        expect(PortfolioAccount.deleteOne).not.toHaveBeenCalled();
    });

    it("deletes an empty, non-default account when it's not the user's only one", async () => {
        PortfolioAccount.findOne.mockResolvedValue({ _id: "acct-2", isDefault: false });
        PortfolioAccount.countDocuments.mockResolvedValue(2);
        Holding.countDocuments.mockResolvedValue(0);
        Transaction.countDocuments.mockResolvedValue(0);
        Dividend.countDocuments.mockResolvedValue(0);
        PortfolioAccount.deleteOne.mockResolvedValue({});

        await portfolioAccountService.deleteAccount("user1", "acct-2");

        expect(PortfolioAccount.deleteOne).toHaveBeenCalledWith({ _id: "acct-2", userId: "user1" });
    });
});

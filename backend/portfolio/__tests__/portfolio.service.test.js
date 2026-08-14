jest.mock("../holding.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));

const Holding = require("../holding.model");
const marketService = require("../../market/market.service");
const portfolioService = require("../portfolio.service");

afterEach(() => {
    jest.clearAllMocks();
});

describe("addHolding", () => {
    it("throws HoldingValidationError for invalid input without touching the database", async () => {
        await expect(
            portfolioService.addHolding("user1", { ticker: "AAPL", shares: -1, averagePurchasePrice: 100, purchaseDate: "2025-01-01" })
        ).rejects.toThrow(portfolioService.HoldingValidationError);
        expect(Holding.create).not.toHaveBeenCalled();
    });

    it("creates a holding scoped to the caller's userId", async () => {
        Holding.create.mockResolvedValue({ _id: "h1", ticker: "AAPL" });

        await portfolioService.addHolding("user1", {
            ticker: "AAPL",
            shares: 10,
            averagePurchasePrice: 100,
            purchaseDate: "2025-01-01",
        });

        expect(Holding.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", ticker: "AAPL", shares: 10, averagePurchasePrice: 100 })
        );
    });
});

describe("updateHolding", () => {
    it("throws HoldingValidationError for invalid input without touching the database", async () => {
        await expect(
            portfolioService.updateHolding("user1", "h1", { shares: 0, averagePurchasePrice: 100, purchaseDate: "2025-01-01" })
        ).rejects.toThrow(portfolioService.HoldingValidationError);
        expect(Holding.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("throws HoldingNotFoundError when the holding doesn't belong to the caller", async () => {
        Holding.findOneAndUpdate.mockResolvedValue(null);

        await expect(
            portfolioService.updateHolding("user1", "h1", { shares: 5, averagePurchasePrice: 100, purchaseDate: "2025-01-01" })
        ).rejects.toThrow(portfolioService.HoldingNotFoundError);
        expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: "h1", userId: "user1" },
            expect.anything(),
            expect.anything()
        );
    });

    it("updates and returns the holding when found and owned by the caller", async () => {
        Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", shares: 5 });

        const result = await portfolioService.updateHolding("user1", "h1", {
            shares: 5,
            averagePurchasePrice: 100,
            purchaseDate: "2025-01-01",
        });

        expect(result.shares).toBe(5);
    });
});

describe("deleteHolding", () => {
    it("throws HoldingNotFoundError when the holding doesn't belong to the caller", async () => {
        Holding.findOneAndDelete.mockResolvedValue(null);

        await expect(portfolioService.deleteHolding("user1", "h1")).rejects.toThrow(portfolioService.HoldingNotFoundError);
    });

    it("deletes when found and owned by the caller", async () => {
        Holding.findOneAndDelete.mockResolvedValue({ _id: "h1" });

        await expect(portfolioService.deleteHolding("user1", "h1")).resolves.toMatchObject({ _id: "h1" });
        expect(Holding.findOneAndDelete).toHaveBeenCalledWith({ _id: "h1", userId: "user1" });
    });
});

describe("getPortfolio", () => {
    const chainableFind = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

    it("returns an empty summary when the user has no holdings", async () => {
        Holding.find.mockReturnValue(chainableFind([]));

        const result = await portfolioService.getPortfolio("user1");

        expect(result.holdings).toEqual([]);
        expect(result.summary.numberOfHoldings).toBe(0);
        expect(marketService.getCurrentMarketData).not.toHaveBeenCalled();
    });

    it("fetches one live price per unique ticker, not per lot", async () => {
        Holding.find.mockReturnValue(
            chainableFind([
                { _id: "h1", ticker: "AAPL", shares: 5, averagePurchasePrice: 100 },
                { _id: "h2", ticker: "AAPL", shares: 5, averagePurchasePrice: 120 },
                { _id: "h3", ticker: "MSFT", shares: 2, averagePurchasePrice: 200 },
            ])
        );
        marketService.getCurrentMarketData.mockImplementation(async (ticker) => ({
            price: { current: ticker === "AAPL" ? 150 : 210 },
        }));

        const result = await portfolioService.getPortfolio("user1");

        expect(marketService.getCurrentMarketData).toHaveBeenCalledTimes(2);
        expect(result.holdings).toHaveLength(3);
        const aaplLot = result.holdings.find((h) => h._id === "h1");
        expect(aaplLot.currentValue).toBe(750);
    });

    it("degrades a lot gracefully when its price fetch fails", async () => {
        Holding.find.mockReturnValue(chainableFind([{ _id: "h1", ticker: "ZZZZ", shares: 5, averagePurchasePrice: 100 }]));
        marketService.getCurrentMarketData.mockRejectedValue(new Error("not found"));

        const result = await portfolioService.getPortfolio("user1");

        expect(result.holdings[0].currentValue).toBeNull();
        expect(result.holdings[0].priceUnavailable).toBe(true);
        expect(result.summary.unpricedHoldings).toEqual([{ ticker: "ZZZZ", costBasis: 500 }]);
    });
});

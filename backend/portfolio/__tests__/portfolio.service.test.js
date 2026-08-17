jest.mock("../holding.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../../market/providers/fxRate.provider", () => ({ getRateToUSD: jest.fn() }));

const Holding = require("../holding.model");
const marketService = require("../../market/market.service");
const fxRateProvider = require("../../market/providers/fxRate.provider");
const portfolioService = require("../portfolio.service");

beforeEach(() => {
    // Default every currency to USD parity unless a test overrides it - most existing tests aren't exercising FX behavior at all.
    fxRateProvider.getRateToUSD.mockResolvedValue(1);
});

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

    describe("multi-currency portfolios", () => {
        it("fetches one FX rate per unique currency, not per ticker", async () => {
            Holding.find.mockReturnValue(
                chainableFind([
                    { _id: "h1", ticker: "AAPL", shares: 10, averagePurchasePrice: 100 },
                    { _id: "h2", ticker: "MSFT", shares: 10, averagePurchasePrice: 100 }, // also USD - should dedupe with AAPL
                    { _id: "h3", ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 },
                ])
            );
            marketService.getCurrentMarketData.mockImplementation(async (ticker) =>
                ticker === "TCS.BO" ? { price: { current: 2315 }, currency: "INR" } : { price: { current: 150 }, currency: "USD" }
            );
            fxRateProvider.getRateToUSD.mockImplementation(async (currency) => (currency === "INR" ? 1 / 87.5 : 1));

            await portfolioService.getPortfolio("user1");

            expect(fxRateProvider.getRateToUSD).toHaveBeenCalledTimes(2); // once for USD, once for INR - not three times
            expect(fxRateProvider.getRateToUSD).toHaveBeenCalledWith("USD");
            expect(fxRateProvider.getRateToUSD).toHaveBeenCalledWith("INR");
        });

        it("computes portfolio totals and weightPercent from USD-normalized value, not the raw INR number", async () => {
            Holding.find.mockReturnValue(
                chainableFind([
                    { _id: "h1", ticker: "AAPL", shares: 10, averagePurchasePrice: 150 },
                    { _id: "h2", ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 },
                ])
            );
            marketService.getCurrentMarketData.mockImplementation(async (ticker) =>
                ticker === "TCS.BO" ? { price: { current: 2315 }, currency: "INR" } : { price: { current: 300 }, currency: "USD" }
            );
            fxRateProvider.getRateToUSD.mockImplementation(async (currency) => (currency === "INR" ? 1 / 87.5 : 1));

            const result = await portfolioService.getPortfolio("user1");

            // AAPL: 10 * 300 = $3,000. TCS.BO: 4 * 2315 = 9,260 INR ~= $105.83. NOT 3000 + 9260 = 12260.
            const expectedTotal = 3000 + 9260 / 87.5;
            expect(result.summary.totalCurrentValue).toBeCloseTo(expectedTotal, 5);

            const tcsHolding = result.holdings.find((h) => h.ticker === "TCS.BO");
            expect(tcsHolding.currentValue).toBe(9260); // native currency, unchanged for display
            expect(tcsHolding.weightPercent).toBeLessThan(5); // true USD weight is small, not ~75%
        });

        it("excludes a holding from USD totals when its exchange rate is unavailable, without dropping its native-currency row", async () => {
            Holding.find.mockReturnValue(
                chainableFind([
                    { _id: "h1", ticker: "AAPL", shares: 10, averagePurchasePrice: 150 },
                    { _id: "h2", ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 },
                ])
            );
            marketService.getCurrentMarketData.mockImplementation(async (ticker) =>
                ticker === "TCS.BO" ? { price: { current: 2315 }, currency: "INR" } : { price: { current: 300 }, currency: "USD" }
            );
            fxRateProvider.getRateToUSD.mockImplementation(async (currency) => (currency === "INR" ? null : 1));

            const result = await portfolioService.getPortfolio("user1");

            expect(result.summary.totalCurrentValue).toBe(3000); // AAPL only
            expect(result.summary.fxUnavailableHoldings).toEqual([{ ticker: "TCS.BO", currency: "INR", currentValue: 9260 }]);

            const tcsHolding = result.holdings.find((h) => h.ticker === "TCS.BO");
            expect(tcsHolding.currentValue).toBe(9260); // still shown natively
            expect(tcsHolding.weightPercent).toBeNull(); // excluded from weight, not assigned 0
        });
    });
});

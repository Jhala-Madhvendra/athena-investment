jest.mock("../paperPortfolio.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({ getCurrentMarketData: jest.fn() }));
jest.mock("../../market/providers/fxRate.provider", () => ({ getRateToUSD: jest.fn() }));

const PaperPortfolio = require("../paperPortfolio.model");
const marketService = require("../../market/market.service");
const fxRateProvider = require("../../market/providers/fxRate.provider");
const simulationService = require("../simulation.service");

const chainableSortSelectLean = (docs) => ({
    select: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) })),
});

beforeEach(() => {
    fxRateProvider.getRateToUSD.mockResolvedValue(1);
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("createPortfolio", () => {
    it("throws PaperPortfolioValidationError for an invalid request without touching the database", async () => {
        await expect(simulationService.createPortfolio("user1", { name: "" })).rejects.toThrow(
            simulationService.PaperPortfolioValidationError
        );
        expect(PaperPortfolio.create).not.toHaveBeenCalled();
    });

    it("creates a portfolio scoped to the caller's userId", async () => {
        PaperPortfolio.create.mockResolvedValue({ _id: "p1", name: "My what-if" });

        await simulationService.createPortfolio("user1", { name: "My what-if", holdings: [{ ticker: "aapl", shares: 5 }] });

        expect(PaperPortfolio.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", name: "My what-if", holdings: [{ ticker: "AAPL", shares: 5, assumedPrice: null }] })
        );
    });
});

describe("listPortfolios", () => {
    it("queries by userId", async () => {
        PaperPortfolio.find.mockReturnValue(chainableSortSelectLean([{ _id: "p1" }]));

        const result = await simulationService.listPortfolios("user1");

        expect(PaperPortfolio.find).toHaveBeenCalledWith({ userId: "user1" });
        expect(result).toEqual([{ _id: "p1" }]);
    });
});

describe("loadOwnedPortfolio", () => {
    it("throws PaperPortfolioNotFoundError when nothing matches", async () => {
        PaperPortfolio.findOne.mockResolvedValue(null);

        await expect(simulationService.loadOwnedPortfolio("user1", "p1")).rejects.toThrow(simulationService.PaperPortfolioNotFoundError);
    });

    it("scopes the lookup to _id and userId together", async () => {
        PaperPortfolio.findOne.mockResolvedValue({ _id: "p1" });

        await simulationService.loadOwnedPortfolio("user1", "p1");

        expect(PaperPortfolio.findOne).toHaveBeenCalledWith({ _id: "p1", userId: "user1" });
    });
});

describe("updatePortfolio", () => {
    it("throws PaperPortfolioNotFoundError when the update matches nothing", async () => {
        PaperPortfolio.findOneAndUpdate.mockResolvedValue(null);

        await expect(simulationService.updatePortfolio("user1", "p1", { name: "New name" })).rejects.toThrow(
            simulationService.PaperPortfolioNotFoundError
        );
    });
});

describe("deletePortfolio", () => {
    it("throws PaperPortfolioNotFoundError when nothing matches", async () => {
        PaperPortfolio.findOneAndDelete.mockResolvedValue(null);

        await expect(simulationService.deletePortfolio("user1", "p1")).rejects.toThrow(simulationService.PaperPortfolioNotFoundError);
    });
});

describe("getSyntheticPortfolio", () => {
    it("returns an empty summary for a portfolio with no holdings", async () => {
        const result = await simulationService.getSyntheticPortfolio({ holdings: [] });
        expect(result.holdings).toEqual([]);
        expect(result.summary.numberOfHoldings).toBe(0);
    });

    it("uses the explicit assumedPrice for cost basis and the live quote for current value", async () => {
        marketService.getCurrentMarketData.mockResolvedValue({ price: { current: 200 }, currency: "USD" });

        const result = await simulationService.getSyntheticPortfolio({
            holdings: [{ ticker: "AAPL", shares: 10, assumedPrice: 150 }],
        });

        const holding = result.holdings[0];
        expect(holding.costBasis).toBe(1500);
        expect(holding.currentValue).toBe(2000);
        expect(holding.gainLoss).toBe(500);
        expect(holding.assumedPriceDefaulted).toBe(false);
    });

    it("defaults assumedPrice to the live price and flags assumedPriceDefaulted when omitted", async () => {
        marketService.getCurrentMarketData.mockResolvedValue({ price: { current: 200 }, currency: "USD" });

        const result = await simulationService.getSyntheticPortfolio({
            holdings: [{ ticker: "AAPL", shares: 10, assumedPrice: null }],
        });

        const holding = result.holdings[0];
        expect(holding.assumedPriceDefaulted).toBe(true);
        expect(holding.costBasis).toBe(2000);
        expect(holding.currentValue).toBe(2000);
        expect(holding.gainLoss).toBe(0);
        expect(holding.returnPercent).toBe(0);
    });

    it("never fabricates a $0 cost basis when both assumedPrice and the live price are unavailable", async () => {
        marketService.getCurrentMarketData.mockResolvedValue(null);

        const result = await simulationService.getSyntheticPortfolio({
            holdings: [{ ticker: "UNKNOWN", shares: 10, assumedPrice: null }],
        });

        const holding = result.holdings[0];
        expect(holding.costBasis).toBeNull();
        expect(holding.currentValue).toBeNull();
        expect(holding.priceUnavailable).toBe(true);
    });
});

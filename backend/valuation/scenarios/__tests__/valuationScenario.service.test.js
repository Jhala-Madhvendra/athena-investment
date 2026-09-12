jest.mock("../valuationScenario.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
}));
jest.mock("../../valuation.service", () => ({
    calculateDCFValuation: jest.fn(),
    DISCLAIMER: "DCF valuation is highly sensitive to assumptions.",
}));

const ValuationScenario = require("../valuationScenario.model");
const valuationService = require("../../valuation.service");
const scenarioService = require("../valuationScenario.service");

const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });
const chainableLean = (doc) => ({ lean: jest.fn(() => Promise.resolve(doc)) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("saveScenario", () => {
    it("throws ScenarioAssumptionsInvalidError and never persists when the DCF calculation is invalid", async () => {
        valuationService.calculateDCFValuation.mockResolvedValue({ isValid: false, errors: ["bad assumptions"] });

        await expect(scenarioService.saveScenario("user1", "AAPL", { name: "Base", assumptions: {} })).rejects.toThrow(
            scenarioService.ScenarioAssumptionsInvalidError
        );
        expect(ValuationScenario.create).not.toHaveBeenCalled();
    });

    it("persists priceAtSave/impliedValuePerShareAtSave from the DCF result", async () => {
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            currentMarketPrice: 190,
            intrinsicValuePerShare: 210,
        });
        ValuationScenario.create.mockResolvedValue({ _id: "s1", name: "Base" });

        await scenarioService.saveScenario("user1", "aapl", { name: "Base", assumptions: { revenueGrowth: 0.1 } });

        expect(ValuationScenario.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user1",
                ticker: "AAPL",
                name: "Base",
                priceAtSave: 190,
                impliedValuePerShareAtSave: 210,
            })
        );
    });
});

describe("listScenarios", () => {
    it("queries by userId and normalized ticker, newest first", async () => {
        ValuationScenario.find.mockReturnValue(chainableSortLean([{ _id: "s1" }]));

        const result = await scenarioService.listScenarios("user1", "aapl");

        expect(ValuationScenario.find).toHaveBeenCalledWith({ userId: "user1", ticker: "AAPL" });
        expect(result).toEqual([{ _id: "s1" }]);
    });
});

describe("deleteScenario", () => {
    it("throws ScenarioNotFoundError when nothing matches", async () => {
        ValuationScenario.findOneAndDelete.mockResolvedValue(null);

        await expect(scenarioService.deleteScenario("user1", "AAPL", "s1")).rejects.toThrow(scenarioService.ScenarioNotFoundError);
    });

    it("scopes the delete to _id, userId, and ticker together", async () => {
        ValuationScenario.findOneAndDelete.mockResolvedValue({ _id: "s1" });

        await scenarioService.deleteScenario("user1", "aapl", "s1");

        expect(ValuationScenario.findOneAndDelete).toHaveBeenCalledWith({ _id: "s1", userId: "user1", ticker: "AAPL" });
    });
});

describe("compareScenarios", () => {
    it("fans out calculateDCFValuation across saved and adHoc entries, and reports missing saved ids as unavailable", async () => {
        ValuationScenario.find.mockReturnValue(chainableLean([{ _id: "s1", name: "Base", assumptions: { a: 1 } }]));
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            intrinsicValuePerShare: 200,
            currentMarketPrice: 190,
            upsideDownsidePercent: 5.26,
        });

        const result = await scenarioService.compareScenarios("user1", "AAPL", {
            savedIds: ["s1", "s2"],
            adHoc: [{ name: "Bull", assumptions: { a: 2 } }],
        });

        expect(valuationService.calculateDCFValuation).toHaveBeenCalledTimes(2);
        expect(result.results).toHaveLength(2);
        expect(result.unavailable).toEqual([{ id: "s2", reason: expect.any(String) }]);
        expect(result.comparisonTable[0]).toMatchObject({ source: "saved", name: "Base", intrinsicValuePerShare: 200 });
    });
});

describe("backtestScenario", () => {
    it("throws ScenarioNotFoundError when the scenario doesn't exist for this user/ticker", async () => {
        ValuationScenario.findOne.mockReturnValue(chainableLean(null));

        await expect(scenarioService.backtestScenario("user1", "AAPL", "s1")).rejects.toThrow(scenarioService.ScenarioNotFoundError);
    });

    it("throws BacktestUnavailableError when the current-data recalculation is invalid", async () => {
        ValuationScenario.findOne.mockReturnValue(
            chainableLean({ _id: "s1", name: "Base", assumptions: {}, priceAtSave: 190, impliedValuePerShareAtSave: 210 })
        );
        valuationService.calculateDCFValuation.mockResolvedValue({ isValid: false, errors: ["no financials"] });

        await expect(scenarioService.backtestScenario("user1", "AAPL", "s1")).rejects.toThrow(scenarioService.BacktestUnavailableError);
    });

    it("computes priceChangeSinceSavePercent from priceAtSave vs the current price", async () => {
        ValuationScenario.findOne.mockReturnValue(
            chainableLean({
                _id: "s1",
                name: "Base",
                assumptions: {},
                createdAt: "2026-01-01T00:00:00.000Z",
                priceAtSave: 100,
                impliedValuePerShareAtSave: 120,
            })
        );
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            currentMarketPrice: 110,
            intrinsicValuePerShare: 130,
            upsideDownsidePercent: 18.18,
        });

        const result = await scenarioService.backtestScenario("user1", "AAPL", "s1");

        expect(result.priceChangeSinceSavePercent).toBeCloseTo(10, 5);
        expect(result.impliedValuePerShareAtSave).toBe(120);
        expect(result.impliedValuePerShareNow).toBe(130);
        expect(result).not.toHaveProperty("verdict");
    });

    it("returns priceChangeSinceSavePercent as null when priceAtSave was never captured", async () => {
        ValuationScenario.findOne.mockReturnValue(
            chainableLean({ _id: "s1", name: "Base", assumptions: {}, priceAtSave: null, impliedValuePerShareAtSave: null })
        );
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            currentMarketPrice: 110,
            intrinsicValuePerShare: 130,
            upsideDownsidePercent: 18.18,
        });

        const result = await scenarioService.backtestScenario("user1", "AAPL", "s1");

        expect(result.priceChangeSinceSavePercent).toBeNull();
    });
});

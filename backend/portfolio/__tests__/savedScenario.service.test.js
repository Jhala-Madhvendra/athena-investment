jest.mock("../savedScenario.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOneAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));
jest.mock("../portfolio.scenario.service", () => ({ runScenario: jest.fn() }));
jest.mock("../../alerts/alert.model", () => ({}));
jest.mock("../../alerts/alert.deduplicator", () => ({
    dayKey: jest.fn(() => "2026-08-31"),
    insertIfNew: jest.fn(),
}));

const SavedScenario = require("../savedScenario.model");
const scenarioService = require("../portfolio.scenario.service");
const dedup = require("../../alerts/alert.deduplicator");
const savedScenarioService = require("../savedScenario.service");

const chainableSortLean = (docs) => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("createSavedScenario / listSavedScenarios / deleteSavedScenario", () => {
    it("creates a saved scenario scoped to the caller", async () => {
        SavedScenario.create.mockResolvedValue({ _id: "s1" });

        await savedScenarioService.createSavedScenario("user1", { name: "Bear Case", rules: [], benchmark: null, window: "1y", alertThresholdPercent: -15 });

        expect(SavedScenario.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", name: "Bear Case", alertThresholdPercent: -15 })
        );
    });

    it("lists a user's saved scenarios, newest first", async () => {
        SavedScenario.find.mockReturnValue(chainableSortLean([{ _id: "s1" }]));

        const result = await savedScenarioService.listSavedScenarios("user1");

        expect(SavedScenario.find).toHaveBeenCalledWith({ userId: "user1" });
        expect(result).toEqual([{ _id: "s1" }]);
    });

    it("throws SavedScenarioNotFoundError when deleting one not owned by the caller", async () => {
        SavedScenario.findOneAndDelete.mockResolvedValue(null);

        await expect(savedScenarioService.deleteSavedScenario("user1", "s1")).rejects.toThrow(
            savedScenarioService.SavedScenarioNotFoundError
        );
    });

    it("deletes when owned, scoped by {_id, userId}", async () => {
        SavedScenario.findOneAndDelete.mockResolvedValue({ _id: "s1" });

        await savedScenarioService.deleteSavedScenario("user1", "s1");

        expect(SavedScenario.findOneAndDelete).toHaveBeenCalledWith({ _id: "s1", userId: "user1" });
    });
});

describe("checkSavedScenario", () => {
    const savedScenario = {
        _id: "s1",
        userId: "user1",
        name: "Bear Case",
        rules: [{ targetType: "PORTFOLIO", shockPercent: -20 }],
        benchmark: null,
        window: "1y",
        alertThresholdPercent: -15,
    };

    it("re-runs the exact existing scenario engine with the saved parameters", async () => {
        scenarioService.runScenario.mockResolvedValue({ percentageChange: -5 });
        SavedScenario.findByIdAndUpdate.mockResolvedValue({});

        await savedScenarioService.checkSavedScenario(savedScenario);

        expect(scenarioService.runScenario).toHaveBeenCalledWith("user1", {
            name: "Bear Case",
            rules: savedScenario.rules,
            benchmark: null,
            window: "1y",
        });
    });

    it("records lastCheckedAt/lastPercentageChange regardless of whether the threshold was crossed", async () => {
        scenarioService.runScenario.mockResolvedValue({ percentageChange: -5 });
        SavedScenario.findByIdAndUpdate.mockResolvedValue({});

        await savedScenarioService.checkSavedScenario(savedScenario);

        expect(SavedScenario.findByIdAndUpdate).toHaveBeenCalledWith(
            "s1",
            expect.objectContaining({ lastPercentageChange: -5, lastCheckedAt: expect.any(Date) })
        );
    });

    it("does not create an alert when the impact is milder than the threshold", async () => {
        scenarioService.runScenario.mockResolvedValue({ percentageChange: -5 });
        SavedScenario.findByIdAndUpdate.mockResolvedValue({});

        const result = await savedScenarioService.checkSavedScenario(savedScenario);

        expect(result.thresholdCrossed).toBe(false);
        expect(dedup.insertIfNew).not.toHaveBeenCalled();
    });

    it("creates a deduplicated PORTFOLIO alert when the impact meets/exceeds the threshold", async () => {
        scenarioService.runScenario.mockResolvedValue({ percentageChange: -20 });
        SavedScenario.findByIdAndUpdate.mockResolvedValue({});
        dedup.insertIfNew.mockResolvedValue({ _id: "alert1", title: "x" });

        const result = await savedScenarioService.checkSavedScenario(savedScenario);

        expect(result.thresholdCrossed).toBe(true);
        expect(dedup.insertIfNew).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                userId: "user1",
                type: "PORTFOLIO",
                rule: "SCENARIO_THRESHOLD_CROSSED",
                periodKey: "s1:2026-08-31",
            })
        );
        expect(result.alert).toEqual({ _id: "alert1", title: "x" });
    });

    it("treats a percentageChange exactly at the threshold as crossed", async () => {
        scenarioService.runScenario.mockResolvedValue({ percentageChange: -15 });
        SavedScenario.findByIdAndUpdate.mockResolvedValue({});
        dedup.insertIfNew.mockResolvedValue({ _id: "alert1" });

        const result = await savedScenarioService.checkSavedScenario(savedScenario);

        expect(result.thresholdCrossed).toBe(true);
    });
});

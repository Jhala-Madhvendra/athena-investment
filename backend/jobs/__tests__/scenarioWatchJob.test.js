jest.mock("../../portfolio/savedScenario.model", () => ({ find: jest.fn() }));
jest.mock("../../identity/identity.model", () => ({ findById: jest.fn() }));
jest.mock("../../portfolio/savedScenario.service", () => ({ checkSavedScenario: jest.fn() }));
jest.mock("../../notifications/notification.service", () => ({ sendToUser: jest.fn() }));

const SavedScenario = require("../../portfolio/savedScenario.model");
const User = require("../../identity/identity.model");
const savedScenarioService = require("../../portfolio/savedScenario.service");
const notificationService = require("../../notifications/notification.service");
const { runScenarioWatchForAllUsers } = require("../scenarioWatchJob");

const chainableLean = (doc) => ({ lean: jest.fn(() => Promise.resolve(doc)) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("runScenarioWatchForAllUsers", () => {
    it("checks every saved scenario and sends nothing when none cross threshold", async () => {
        SavedScenario.find.mockResolvedValue([{ _id: "s1", userId: "u1", lastPercentageChange: null, alertThresholdPercent: -15 }]);
        savedScenarioService.checkSavedScenario.mockResolvedValue({ percentageChange: -5, thresholdCrossed: false, alert: null });

        const result = await runScenarioWatchForAllUsers();

        expect(result).toEqual({ scenariosChecked: 1, notificationsSent: 0 });
        expect(notificationService.sendToUser).not.toHaveBeenCalled();
    });

    it("notifies when a scenario newly crosses its threshold", async () => {
        SavedScenario.find.mockResolvedValue([{ _id: "s1", userId: "u1", lastPercentageChange: -5, alertThresholdPercent: -15 }]);
        savedScenarioService.checkSavedScenario.mockResolvedValue({
            percentageChange: -20,
            thresholdCrossed: true,
            alert: { title: "Threshold crossed", message: "..." },
        });
        User.findById.mockReturnValue(chainableLean({ _id: "u1", email: "test@example.com" }));
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runScenarioWatchForAllUsers();

        expect(result).toEqual({ scenariosChecked: 1, notificationsSent: 1 });
        expect(notificationService.sendToUser).toHaveBeenCalledWith(
            { _id: "u1", email: "test@example.com" },
            expect.objectContaining({ title: "Threshold crossed" })
        );
    });

    it("does not re-notify when a scenario was ALREADY over threshold on the previous check", async () => {
        SavedScenario.find.mockResolvedValue([{ _id: "s1", userId: "u1", lastPercentageChange: -18, alertThresholdPercent: -15 }]);
        savedScenarioService.checkSavedScenario.mockResolvedValue({ percentageChange: -22, thresholdCrossed: true, alert: { title: "x", message: "y" } });

        const result = await runScenarioWatchForAllUsers();

        expect(result.notificationsSent).toBe(0);
        expect(notificationService.sendToUser).not.toHaveBeenCalled();
    });

    it("does not let one saved scenario's failure block the rest", async () => {
        SavedScenario.find.mockResolvedValue([
            { _id: "s1", userId: "u1", lastPercentageChange: null, alertThresholdPercent: -15 },
            { _id: "s2", userId: "u2", lastPercentageChange: null, alertThresholdPercent: -15 },
        ]);
        savedScenarioService.checkSavedScenario
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce({ percentageChange: -5, thresholdCrossed: false, alert: null });

        const result = await runScenarioWatchForAllUsers();

        expect(result.scenariosChecked).toBe(1);
    });
});

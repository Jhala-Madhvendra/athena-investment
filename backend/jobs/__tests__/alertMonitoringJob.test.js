jest.mock("../../identity/identity.model", () => ({ find: jest.fn() }));
jest.mock("../../alerts/alert.service", () => ({ runMonitoring: jest.fn() }));
jest.mock("../../notifications/notification.service", () => ({ sendToUser: jest.fn() }));

const User = require("../../identity/identity.model");
const alertService = require("../../alerts/alert.service");
const notificationService = require("../../notifications/notification.service");
const { runAlertMonitoringForAllUsers } = require("../alertMonitoringJob");

const chainableLean = (docs) => ({ lean: jest.fn(() => Promise.resolve(docs)) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("runAlertMonitoringForAllUsers", () => {
    it("queries only users with at least one notification channel opted in", async () => {
        User.find.mockReturnValue(chainableLean([]));

        await runAlertMonitoringForAllUsers();

        expect(User.find).toHaveBeenCalledWith({
            $or: [
                { "notificationPreferences.emailEnabled": true },
                { "notificationPreferences.slackWebhookUrl": { $ne: null } },
                { "notificationPreferences.telegramChatId": { $ne: null } },
            ],
        });
    });

    it("runs monitoring for each opted-in user and sends a notification only when new alerts were created", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }, { _id: "u2" }]));
        alertService.runMonitoring
            .mockResolvedValueOnce({ alertsCreated: 2, alerts: [{ ticker: "AAPL", title: "Price drop" }] })
            .mockResolvedValueOnce({ alertsCreated: 0, alerts: [] });
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runAlertMonitoringForAllUsers();

        expect(alertService.runMonitoring).toHaveBeenCalledWith("u1");
        expect(alertService.runMonitoring).toHaveBeenCalledWith("u2");
        expect(notificationService.sendToUser).toHaveBeenCalledTimes(1);
        expect(notificationService.sendToUser).toHaveBeenCalledWith({ _id: "u1" }, expect.objectContaining({ title: expect.any(String) }));
        expect(result).toEqual({ usersChecked: 2, usersNotified: 1 });
    });

    it("does not let one user's monitoring failure block the rest", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }, { _id: "u2" }]));
        alertService.runMonitoring
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce({ alertsCreated: 1, alerts: [{ ticker: "MSFT", title: "Margin declined" }] });
        notificationService.sendToUser.mockResolvedValue([]);

        const result = await runAlertMonitoringForAllUsers();

        expect(result.usersChecked).toBe(2);
        expect(result.usersNotified).toBe(1);
    });

    it("does not send a notification when a user's delivery itself fails, but keeps processing", async () => {
        User.find.mockReturnValue(chainableLean([{ _id: "u1" }, { _id: "u2" }]));
        alertService.runMonitoring.mockResolvedValue({ alertsCreated: 1, alerts: [{ ticker: "AAPL", title: "x" }] });
        notificationService.sendToUser.mockRejectedValueOnce(new Error("delivery failed")).mockResolvedValueOnce([]);

        const result = await runAlertMonitoringForAllUsers();

        expect(result.usersChecked).toBe(2);
        expect(result.usersNotified).toBe(1);
    });
});

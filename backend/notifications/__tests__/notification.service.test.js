jest.mock("../channels/email.channel", () => ({ send: jest.fn() }));
jest.mock("../channels/slack.channel", () => ({ send: jest.fn() }));
jest.mock("../channels/telegram.channel", () => ({ send: jest.fn() }));

const emailChannel = require("../channels/email.channel");
const slackChannel = require("../channels/slack.channel");
const telegramChannel = require("../channels/telegram.channel");
const { sendToUser } = require("../notification.service");

const CONTENT = { title: "3 new alerts", message: "AAPL: Price drop" };

afterEach(() => {
    jest.clearAllMocks();
});

describe("sendToUser", () => {
    it("sends nothing when no channel is enabled/configured", async () => {
        const user = { _id: "u1", email: "test@example.com", notificationPreferences: {} };

        const results = await sendToUser(user, CONTENT);

        expect(results).toEqual([]);
        expect(emailChannel.send).not.toHaveBeenCalled();
        expect(slackChannel.send).not.toHaveBeenCalled();
        expect(telegramChannel.send).not.toHaveBeenCalled();
    });

    it("sends email only when emailEnabled AND the user has an email", async () => {
        emailChannel.send.mockResolvedValue();
        const user = { _id: "u1", email: "test@example.com", notificationPreferences: { emailEnabled: true } };

        await sendToUser(user, CONTENT);

        expect(emailChannel.send).toHaveBeenCalledWith("test@example.com", CONTENT);
    });

    it("does not attempt email when emailEnabled is true but the user has no email (anonymous)", async () => {
        const user = { _id: "u1", email: null, notificationPreferences: { emailEnabled: true } };

        await sendToUser(user, CONTENT);

        expect(emailChannel.send).not.toHaveBeenCalled();
    });

    it("sends to every configured channel at once", async () => {
        emailChannel.send.mockResolvedValue();
        slackChannel.send.mockResolvedValue();
        telegramChannel.send.mockResolvedValue();
        const user = {
            _id: "u1",
            email: "test@example.com",
            notificationPreferences: { emailEnabled: true, slackWebhookUrl: "https://hooks.slack.com/x", telegramChatId: "123" },
        };

        const results = await sendToUser(user, CONTENT);

        expect(results).toEqual([
            { channel: "email", ok: true },
            { channel: "slack", ok: true },
            { channel: "telegram", ok: true },
        ]);
    });

    it("does not let one channel's failure block another", async () => {
        emailChannel.send.mockRejectedValue(new Error("SMTP down"));
        slackChannel.send.mockResolvedValue();
        const user = {
            _id: "u1",
            email: "test@example.com",
            notificationPreferences: { emailEnabled: true, slackWebhookUrl: "https://hooks.slack.com/x" },
        };

        const results = await sendToUser(user, CONTENT);

        expect(results).toEqual([
            { channel: "email", ok: false },
            { channel: "slack", ok: true },
        ]);
    });

    it("never throws, even if every channel fails", async () => {
        emailChannel.send.mockRejectedValue(new Error("boom"));
        const user = { _id: "u1", email: "test@example.com", notificationPreferences: { emailEnabled: true } };

        await expect(sendToUser(user, CONTENT)).resolves.toBeDefined();
    });
});

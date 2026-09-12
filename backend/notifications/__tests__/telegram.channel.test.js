const env = require("../../config/env");

const originalFetch = global.fetch;
const originalBotToken = env.telegramBotToken;

const { send, isConfigured } = require("../channels/telegram.channel");

beforeEach(() => {
    global.fetch = jest.fn();
    env.telegramBotToken = "test-bot-token";
});

afterEach(() => {
    global.fetch = originalFetch;
    env.telegramBotToken = originalBotToken;
});

describe("telegram.channel", () => {
    it("isConfigured reflects whether a bot token is set", () => {
        expect(isConfigured()).toBe(true);
        env.telegramBotToken = null;
        expect(isConfigured()).toBe(false);
    });

    it("throws without attempting a request when unconfigured", async () => {
        env.telegramBotToken = null;

        await expect(send("123", { title: "t", message: "m" })).rejects.toThrow(/not configured/);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("POSTs to the bot's sendMessage endpoint with the chat_id and formatted text", async () => {
        global.fetch.mockResolvedValue({ ok: true, status: 200 });

        await send("987654321", { title: "3 new alerts", message: "AAPL: Price drop", url: "https://app/alerts" });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
        const body = JSON.parse(options.body);
        expect(body.chat_id).toBe("987654321");
        expect(body.text).toContain("3 new alerts");
    });

    it("throws when Telegram responds with a non-ok status", async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 400 });

        await expect(send("1", { title: "t", message: "m" })).rejects.toThrow(/400/);
    });
});

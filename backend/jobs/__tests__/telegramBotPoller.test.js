const env = require("../../config/env");

const originalFetch = global.fetch;
const originalBotToken = env.telegramBotToken;

const { createPoller } = require("../telegramBotPoller");

const jsonResponse = (body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

beforeEach(() => {
    global.fetch = jest.fn();
    env.telegramBotToken = "test-bot-token";
});

afterEach(() => {
    global.fetch = originalFetch;
    env.telegramBotToken = originalBotToken;
});

describe("telegramBotPoller", () => {
    it("does nothing when no bot token is configured", async () => {
        env.telegramBotToken = null;
        const { pollOnce } = createPoller();

        await pollOnce();

        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("fetches getUpdates with an offset starting at 1", async () => {
        global.fetch.mockResolvedValue(jsonResponse({ result: [] }));
        const { pollOnce } = createPoller();

        await pollOnce();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain("offset=1");
    });

    it("replies with the chat_id to a /start message", async () => {
        global.fetch
            .mockResolvedValueOnce(jsonResponse({ result: [{ update_id: 5, message: { text: "/start", chat: { id: 999 } } }] }))
            .mockResolvedValueOnce({ ok: true, status: 200 });
        const { pollOnce } = createPoller();

        await pollOnce();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        const [replyUrl, replyOptions] = global.fetch.mock.calls[1];
        expect(replyUrl).toContain("sendMessage");
        const body = JSON.parse(replyOptions.body);
        expect(body.chat_id).toBe(999);
        expect(body.text).toContain("999");
    });

    it("does not reply to a non-/start message", async () => {
        global.fetch.mockResolvedValueOnce(jsonResponse({ result: [{ update_id: 5, message: { text: "hello", chat: { id: 999 } } }] }));
        const { pollOnce } = createPoller();

        await pollOnce();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("advances the offset across calls so the same update is never re-processed", async () => {
        global.fetch
            .mockResolvedValueOnce(jsonResponse({ result: [{ update_id: 5, message: { text: "hello", chat: { id: 1 } } }] }))
            .mockResolvedValueOnce(jsonResponse({ result: [] }));
        const { pollOnce } = createPoller();

        await pollOnce();
        await pollOnce();

        expect(global.fetch.mock.calls[1][0]).toContain("offset=6");
    });

    it("logs and does not throw when getUpdates itself fails", async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 500 });
        const { pollOnce } = createPoller();

        await expect(pollOnce()).resolves.toBeUndefined();
    });
});

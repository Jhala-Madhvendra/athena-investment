const originalFetch = global.fetch;

const { send } = require("../channels/slack.channel");

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe("slack.channel send", () => {
    it("POSTs a formatted text payload to the webhook URL", async () => {
        global.fetch.mockResolvedValue({ ok: true, status: 200 });

        await send("https://hooks.slack.com/services/T00/B00/xxx", { title: "3 new alerts", message: "AAPL: Price drop", url: "https://app/alerts" });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://hooks.slack.com/services/T00/B00/xxx");
        expect(options.method).toBe("POST");
        const body = JSON.parse(options.body);
        expect(body.text).toContain("3 new alerts");
        expect(body.text).toContain("AAPL: Price drop");
        expect(body.text).toContain("https://app/alerts");
    });

    it("throws when Slack responds with a non-ok status", async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 404 });

        await expect(send("https://hooks.slack.com/services/bad", { title: "t", message: "m" })).rejects.toThrow(/404/);
    });
});

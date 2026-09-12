const mockSendMail = jest.fn();
jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));

// email.channel.js caches its transport (and reads env) at module scope, so
// both env and the channel module are re-required together in beforeEach -
// jest.resetModules() means a stale top-level `env` reference would silently
// diverge from the instance email.channel.js actually reads.
let env;
let nodemailer;
let emailChannel;

beforeEach(() => {
    jest.resetModules();
    mockSendMail.mockReset();

    env = require("../../config/env");
    nodemailer = require("nodemailer");
    nodemailer.createTransport.mockClear();

    env.smtpHost = "smtp.example.com";
    env.smtpPort = 587;
    env.smtpUser = "user@example.com";
    env.smtpPass = "secret";
    env.smtpFrom = "athena@example.com";

    emailChannel = require("../channels/email.channel");
});

describe("email.channel", () => {
    it("isConfigured reflects whether every required SMTP var is set", () => {
        expect(emailChannel.isConfigured()).toBe(true);
        env.smtpPass = null;
        expect(emailChannel.isConfigured()).toBe(false);
    });

    it("throws without creating a transport when unconfigured", async () => {
        env.smtpHost = null;

        await expect(emailChannel.send("user@example.com", { title: "t", message: "m" })).rejects.toThrow(/not configured/);
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it("sends via the SMTP transport with subject/text derived from title/message/url", async () => {
        mockSendMail.mockResolvedValue({});

        await emailChannel.send("recipient@example.com", { title: "3 new alerts", message: "AAPL: Price drop", url: "https://app/alerts" });

        expect(mockSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: "athena@example.com",
                to: "recipient@example.com",
                subject: "3 new alerts",
            })
        );
        expect(mockSendMail.mock.calls[0][0].text).toContain("AAPL: Price drop");
        expect(mockSendMail.mock.calls[0][0].text).toContain("https://app/alerts");
    });

    it("reuses the same transport across multiple sends instead of recreating it", async () => {
        mockSendMail.mockResolvedValue({});

        await emailChannel.send("a@example.com", { title: "t1", message: "m1" });
        await emailChannel.send("b@example.com", { title: "t2", message: "m2" });

        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
});

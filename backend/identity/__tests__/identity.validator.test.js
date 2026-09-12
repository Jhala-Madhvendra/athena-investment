const { validateSignupInput, validateLoginInput, validatePreferencesInput } = require("../identity.validator");

describe("validateSignupInput", () => {
    it("accepts a valid email/password and normalizes the email", () => {
        const result = validateSignupInput({ email: "  Test@Example.com  ", password: "longenough" });

        expect(result.isValid).toBe(true);
        expect(result.normalized).toEqual({ email: "test@example.com", password: "longenough" });
    });

    it("rejects a missing/malformed email", () => {
        expect(validateSignupInput({ email: "", password: "longenough" }).isValid).toBe(false);
        expect(validateSignupInput({ email: "not-an-email", password: "longenough" }).isValid).toBe(false);
        expect(validateSignupInput({ email: undefined, password: "longenough" }).isValid).toBe(false);
    });

    it("rejects a password shorter than 8 characters", () => {
        const result = validateSignupInput({ email: "test@example.com", password: "short" });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Password must be at least 8 characters.");
    });

    it("accepts an exactly-8-character password", () => {
        expect(validateSignupInput({ email: "test@example.com", password: "12345678" }).isValid).toBe(true);
    });
});

describe("validateLoginInput", () => {
    it("accepts any non-empty email/password with no length/format re-check", () => {
        const result = validateLoginInput({ email: "  Test@Example.com  ", password: "x" });

        expect(result.isValid).toBe(true);
        expect(result.normalized).toEqual({ email: "test@example.com", password: "x" });
    });

    it("rejects a missing email or password", () => {
        expect(validateLoginInput({ email: "", password: "x" }).isValid).toBe(false);
        expect(validateLoginInput({ email: "test@example.com", password: "" }).isValid).toBe(false);
        expect(validateLoginInput({}).isValid).toBe(false);
    });
});

describe("validatePreferencesInput", () => {
    it("accepts an empty body (no-op update)", () => {
        expect(validatePreferencesInput({})).toEqual({ isValid: true, errors: [], normalized: {} });
    });

    it("accepts and normalizes booleans", () => {
        const result = validatePreferencesInput({ emailEnabled: true, digestEnabled: false });
        expect(result.isValid).toBe(true);
        expect(result.normalized).toEqual({ emailEnabled: true, digestEnabled: false });
    });

    it("rejects a non-boolean emailEnabled/digestEnabled", () => {
        expect(validatePreferencesInput({ emailEnabled: "yes" }).isValid).toBe(false);
        expect(validatePreferencesInput({ digestEnabled: 1 }).isValid).toBe(false);
    });

    it("accepts a valid Slack webhook URL", () => {
        const url = "https://hooks.slack.com/services/T00/B00/xxx";
        const result = validatePreferencesInput({ slackWebhookUrl: url });
        expect(result.isValid).toBe(true);
        expect(result.normalized.slackWebhookUrl).toBe(url);
    });

    it("rejects a malformed Slack webhook URL", () => {
        expect(validatePreferencesInput({ slackWebhookUrl: "https://example.com/not-slack" }).isValid).toBe(false);
    });

    it("allows clearing slackWebhookUrl/telegramChatId with null or empty string", () => {
        expect(validatePreferencesInput({ slackWebhookUrl: null }).normalized.slackWebhookUrl).toBeNull();
        expect(validatePreferencesInput({ telegramChatId: "" }).normalized.telegramChatId).toBeNull();
    });

    it("accepts a numeric Telegram chat id", () => {
        const result = validatePreferencesInput({ telegramChatId: "123456789" });
        expect(result.isValid).toBe(true);
        expect(result.normalized.telegramChatId).toBe("123456789");
    });

    it("accepts a negative Telegram chat id (group chats are negative)", () => {
        expect(validatePreferencesInput({ telegramChatId: "-100123456" }).isValid).toBe(true);
    });

    it("rejects a non-numeric Telegram chat id", () => {
        expect(validatePreferencesInput({ telegramChatId: "not-a-number" }).isValid).toBe(false);
    });
});

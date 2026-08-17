const { validateAnalyticsQuery, DEFAULT_WINDOW } = require("../portfolio.analytics.validator");

describe("validateAnalyticsQuery", () => {
    it("defaults window to 1y and benchmark to null when neither is provided", () => {
        const result = validateAnalyticsQuery({});
        expect(result).toEqual({ isValid: true, errors: [], window: DEFAULT_WINDOW, benchmark: null });
    });

    it("accepts every supported window", () => {
        ["1m", "3m", "6m", "1y", "5y"].forEach((window) => {
            expect(validateAnalyticsQuery({ window }).isValid).toBe(true);
        });
    });

    it("rejects an unsupported window", () => {
        const result = validateAnalyticsQuery({ window: "2y" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/window must be one of/);
    });

    it("normalizes a valid benchmark ticker to uppercase", () => {
        const result = validateAnalyticsQuery({ benchmark: "spy" });
        expect(result.isValid).toBe(true);
        expect(result.benchmark).toBe("SPY");
    });

    it("rejects a malformed benchmark ticker", () => {
        const result = validateAnalyticsQuery({ benchmark: "not a ticker!" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/benchmark must be a valid ticker/);
    });

    it("treats an empty-string benchmark as not provided", () => {
        const result = validateAnalyticsQuery({ benchmark: "" });
        expect(result.isValid).toBe(true);
        expect(result.benchmark).toBeNull();
    });
});

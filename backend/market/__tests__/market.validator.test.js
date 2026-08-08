const { validatePeriod, DEFAULT_PERIOD } = require("../validators/market.validator");

describe("validatePeriod", () => {
    it("defaults to 1y when no period is supplied", () => {
        expect(validatePeriod(undefined)).toEqual({ isValid: true, period: DEFAULT_PERIOD, error: null });
    });

    it.each(["1m", "3m", "6m", "1y", "5y"])("accepts the supported period %s", (period) => {
        expect(validatePeriod(period)).toEqual({ isValid: true, period, error: null });
    });

    it("is case-insensitive", () => {
        expect(validatePeriod("1Y")).toEqual({ isValid: true, period: "1y", error: null });
    });

    it("rejects an unsupported period", () => {
        const result = validatePeriod("2y");

        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Invalid period/);
    });

    it("rejects a non-string period", () => {
        expect(validatePeriod(123).isValid).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(validatePeriod("").isValid).toBe(false);
    });
});

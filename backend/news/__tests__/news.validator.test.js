const { validateNewsQuery } = require("../news.validator");

describe("validateNewsQuery", () => {
    it("defaults limit to 20 when not supplied", () => {
        const result = validateNewsQuery({});
        expect(result.isValid).toBe(true);
        expect(result.limit).toBe(20);
    });

    it("accepts a valid limit within range", () => {
        const result = validateNewsQuery({ limit: "10" });
        expect(result.isValid).toBe(true);
        expect(result.limit).toBe(10);
    });

    it("rejects a limit above the maximum", () => {
        const result = validateNewsQuery({ limit: "500" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/between 1 and 50/);
    });

    it("rejects a non-integer limit", () => {
        const result = validateNewsQuery({ limit: "abc" });
        expect(result.isValid).toBe(false);
    });

    it("accepts a valid category", () => {
        const result = validateNewsQuery({ category: "Earnings" });
        expect(result.isValid).toBe(true);
        expect(result.category).toBe("Earnings");
    });

    it("rejects an invalid category rather than guessing", () => {
        const result = validateNewsQuery({ category: "Rumors" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/category must be one of/);
    });

    it("rejects an invalid from date", () => {
        const result = validateNewsQuery({ from: "not-a-date" });
        expect(result.isValid).toBe(false);
    });

    it("rejects from being after to", () => {
        const result = validateNewsQuery({ from: "2026-08-10", to: "2026-08-01" });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("from must not be after to.");
    });

    it("accepts a valid from/to range", () => {
        const result = validateNewsQuery({ from: "2026-08-01", to: "2026-08-10" });
        expect(result.isValid).toBe(true);
    });
});

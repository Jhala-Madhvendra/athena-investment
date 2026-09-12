const {
    validateCreatePortfolioRequest,
    isValidPortfolioId,
    validateScenarioRequest,
    validateCompareRequest,
} = require("../simulation.validator");

describe("validateCreatePortfolioRequest", () => {
    it("rejects a missing name", () => {
        const result = validateCreatePortfolioRequest({ holdings: [] });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("name"))).toBe(true);
    });

    it("accepts an empty holdings array", () => {
        const result = validateCreatePortfolioRequest({ name: "My what-if" });
        expect(result.isValid).toBe(true);
        expect(result.normalized.holdings).toEqual([]);
    });

    it("rejects a holding with non-positive shares", () => {
        const result = validateCreatePortfolioRequest({ name: "X", holdings: [{ ticker: "AAPL", shares: 0 }] });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("holdings[0].shares"))).toBe(true);
    });

    it("rejects an invalid ticker", () => {
        const result = validateCreatePortfolioRequest({ name: "X", holdings: [{ ticker: "!!bad!!", shares: 1 }] });
        expect(result.isValid).toBe(false);
    });

    it("allows assumedPrice to be omitted", () => {
        const result = validateCreatePortfolioRequest({ name: "X", holdings: [{ ticker: "aapl", shares: 5 }] });
        expect(result.isValid).toBe(true);
        expect(result.normalized.holdings[0]).toEqual({ ticker: "AAPL", shares: 5, assumedPrice: null });
    });

    it("rejects a negative assumedPrice", () => {
        const result = validateCreatePortfolioRequest({ name: "X", holdings: [{ ticker: "AAPL", shares: 5, assumedPrice: -1 }] });
        expect(result.isValid).toBe(false);
    });

    it("accepts a fully specified holding", () => {
        const result = validateCreatePortfolioRequest({ name: "X", holdings: [{ ticker: "aapl", shares: 5, assumedPrice: 190.5 }] });
        expect(result.isValid).toBe(true);
        expect(result.normalized.holdings[0]).toEqual({ ticker: "AAPL", shares: 5, assumedPrice: 190.5 });
    });
});

describe("isValidPortfolioId", () => {
    it("returns false for a malformed id", () => {
        expect(isValidPortfolioId("not-an-id")).toBe(false);
    });

    it("returns true for a well-formed ObjectId string", () => {
        expect(isValidPortfolioId("507f1f77bcf86cd799439011")).toBe(true);
    });
});

describe("re-exported scenario validators", () => {
    it("re-exports validateScenarioRequest from portfolio.scenario.validator", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }] });
        expect(result.isValid).toBe(true);
    });

    it("re-exports validateCompareRequest from portfolio.scenario.validator", () => {
        const result = validateCompareRequest({ scenarios: [{ rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }] }] });
        expect(result.isValid).toBe(false); // requires at least 2 scenarios
    });
});

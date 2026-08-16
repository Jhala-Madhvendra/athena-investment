jest.mock("../industry.discovery", () => ({ DISCOVERY_LIMIT: 20 }));

const { validateDiscoveryImportTickers } = require("../industry.validator");

describe("industry.validator.validateDiscoveryImportTickers", () => {
    it("rejects a missing or empty tickers array", () => {
        expect(validateDiscoveryImportTickers(undefined).isValid).toBe(false);
        expect(validateDiscoveryImportTickers([]).isValid).toBe(false);
        expect(validateDiscoveryImportTickers("AAPL").isValid).toBe(false);
    });

    it("rejects more than DISCOVERY_LIMIT tickers", () => {
        const tooMany = Array.from({ length: 21 }, (_, i) => `T${i}`);
        const result = validateDiscoveryImportTickers(tooMany);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/no more than 20/i);
    });

    it("rejects invalidly-formatted tickers", () => {
        const result = validateDiscoveryImportTickers(["AAPL", "not a ticker!"]);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("not a ticker!");
    });

    it("normalizes casing and deduplicates a valid list", () => {
        const result = validateDiscoveryImportTickers(["sony", "SONY", "005930.KS"]);
        expect(result.isValid).toBe(true);
        expect(result.tickers).toEqual(["SONY", "005930.KS"]);
    });
});

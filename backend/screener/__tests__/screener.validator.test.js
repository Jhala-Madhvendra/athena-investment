const { validateScreenerQuery, SCREENER_LIMIT_MAX } = require("../screener.validator");

describe("validateScreenerQuery", () => {
    it("returns sensible defaults for an empty query", () => {
        const result = validateScreenerQuery({});
        expect(result.isValid).toBe(true);
        expect(result.normalized).toMatchObject({
            sector: null,
            industry: null,
            minMarketCap: null,
            maxMarketCap: null,
            minHealthScore: null,
            maxHealthScore: null,
            sortBy: "healthScore",
            sortDirection: "desc",
            limit: 20,
        });
    });

    it("rejects an unsupported sortBy", () => {
        const result = validateScreenerQuery({ sortBy: "roe" });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("sortBy"))).toBe(true);
    });

    it("rejects minMarketCap greater than maxMarketCap", () => {
        const result = validateScreenerQuery({ minMarketCap: "500", maxMarketCap: "100" });
        expect(result.isValid).toBe(false);
    });

    it("rejects a healthScore filter outside 0-100", () => {
        const result = validateScreenerQuery({ minHealthScore: "150" });
        expect(result.isValid).toBe(false);
    });

    it("clamps a limit above SCREENER_LIMIT_MAX instead of rejecting it", () => {
        const result = validateScreenerQuery({ limit: "500" });
        expect(result.isValid).toBe(true);
        expect(result.normalized.limit).toBe(SCREENER_LIMIT_MAX);
    });

    it("trims and passes through sector/industry filters", () => {
        const result = validateScreenerQuery({ sector: "  Technology  " });
        expect(result.normalized.sector).toBe("Technology");
    });
});

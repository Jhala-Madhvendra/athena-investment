const { calculatePortfolioBeta } = require("../portfolio.analytics.risk");

describe("calculatePortfolioBeta", () => {
    it("computes the weighted average beta when every holding has one", () => {
        const holdings = [
            { ticker: "AAPL", weight: 0.6, beta: 1.2 },
            { ticker: "MSFT", weight: 0.4, beta: 0.9 },
        ];

        const result = calculatePortfolioBeta(holdings);

        expect(result.beta).toBeCloseTo(0.6 * 1.2 + 0.4 * 0.9, 10);
        expect(result.coveragePercent).toBe(100);
        expect(result.excludedTickers).toEqual([]);
    });

    it("renormalizes over holdings with a known beta when one is missing, if coverage is still sufficient", () => {
        const holdings = [
            { ticker: "AAPL", weight: 0.7, beta: 1.2 },
            { ticker: "NEWCO", weight: 0.3, beta: null },
        ];

        const result = calculatePortfolioBeta(holdings);

        expect(result.beta).toBeCloseTo(1.2, 10);
        expect(result.coveragePercent).toBe(70);
        expect(result.excludedTickers).toEqual(["NEWCO"]);
    });

    it("returns null beta when covered weight falls below the minimum coverage threshold", () => {
        const holdings = [
            { ticker: "AAPL", weight: 0.4, beta: 1.2 },
            { ticker: "NEWCO", weight: 0.6, beta: null },
        ];

        const result = calculatePortfolioBeta(holdings);

        expect(result.beta).toBeNull();
        expect(result.coveragePercent).toBe(40);
        expect(result.excludedTickers).toEqual(["NEWCO"]);
    });

    it("returns null with no holdings", () => {
        expect(calculatePortfolioBeta([])).toEqual({ beta: null, coveragePercent: 0, excludedTickers: [] });
    });
});

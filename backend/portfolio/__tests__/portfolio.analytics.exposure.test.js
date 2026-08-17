const { groupByClassification, calculateConcentration, UNCLASSIFIED_LABEL } = require("../portfolio.analytics.exposure");

describe("groupByClassification", () => {
    const positions = [
        { ticker: "AAPL", weightPercent: 40 },
        { ticker: "MSFT", weightPercent: 35 },
        { ticker: "NEWCO", weightPercent: 25 },
    ];
    const classify = (ticker) => ({ AAPL: "Technology", MSFT: "Technology" }[ticker] || null);

    it("sums weight within a classification and sorts descending", () => {
        const result = groupByClassification(positions, classify);

        expect(result[0]).toMatchObject({ label: "Technology", weightPercent: 75 });
        expect(result[0].tickers.sort()).toEqual(["AAPL", "MSFT"]);
    });

    it("groups unclassified positions under UNCLASSIFIED_LABEL instead of dropping them", () => {
        const result = groupByClassification(positions, classify);
        const unclassified = result.find((g) => g.label === UNCLASSIFIED_LABEL);

        expect(unclassified).toMatchObject({ weightPercent: 25, tickers: ["NEWCO"] });
    });

    it("returns an empty array for no positions", () => {
        expect(groupByClassification([], classify)).toEqual([]);
    });

    it("skips positions without a finite weight", () => {
        const result = groupByClassification([{ ticker: "X", weightPercent: null }], classify);
        expect(result).toEqual([]);
    });
});

describe("calculateConcentration", () => {
    it("computes top1/top3/top5 and HHI on a percentage-point scale", () => {
        const positions = [
            { ticker: "A", weightPercent: 40 },
            { ticker: "B", weightPercent: 30 },
            { ticker: "C", weightPercent: 20 },
            { ticker: "D", weightPercent: 10 },
        ];

        const result = calculateConcentration(positions);

        expect(result.top1WeightPercent).toBe(40);
        expect(result.top3WeightPercent).toBe(90);
        expect(result.top5WeightPercent).toBe(100);
        expect(result.hhi).toBeCloseTo(40 ** 2 + 30 ** 2 + 20 ** 2 + 10 ** 2, 5);
    });

    it("reports HHI of 10,000 for a single fully concentrated holding", () => {
        const result = calculateConcentration([{ ticker: "A", weightPercent: 100 }]);
        expect(result.hhi).toBe(10000);
    });

    it("returns nulls for an empty/unpriced portfolio", () => {
        expect(calculateConcentration([])).toEqual({
            top1WeightPercent: null,
            top3WeightPercent: null,
            top5WeightPercent: null,
            hhi: null,
        });
    });
});

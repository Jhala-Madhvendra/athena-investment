const { calculatePairwiseCorrelation, calculateCorrelationMatrix } = require("../portfolio.analytics.correlation");

/** Builds N days of returns with a given values array, dated sequentially. */
const seriesFrom = (values, startIndex = 1) =>
    values.map((value, i) => ({ date: `2025-01-${String(startIndex + i).padStart(2, "0")}`, return: value }));

describe("calculatePairwiseCorrelation", () => {
    it("returns 1 for two perfectly correlated series", () => {
        const values = Array.from({ length: 25 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01) + i * 0.0001);
        const a = seriesFrom(values);
        const b = seriesFrom(values.map((v) => v * 2)); // perfectly linearly related

        const result = calculatePairwiseCorrelation(a, b);
        expect(result.correlation).toBeCloseTo(1, 6);
        expect(result.observations).toBe(25);
    });

    it("returns -1 for two perfectly inversely correlated series", () => {
        const values = Array.from({ length: 25 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01) + i * 0.0001);
        const a = seriesFrom(values);
        const b = seriesFrom(values.map((v) => -v));

        const result = calculatePairwiseCorrelation(a, b);
        expect(result.correlation).toBeCloseTo(-1, 6);
    });

    it("only uses overlapping dates between the two series", () => {
        const a = seriesFrom(Array.from({ length: 30 }, (_, i) => 0.01 * (i % 3)), 1);
        const b = seriesFrom(Array.from({ length: 25 }, (_, i) => 0.01 * (i % 3)), 6); // shifted start, 25 overlapping-ish dates

        const result = calculatePairwiseCorrelation(a, b);
        expect(result.observations).toBeLessThanOrEqual(25);
    });

    it("returns null when there are fewer than the minimum overlapping observations", () => {
        const a = seriesFrom([0.01, 0.02, -0.01]);
        const b = seriesFrom([0.01, 0.015, -0.02]);

        const result = calculatePairwiseCorrelation(a, b);
        expect(result.correlation).toBeNull();
        expect(result.observations).toBe(3);
    });

    it("returns null (not 0) when one series is constant (zero variance)", () => {
        const a = seriesFrom(Array.from({ length: 25 }, () => 0.01));
        const b = seriesFrom(Array.from({ length: 25 }, (_, i) => i * 0.001));

        const result = calculatePairwiseCorrelation(a, b);
        expect(result.correlation).toBeNull();
    });
});

describe("calculateCorrelationMatrix", () => {
    it("builds a symmetric matrix with 1 on the diagonal", () => {
        const values = Array.from({ length: 25 }, (_, i) => 0.01 * (i % 5));
        const returnsByTicker = {
            AAPL: seriesFrom(values),
            MSFT: seriesFrom(values.map((v) => v * 0.5 + 0.001)),
        };

        const { tickers, matrix } = calculateCorrelationMatrix(returnsByTicker);

        expect(tickers).toEqual(["AAPL", "MSFT"]);
        expect(matrix.AAPL.AAPL).toBe(1);
        expect(matrix.MSFT.MSFT).toBe(1);
        expect(matrix.AAPL.MSFT).toBeCloseTo(matrix.MSFT.AAPL, 10);
    });

    it("handles a single-ticker portfolio", () => {
        const { tickers, matrix } = calculateCorrelationMatrix({ AAPL: seriesFrom([0.01, 0.02]) });
        expect(tickers).toEqual(["AAPL"]);
        expect(matrix.AAPL.AAPL).toBe(1);
    });

    it("handles no tickers", () => {
        expect(calculateCorrelationMatrix({})).toEqual({ tickers: [], matrix: {}, observations: {} });
    });
});

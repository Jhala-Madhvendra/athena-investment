const statistics = require("../comps.statistics");

describe("comps.statistics", () => {
    describe("mean", () => {
        it("averages the values", () => {
            expect(statistics.mean([10, 20, 30])).toBe(20);
        });

        it("returns null for an empty array", () => {
            expect(statistics.mean([])).toBeNull();
        });
    });

    describe("median", () => {
        it("returns the middle value for an odd-length sorted array", () => {
            expect(statistics.median([10, 15, 20])).toBe(15);
        });

        it("averages the two middle values for an even-length sorted array", () => {
            expect(statistics.median([10, 20, 30, 40])).toBe(25);
        });

        it("is far less sensitive to an outlier than the mean", () => {
            const withOutlier = [10, 12, 14, 16, 1000];
            expect(statistics.median(withOutlier)).toBe(14);
            expect(statistics.mean(withOutlier)).toBe(210.4);
        });
    });

    describe("percentile", () => {
        it("computes the 25th and 75th percentile via linear interpolation", () => {
            const sorted = [10, 20, 30, 40];
            // rank = 0.25 * 3 = 0.75 -> between index 0 (10) and 1 (20)
            expect(statistics.percentile(sorted, 0.25)).toBeCloseTo(17.5);
            // rank = 0.75 * 3 = 2.25 -> between index 2 (30) and 3 (40)
            expect(statistics.percentile(sorted, 0.75)).toBeCloseTo(32.5);
        });

        it("returns the single value for a one-element array", () => {
            expect(statistics.percentile([42], 0.25)).toBe(42);
        });

        it("returns null for an empty array", () => {
            expect(statistics.percentile([], 0.5)).toBeNull();
        });
    });

    describe("summarize", () => {
        it("computes count/min/max/mean/median for a small sample", () => {
            const result = statistics.summarize([10, 20, 30]);
            expect(result.count).toBe(3);
            expect(result.min).toBe(10);
            expect(result.max).toBe(30);
            expect(result.mean).toBe(20);
            expect(result.median).toBe(20);
        });

        it("omits percentiles below the minimum sample size", () => {
            const result = statistics.summarize([10, 20, 30]);
            expect(result.p25).toBeNull();
            expect(result.p75).toBeNull();
        });

        it("computes percentiles once the minimum sample size is met", () => {
            const result = statistics.summarize([10, 20, 30, 40]);
            expect(result.p25).not.toBeNull();
            expect(result.p75).not.toBeNull();
        });

        it("drops nulls/non-finite entries instead of treating them as zero", () => {
            const result = statistics.summarize([10, null, 20, NaN, 30]);
            expect(result.count).toBe(3);
            expect(result.mean).toBe(20);
        });

        it("returns an all-null shape for no valid observations", () => {
            const result = statistics.summarize([]);
            expect(result).toEqual({ count: 0, min: null, max: null, mean: null, median: null, p25: null, p75: null });
        });
    });
});

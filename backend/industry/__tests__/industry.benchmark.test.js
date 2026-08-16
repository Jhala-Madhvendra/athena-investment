const benchmark = require("../industry.benchmark");

describe("industry.benchmark.summarizeMetric", () => {
    it("reports unavailable when fewer than MIN_UNIVERSE_SIZE valid observations exist", () => {
        const result = benchmark.summarizeMetric([10, 20, 30]);
        expect(result.available).toBe(false);
        expect(result.count).toBe(3);
        expect(result.reason).toMatch(/at least 4/i);
    });

    it("computes mean/median once MIN_UNIVERSE_SIZE is met", () => {
        const result = benchmark.summarizeMetric([10, 20, 30, 40]);
        expect(result.available).toBe(true);
        expect(result.mean).toBe(25);
        expect(result.median).toBe(25);
    });

    it("drops nulls instead of treating them as zero, and counts only valid observations toward the minimum", () => {
        const result = benchmark.summarizeMetric([10, null, 20, null, 30]);
        expect(result.available).toBe(false);
        expect(result.count).toBe(3);
    });

    it("median is far less sensitive to an outlier than the mean (missing-data/outlier handling)", () => {
        const result = benchmark.summarizeMetric([10, 12, 14, 16, 1000]);
        expect(result.median).toBe(14);
        expect(result.mean).toBe(210.4);
    });
});

describe("industry.benchmark.percentileRank", () => {
    it("ranks a value in the middle of the universe near the 50th percentile", () => {
        expect(benchmark.percentileRank([10, 20, 30, 40], 25)).toBeCloseTo(50, 0);
    });

    it("ranks a value above the whole universe at the 100th percentile", () => {
        expect(benchmark.percentileRank([10, 20, 30, 40], 100)).toBe(100);
    });

    it("ranks a value below the whole universe at the 0th percentile", () => {
        expect(benchmark.percentileRank([10, 20, 30, 40], 0)).toBe(0);
    });

    it("gives ties half weight rather than jumping to the top of the tie band", () => {
        // 1 value below (10) + half of the 3 tied values (1.5), over 4 total = 62.5 -> rounds to 63,
        // not 100 (which a naive "count <= target" rank would wrongly produce for a value tied with most of the universe).
        expect(benchmark.percentileRank([10, 20, 20, 20], 20)).toBe(63);
    });

    it("returns null for an empty universe", () => {
        expect(benchmark.percentileRank([], 20)).toBeNull();
    });
});

describe("industry.benchmark.compareToTarget", () => {
    it("returns unavailable when the universe summary itself is unavailable", () => {
        const result = benchmark.compareToTarget(28, { available: false, reason: "too few peers" }, "percent");
        expect(result.available).toBe(false);
        expect(result.reason).toBe("too few peers");
    });

    it("returns unavailable when the company's own value is missing", () => {
        const universe = benchmark.summarizeMetric([10, 20, 30, 40]);
        const result = benchmark.compareToTarget(null, universe, "percent");
        expect(result.available).toBe(false);
        expect(result.universeMedian).toBe(25);
    });

    it("computes a percentage-point difference for percent metrics", () => {
        const universe = benchmark.summarizeMetric([18, 20, 22, 24]); // median 21
        const result = benchmark.compareToTarget(28, universe, "percent");
        expect(result.difference).toBeCloseTo(7);
        expect(result.note).toMatch(/\+7\.0 percentage points/);
    });

    it("computes a relative multiple for multiple-based metrics without a pp difference", () => {
        const universe = benchmark.summarizeMetric([20, 22, 24, 26]); // median 23
        const result = benchmark.compareToTarget(27, universe, "multiple");
        expect(result.relative).toBeCloseTo(27 / 23);
        expect(result.note).toMatch(/1\.17x the industry median/);
    });

    it("never fabricates a comparison when zero denominators produced a null company value upstream", () => {
        const universe = benchmark.summarizeMetric([1, 2, 3, 4]);
        const result = benchmark.compareToTarget(null, universe, "ratio");
        expect(result.available).toBe(false);
        expect(result.difference).toBeNull();
    });
});

describe("industry.benchmark.classifyPosition", () => {
    it("classifies a material positive difference as a strength", () => {
        const comparison = { available: true, difference: 7, unit: "percent" };
        expect(benchmark.classifyPosition(comparison)).toBe("strength");
    });

    it("classifies a material negative difference as a weakness", () => {
        const comparison = { available: true, difference: -5, unit: "percent" };
        expect(benchmark.classifyPosition(comparison)).toBe("weakness");
    });

    it("does not call an insignificant difference a strength or weakness", () => {
        const comparison = { available: true, difference: 1.2, unit: "percent" };
        expect(benchmark.classifyPosition(comparison)).toBe("neutral");
    });

    it("classifies exactly at the materiality threshold as significant (inclusive boundary)", () => {
        const comparison = { available: true, difference: benchmark.MATERIALITY_THRESHOLD_PP, unit: "percent" };
        expect(benchmark.classifyPosition(comparison)).toBe("strength");
    });

    it("returns unavailable when the comparison itself was unavailable", () => {
        expect(benchmark.classifyPosition({ available: false })).toBe("unavailable");
    });
});

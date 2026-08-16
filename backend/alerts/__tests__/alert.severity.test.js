const severity = require("../alert.severity");
const { THRESHOLDS, SEVERITY_MULTIPLIER } = require("../alert.rules");

describe("byMagnitude", () => {
    const threshold = THRESHOLDS.market.dailyMovePercent;

    it("returns MEDIUM at the threshold", () => {
        expect(severity.byMagnitude(threshold, threshold)).toBe("MEDIUM");
    });

    it("returns MEDIUM just under the HIGH boundary", () => {
        expect(severity.byMagnitude(threshold * SEVERITY_MULTIPLIER - 0.01, threshold)).toBe("MEDIUM");
    });

    it("returns HIGH at exactly the HIGH boundary", () => {
        expect(severity.byMagnitude(threshold * SEVERITY_MULTIPLIER, threshold)).toBe("HIGH");
    });

    it("treats a negative magnitude the same as its positive counterpart", () => {
        expect(severity.byMagnitude(-threshold * SEVERITY_MULTIPLIER, threshold)).toBe("HIGH");
    });
});

describe("forNewsCategory", () => {
    it("classifies Acquisition / Merger and Regulation / Legal as HIGH", () => {
        expect(severity.forNewsCategory("Acquisition / Merger")).toBe("HIGH");
        expect(severity.forNewsCategory("Regulation / Legal")).toBe("HIGH");
    });

    it("classifies other important categories (Earnings, Leadership) as MEDIUM", () => {
        expect(severity.forNewsCategory("Earnings")).toBe("MEDIUM");
        expect(severity.forNewsCategory("Leadership")).toBe("MEDIUM");
    });

    it("defaults to MEDIUM for an unrecognized category rather than throwing", () => {
        expect(severity.forNewsCategory("Something Unexpected")).toBe("MEDIUM");
    });
});

describe("forSignChange", () => {
    it("classifies declining-into-loss transitions as HIGH", () => {
        expect(severity.forSignChange("declinedToLoss")).toBe("HIGH");
        expect(severity.forSignChange("newLoss")).toBe("HIGH");
        expect(severity.forSignChange("wideningLoss")).toBe("HIGH");
    });

    it("classifies improving transitions as MEDIUM", () => {
        expect(severity.forSignChange("turnaround")).toBe("MEDIUM");
        expect(severity.forSignChange("narrowingLoss")).toBe("MEDIUM");
        expect(severity.forSignChange("newProfit")).toBe("MEDIUM");
    });
});

describe("forConcentration", () => {
    const medium = THRESHOLDS.portfolio.concentrationPercent;
    const high = THRESHOLDS.portfolio.concentrationHighPercent;

    it("returns null below the medium threshold (no alert should fire)", () => {
        expect(severity.forConcentration(medium - 0.01, medium, high)).toBeNull();
    });

    it("returns MEDIUM at the medium threshold", () => {
        expect(severity.forConcentration(medium, medium, high)).toBe("MEDIUM");
    });

    it("returns HIGH at the high threshold", () => {
        expect(severity.forConcentration(high, medium, high)).toBe("HIGH");
    });
});

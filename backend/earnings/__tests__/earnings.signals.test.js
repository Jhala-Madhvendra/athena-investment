const signals = require("../earnings.signals");
const { THRESHOLDS: ALERT_THRESHOLDS } = require("../../alerts/alert.rules");

describe("classifyByMagnitude", () => {
    const threshold = 5;

    it("returns Improving at or above the threshold", () => {
        expect(signals.classifyByMagnitude(5, threshold)).toBe("Improving");
        expect(signals.classifyByMagnitude(20, threshold)).toBe("Improving");
    });

    it("returns Deteriorating at or below the negative threshold", () => {
        expect(signals.classifyByMagnitude(-5, threshold)).toBe("Deteriorating");
        expect(signals.classifyByMagnitude(-20, threshold)).toBe("Deteriorating");
    });

    it("returns Stable strictly inside the band", () => {
        expect(signals.classifyByMagnitude(0, threshold)).toBe("Stable");
        expect(signals.classifyByMagnitude(4.99, threshold)).toBe("Stable");
        expect(signals.classifyByMagnitude(-4.99, threshold)).toBe("Stable");
    });

    it("returns null (no signal) when there is nothing to compare", () => {
        expect(signals.classifyByMagnitude(null, threshold)).toBeNull();
        expect(signals.classifyByMagnitude(undefined, threshold)).toBeNull();
    });
});

describe("classifyDirection", () => {
    const threshold = 15;

    it("returns the up arrow at or above the threshold", () => {
        expect(signals.classifyDirection(15, threshold)).toBe("↑");
    });

    it("returns the down arrow at or below the negative threshold", () => {
        expect(signals.classifyDirection(-15, threshold)).toBe("↓");
    });

    it("returns the flat arrow inside the band", () => {
        expect(signals.classifyDirection(5, threshold)).toBe("→");
    });

    it("returns null when there is nothing to compare", () => {
        expect(signals.classifyDirection(null, threshold)).toBeNull();
    });
});

describe("signalForMetric", () => {
    it("reads percentChange off a variance-shaped metric", () => {
        expect(signals.signalForMetric({ percentChange: 10 }, signals.SIGNAL_THRESHOLDS.growthPercent)).toBe("Improving");
    });

    it("returns null when the metric itself is missing", () => {
        expect(signals.signalForMetric(undefined, 5)).toBeNull();
        expect(signals.signalForMetric(null, 5)).toBeNull();
    });
});

describe("signalForMarginMetric", () => {
    it("reads pointChange, not percentChange, off a margin-shaped metric", () => {
        // A metric with a huge percentChange but a small pointChange should NOT be flagged -
        // margins are judged in percentage points, never relative percent (see calculator tests).
        expect(signals.signalForMarginMetric({ percentChange: 500, pointChange: 1 })).toBe("Stable");
        expect(signals.signalForMarginMetric({ percentChange: 0.1, pointChange: -4 })).toBe("Deteriorating");
    });

    it("defaults to the shared marginPoints threshold, matching alert.rules.js's marginChangePoints", () => {
        expect(signals.SIGNAL_THRESHOLDS.marginPoints).toBe(ALERT_THRESHOLDS.financial.marginChangePoints);
    });
});

describe("directionForBalanceSheetMetric", () => {
    it("never returns Improving/Deteriorating - only ↑/↓/→", () => {
        const result = signals.directionForBalanceSheetMetric({ percentChange: 30 });
        expect(["↑", "↓", "→"]).toContain(result);
    });

    it("reuses alert.rules.js's debtIncreasePercent as its threshold", () => {
        expect(signals.SIGNAL_THRESHOLDS.balanceSheetPercent).toBe(ALERT_THRESHOLDS.financial.debtIncreasePercent);
    });
});

describe("computeSignals", () => {
    const buildMetrics = () => ({
        growth: {
            revenue: { percentChange: 8 },
            operatingIncome: { percentChange: 2 },
            netIncome: { percentChange: -12 },
        },
        profitability: {
            operatingMargin: { pointChange: -4 },
            netMargin: { pointChange: 0.5 },
            returnOnEquity: { pointChange: null },
            returnOnAssets: { pointChange: 6 },
        },
        cashFlow: {
            freeCashFlow: { percentChange: -20 },
            fcfMargin: { pointChange: 1 },
        },
        balanceSheet: {
            totalDebt: { percentChange: 18 },
            cash: { percentChange: -2 },
            netDebt: { percentChange: -25 },
        },
    });

    it("classifies growth metrics against the growth threshold", () => {
        const result = signals.computeSignals(buildMetrics());
        expect(result.growth.revenue).toBe("Improving");
        expect(result.growth.operatingIncome).toBe("Stable");
        expect(result.growth.netIncome).toBe("Deteriorating");
    });

    it("classifies margin metrics by point change against the shared margin threshold", () => {
        const result = signals.computeSignals(buildMetrics());
        expect(result.profitability.operatingMargin).toBe("Deteriorating");
        expect(result.profitability.netMargin).toBe("Stable");
        expect(result.profitability.returnOnEquity).toBeNull();
        expect(result.profitability.returnOnAssets).toBe("Improving");
    });

    it("classifies FCF against its own (larger) threshold", () => {
        const result = signals.computeSignals(buildMetrics());
        expect(result.cashFlow.freeCashFlow).toBe("Deteriorating");
    });

    it("classifies FCF margin by point change, same as other margin metrics", () => {
        const result = signals.computeSignals(buildMetrics());
        expect(result.cashFlow.fcfMargin).toBe("Stable");
    });

    it("classifies balance sheet items as directions, never Improving/Deteriorating labels", () => {
        const result = signals.computeSignals(buildMetrics());
        expect(result.balanceSheet.totalDebt).toBe("↑");
        expect(result.balanceSheet.cash).toBe("→");
        expect(result.balanceSheet.netDebt).toBe("↓");
        Object.values(result.balanceSheet).forEach((value) => {
            expect(value === null || ["↑", "↓", "→"].includes(value)).toBe(true);
        });
    });

    it("returns an empty-shaped result for undefined metrics rather than throwing", () => {
        expect(() => signals.computeSignals(undefined)).not.toThrow();
        expect(signals.computeSignals(undefined)).toEqual({ growth: {}, profitability: {}, cashFlow: {}, balanceSheet: {} });
    });
});

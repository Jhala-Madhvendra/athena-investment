const calculator = require("../earnings.calculator");

const DEFAULT_INCOME_STATEMENT = {
    totalRevenue: 1000,
    operatingIncome: 300,
    netIncome: 200,
    grossProfit: 500,
    costOfRevenue: 500,
    basicEPS: 2.5,
    dilutedEPS: 2.4,
};
const DEFAULT_BALANCE_SHEET = {
    totalDebt: 300,
    totalStockholderEquity: 400,
    totalAssets: 1200,
    cashAndCashEquivalents: 100,
};
const DEFAULT_CASH_FLOW = {
    operatingCashFlow: 240,
    capitalExpenditure: -60,
};

const buildStatement = (year, overrides = {}) => ({
    year,
    incomeStatement: { ...DEFAULT_INCOME_STATEMENT, ...(overrides.incomeStatement || {}) },
    balanceSheet: { ...DEFAULT_BALANCE_SHEET, ...(overrides.balanceSheet || {}) },
    cashFlow: { ...DEFAULT_CASH_FLOW, ...(overrides.cashFlow || {}) },
});

describe("percentChange", () => {
    it("computes a positive percent change", () => {
        expect(calculator.percentChange(100, 120)).toBe(20);
    });

    it("computes a negative percent change", () => {
        expect(calculator.percentChange(100, 80)).toBe(-20);
    });

    it("returns null when previous is zero (invalid denominator)", () => {
        expect(calculator.percentChange(0, 120)).toBeNull();
    });

    it("returns null when previous is negative", () => {
        expect(calculator.percentChange(-50, 120)).toBeNull();
    });

    it("returns null when either input is missing", () => {
        expect(calculator.percentChange(null, 120)).toBeNull();
        expect(calculator.percentChange(100, null)).toBeNull();
        expect(calculator.percentChange(undefined, undefined)).toBeNull();
    });
});

describe("absoluteChange", () => {
    it("computes the absolute difference, including negative results", () => {
        expect(calculator.absoluteChange(100, 120)).toBe(20);
        expect(calculator.absoluteChange(120, 100)).toBe(-20);
    });

    it("returns null when either input is missing", () => {
        expect(calculator.absoluteChange(null, 120)).toBeNull();
    });

    it("still computes when previous is zero or negative - only percentChange rejects those", () => {
        expect(calculator.absoluteChange(0, 50)).toBe(50);
        expect(calculator.absoluteChange(-10, 5)).toBe(15);
    });
});

describe("marginPointChange", () => {
    it("returns the difference in percentage points, not a relative percent", () => {
        // 30.1% -> 28.4% is -1.7 percentage points, never "-6%"
        expect(calculator.marginPointChange(30.1, 28.4)).toBeCloseTo(-1.7, 5);
    });

    it("returns null when either input is missing", () => {
        expect(calculator.marginPointChange(null, 28.4)).toBeNull();
    });
});

describe("fcfConversion", () => {
    it("computes FCF / Net Income when both are positive", () => {
        const result = calculator.fcfConversion(180, 200);
        expect(result.available).toBe(true);
        expect(result.value).toBe(0.9);
        expect(result.caveat).toBeNull();
    });

    it("still computes a value when net income is negative, with a caveat attached (never labeled fraudulent)", () => {
        const result = calculator.fcfConversion(50, -20);
        expect(result.available).toBe(true);
        expect(result.value).toBe(-2.5);
        expect(result.caveat).toMatch(/negative/i);
        expect(result.caveat).not.toMatch(/fraud/i);
    });

    it("returns unavailable when net income is exactly zero (true divide-by-zero)", () => {
        const result = calculator.fcfConversion(50, 0);
        expect(result.available).toBe(false);
        expect(result.value).toBeNull();
    });

    it("returns unavailable when free cash flow is missing", () => {
        const result = calculator.fcfConversion(null, 200);
        expect(result.available).toBe(false);
    });
});

describe("computeGrowthMetrics", () => {
    it("computes revenue/operatingIncome/netIncome variance for two full periods", () => {
        const latest = buildStatement(2026, { incomeStatement: { totalRevenue: 1200, operatingIncome: 360, netIncome: 240 } });
        const previous = buildStatement(2025, { incomeStatement: { totalRevenue: 1000, operatingIncome: 300, netIncome: 200 } });

        const result = calculator.computeGrowthMetrics(latest, previous);

        expect(result.revenue).toMatchObject({ latest: 1200, previous: 1000, absoluteChange: 200, percentChange: 20, available: true });
        expect(result.operatingIncome).toMatchObject({ absoluteChange: 60, percentChange: 20 });
        expect(result.netIncome).toMatchObject({ absoluteChange: 40, percentChange: 20 });
    });

    it("still reports the latest value when there is no comparison period, with null change fields", () => {
        const latest = buildStatement(2026);

        const result = calculator.computeGrowthMetrics(latest, null);

        expect(result.revenue.available).toBe(true);
        expect(result.revenue.latest).toBe(1000);
        expect(result.revenue.previous).toBeNull();
        expect(result.revenue.absoluteChange).toBeNull();
        expect(result.revenue.percentChange).toBeNull();
    });

    it("marks a metric unavailable when the latest statement itself has no value for it", () => {
        const latest = buildStatement(2026, { incomeStatement: { totalRevenue: null } });
        const result = calculator.computeGrowthMetrics(latest, null);
        expect(result.revenue.available).toBe(false);
    });
});

describe("computeProfitabilityMetrics", () => {
    it("computes operating margin, net margin, ROE, ROA with point-change deltas", () => {
        const latest = buildStatement(2026, {
            incomeStatement: { totalRevenue: 1000, operatingIncome: 250, netIncome: 150 },
        });
        const previous = buildStatement(2025, {
            incomeStatement: { totalRevenue: 1000, operatingIncome: 300, netIncome: 200 },
        });

        const result = calculator.computeProfitabilityMetrics(latest, previous);

        // 30% -> 25% operating margin = -5 point change, not "-16.7%"
        expect(result.operatingMargin.latest).toBe(25);
        expect(result.operatingMargin.previous).toBe(30);
        expect(result.operatingMargin.pointChange).toBeCloseTo(-5, 5);
        expect(result.netMargin.available).toBe(true);
    });
});

describe("computeCashFlowMetrics", () => {
    it("computes FCF variance, FCF margin, and FCF conversion together", () => {
        const latest = buildStatement(2026, {
            incomeStatement: { totalRevenue: 1000, netIncome: 200 },
            cashFlow: { operatingCashFlow: 240, capitalExpenditure: -60 },
        });
        const previous = buildStatement(2025, {
            incomeStatement: { totalRevenue: 900, netIncome: 180 },
            cashFlow: { operatingCashFlow: 200, capitalExpenditure: -50 },
        });

        const result = calculator.computeCashFlowMetrics(latest, previous);

        expect(result.freeCashFlow.latest).toBe(180); // 240 - 60
        expect(result.freeCashFlow.previous).toBe(150); // 200 - 50
        expect(result.fcfMargin.available).toBe(true);
        expect(result.fcfConversion.available).toBe(true);
        expect(result.fcfConversion.value).toBe(0.9); // 180 / 200
    });
});

describe("computeBalanceSheetMetrics", () => {
    it("computes debt, cash, and net debt (debt - cash) variance", () => {
        const latest = buildStatement(2026, { balanceSheet: { totalDebt: 500, cashAndCashEquivalents: 150 } });
        const previous = buildStatement(2025, { balanceSheet: { totalDebt: 400, cashAndCashEquivalents: 200 } });

        const result = calculator.computeBalanceSheetMetrics(latest, previous);

        expect(result.totalDebt).toMatchObject({ latest: 500, previous: 400, absoluteChange: 100 });
        expect(result.cash).toMatchObject({ latest: 150, previous: 200, absoluteChange: -50 });
        expect(result.netDebt).toMatchObject({ latest: 350, previous: 200, absoluteChange: 150 });
    });
});

describe("computePerShareMetrics", () => {
    it("marks EPS available only when both periods report a value", () => {
        const latest = buildStatement(2026, { incomeStatement: { basicEPS: 2.75, dilutedEPS: 2.6 } });
        const previous = buildStatement(2025, { incomeStatement: { basicEPS: 2.5, dilutedEPS: 2.4 } });

        const result = calculator.computePerShareMetrics(latest, previous);

        expect(result.basicEPS.available).toBe(true);
        expect(result.basicEPS.percentChange).toBe(10);
    });

    it("marks EPS unavailable when only the latest period has a value - unlike revenue/income metrics", () => {
        const latest = buildStatement(2026, { incomeStatement: { basicEPS: 2.75 } });
        const previous = buildStatement(2025, { incomeStatement: { basicEPS: null } });

        const result = calculator.computePerShareMetrics(latest, previous);

        expect(result.basicEPS.available).toBe(false);
        expect(result.basicEPS.latest).toBe(2.75);
        expect(result.basicEPS.percentChange).toBeNull();
    });
});

describe("computeQualityObservations", () => {
    it("flags divergence when net income and free cash flow move in different directions", () => {
        const growth = { netIncome: { percentChange: 12 }, revenue: { percentChange: 8 } };
        const cashFlow = { freeCashFlow: { percentChange: -8 } };
        const balanceSheet = { totalDebt: { percentChange: 2 } };

        const observations = calculator.computeQualityObservations({ growth, cashFlow, balanceSheet });
        const niVsFcf = observations.find((o) => o.type === "netIncomeVsFcf");

        expect(niVsFcf.text).toMatch(/different directions/i);
        expect(niVsFcf.text).not.toMatch(/fraud|manipulat/i);
    });

    it("does not flag divergence when net income and free cash flow move the same direction", () => {
        const growth = { netIncome: { percentChange: 12 }, revenue: { percentChange: 8 } };
        const cashFlow = { freeCashFlow: { percentChange: 9 } };
        const balanceSheet = { totalDebt: { percentChange: 2 } };

        const observations = calculator.computeQualityObservations({ growth, cashFlow, balanceSheet });
        const niVsFcf = observations.find((o) => o.type === "netIncomeVsFcf");

        expect(niVsFcf.text).not.toMatch(/different directions/i);
    });

    it("returns no observation for a comparison with missing inputs, rather than a broken string", () => {
        const observations = calculator.computeQualityObservations({ growth: {}, cashFlow: {}, balanceSheet: {} });
        expect(observations).toEqual([]);
    });

    it("notes when debt increased alongside declining free cash flow", () => {
        const growth = { netIncome: { percentChange: 5 }, revenue: { percentChange: 5 } };
        const cashFlow = { freeCashFlow: { percentChange: -10 } };
        const balanceSheet = { totalDebt: { percentChange: 20 } };

        const observations = calculator.computeQualityObservations({ growth, cashFlow, balanceSheet });
        const debtVsFcf = observations.find((o) => o.type === "debtVsCashFlow");

        expect(debtVsFcf.text).toMatch(/worth watching/i);
    });
});

describe("calculateEarningsMetrics", () => {
    it("assembles growth, profitability, cashFlow, balanceSheet, perShare, and qualityObservations from two periods", () => {
        const latest = buildStatement(2026);
        const previous = buildStatement(2025, { incomeStatement: { totalRevenue: 900, operatingIncome: 250, netIncome: 170 } });

        const result = calculator.calculateEarningsMetrics(latest, previous);

        expect(result).toHaveProperty("growth.revenue");
        expect(result).toHaveProperty("profitability.operatingMargin");
        expect(result).toHaveProperty("cashFlow.fcfConversion");
        expect(result).toHaveProperty("balanceSheet.netDebt");
        expect(result).toHaveProperty("perShare.basicEPS");
        expect(Array.isArray(result.qualityObservations)).toBe(true);
    });

    it("degrades gracefully with only a latest statement and no comparison period", () => {
        const latest = buildStatement(2026);
        const result = calculator.calculateEarningsMetrics(latest, null);

        expect(result.growth.revenue.available).toBe(true);
        expect(result.growth.revenue.percentChange).toBeNull();
        expect(result.qualityObservations).toEqual([]);
    });

    it("does not throw when both statements are null", () => {
        expect(() => calculator.calculateEarningsMetrics(null, null)).not.toThrow();
        const result = calculator.calculateEarningsMetrics(null, null);
        expect(result.growth.revenue.available).toBe(false);
    });
});

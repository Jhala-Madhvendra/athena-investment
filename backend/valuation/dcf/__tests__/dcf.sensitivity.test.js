const { buildRangeAroundCenter, buildSensitivityMatrix } = require("../dcf.sensitivity");

const validInput = () => ({
    historicalFinancials: { latestRevenue: 1000, latestNWC: 150 },
    assumptions: {
        revenueGrowth: 0.08,
        ebitMargin: 0.2,
        depreciationPercentRevenue: 0.04,
        capexPercentRevenue: 0.05,
        workingCapitalPercentRevenue: 0.03,
        taxRate: 0.25,
        wacc: 0.09,
        terminalGrowthRate: 0.025,
        forecastYears: 5,
    },
    capitalStructure: { debt: 200, cash: 100, dilutedShares: 50 },
});

describe("buildRangeAroundCenter", () => {
    it("generates evenly-spaced values centered on the given value", () => {
        expect(buildRangeAroundCenter(0.09, 5, 0.01)).toEqual([0.07, 0.08, 0.09, 0.1, 0.11]);
    });

    it("supports a smaller custom step and step count", () => {
        expect(buildRangeAroundCenter(0.025, 3, 0.005)).toEqual([0.02, 0.025, 0.03]);
    });
});

describe("buildSensitivityMatrix", () => {
    it("returns one row per WACC value, one cell per terminal growth value", () => {
        const matrix = buildSensitivityMatrix(validInput(), {
            waccValues: [0.08, 0.09, 0.1],
            terminalGrowthValues: [0.02, 0.025, 0.03],
        });

        expect(matrix.rows).toHaveLength(3);
        matrix.rows.forEach((row) => expect(row.cells).toHaveLength(3));
    });

    it("every valid cell's intrinsic value per share matches a direct calculateDCF call with the same wacc/g", () => {
        const { calculateDCF } = require("../dcf.engine");
        const input = validInput();
        const matrix = buildSensitivityMatrix(input, { waccValues: [0.1], terminalGrowthValues: [0.03] });

        const direct = calculateDCF({
            ...input,
            assumptions: { ...input.assumptions, wacc: 0.1, terminalGrowthRate: 0.03 },
        });

        expect(matrix.rows[0].cells[0].intrinsicValuePerShare).toBeCloseTo(direct.intrinsicValuePerShare);
    });

    it("marks a cell invalid (not throwing, not silently omitted) when terminal growth >= WACC", () => {
        const matrix = buildSensitivityMatrix(validInput(), {
            waccValues: [0.05],
            terminalGrowthValues: [0.05, 0.06],
        });

        const cell = matrix.rows[0].cells[0];
        expect(cell.isValid).toBe(false);
        expect(cell.intrinsicValuePerShare).toBeNull();
        expect(cell.errors.length).toBeGreaterThan(0);
    });

    it("higher WACC produces a lower intrinsic value per share, holding terminal growth fixed", () => {
        const matrix = buildSensitivityMatrix(validInput(), {
            waccValues: [0.07, 0.09, 0.11],
            terminalGrowthValues: [0.02],
        });

        const [low, mid, high] = matrix.rows.map((row) => row.cells[0].intrinsicValuePerShare);
        expect(low).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(high);
    });

    it("higher terminal growth produces a higher intrinsic value per share, holding WACC fixed", () => {
        const matrix = buildSensitivityMatrix(validInput(), {
            waccValues: [0.1],
            terminalGrowthValues: [0.01, 0.03, 0.05],
        });

        const [low, mid, high] = matrix.rows[0].cells.map((cell) => cell.intrinsicValuePerShare);
        expect(high).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(low);
    });

    it("is deterministic across repeated calls", () => {
        const grid = { waccValues: [0.08, 0.1], terminalGrowthValues: [0.02, 0.03] };
        expect(buildSensitivityMatrix(validInput(), grid)).toEqual(buildSensitivityMatrix(validInput(), grid));
    });
});

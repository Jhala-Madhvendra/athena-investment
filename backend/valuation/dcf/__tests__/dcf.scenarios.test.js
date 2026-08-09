const { SCENARIO_DELTAS, buildScenarioAssumptions, runScenarios } = require("../dcf.scenarios");

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

describe("buildScenarioAssumptions", () => {
    it("shifts revenueGrowth and ebitMargin by the given delta, leaving everything else untouched", () => {
        const base = validInput().assumptions;
        const bull = buildScenarioAssumptions(base, SCENARIO_DELTAS.bull);

        expect(bull.revenueGrowth).toBeCloseTo(0.1);
        expect(bull.ebitMargin).toBeCloseTo(0.22);
        expect(bull.taxRate).toBe(base.taxRate);
        expect(bull.wacc).toBe(base.wacc);
        expect(bull.terminalGrowthRate).toBe(base.terminalGrowthRate);
        expect(bull.capexPercentRevenue).toBe(base.capexPercentRevenue);
    });

    it("applies the delta to every entry when the assumption is a per-year array", () => {
        const base = { ...validInput().assumptions, revenueGrowth: [0.05, 0.06, 0.07], ebitMargin: [0.2, 0.2, 0.2] };
        const bear = buildScenarioAssumptions(base, SCENARIO_DELTAS.bear);

        expect(bear.revenueGrowth.map((v) => Number(v.toFixed(4)))).toEqual([0.03, 0.04, 0.05]);
        expect(bear.ebitMargin.every((m) => Math.abs(m - 0.18) < 1e-9)).toBe(true);
    });

    it("the base scenario delta is a no-op", () => {
        const base = validInput().assumptions;
        const result = buildScenarioAssumptions(base, SCENARIO_DELTAS.base);
        expect(result.revenueGrowth).toBeCloseTo(base.revenueGrowth);
        expect(result.ebitMargin).toBeCloseTo(base.ebitMargin);
    });
});

describe("runScenarios", () => {
    it("returns valid, deterministic results for all three scenarios", () => {
        const input = validInput();
        const first = runScenarios(input);
        const second = runScenarios(validInput());

        expect(first.bear.isValid).toBe(true);
        expect(first.base.isValid).toBe(true);
        expect(first.bull.isValid).toBe(true);
        expect(first).toEqual(second);
    });

    it("bull case produces a higher intrinsic value than base, which is higher than bear", () => {
        const { bear, base, bull } = runScenarios(validInput());

        expect(bull.intrinsicValuePerShare).toBeGreaterThan(base.intrinsicValuePerShare);
        expect(base.intrinsicValuePerShare).toBeGreaterThan(bear.intrinsicValuePerShare);
    });

    it("does not mutate the WACC or terminal growth rate across scenarios", () => {
        const { bear, base, bull } = runScenarios(validInput());
        expect(bear.assumptionsUsed.wacc).toBe(0.09);
        expect(base.assumptionsUsed.wacc).toBe(0.09);
        expect(bull.assumptionsUsed.wacc).toBe(0.09);
        expect(bear.assumptionsUsed.terminalGrowthRate).toBe(0.025);
        expect(bull.assumptionsUsed.terminalGrowthRate).toBe(0.025);
    });

    it("propagates invalid input as an invalid result rather than throwing", () => {
        const input = validInput();
        input.capitalStructure.dilutedShares = 0;

        const { bear, base, bull } = runScenarios(input);
        expect(bear.isValid).toBe(false);
        expect(base.isValid).toBe(false);
        expect(bull.isValid).toBe(false);
    });

    it("accepts custom deltas instead of the defaults", () => {
        const input = validInput();
        const customDeltas = {
            bear: { revenueGrowth: -0.05, ebitMargin: -0.05 },
            base: { revenueGrowth: 0, ebitMargin: 0 },
            bull: { revenueGrowth: 0.05, ebitMargin: 0.05 },
        };
        const { bear, bull } = runScenarios(input, customDeltas);
        // assumptionsUsed.revenueGrowth is normalized to a per-year array by the engine
        expect(bear.assumptionsUsed.revenueGrowth[0]).toBeCloseTo(0.03);
        expect(bull.assumptionsUsed.revenueGrowth[0]).toBeCloseTo(0.13);
    });
});

const validateDCFInput = require("../dcf.validator");

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

describe("dcf.validator", () => {
    it("accepts a well-formed input", () => {
        const result = validateDCFInput(validInput());
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("accepts per-year assumption arrays matching forecastYears", () => {
        const input = validInput();
        input.assumptions.revenueGrowth = [0.1, 0.09, 0.08, 0.07, 0.06];
        input.assumptions.ebitMargin = [0.18, 0.19, 0.2, 0.2, 0.2];
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(true);
    });

    it("rejects an assumption array of the wrong length", () => {
        const input = validInput();
        input.assumptions.revenueGrowth = [0.1, 0.09];
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("revenueGrowth"))).toBe(true);
    });

    it("rejects WACC equal to terminal growth", () => {
        const input = validInput();
        input.assumptions.wacc = 0.03;
        input.assumptions.terminalGrowthRate = 0.03;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes("terminal growth"))).toBe(true);
    });

    it("rejects WACC less than terminal growth", () => {
        const input = validInput();
        input.assumptions.wacc = 0.02;
        input.assumptions.terminalGrowthRate = 0.03;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("rejects WACC = 0", () => {
        const input = validInput();
        input.assumptions.wacc = 0;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("wacc"))).toBe(true);
    });

    it("rejects zero forecast years", () => {
        const input = validInput();
        input.assumptions.forecastYears = 0;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("rejects a non-positive revenue base", () => {
        const input = validInput();
        input.historicalFinancials.latestRevenue = 0;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("rejects zero diluted shares rather than silently substituting a value", () => {
        const input = validInput();
        input.capitalStructure.dilutedShares = 0;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("dilutedShares"))).toBe(true);
    });

    it("rejects missing diluted shares", () => {
        const input = validInput();
        delete input.capitalStructure.dilutedShares;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("rejects missing capital structure", () => {
        const input = validInput();
        delete input.capitalStructure;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("capitalStructure"))).toBe(true);
    });

    it("rejects missing historical financials", () => {
        const input = validInput();
        delete input.historicalFinancials;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("rejects a negative or out-of-range tax rate", () => {
        const negative = validInput();
        negative.assumptions.taxRate = -0.1;
        expect(validateDCFInput(negative).isValid).toBe(false);

        const tooHigh = validInput();
        tooHigh.assumptions.taxRate = 1;
        expect(validateDCFInput(tooHigh).isValid).toBe(false);
    });

    it("rejects negative debt or cash", () => {
        const input = validInput();
        input.capitalStructure.debt = -50;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(false);
    });

    it("accepts extremely high growth assumptions (economically implausible, still valid math)", () => {
        const input = validInput();
        input.assumptions.revenueGrowth = 5; // 500% growth
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(true);
    });

    it("accepts negative terminal growth as long as it stays below WACC", () => {
        const input = validInput();
        input.assumptions.terminalGrowthRate = -0.05;
        const result = validateDCFInput(input);
        expect(result.isValid).toBe(true);
    });
});

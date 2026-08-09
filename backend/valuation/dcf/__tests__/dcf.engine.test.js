const { calculateDCF, calculateHistoricalFCFF, forecastFCFF, normalizeYearlySeries } = require("../dcf.engine");

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

describe("normalizeYearlySeries", () => {
    it("broadcasts a scalar to every year", () => {
        expect(normalizeYearlySeries(0.05, 3)).toEqual([0.05, 0.05, 0.05]);
    });

    it("passes an array through untouched", () => {
        expect(normalizeYearlySeries([0.1, 0.2], 2)).toEqual([0.1, 0.2]);
    });
});

describe("calculateHistoricalFCFF", () => {
    // capitalExpenditure is negative here deliberately - that's how Yahoo (and
    // standard cash-flow-statement convention) actually reports it. Confirmed
    // empirically against real data: OCF + capitalExpenditure == Yahoo's own
    // reported FCF for every year checked.
    const buildStatement = (year, overrides = {}) => ({
        year,
        incomeStatement: { operatingIncome: 200, pretaxIncome: 180, taxProvision: 45 },
        balanceSheet: { currentAssets: 500, currentLiabilities: 300 },
        cashFlow: { depreciationAndAmortization: 40, capitalExpenditure: -60 },
        ...overrides,
    });

    it("returns one entry per statement, oldest to newest", () => {
        const result = calculateHistoricalFCFF([buildStatement(2023), buildStatement(2022), buildStatement(2021)]);
        expect(result.map((r) => r.year)).toEqual([2021, 2022, 2023]);
    });

    it("marks the first year unavailable (no prior-year NWC to diff against)", () => {
        const result = calculateHistoricalFCFF([buildStatement(2021), buildStatement(2022)]);
        expect(result[0].available).toBe(false);
        expect(result[0].fcff).toBeNull();
        expect(result[0].changeInNWC).toBeNull();
    });

    it("computes FCFF for years with a prior-year comparison", () => {
        const result = calculateHistoricalFCFF([
            buildStatement(2021, { balanceSheet: { currentAssets: 480, currentLiabilities: 300 } }),
            buildStatement(2022, { balanceSheet: { currentAssets: 500, currentLiabilities: 300 } }),
        ]);
        const year2022 = result[1];
        expect(year2022.available).toBe(true);
        // taxRate = 45/180 = 0.25; NOPAT = 200*0.75 = 150
        // changeInNWC = (500-300) - (480-300) = 200 - 180 = 20
        // FCFF = 150 + 40 - 60 - 20 = 110
        expect(year2022.fcff).toBeCloseTo(110);
    });

    it("returns an empty array for no statements", () => {
        expect(calculateHistoricalFCFF([])).toEqual([]);
        expect(calculateHistoricalFCFF(null)).toEqual([]);
    });

    it("handles a missing effective tax rate (zero pretax income) without throwing", () => {
        const result = calculateHistoricalFCFF([
            buildStatement(2021),
            buildStatement(2022, { incomeStatement: { operatingIncome: 200, pretaxIncome: 0, taxProvision: 0 } }),
        ]);
        expect(result[1].taxRate).toBeNull();
        expect(result[1].fcff).toBeNull();
        expect(result[1].available).toBe(false);
    });

    it("normalizes a negative (outflow-signed) capitalExpenditure to a positive magnitude before subtracting it", () => {
        // Regression test: Yahoo reports capitalExpenditure as negative (e.g. -12,715,000,000
        // for a real AAPL year). Subtracting it unmodified would ADD it back and wildly
        // inflate FCFF instead of reducing it - the exact bug this normalization prevents.
        const positiveCapex = calculateHistoricalFCFF([
            buildStatement(2021, { cashFlow: { depreciationAndAmortization: 40, capitalExpenditure: -60 } }),
            buildStatement(2022, { cashFlow: { depreciationAndAmortization: 40, capitalExpenditure: -60 } }),
        ]);
        const negativeCapexStoredAsPositive = calculateHistoricalFCFF([
            buildStatement(2021, { cashFlow: { depreciationAndAmortization: 40, capitalExpenditure: 60 } }),
            buildStatement(2022, { cashFlow: { depreciationAndAmortization: 40, capitalExpenditure: 60 } }),
        ]);

        // Both signs should normalize to the same FCFF - the magnitude is what matters.
        expect(positiveCapex[1].capitalExpenditure).toBe(60);
        expect(positiveCapex[1].fcff).toBeCloseTo(negativeCapexStoredAsPositive[1].fcff);
    });
});

describe("forecastFCFF", () => {
    it("grows revenue from the latest historical base year over year", () => {
        const input = validInput();
        const detail = forecastFCFF(input);
        expect(detail).toHaveLength(5);
        expect(detail[0].revenue).toBeCloseTo(1000 * 1.08);
        expect(detail[1].revenue).toBeCloseTo(1000 * 1.08 * 1.08);
    });

    it("computes the full waterfall per year: revenue -> ebit -> nopat -> fcff", () => {
        const input = validInput();
        const [year1] = forecastFCFF(input);
        expect(year1.ebit).toBeCloseTo(year1.revenue * 0.2);
        expect(year1.nopat).toBeCloseTo(year1.ebit * 0.75);
        expect(year1.fcff).toBeCloseTo(
            year1.nopat + year1.depreciationAndAmortization - year1.capitalExpenditure - year1.changeInNWC
        );
    });

    it("discounts year t at 1/(1+wacc)^t", () => {
        const input = validInput();
        const detail = forecastFCFF(input);
        expect(detail[0].discountFactor).toBeCloseTo(1 / 1.09);
        expect(detail[4].discountFactor).toBeCloseTo(1 / Math.pow(1.09, 5));
    });

    it("supports per-year assumption arrays", () => {
        const input = validInput();
        input.assumptions.forecastYears = 3;
        input.assumptions.revenueGrowth = [0.1, 0.08, 0.05];
        input.assumptions.ebitMargin = [0.18, 0.19, 0.2];
        input.assumptions.depreciationPercentRevenue = 0.04;
        input.assumptions.capexPercentRevenue = 0.05;
        input.assumptions.workingCapitalPercentRevenue = 0.03;

        const detail = forecastFCFF(input);
        expect(detail).toHaveLength(3);
        expect(detail[0].revenue).toBeCloseTo(1100);
        expect(detail[1].revenue).toBeCloseTo(1100 * 1.08);
    });
});

describe("calculateDCF", () => {
    it("produces a deterministic, internally consistent valuation for valid input", () => {
        const first = calculateDCF(validInput());
        const second = calculateDCF(validInput());

        expect(first.isValid).toBe(true);
        expect(first).toEqual(second); // determinism: same input -> same output

        expect(first.projectedFCFF).toHaveLength(5);
        expect(first.pvOfFCFF).toBeCloseTo(
            first.forecastDetail.reduce((sum, entry) => sum + entry.presentValue, 0)
        );
        expect(first.enterpriseValue).toBeCloseTo(first.pvOfFCFF + first.pvOfTerminalValue);
        expect(first.equityValue).toBeCloseTo(first.enterpriseValue - first.netDebt);
        expect(first.intrinsicValuePerShare).toBeCloseTo(first.equityValue / 50);
    });

    it("rejects invalid input instead of computing a misleading number", () => {
        const input = validInput();
        input.assumptions.wacc = 0.02;
        input.assumptions.terminalGrowthRate = 0.03;

        const result = calculateDCF(input);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.enterpriseValue).toBeUndefined();
    });

    it("still produces a valuation when forecast FCFF is negative in early years", () => {
        const input = validInput();
        input.assumptions.ebitMargin = 0.02;
        input.assumptions.capexPercentRevenue = 0.15;
        input.assumptions.workingCapitalPercentRevenue = 0.2; // NWC grows a lot vs. the 150 base -> cash outflow

        const result = calculateDCF(input);
        expect(result.isValid).toBe(true);
        expect(result.projectedFCFF[0]).toBeLessThan(0);
        // Still produces a number - a negative near-term FCFF does not invalidate the model.
        expect(typeof result.intrinsicValuePerShare).toBe("number");
    });

    it("handles a net-cash capital structure (cash exceeds debt)", () => {
        const input = validInput();
        input.capitalStructure = { debt: 50, cash: 300, dilutedShares: 50 };

        const result = calculateDCF(input);
        expect(result.isValid).toBe(true);
        expect(result.netDebt).toBeLessThan(0);
        expect(result.equityValue).toBeGreaterThan(result.enterpriseValue);
    });

    it("rejects zero diluted shares via the validator rather than dividing by zero", () => {
        const input = validInput();
        input.capitalStructure.dilutedShares = 0;

        const result = calculateDCF(input);
        expect(result.isValid).toBe(false);
    });
});

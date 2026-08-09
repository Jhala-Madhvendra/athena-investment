const formulas = require("../dcf.formulas");

describe("dcf.formulas", () => {
    describe("effectiveTaxRate", () => {
        it("divides tax provision by pretax income", () => {
            expect(formulas.effectiveTaxRate(1000, 210)).toBeCloseTo(0.21);
        });

        it("returns null when pretax income is zero", () => {
            expect(formulas.effectiveTaxRate(0, 100)).toBeNull();
        });

        it("returns null for missing inputs", () => {
            expect(formulas.effectiveTaxRate(null, 100)).toBeNull();
        });
    });

    describe("nopat", () => {
        it("computes EBIT x (1 - tax rate)", () => {
            expect(formulas.nopat(1000, 0.25)).toBe(750);
        });

        it("handles negative EBIT (loss-making company)", () => {
            expect(formulas.nopat(-500, 0.25)).toBe(-375);
        });
    });

    describe("netWorkingCapital / changeInNetWorkingCapital", () => {
        it("computes NWC as current assets minus current liabilities", () => {
            expect(formulas.netWorkingCapital(500, 300)).toBe(200);
        });

        it("computes the year-over-year change", () => {
            expect(formulas.changeInNetWorkingCapital(250, 200)).toBe(50);
        });

        it("returns null when either NWC is missing", () => {
            expect(formulas.changeInNetWorkingCapital(250, null)).toBeNull();
        });
    });

    describe("fcff", () => {
        it("matches the documented formula: EBIT(1-t) + D&A - CapEx - ChangeInNWC", () => {
            const result = formulas.fcff({
                ebit: 1000,
                taxRate: 0.25,
                depreciationAndAmortization: 100,
                capitalExpenditure: 150,
                changeInNWC: 20,
            });
            // NOPAT = 750; 750 + 100 - 150 - 20 = 680
            expect(result).toBe(680);
        });

        it("can be negative when capex/NWC investment outpaces NOPAT+D&A", () => {
            const result = formulas.fcff({
                ebit: 100,
                taxRate: 0.25,
                depreciationAndAmortization: 50,
                capitalExpenditure: 400,
                changeInNWC: 50,
            });
            expect(result).toBeLessThan(0);
        });

        it("returns null when a required input is missing", () => {
            const result = formulas.fcff({
                ebit: 100,
                taxRate: 0.25,
                depreciationAndAmortization: undefined,
                capitalExpenditure: 50,
                changeInNWC: 10,
            });
            expect(result).toBeNull();
        });
    });

    describe("costOfEquityCAPM", () => {
        it("computes Ke = Rf + Beta x ERP", () => {
            expect(
                formulas.costOfEquityCAPM({ riskFreeRate: 0.04, beta: 1.2, equityRiskPremium: 0.05 })
            ).toBeCloseTo(0.1);
        });
    });

    describe("afterTaxCostOfDebt", () => {
        it("computes Kd x (1 - tax rate)", () => {
            expect(formulas.afterTaxCostOfDebt(0.06, 0.25)).toBeCloseTo(0.045);
        });
    });

    describe("wacc", () => {
        it("weights cost of equity and after-tax cost of debt by capital structure", () => {
            const result = formulas.wacc({
                marketValueOfEquity: 800,
                marketValueOfDebt: 200,
                costOfEquity: 0.1,
                afterTaxCostOfDebt: 0.045,
            });
            // 0.8*0.10 + 0.2*0.045 = 0.08 + 0.009 = 0.089
            expect(result).toBeCloseTo(0.089);
        });

        it("returns null when total capital is zero", () => {
            expect(
                formulas.wacc({ marketValueOfEquity: 0, marketValueOfDebt: 0, costOfEquity: 0.1, afterTaxCostOfDebt: 0.05 })
            ).toBeNull();
        });

        it("returns pure cost of equity when debt is zero", () => {
            const result = formulas.wacc({
                marketValueOfEquity: 500,
                marketValueOfDebt: 0,
                costOfEquity: 0.11,
                afterTaxCostOfDebt: 0.05,
            });
            expect(result).toBeCloseTo(0.11);
        });
    });

    describe("discountFactor", () => {
        it("computes 1/(1+r)^t", () => {
            expect(formulas.discountFactor(0.1, 1)).toBeCloseTo(0.9091, 4);
            expect(formulas.discountFactor(0.1, 2)).toBeCloseTo(0.8264, 4);
        });

        it("handles WACC = 0 (no discounting)", () => {
            expect(formulas.discountFactor(0, 3)).toBe(1);
        });
    });

    describe("terminalValueGordonGrowth", () => {
        it("computes FCFF(n+1) / (WACC - g)", () => {
            const result = formulas.terminalValueGordonGrowth({
                finalYearFCFF: 100,
                wacc: 0.1,
                terminalGrowthRate: 0.03,
            });
            // FCFF(n+1) = 103; 103 / 0.07 = 1471.43
            expect(result).toBeCloseTo(1471.43, 1);
        });

        it("returns null when WACC equals terminal growth", () => {
            const result = formulas.terminalValueGordonGrowth({
                finalYearFCFF: 100,
                wacc: 0.05,
                terminalGrowthRate: 0.05,
            });
            expect(result).toBeNull();
        });

        it("returns null when WACC is less than terminal growth", () => {
            const result = formulas.terminalValueGordonGrowth({
                finalYearFCFF: 100,
                wacc: 0.03,
                terminalGrowthRate: 0.05,
            });
            expect(result).toBeNull();
        });

        it("handles negative terminal growth", () => {
            const result = formulas.terminalValueGordonGrowth({
                finalYearFCFF: 100,
                wacc: 0.1,
                terminalGrowthRate: -0.02,
            });
            // FCFF(n+1) = 98; 98 / 0.12 = 816.67
            expect(result).toBeCloseTo(816.67, 1);
        });

        it("handles negative final-year FCFF", () => {
            const result = formulas.terminalValueGordonGrowth({
                finalYearFCFF: -50,
                wacc: 0.1,
                terminalGrowthRate: 0.03,
            });
            expect(result).toBeLessThan(0);
        });
    });

    describe("enterpriseValue / netDebt / equityValue", () => {
        it("sums PV of FCFF and PV of terminal value", () => {
            expect(formulas.enterpriseValue(500, 1500)).toBe(2000);
        });

        it("computes net debt as debt minus cash (can be negative)", () => {
            expect(formulas.netDebt(100, 300)).toBe(-200);
        });

        it("computes equity value as EV minus net debt", () => {
            expect(formulas.equityValue(2000, -200)).toBe(2200);
        });
    });

    describe("intrinsicValuePerShare", () => {
        it("divides equity value by diluted shares", () => {
            expect(formulas.intrinsicValuePerShare(1000, 100)).toBe(10);
        });

        it("returns null when shares outstanding is zero", () => {
            expect(formulas.intrinsicValuePerShare(1000, 0)).toBeNull();
        });
    });

    describe("upsideDownsidePercent", () => {
        it("computes valuation gap as a percentage, not a recommendation", () => {
            expect(formulas.upsideDownsidePercent(120, 100)).toBeCloseTo(20);
            expect(formulas.upsideDownsidePercent(80, 100)).toBeCloseTo(-20);
        });

        it("returns null when market price is zero or missing", () => {
            expect(formulas.upsideDownsidePercent(120, 0)).toBeNull();
            expect(formulas.upsideDownsidePercent(120, null)).toBeNull();
        });
    });
});

const { calculateImpliedValuation, MULTIPLE_DEFINITIONS } = require("../comps.valuation");

describe("comps.valuation", () => {
    describe("MULTIPLE_DEFINITIONS", () => {
        it("classifies P/E, P/B, P/S as equity multiples and EV/EBITDA, EV/Revenue as enterprise multiples", () => {
            expect(MULTIPLE_DEFINITIONS.pe.basis).toBe("equity");
            expect(MULTIPLE_DEFINITIONS.pb.basis).toBe("equity");
            expect(MULTIPLE_DEFINITIONS.ps.basis).toBe("equity");
            expect(MULTIPLE_DEFINITIONS.evEbitda.basis).toBe("enterprise");
            expect(MULTIPLE_DEFINITIONS.evRevenue.basis).toBe("enterprise");
        });
    });

    describe("equity multiples (pe / pb / ps)", () => {
        it("applies the peer statistic directly to the target metric for Implied Equity Value", () => {
            const result = calculateImpliedValuation("pe", 15, { netIncome: 400, dilutedShares: 100 });

            expect(result.isApplicable).toBe(true);
            expect(result.impliedEquityValue).toBe(6000);
            expect(result.impliedValuePerShare).toBe(60);
            expect(result.impliedEnterpriseValue).toBeUndefined();
        });

        it("is not applicable when the target's own metric is missing", () => {
            const result = calculateImpliedValuation("pb", 4, { bookValue: null, dilutedShares: 100 });
            expect(result.isApplicable).toBe(false);
            expect(result.reason).toMatch(/bookValue is not available/);
        });

        it("is not applicable when there is no valid peer statistic", () => {
            const result = calculateImpliedValuation("ps", null, { revenue: 5000, dilutedShares: 100 });
            expect(result.isApplicable).toBe(false);
            expect(result.reason).toMatch(/No valid peer P\/S observations/);
        });

        it("is not applicable when diluted shares are missing", () => {
            const result = calculateImpliedValuation("pe", 15, { netIncome: 400, dilutedShares: null });
            expect(result.isApplicable).toBe(false);
            expect(result.impliedEquityValue).toBe(6000);
            expect(result.impliedValuePerShare).toBeNull();
            expect(result.reason).toMatch(/Diluted shares outstanding/);
        });
    });

    describe("enterprise multiples (evEbitda / evRevenue)", () => {
        it("bridges Implied Enterprise Value to Implied Equity Value via Net Debt", () => {
            const result = calculateImpliedValuation("evEbitda", 10, {
                ebitda: 1000,
                debt: 2000,
                cash: 500,
                dilutedShares: 100,
            });

            expect(result.impliedEnterpriseValue).toBe(10000);
            expect(result.netDebt).toBe(1500);
            expect(result.impliedEquityValue).toBe(8500);
            expect(result.impliedValuePerShare).toBe(85);
            expect(result.isApplicable).toBe(true);
        });

        it("handles a net-cash target (negative net debt increases equity value above EV)", () => {
            const result = calculateImpliedValuation("evRevenue", 3, {
                revenue: 5000,
                debt: 0,
                cash: 2000,
                dilutedShares: 100,
            });

            expect(result.impliedEnterpriseValue).toBe(15000);
            expect(result.netDebt).toBe(-2000);
            expect(result.impliedEquityValue).toBe(17000);
            expect(result.impliedValuePerShare).toBe(170);
        });

        it("is not applicable when target debt/cash are missing (cannot bridge EV to equity)", () => {
            const result = calculateImpliedValuation("evEbitda", 10, {
                ebitda: 1000,
                debt: null,
                cash: null,
                dilutedShares: 100,
            });

            expect(result.isApplicable).toBe(false);
            expect(result.impliedEnterpriseValue).toBe(10000);
            expect(result.impliedEquityValue).toBeNull();
            expect(result.reason).toMatch(/debt\/cash is not available/);
        });

        it("is not applicable when the target's EBITDA/Revenue metric is missing", () => {
            const result = calculateImpliedValuation("evEbitda", 10, {
                ebitda: null,
                debt: 100,
                cash: 50,
                dilutedShares: 100,
            });

            expect(result.isApplicable).toBe(false);
            expect(result.reason).toMatch(/Target ebitda is not available/);
        });
    });

    it("returns isApplicable: false for an unknown multiple key", () => {
        const result = calculateImpliedValuation("notARealMultiple", 10, {});
        expect(result.isApplicable).toBe(false);
    });
});

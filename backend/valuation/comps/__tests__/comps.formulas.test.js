const formulas = require("../comps.formulas");

describe("comps.formulas", () => {
    describe("ebitda", () => {
        it("adds D&A back to operating income", () => {
            expect(formulas.ebitda(1000, 200)).toBe(1200);
        });

        it("can be negative when operating income is a large enough loss", () => {
            expect(formulas.ebitda(-500, 100)).toBe(-400);
        });

        it("returns null when either input is missing", () => {
            expect(formulas.ebitda(null, 200)).toBeNull();
            expect(formulas.ebitda(1000, undefined)).toBeNull();
        });
    });

    describe("enterpriseValue", () => {
        it("computes Market Cap + Debt - Cash", () => {
            expect(formulas.enterpriseValue(10000, 2000, 500)).toBe(11500);
        });

        it("can be lower than market cap for a net-cash company", () => {
            expect(formulas.enterpriseValue(10000, 0, 3000)).toBe(7000);
        });

        it("returns null when any input is missing", () => {
            expect(formulas.enterpriseValue(10000, null, 500)).toBeNull();
        });
    });

    describe("priceToEarnings", () => {
        it("divides market cap by net income", () => {
            expect(formulas.priceToEarnings(10000, 500)).toBe(20);
        });

        it("returns null for negative net income (P/E is not meaningful for a loss)", () => {
            expect(formulas.priceToEarnings(10000, -500)).toBeNull();
        });

        it("returns null for zero net income", () => {
            expect(formulas.priceToEarnings(10000, 0)).toBeNull();
        });
    });

    describe("evToEbitda", () => {
        it("divides EV by EBITDA", () => {
            expect(formulas.evToEbitda(12000, 1000)).toBe(12);
        });

        it("returns null for negative EBITDA", () => {
            expect(formulas.evToEbitda(12000, -100)).toBeNull();
        });

        it("returns null for zero EBITDA", () => {
            expect(formulas.evToEbitda(12000, 0)).toBeNull();
        });
    });

    describe("evToRevenue", () => {
        it("divides EV by revenue", () => {
            expect(formulas.evToRevenue(12000, 4000)).toBe(3);
        });

        it("returns null for zero revenue", () => {
            expect(formulas.evToRevenue(12000, 0)).toBeNull();
        });
    });

    describe("priceToBook", () => {
        it("divides market cap by book value", () => {
            expect(formulas.priceToBook(10000, 2000)).toBe(5);
        });

        it("returns null for zero or negative book value", () => {
            expect(formulas.priceToBook(10000, 0)).toBeNull();
            expect(formulas.priceToBook(10000, -100)).toBeNull();
        });
    });

    describe("priceToSales", () => {
        it("divides market cap by revenue", () => {
            expect(formulas.priceToSales(10000, 5000)).toBe(2);
        });

        it("returns null for zero revenue", () => {
            expect(formulas.priceToSales(10000, 0)).toBeNull();
        });
    });

    describe("safeDivide", () => {
        it("returns null for non-finite inputs", () => {
            expect(formulas.safeDivide(NaN, 5)).toBeNull();
            expect(formulas.safeDivide(5, Infinity)).toBeNull();
        });
    });
});

const { validateDividendInput } = require("../dividend.validator");

describe("validateDividendInput", () => {
    it("accepts a non-reinvested dividend and computes totalAmount", () => {
        const result = validateDividendInput({ amountPerShare: 0.5, shares: 100, payDate: "2025-01-01", reinvested: false });

        expect(result.isValid).toBe(true);
        expect(result.normalized.totalAmount).toBe(50);
        expect(result.normalized.sharesAcquired).toBeNull();
        expect(result.normalized.reinvestmentPrice).toBeNull();
    });

    it("computes sharesAcquired when reinvested with a valid price", () => {
        const result = validateDividendInput({
            amountPerShare: 1,
            shares: 100,
            payDate: "2025-01-01",
            reinvested: true,
            reinvestmentPrice: 25,
        });

        expect(result.isValid).toBe(true);
        expect(result.normalized.totalAmount).toBe(100);
        expect(result.normalized.sharesAcquired).toBe(4);
    });

    it("rejects reinvested:true with no reinvestment price", () => {
        const result = validateDividendInput({ amountPerShare: 1, shares: 100, payDate: "2025-01-01", reinvested: true });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Reinvestment price must be a positive number when a dividend is marked reinvested.");
    });

    it("rejects reinvested:true with a zero or negative reinvestment price", () => {
        const result = validateDividendInput({
            amountPerShare: 1,
            shares: 100,
            payDate: "2025-01-01",
            reinvested: true,
            reinvestmentPrice: 0,
        });

        expect(result.isValid).toBe(false);
    });

    it("rejects a reinvestment price set when reinvested is false", () => {
        const result = validateDividendInput({
            amountPerShare: 1,
            shares: 100,
            payDate: "2025-01-01",
            reinvested: false,
            reinvestmentPrice: 25,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Reinvestment price can only be set when a dividend is marked reinvested.");
    });

    it("rejects a negative amount per share", () => {
        const result = validateDividendInput({ amountPerShare: -1, shares: 100, payDate: "2025-01-01" });
        expect(result.isValid).toBe(false);
    });

    it("rejects a future pay date", () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        const result = validateDividendInput({ amountPerShare: 1, shares: 100, payDate: future });
        expect(result.isValid).toBe(false);
    });

    it("rejects a missing/invalid pay date", () => {
        const result = validateDividendInput({ amountPerShare: 1, shares: 100, payDate: "not-a-date" });
        expect(result.isValid).toBe(false);
    });
});

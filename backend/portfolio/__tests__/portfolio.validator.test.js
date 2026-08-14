const { validateHoldingInput } = require("../portfolio.validator");

const validInput = { shares: 10, averagePurchasePrice: 100, purchaseDate: "2025-01-01" };

describe("validateHoldingInput", () => {
    it("accepts valid input", () => {
        const result = validateHoldingInput(validInput);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.normalized).toMatchObject({ shares: 10, averagePurchasePrice: 100 });
    });

    it("rejects zero shares", () => {
        expect(validateHoldingInput({ ...validInput, shares: 0 }).isValid).toBe(false);
    });

    it("rejects negative shares (no short selling)", () => {
        expect(validateHoldingInput({ ...validInput, shares: -5 }).isValid).toBe(false);
    });

    it("rejects non-numeric shares", () => {
        expect(validateHoldingInput({ ...validInput, shares: "not-a-number" }).isValid).toBe(false);
    });

    it("accepts a zero purchase price (e.g. gifted shares)", () => {
        expect(validateHoldingInput({ ...validInput, averagePurchasePrice: 0 }).isValid).toBe(true);
    });

    it("rejects a negative purchase price", () => {
        expect(validateHoldingInput({ ...validInput, averagePurchasePrice: -1 }).isValid).toBe(false);
    });

    it("rejects a missing purchase date", () => {
        expect(validateHoldingInput({ ...validInput, purchaseDate: undefined }).isValid).toBe(false);
    });

    it("rejects an invalid purchase date", () => {
        expect(validateHoldingInput({ ...validInput, purchaseDate: "not-a-date" }).isValid).toBe(false);
    });

    it("rejects a future purchase date", () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        expect(validateHoldingInput({ ...validInput, purchaseDate: future.toISOString() }).isValid).toBe(false);
    });

    it("collects multiple errors at once", () => {
        const result = validateHoldingInput({ shares: -1, averagePurchasePrice: -1, purchaseDate: "bad" });
        expect(result.errors.length).toBe(3);
    });
});

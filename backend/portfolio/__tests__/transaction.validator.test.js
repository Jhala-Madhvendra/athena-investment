const { validateTransactionInput, TRANSACTION_TYPES } = require("../transaction.validator");

describe("validateTransactionInput", () => {
    const validInput = { type: "BUY", quantity: 10, price: 100, transactionDate: "2025-01-01" };

    it("accepts a valid BUY", () => {
        const result = validateTransactionInput(validInput);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.normalized).toMatchObject({ type: "BUY", quantity: 10, price: 100 });
    });

    it("accepts a valid SELL", () => {
        const result = validateTransactionInput({ ...validInput, type: "sell" });
        expect(result.isValid).toBe(true);
        expect(result.normalized.type).toBe("SELL");
    });

    it("rejects an unsupported type", () => {
        const result = validateTransactionInput({ ...validInput, type: "DIVIDEND" });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Transaction type must be one of/);
    });

    it.each([0, -1, NaN, "abc"])("rejects a non-positive or invalid quantity (%p)", (quantity) => {
        const result = validateTransactionInput({ ...validInput, quantity });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Quantity must be a positive number.");
    });

    it("accepts a fractional quantity", () => {
        const result = validateTransactionInput({ ...validInput, quantity: 0.25 });
        expect(result.isValid).toBe(true);
        expect(result.normalized.quantity).toBe(0.25);
    });

    it("accepts a zero price (e.g. a gifted/transferred lot)", () => {
        const result = validateTransactionInput({ ...validInput, price: 0 });
        expect(result.isValid).toBe(true);
    });

    it("rejects a negative price", () => {
        const result = validateTransactionInput({ ...validInput, price: -1 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Price must be zero or a positive number.");
    });

    it("rejects a missing or invalid transaction date", () => {
        expect(validateTransactionInput({ ...validInput, transactionDate: null }).isValid).toBe(false);
        expect(validateTransactionInput({ ...validInput, transactionDate: "not-a-date" }).isValid).toBe(false);
    });

    it("rejects a future transaction date", () => {
        const future = new Date(Date.now() + 86400000).toISOString();
        const result = validateTransactionInput({ ...validInput, transactionDate: future });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Transaction date cannot be in the future.");
    });

    it("returns null normalized when invalid", () => {
        const result = validateTransactionInput({ ...validInput, quantity: -1 });
        expect(result.normalized).toBeNull();
    });

    it("exposes the supported transaction types", () => {
        expect(TRANSACTION_TYPES).toEqual(["BUY", "SELL"]);
    });
});

const { validateStatementsAvailable } = require("../earnings.validator");

describe("validateStatementsAvailable", () => {
    it("is invalid when statements is an empty array", () => {
        const result = validateStatementsAvailable([]);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("is invalid when statements is not an array", () => {
        expect(validateStatementsAvailable(null).isValid).toBe(false);
        expect(validateStatementsAvailable(undefined).isValid).toBe(false);
    });

    it("is valid with a single statement - one period is enough to show a latest period", () => {
        const result = validateStatementsAvailable([{ year: 2026 }]);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("is valid with multiple statements", () => {
        expect(validateStatementsAvailable([{ year: 2026 }, { year: 2025 }]).isValid).toBe(true);
    });
});

const { validateSavedScenarioRequest } = require("../savedScenario.validator");

const validRule = { targetType: "PORTFOLIO", shockPercent: -10 };

describe("validateSavedScenarioRequest", () => {
    it("accepts a valid scenario + negative threshold", () => {
        const result = validateSavedScenarioRequest({ rules: [validRule], alertThresholdPercent: -15 });

        expect(result.isValid).toBe(true);
        expect(result.normalized.alertThresholdPercent).toBe(-15);
        expect(result.normalized.rules).toEqual([{ ...validRule, target: null }]);
    });

    it("rejects a missing alertThresholdPercent", () => {
        const result = validateSavedScenarioRequest({ rules: [validRule] });
        expect(result.isValid).toBe(false);
    });

    it("rejects a non-negative alertThresholdPercent", () => {
        expect(validateSavedScenarioRequest({ rules: [validRule], alertThresholdPercent: 0 }).isValid).toBe(false);
        expect(validateSavedScenarioRequest({ rules: [validRule], alertThresholdPercent: 15 }).isValid).toBe(false);
    });

    it("rejects a threshold beyond -100", () => {
        expect(validateSavedScenarioRequest({ rules: [validRule], alertThresholdPercent: -150 }).isValid).toBe(false);
    });

    it("still surfaces the underlying scenario validation errors (e.g. no rules)", () => {
        const result = validateSavedScenarioRequest({ rules: [], alertThresholdPercent: -15 });

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("rules"))).toBe(true);
    });

    it("accepts the boundary value -100", () => {
        expect(validateSavedScenarioRequest({ rules: [validRule], alertThresholdPercent: -100 }).isValid).toBe(true);
    });
});

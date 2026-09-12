const { validateSaveRequest, validateCompareRequest, MAX_COMPARE_SETS } = require("../valuationScenario.validator");

const validAssumptions = {
    riskFreeRate: 0.04,
    beta: 1.1,
    equityRiskPremium: 0.05,
    preTaxCostOfDebt: 0.06,
};

describe("validateSaveRequest", () => {
    it("rejects a missing name", () => {
        const result = validateSaveRequest({ ...validAssumptions });
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("name")]));
    });

    it("rejects assumptions missing required WACC fields, delegating to validateDCFRequestBody", () => {
        const result = validateSaveRequest({ name: "Base case" });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.includes("riskFreeRate"))).toBe(true);
    });

    it("accepts a well-formed request and strips name out of the normalized assumptions", () => {
        const result = validateSaveRequest({ name: "Aggressive growth", ...validAssumptions });
        expect(result.isValid).toBe(true);
        expect(result.normalized.name).toBe("Aggressive growth");
        expect(result.normalized.assumptions).not.toHaveProperty("name");
        expect(result.normalized.assumptions.riskFreeRate).toBe(0.04);
    });
});

describe("validateCompareRequest", () => {
    it("rejects fewer than 2 total entries", () => {
        const result = validateCompareRequest({ savedIds: ["507f1f77bcf86cd799439011"] });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.includes("At least"))).toBe(true);
    });

    it("rejects more than MAX_COMPARE_SETS total entries", () => {
        const savedIds = Array.from({ length: MAX_COMPARE_SETS + 1 }, () => "507f1f77bcf86cd799439011");
        const result = validateCompareRequest({ savedIds });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.includes("At most"))).toBe(true);
    });

    it("rejects a malformed savedId", () => {
        const result = validateCompareRequest({ savedIds: ["not-an-id", "507f1f77bcf86cd799439011"] });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.includes("savedIds[0]"))).toBe(true);
    });

    it("validates each adHoc entry's assumptions and name independently", () => {
        const result = validateCompareRequest({
            adHoc: [
                { name: "Bull", ...validAssumptions },
                { name: "", ...validAssumptions },
            ],
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.includes("adHoc[1].name"))).toBe(true);
        expect(result.normalized.adHoc).toHaveLength(1);
    });

    it("accepts a mix of savedIds and adHoc entries totaling within bounds", () => {
        const result = validateCompareRequest({
            savedIds: ["507f1f77bcf86cd799439011"],
            adHoc: [{ name: "Bull", ...validAssumptions }],
        });
        expect(result.isValid).toBe(true);
        expect(result.normalized.savedIds).toEqual(["507f1f77bcf86cd799439011"]);
        expect(result.normalized.adHoc).toHaveLength(1);
    });
});

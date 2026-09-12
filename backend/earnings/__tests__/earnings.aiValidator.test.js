const { validateSummarySchema } = require("../earnings.aiValidator");

const ALLOW_LIST = ["growth.revenue.variancePercent", "profitability.netMargin.current"];

describe("validateSummarySchema", () => {
    it("accepts a well-formed summary and trims the narrative", () => {
        const result = validateSummarySchema(
            { narrative: "  Revenue grew.  ", evidenceUsed: ["growth.revenue.variancePercent"] },
            ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized).toEqual({ narrative: "Revenue grew.", evidenceUsed: ["growth.revenue.variancePercent"] });
    });

    it("rejects a non-object response", () => {
        expect(validateSummarySchema(null, ALLOW_LIST).isValid).toBe(false);
        expect(validateSummarySchema("text", ALLOW_LIST).isValid).toBe(false);
        expect(validateSummarySchema(["array"], ALLOW_LIST).isValid).toBe(false);
    });

    it("rejects a missing or empty narrative", () => {
        expect(validateSummarySchema({ narrative: "" }, ALLOW_LIST).isValid).toBe(false);
        expect(validateSummarySchema({}, ALLOW_LIST).isValid).toBe(false);
    });

    it("rejects unexpected top-level fields", () => {
        const result = validateSummarySchema({ narrative: "ok", extraField: "nope" }, ALLOW_LIST);

        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toContain("extraField");
    });

    it("drops a hallucinated evidence path instead of failing validation", () => {
        const result = validateSummarySchema(
            { narrative: "ok", evidenceUsed: ["growth.revenue.variancePercent", "made.up.path"] },
            ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized.evidenceUsed).toEqual(["growth.revenue.variancePercent"]);
    });

    it("defaults evidenceUsed to an empty array when omitted", () => {
        const result = validateSummarySchema({ narrative: "ok" }, ALLOW_LIST);

        expect(result.isValid).toBe(true);
        expect(result.sanitized.evidenceUsed).toEqual([]);
    });
});

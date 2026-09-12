const { validateDigestSchema } = require("../portfolioDigest.validator");

const ALLOW_LIST = ["summary.totalReturnPercent", "holdings[0].weightPercent"];

describe("validateDigestSchema", () => {
    it("accepts a well-formed digest and trims narrative/note fields", () => {
        const result = validateDigestSchema(
            {
                narrative: "  Portfolio was up this week.  ",
                holdingHighlights: [{ ticker: "aapl", note: "  Reported strong earnings.  " }],
                evidenceUsed: ["summary.totalReturnPercent"],
            },
            ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized.narrative).toBe("Portfolio was up this week.");
        expect(result.sanitized.holdingHighlights).toEqual([{ ticker: "AAPL", note: "Reported strong earnings." }]);
        expect(result.sanitized.evidenceUsed).toEqual(["summary.totalReturnPercent"]);
    });

    it("rejects a non-object response", () => {
        expect(validateDigestSchema(null, ALLOW_LIST).isValid).toBe(false);
        expect(validateDigestSchema("text", ALLOW_LIST).isValid).toBe(false);
        expect(validateDigestSchema(["array"], ALLOW_LIST).isValid).toBe(false);
    });

    it("rejects a missing or empty narrative", () => {
        expect(validateDigestSchema({ narrative: "" }, ALLOW_LIST).isValid).toBe(false);
        expect(validateDigestSchema({}, ALLOW_LIST).isValid).toBe(false);
    });

    it("defaults holdingHighlights/evidenceUsed to empty arrays when omitted", () => {
        const result = validateDigestSchema({ narrative: "ok" }, ALLOW_LIST);

        expect(result.isValid).toBe(true);
        expect(result.sanitized.holdingHighlights).toEqual([]);
        expect(result.sanitized.evidenceUsed).toEqual([]);
    });

    it("rejects a malformed holdingHighlights entry (missing ticker or note)", () => {
        expect(validateDigestSchema({ narrative: "ok", holdingHighlights: [{ ticker: "AAPL" }] }, ALLOW_LIST).isValid).toBe(false);
        expect(validateDigestSchema({ narrative: "ok", holdingHighlights: ["not an object"] }, ALLOW_LIST).isValid).toBe(false);
    });

    it("rejects unexpected top-level fields", () => {
        const result = validateDigestSchema({ narrative: "ok", extraField: "nope" }, ALLOW_LIST);
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toContain("extraField");
    });

    it("drops a hallucinated evidence path instead of failing validation", () => {
        const result = validateDigestSchema({ narrative: "ok", evidenceUsed: ["summary.totalReturnPercent", "made.up.path"] }, ALLOW_LIST);

        expect(result.isValid).toBe(true);
        expect(result.sanitized.evidenceUsed).toEqual(["summary.totalReturnPercent"]);
    });
});

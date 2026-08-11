const { parseReportResponse } = require("../ai.responseParser");

describe("parseReportResponse", () => {
    it("parses a clean JSON object as-is", () => {
        const result = parseReportResponse('{"executiveSummary":"ok"}');
        expect(result).toEqual({ executiveSummary: "ok" });
    });

    it("strips a ```json code fence", () => {
        const result = parseReportResponse('```json\n{"executiveSummary":"ok"}\n```');
        expect(result).toEqual({ executiveSummary: "ok" });
    });

    it("strips a bare ``` code fence (no language tag)", () => {
        const result = parseReportResponse('```\n{"executiveSummary":"ok"}\n```');
        expect(result).toEqual({ executiveSummary: "ok" });
    });

    it("recovers JSON surrounded by stray prose", () => {
        const result = parseReportResponse('Here is the report:\n{"executiveSummary":"ok"}\nLet me know if you need changes.');
        expect(result).toEqual({ executiveSummary: "ok" });
    });

    it("tolerates surrounding whitespace", () => {
        const result = parseReportResponse('   \n {"executiveSummary":"ok"}  \n  ');
        expect(result).toEqual({ executiveSummary: "ok" });
    });

    it("throws on empty input", () => {
        expect(() => parseReportResponse("")).toThrow("empty");
        expect(() => parseReportResponse("   ")).toThrow("empty");
        expect(() => parseReportResponse(null)).toThrow("empty");
    });

    it("throws with the raw text attached when nothing resembling JSON can be recovered", () => {
        try {
            parseReportResponse("I cannot generate this report.");
            throw new Error("expected parseReportResponse to throw");
        } catch (error) {
            expect(error.message).toBe("The AI response was not valid JSON.");
            expect(error.rawText).toBe("I cannot generate this report.");
        }
    });

    it("throws when a {...} substring exists but isn't actually valid JSON", () => {
        expect(() => parseReportResponse("Some notes {not: valid, json here} more notes")).toThrow(
            "The AI response was not valid JSON."
        );
    });
});

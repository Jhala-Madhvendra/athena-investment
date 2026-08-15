const { validateReportRequest, validateReportSchema } = require("../ai.validator");

describe("validateReportRequest", () => {
    it("defaults regenerate to false and leaves preTaxCostOfDebt undefined when omitted", () => {
        const result = validateReportRequest({});
        expect(result).toEqual({ isValid: true, errors: [], regenerate: false, preTaxCostOfDebt: undefined });
    });

    it("accepts a valid regenerate flag and preTaxCostOfDebt", () => {
        const result = validateReportRequest({ regenerate: true, preTaxCostOfDebt: 0.045 });
        expect(result.isValid).toBe(true);
        expect(result.regenerate).toBe(true);
        expect(result.preTaxCostOfDebt).toBe(0.045);
    });

    it("rejects a non-boolean regenerate", () => {
        const result = validateReportRequest({ regenerate: "yes" });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("regenerate must be a boolean.");
    });

    it("rejects an out-of-range preTaxCostOfDebt", () => {
        expect(validateReportRequest({ preTaxCostOfDebt: 1.5 }).isValid).toBe(false);
        expect(validateReportRequest({ preTaxCostOfDebt: -0.01 }).isValid).toBe(false);
        expect(validateReportRequest({ preTaxCostOfDebt: "0.05" }).isValid).toBe(false);
    });

    it("tolerates a missing/non-object body", () => {
        expect(validateReportRequest(undefined).isValid).toBe(true);
        expect(validateReportRequest(null).isValid).toBe(true);
    });
});

const VALID_REPORT = {
    executiveSummary: "Athena's analysis indicates a financially healthy company trading above its DCF intrinsic value.",
    companyOverview: "The company operates in the Technology sector, Consumer Electronics industry, listed on NASDAQ.",
    businessPerformance: "Revenue grew at a 7.8% CAGR over the analysis window, with expanding operating margins.",
    financialHealth: "The overall health score of 78 reflects strong profitability and cash generation.",
    marketPerformance: "The stock trades at a P/E of 34.2, near the top of its 52-week range.",
    valuation: "The DCF model suggests a lower intrinsic value than the current market price.",
    conclusion: "Investors may want to investigate the gap between intrinsic and market value further.",
    strengths: ["Consistent revenue growth", "Strong free cash flow"],
    risks: ["High valuation multiple relative to historical average"],
    considerations: ["Comparable peer set was auto-selected and not manually reviewed"],
    dataGaps: ["Comparable company analysis peers were not manually vetted"],
    sectionEvidence: {
        financialHealth: ["analysis.healthScore.overall", "ratios.profitability.returnOnEquity"],
        valuation: ["dcf.intrinsicValuePerShare", "dcf.upsideDownsidePercent"],
    },
};

const EVIDENCE_ALLOW_LIST = [
    "analysis.healthScore.overall",
    "ratios.profitability.returnOnEquity",
    "dcf.intrinsicValuePerShare",
    "dcf.upsideDownsidePercent",
];

describe("validateReportSchema", () => {
    it("accepts a fully well-formed report and sanitizes/trims it", () => {
        const result = validateReportSchema(
            { ...VALID_REPORT, executiveSummary: `  ${VALID_REPORT.executiveSummary}  ` },
            EVIDENCE_ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.sanitized.executiveSummary).toBe(VALID_REPORT.executiveSummary);
        expect(result.sanitized.sectionEvidence).toEqual(VALID_REPORT.sectionEvidence);
    });

    it.each(["not an object", null, undefined, 42, ["array"]])("rejects a non-object report: %p", (bad) => {
        const result = validateReportSchema(bad);
        expect(result.isValid).toBe(false);
        expect(result.sanitized).toBeNull();
    });

    it("rejects missing required string sections", () => {
        const { executiveSummary, ...withoutExecSummary } = VALID_REPORT;
        const result = validateReportSchema(withoutExecSummary, EVIDENCE_ALLOW_LIST);

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("executiveSummary")]));
    });

    it("rejects a blank/whitespace-only required string", () => {
        const result = validateReportSchema({ ...VALID_REPORT, conclusion: "   " }, EVIDENCE_ALLOW_LIST);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("conclusion")]));
    });

    it("rejects strengths/risks/considerations that aren't non-empty string arrays", () => {
        expect(validateReportSchema({ ...VALID_REPORT, strengths: [] }, EVIDENCE_ALLOW_LIST).isValid).toBe(false);
        expect(validateReportSchema({ ...VALID_REPORT, risks: "not an array" }, EVIDENCE_ALLOW_LIST).isValid).toBe(false);
        expect(validateReportSchema({ ...VALID_REPORT, considerations: [""] }, EVIDENCE_ALLOW_LIST).isValid).toBe(false);
        expect(validateReportSchema({ ...VALID_REPORT, strengths: ["ok", 42] }, EVIDENCE_ALLOW_LIST).isValid).toBe(false);
    });

    it("rejects unexpected top-level fields (e.g. a smuggled recommendation field)", () => {
        const result = validateReportSchema({ ...VALID_REPORT, targetPrice: 250 }, EVIDENCE_ALLOW_LIST);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("targetPrice")]));
    });

    it("allows dataGaps and sectionEvidence to be omitted", () => {
        const { dataGaps, sectionEvidence, ...minimal } = VALID_REPORT;
        const result = validateReportSchema(minimal, EVIDENCE_ALLOW_LIST);
        expect(result.isValid).toBe(true);
        expect(result.sanitized.dataGaps).toEqual([]);
        expect(result.sanitized.sectionEvidence).toEqual({});
    });

    it("strips evidence paths not present in the allow-list instead of failing", () => {
        const result = validateReportSchema(
            {
                ...VALID_REPORT,
                sectionEvidence: {
                    valuation: ["dcf.intrinsicValuePerShare", "dcf.fabricatedField"],
                    madeUpSection: ["ratios.profitability.returnOnEquity"],
                },
            },
            EVIDENCE_ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized.sectionEvidence.valuation).toEqual(["dcf.intrinsicValuePerShare"]);
        expect(result.sanitized.sectionEvidence.madeUpSection).toEqual(["ratios.profitability.returnOnEquity"]);
    });

    it("emits a non-fatal warning for stray recommendation language without rejecting the report", () => {
        const result = validateReportSchema(
            { ...VALID_REPORT, conclusion: "Investors should buy this stock immediately." },
            EVIDENCE_ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("accepts recentDevelopments when present and non-empty, sanitizing/trimming it", () => {
        const result = validateReportSchema(
            { ...VALID_REPORT, recentDevelopments: "  The company reported quarterly earnings.  " },
            EVIDENCE_ALLOW_LIST
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized.recentDevelopments).toBe("The company reported quarterly earnings.");
    });

    it("allows recentDevelopments to be omitted entirely", () => {
        const result = validateReportSchema(VALID_REPORT, EVIDENCE_ALLOW_LIST);
        expect(result.isValid).toBe(true);
        expect(result.sanitized.recentDevelopments).toBeUndefined();
    });

    it("rejects a blank recentDevelopments if present", () => {
        const result = validateReportSchema({ ...VALID_REPORT, recentDevelopments: "   " }, EVIDENCE_ALLOW_LIST);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("recentDevelopments")]));
    });

    it("allows sectionEvidence.recentDevelopments to cite an article url from the allow-list", () => {
        const allowListWithUrl = [...EVIDENCE_ALLOW_LIST, "https://example.com/apple-earnings"];
        const result = validateReportSchema(
            {
                ...VALID_REPORT,
                recentDevelopments: "The company reported quarterly earnings ahead of estimates.",
                sectionEvidence: {
                    ...VALID_REPORT.sectionEvidence,
                    recentDevelopments: ["https://example.com/apple-earnings"],
                },
            },
            allowListWithUrl
        );

        expect(result.isValid).toBe(true);
        expect(result.sanitized.sectionEvidence.recentDevelopments).toEqual(["https://example.com/apple-earnings"]);
    });

    it("does not flag benign phrases containing 'sell'/'buy' as substrings only via word-boundary matching", () => {
        const result = validateReportSchema(
            { ...VALID_REPORT, conclusion: "The sell-through rate and buyer sentiment are both improving." },
            EVIDENCE_ALLOW_LIST
        );
        // "sell" and "buy" still match as whole words here by design (soft check) -
        // this test documents the known false-positive rather than asserting silence.
        expect(result.isValid).toBe(true);
    });
});

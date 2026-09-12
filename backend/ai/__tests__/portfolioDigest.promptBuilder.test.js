const { buildPrompt, buildEvidenceAllowList } = require("../portfolioDigest.promptBuilder");

const CONTEXT = {
    hasHoldings: true,
    summary: { totalCurrentValue: 10000, totalReturnPercent: 5.2 },
    holdings: [
        {
            ticker: "AAPL",
            weightPercent: 60,
            returnPercent: 8,
            recentNews: [{ title: "Apple reports Q3 earnings", publishedAt: "2026-08-01T00:00:00.000Z", url: "https://example.com/a" }],
        },
        { ticker: "MSFT", weightPercent: 40, returnPercent: 2, recentNews: [] },
    ],
};

describe("buildEvidenceAllowList", () => {
    it("flattens summary and per-holding numeric fields into dot-paths", () => {
        const allowList = buildEvidenceAllowList(CONTEXT);

        expect(allowList).toContain("summary.totalCurrentValue");
        expect(allowList).toContain("summary.totalReturnPercent");
        expect(allowList).toContain("holdings[0].weightPercent");
        expect(allowList).toContain("holdings[1].returnPercent");
    });

    it("includes article URLs as citable evidence", () => {
        expect(buildEvidenceAllowList(CONTEXT)).toContain("https://example.com/a");
    });

    it("never includes a ticker itself as an evidence path", () => {
        expect(buildEvidenceAllowList(CONTEXT).some((p) => p === "AAPL" || p.includes(".ticker"))).toBe(false);
    });

    it("tolerates an empty context without throwing", () => {
        expect(() => buildEvidenceAllowList({})).not.toThrow();
        expect(buildEvidenceAllowList({})).toEqual([]);
    });
});

describe("buildPrompt", () => {
    it("returns a system prompt, user message, and generation params", () => {
        const prompt = buildPrompt(CONTEXT, buildEvidenceAllowList(CONTEXT));

        expect(typeof prompt.systemPrompt).toBe("string");
        expect(typeof prompt.userMessage).toBe("string");
        expect(prompt.maxTokens).toBeGreaterThan(0);
        expect(prompt.temperature).toBeGreaterThanOrEqual(0);
    });

    it("embeds the context and evidence allow-list in the user message", () => {
        const allowList = buildEvidenceAllowList(CONTEXT);
        const prompt = buildPrompt(CONTEXT, allowList);

        expect(prompt.userMessage).toContain("AAPL");
        expect(prompt.userMessage).toContain("summary.totalCurrentValue");
    });

    it("forbids investment-recommendation and rebalancing language, and requires the closed JSON shape", () => {
        const prompt = buildPrompt(CONTEXT, []);

        expect(prompt.systemPrompt).toMatch(/Buy|Sell/);
        expect(prompt.systemPrompt).toMatch(/rebalanc/i);
        expect(prompt.systemPrompt).toContain("narrative");
        expect(prompt.systemPrompt).toContain("holdingHighlights");
        expect(prompt.systemPrompt).toContain("evidenceUsed");
    });
});

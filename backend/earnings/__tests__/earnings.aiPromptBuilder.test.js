const { buildPrompt, buildEvidenceAllowList } = require("../earnings.aiPromptBuilder");

const EARNINGS_DATA = {
    ticker: "AAPL",
    period: { latestPeriod: "FY2026", comparisonType: "YoY" },
    growth: { revenue: { variancePercent: 12.5 }, netIncome: { variancePercent: 8.1 } },
    profitability: { netMargin: { current: 0.24 } },
    cashFlow: { freeCashFlow: { current: 1000 } },
    balanceSheet: { netDebt: { direction: "down" } },
    perShare: { basicEPS: 6.1 },
    marketReaction: { available: true, oneDayReturnPercent: 3.2 },
    qualityObservations: ["Margins expanded."],
    relatedNews: [{ title: "Apple reports Q3 earnings", url: "https://example.com/a" }],
};

describe("buildEvidenceAllowList", () => {
    it("flattens quantitative sections into dot-paths", () => {
        const allowList = buildEvidenceAllowList(EARNINGS_DATA);

        expect(allowList).toContain("growth.revenue.variancePercent");
        expect(allowList).toContain("profitability.netMargin.current");
        expect(allowList).toContain("cashFlow.freeCashFlow.current");
        expect(allowList).toContain("balanceSheet.netDebt.direction");
        expect(allowList).toContain("perShare.basicEPS");
        expect(allowList).toContain("marketReaction.oneDayReturnPercent");
    });

    it("never includes relatedNews, period, or qualityObservations paths - not citable numeric leaves", () => {
        const allowList = buildEvidenceAllowList(EARNINGS_DATA);

        expect(allowList.some((path) => path.startsWith("relatedNews"))).toBe(false);
        expect(allowList.some((path) => path.startsWith("period"))).toBe(false);
        expect(allowList.some((path) => path.startsWith("qualityObservations"))).toBe(false);
    });

    it("tolerates a missing section without throwing", () => {
        expect(() => buildEvidenceAllowList({ ticker: "AAPL" })).not.toThrow();
        expect(buildEvidenceAllowList({ ticker: "AAPL" })).toEqual([]);
    });
});

describe("buildPrompt", () => {
    it("returns a system prompt, user message, and generation params", () => {
        const allowList = buildEvidenceAllowList(EARNINGS_DATA);
        const prompt = buildPrompt(EARNINGS_DATA, allowList);

        expect(typeof prompt.systemPrompt).toBe("string");
        expect(typeof prompt.userMessage).toBe("string");
        expect(prompt.maxTokens).toBeGreaterThan(0);
        expect(prompt.temperature).toBeGreaterThanOrEqual(0);
    });

    it("embeds the earnings data and the evidence allow-list in the user message", () => {
        const allowList = buildEvidenceAllowList(EARNINGS_DATA);
        const prompt = buildPrompt(EARNINGS_DATA, allowList);

        expect(prompt.userMessage).toContain("AAPL");
        expect(prompt.userMessage).toContain("growth.revenue.variancePercent");
    });

    it("forbids investment-recommendation language and requires the closed JSON shape in the system prompt", () => {
        const prompt = buildPrompt(EARNINGS_DATA, []);

        expect(prompt.systemPrompt).toMatch(/Buy|Sell/);
        expect(prompt.systemPrompt).toContain("narrative");
        expect(prompt.systemPrompt).toContain("evidenceUsed");
    });
});

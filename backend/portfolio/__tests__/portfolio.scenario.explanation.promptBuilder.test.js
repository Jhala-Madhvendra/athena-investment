const { buildPrompt, buildSystemPrompt } = require("../portfolio.scenario.explanation.promptBuilder");

const NORMALIZED = {
    scenario: { name: "Bear Case", rules: [{ targetType: "MARKET", target: null, shockPercent: -20 }] },
    currentPortfolioValueUSD: 100000,
    scenarioPortfolioValueUSD: 88000,
    absoluteChangeUSD: -12000,
    percentageChange: -12,
    holdingImpact: [{ ticker: "AAPL", contributionToScenarioImpactPercent: 61.4 }],
    sectorImpact: [{ sector: "Technology", contributionToScenarioImpactPercent: 61.4 }],
    historicalContext: { available: false },
    assumptions: { scenarioName: "Bear Case", portfolioValueUSD: 100000, methodologyNotes: [] },
};

describe("buildSystemPrompt", () => {
    it("forbids forecasts, probabilities, and recommendations", () => {
        const prompt = buildSystemPrompt();
        expect(prompt).toMatch(/no forecasts, no probabilities, no recommendations/i);
        expect(prompt).toMatch(/never say the modeled outcome "will" happen/i);
        expect(prompt).toMatch(/Buy, Sell, Hold/);
    });

    it("instructs the model to use only numbers already present in its input", () => {
        const prompt = buildSystemPrompt();
        expect(prompt).toMatch(/Use ONLY the numbers and facts present/i);
        expect(prompt).toMatch(/never invent/i);
    });

    it("instructs the model to flag a rule that matched zero holdings rather than reporting a silent 0% impact", () => {
        const prompt = buildSystemPrompt();
        expect(prompt).toMatch(/unmatchedRules/);
        expect(prompt).toMatch(/matched ZERO holdings/i);
    });
});

describe("buildPrompt", () => {
    it("embeds the exact normalized scenario result as the only data source in the user message", () => {
        const prompt = buildPrompt(NORMALIZED);
        expect(prompt.userMessage).toContain(JSON.stringify(NORMALIZED));
    });

    it("returns a bounded token budget appropriate for a short explanation, not a full report", () => {
        const prompt = buildPrompt(NORMALIZED);
        expect(prompt.maxTokens).toBeLessThan(2000);
        expect(prompt.temperature).toBeLessThanOrEqual(0.3);
    });

    it("never references anything outside the normalized input (no raw market/news fetch instructions)", () => {
        const prompt = buildPrompt(NORMALIZED);
        expect(prompt.systemPrompt + prompt.userMessage).not.toMatch(/fetch|API call|search the web/i);
    });
});

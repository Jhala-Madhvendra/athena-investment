const { validateExplanationText } = require("../portfolio.scenario.explanation.responseValidator");

const normalizedResult = {
    scenario: { name: "Bear Case", rules: [{ targetType: "MARKET", target: null, shockPercent: -20 }] },
    currentPortfolioValueUSD: 100000,
    scenarioPortfolioValueUSD: 88000,
    absoluteChangeUSD: -12000,
    percentageChange: -12,
    holdingImpact: [{ ticker: "AAPL", contributionToScenarioImpactPercent: 61.4 }],
    sectorImpact: [{ sector: "Technology", contributionToScenarioImpactPercent: 61.4 }],
};

describe("validateExplanationText - numbers that trace back to the input", () => {
    it("accepts prose restating exact numbers from the input", () => {
        const text =
            "Under Bear Case, the portfolio's modeled value falls from $100000 to $88000, a change of -$12000, or -12%. Technology alone contributes 61.4% of this impact.";
        const result = validateExplanationText(text, normalizedResult);
        expect(result.isValid).toBe(true);
        expect(result.unverifiedNumbers).toEqual([]);
    });

    it("accepts numbers rounded within tolerance", () => {
        const text = "The portfolio would decline by approximately 12.0%, or about -$12,000, under this scenario.";
        const result = validateExplanationText(text, normalizedResult);
        expect(result.isValid).toBe(true);
    });

    it("allows small integers used as counts/ordinals", () => {
        const text = "This scenario applies 1 rule across the portfolio and affects Technology the most.";
        const result = validateExplanationText(text, normalizedResult);
        expect(result.isValid).toBe(true);
    });
});

describe("validateExplanationText - hallucinated numbers", () => {
    it("rejects a number not present anywhere in the input", () => {
        const text = "Under this scenario, the portfolio is expected to fall by 47.5% next quarter.";
        const result = validateExplanationText(text, normalizedResult);
        expect(result.isValid).toBe(false);
        expect(result.unverifiedNumbers).toContain(47.5);
    });

    it("rejects a fabricated dollar figure", () => {
        const text = "The scenario portfolio value would land at $250,000.";
        const result = validateExplanationText(text, normalizedResult);
        expect(result.isValid).toBe(false);
        expect(result.unverifiedNumbers.length).toBeGreaterThan(0);
    });
});

describe("validateExplanationText - malformed output", () => {
    it("rejects an empty response", () => {
        const result = validateExplanationText("", normalizedResult);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/empty/);
    });
});

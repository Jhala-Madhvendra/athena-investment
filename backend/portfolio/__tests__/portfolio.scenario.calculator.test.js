const { calculateScenarioImpact } = require("../portfolio.scenario.calculator");
const { resolveScenario } = require("../portfolio.scenario.resolver");

const run = (holdings, rules) => calculateScenarioImpact(resolveScenario(holdings, rules));

describe("calculateScenarioImpact - single asset shock", () => {
    it("matches the worked example from the sprint brief", () => {
        const holdings = [{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 200000, beta: 1.2 }];
        const rules = [{ targetType: "ASSET", target: "AAPL", shockPercent: -30 }];

        const result = run(holdings, rules);

        expect(result.currentPortfolioValueUSD).toBe(200000);
        expect(result.scenarioPortfolioValueUSD).toBe(140000);
        expect(result.absoluteChangeUSD).toBe(-60000);
        expect(result.percentageChange).toBeCloseTo(-30, 6);
        expect(result.holdingImpact[0].absoluteChangeUSD).toBe(-60000);
        expect(result.holdingImpact[0].portfolioImpactPercentagePoints).toBeCloseTo(-30, 6);
        expect(result.holdingImpact[0].contributionToScenarioImpactPercent).toBeCloseTo(100, 6);
    });
});

describe("calculateScenarioImpact - portfolio-wide shock", () => {
    it("applies the same shock to every current holding", () => {
        const holdings = [
            { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 100000, beta: 1.1 },
            { ticker: "JPM", sector: "Financial Services", industry: "Banks", currentValueUSD: 100000, beta: 1.0 },
        ];
        const rules = [{ targetType: "PORTFOLIO", target: null, shockPercent: -10 }];

        const result = run(holdings, rules);

        expect(result.currentPortfolioValueUSD).toBe(200000);
        expect(result.scenarioPortfolioValueUSD).toBe(180000);
        expect(result.percentageChange).toBeCloseTo(-10, 6);
        result.holdingImpact.forEach((h) => expect(h.effectiveShockPercent).toBe(-10));
    });
});

describe("calculateScenarioImpact - market/beta shock", () => {
    it("estimates portfolio movement as beta x market shock, labeled distinctly per holding", () => {
        const holdings = [{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 100000, beta: 1.18 }];
        const rules = [{ targetType: "MARKET", target: null, shockPercent: -20 }];

        const result = run(holdings, rules);

        expect(result.holdingImpact[0].effectiveShockPercent).toBeCloseTo(1.18 * -20, 4);
        expect(result.percentageChange).toBeCloseTo(1.18 * -20, 4);
    });
});

describe("calculateScenarioImpact - multi-factor scenario with overlap", () => {
    it("resolves overlapping asset/sector rules without double counting, per the sprint brief's AAPL example", () => {
        const holdings = [
            { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 200000, beta: 1.2 },
            { ticker: "MSFT", sector: "Technology", industry: "Software", currentValueUSD: 100000, beta: 1.0 },
            { ticker: "JPM", sector: "Financial Services", industry: "Banks", currentValueUSD: 100000, beta: 0.9 },
        ];
        const rules = [
            { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
            { targetType: "ASSET", target: "AAPL", shockPercent: -30 },
            { targetType: "SECTOR", target: "Financial Services", shockPercent: -10 },
        ];

        const result = run(holdings, rules);

        const byTicker = Object.fromEntries(result.holdingImpact.map((h) => [h.ticker, h]));
        expect(byTicker.AAPL.effectiveShockPercent).toBe(-30); // asset overrides sector
        expect(byTicker.AAPL.overriddenRules).toHaveLength(1);
        expect(byTicker.MSFT.effectiveShockPercent).toBe(-20); // pure sector shock
        expect(byTicker.JPM.effectiveShockPercent).toBe(-10);

        expect(result.absoluteChangeUSD).toBeCloseTo(-60000 + -20000 + -10000, 6);
    });
});

describe("calculateScenarioImpact - holding attribution", () => {
    it("keeps portfolioImpactPercentagePoints and contributionToScenarioImpactPercent conceptually distinct from weight", () => {
        const holdings = [
            { ticker: "SMALL", sector: "Technology", industry: "Software", currentValueUSD: 10000, beta: 1 },
            { ticker: "BIG", sector: "Financial Services", industry: "Banks", currentValueUSD: 990000, beta: 1 },
        ];
        const rules = [{ targetType: "ASSET", target: "SMALL", shockPercent: -80 }];

        const result = run(holdings, rules);
        const small = result.holdingImpact.find((h) => h.ticker === "SMALL");
        const big = result.holdingImpact.find((h) => h.ticker === "BIG");

        // SMALL is only 1% of the portfolio by value, but explains 100% of the total dollar move.
        expect(small.contributionToScenarioImpactPercent).toBeCloseTo(100, 6);
        expect(big.contributionToScenarioImpactPercent).toBeCloseTo(0, 6);
        expect(big.unaffected).toBe(true);
    });

    it("leaves contributionToScenarioImpactPercent null when the total scenario change is zero", () => {
        const holdings = [{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 100000, beta: 1 }];
        const result = run(holdings, [{ targetType: "PORTFOLIO", target: null, shockPercent: 0 }]);

        expect(result.holdingImpact[0].contributionToScenarioImpactPercent).toBeNull();
    });
});

describe("calculateScenarioImpact - sector attribution", () => {
    it("aggregates holding-level impact by sector, matching the brief's worked example shape", () => {
        const holdings = [
            { ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 200000, beta: 1.2 },
            { ticker: "MSFT", sector: "Technology", industry: "Software", currentValueUSD: 100000, beta: 1.0 },
            { ticker: "JPM", sector: "Financial Services", industry: "Banks", currentValueUSD: 100000, beta: 0.9 },
            { ticker: "PFE", sector: "Healthcare", industry: "Drug Manufacturers", currentValueUSD: 100000, beta: 0.6 },
        ];
        const rules = [
            { targetType: "SECTOR", target: "Technology", shockPercent: -24 },
            { targetType: "SECTOR", target: "Financial Services", shockPercent: -20 },
            { targetType: "SECTOR", target: "Healthcare", shockPercent: 8 },
        ];

        const result = run(holdings, rules);
        const bySector = Object.fromEntries(result.sectorImpact.map((s) => [s.sector, s]));

        expect(bySector.Technology.absoluteChangeUSD).toBeCloseTo(300000 * -0.24, 6);
        expect(bySector["Financial Services"].absoluteChangeUSD).toBeCloseTo(100000 * -0.2, 6);
        expect(bySector.Healthcare.absoluteChangeUSD).toBeCloseTo(100000 * 0.08, 6);
        expect(bySector.Healthcare.absoluteChangeUSD).toBeGreaterThan(0);
    });

    it("groups holdings with no sector under the Unclassified label instead of dropping them", () => {
        const holdings = [{ ticker: "NEWCO", sector: null, industry: null, currentValueUSD: 50000, beta: 1 }];
        const result = run(holdings, [{ targetType: "PORTFOLIO", target: null, shockPercent: -10 }]);

        expect(result.sectorImpact).toHaveLength(1);
        expect(result.sectorImpact[0].sector).toBe("Unclassified");
    });
});

describe("calculateScenarioImpact - edge shocks", () => {
    it("handles a -100% total wipeout shock", () => {
        const holdings = [{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 100000, beta: 1 }];
        const result = run(holdings, [{ targetType: "ASSET", target: "AAPL", shockPercent: -100 }]);

        expect(result.scenarioPortfolioValueUSD).toBe(0);
        expect(result.percentageChange).toBeCloseTo(-100, 6);
    });

    it("handles a +100% doubling shock", () => {
        const holdings = [{ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics", currentValueUSD: 100000, beta: 1 }];
        const result = run(holdings, [{ targetType: "ASSET", target: "AAPL", shockPercent: 100 }]);

        expect(result.scenarioPortfolioValueUSD).toBe(200000);
    });

    it("handles an empty portfolio without dividing by zero", () => {
        const result = run([], [{ targetType: "PORTFOLIO", target: null, shockPercent: -10 }]);

        expect(result.currentPortfolioValueUSD).toBe(0);
        expect(result.scenarioPortfolioValueUSD).toBe(0);
        expect(result.percentageChange).toBeNull();
        expect(result.holdingImpact).toEqual([]);
        expect(result.sectorImpact).toEqual([]);
    });
});

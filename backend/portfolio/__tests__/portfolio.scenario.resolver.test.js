const { resolveHoldingRule, resolveScenario, ruleMatchesHolding, PRECEDENCE_RANK } = require("../portfolio.scenario.resolver");

const holding = (overrides = {}) => ({
    ticker: "AAPL",
    sector: "Technology",
    industry: "Consumer Electronics",
    currentValueUSD: 200000,
    beta: 1.2,
    ...overrides,
});

describe("PRECEDENCE_RANK", () => {
    it("orders ASSET > INDUSTRY > SECTOR > MARKET > PORTFOLIO from most to least specific", () => {
        expect(PRECEDENCE_RANK.ASSET).toBeLessThan(PRECEDENCE_RANK.INDUSTRY);
        expect(PRECEDENCE_RANK.INDUSTRY).toBeLessThan(PRECEDENCE_RANK.SECTOR);
        expect(PRECEDENCE_RANK.SECTOR).toBeLessThan(PRECEDENCE_RANK.MARKET);
        expect(PRECEDENCE_RANK.MARKET).toBeLessThan(PRECEDENCE_RANK.PORTFOLIO);
    });
});

describe("ruleMatchesHolding", () => {
    it("matches ASSET rules only on an exact ticker match", () => {
        expect(ruleMatchesHolding({ targetType: "ASSET", target: "AAPL" }, holding())).toBe(true);
        expect(ruleMatchesHolding({ targetType: "ASSET", target: "MSFT" }, holding())).toBe(false);
    });

    it("matches SECTOR/INDUSTRY rules on exact classification match", () => {
        expect(ruleMatchesHolding({ targetType: "SECTOR", target: "Technology" }, holding())).toBe(true);
        expect(ruleMatchesHolding({ targetType: "SECTOR", target: "Financial Services" }, holding())).toBe(false);
        expect(ruleMatchesHolding({ targetType: "INDUSTRY", target: "Consumer Electronics" }, holding())).toBe(true);
    });

    it("MARKET and PORTFOLIO rules match every holding", () => {
        expect(ruleMatchesHolding({ targetType: "MARKET", target: null }, holding())).toBe(true);
        expect(ruleMatchesHolding({ targetType: "PORTFOLIO", target: null }, holding())).toBe(true);
    });
});

describe("resolveHoldingRule - single asset shock", () => {
    it("applies an ASSET shock directly", () => {
        const result = resolveHoldingRule(holding(), [{ targetType: "ASSET", target: "AAPL", shockPercent: -20 }]);
        expect(result.appliedRule.targetType).toBe("ASSET");
        expect(result.effectiveShockPercent).toBe(-20);
        expect(result.overriddenRules).toEqual([]);
    });
});

describe("resolveHoldingRule - precedence and overlap", () => {
    it("lets an asset shock override a sector shock on the same holding (no stacking)", () => {
        const rules = [
            { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
            { targetType: "ASSET", target: "AAPL", shockPercent: -30 },
        ];
        const result = resolveHoldingRule(holding(), rules);

        expect(result.appliedRule).toEqual({ targetType: "ASSET", target: "AAPL", shockPercent: -30 });
        expect(result.effectiveShockPercent).toBe(-30);
        expect(result.overriddenRules).toEqual([{ targetType: "SECTOR", target: "Technology", shockPercent: -20 }]);
    });

    it("lets a sector shock override a market shock on the same holding", () => {
        const rules = [
            { targetType: "MARKET", target: null, shockPercent: -20 },
            { targetType: "SECTOR", target: "Technology", shockPercent: -10 },
        ];
        const result = resolveHoldingRule(holding(), rules);

        expect(result.appliedRule.targetType).toBe("SECTOR");
        expect(result.effectiveShockPercent).toBe(-10);
        expect(result.overriddenRules).toEqual([{ targetType: "MARKET", target: null, shockPercent: -20 }]);
    });

    it("does not multiply or add overlapping shocks together", () => {
        const rules = [
            { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
            { targetType: "ASSET", target: "AAPL", shockPercent: -30 },
        ];
        const result = resolveHoldingRule(holding(), rules);

        expect(result.effectiveShockPercent).not.toBe(-50); // additive
        expect(result.effectiveShockPercent).not.toBeCloseTo(-20 + -30 + -20 * -30 * 0.01); // multiplicative-ish
        expect(result.effectiveShockPercent).toBe(-30);
    });
});

describe("resolveHoldingRule - market shock beta mechanics", () => {
    it("scales a MARKET shock by the holding's own beta", () => {
        const result = resolveHoldingRule(holding({ beta: 1.18 }), [{ targetType: "MARKET", target: null, shockPercent: -20 }]);
        expect(result.effectiveShockPercent).toBeCloseTo(1.18 * -20, 10);
    });

    it("falls through to a lower-precedence PORTFOLIO rule when beta is unknown", () => {
        const rules = [
            { targetType: "MARKET", target: null, shockPercent: -20 },
            { targetType: "PORTFOLIO", target: null, shockPercent: -5 },
        ];
        const result = resolveHoldingRule(holding({ beta: null }), rules);

        expect(result.appliedRule.targetType).toBe("PORTFOLIO");
        expect(result.effectiveShockPercent).toBe(-5);
        expect(result.overriddenRules).toEqual([]); // MARKET couldn't be evaluated, not "overridden" by precedence
        expect(result.unevaluableRules).toEqual([{ targetType: "MARKET", target: null, shockPercent: -20 }]);
    });

    it("leaves the holding unaffected when only MARKET matches and beta is unknown", () => {
        const result = resolveHoldingRule(holding({ beta: null }), [{ targetType: "MARKET", target: null, shockPercent: -20 }]);
        expect(result.appliedRule).toBeNull();
        expect(result.effectiveShockPercent).toBeNull();
    });
});

describe("resolveScenario - portfolio-wide fallback", () => {
    it("applies PORTFOLIO only to holdings untouched by a more specific rule", () => {
        const holdings = [
            holding({ ticker: "AAPL", sector: "Technology" }),
            holding({ ticker: "JPM", sector: "Financial Services", industry: "Banks" }),
        ];
        const rules = [
            { targetType: "SECTOR", target: "Technology", shockPercent: -25 },
            { targetType: "PORTFOLIO", target: null, shockPercent: -10 },
        ];

        const [aapl, jpm] = resolveScenario(holdings, rules);

        expect(aapl.appliedRule.targetType).toBe("SECTOR");
        expect(aapl.effectiveShockPercent).toBe(-25);
        expect(jpm.appliedRule.targetType).toBe("PORTFOLIO");
        expect(jpm.effectiveShockPercent).toBe(-10);
    });

    it("marks a holding unaffected when no rule targets it at all", () => {
        const [result] = resolveScenario([holding({ sector: "Healthcare", industry: "Biotechnology" })], [
            { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
        ]);

        expect(result.unaffected).toBe(true);
        expect(result.appliedRule).toBeNull();
        expect(result.effectiveShockPercent).toBeNull();
    });
});

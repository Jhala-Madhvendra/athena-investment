const { validateScenarioRequest, validateCompareRequest } = require("../portfolio.scenario.validator");

describe("validateScenarioRequest - happy path", () => {
    it("normalizes a well-formed multi-factor scenario request", () => {
        const result = validateScenarioRequest({
            name: "Tech + Market Stress",
            rules: [
                { targetType: "market", shockPercent: -10 },
                { targetType: "sector", target: "Technology", shockPercent: -20 },
                { targetType: "asset", target: "aapl", shockPercent: -30 },
            ],
            benchmark: "spy",
            window: "1y",
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.normalized.name).toBe("Tech + Market Stress");
        expect(result.normalized.rules).toEqual([
            { targetType: "MARKET", target: null, shockPercent: -10 },
            { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
            { targetType: "ASSET", target: "AAPL", shockPercent: -30 },
        ]);
        expect(result.normalized.benchmark).toBe("SPY");
    });

    it("defaults name to 'Custom Scenario' and window to 1y when omitted", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }] });

        expect(result.isValid).toBe(true);
        expect(result.normalized.name).toBe("Custom Scenario");
        expect(result.normalized.window).toBe("1y");
        expect(result.normalized.benchmark).toBeNull();
    });
});

describe("validateScenarioRequest - missing/invalid fields", () => {
    it("rejects an empty rules array", () => {
        const result = validateScenarioRequest({ rules: [] });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/non-empty array/);
    });

    it("rejects a missing ticker for an ASSET rule", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "ASSET", shockPercent: -10 }] });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/target is required/);
    });

    it("rejects a missing sector for a SECTOR rule", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "SECTOR", shockPercent: -10 }] });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/target is required/);
    });

    it("rejects an unsupported benchmark ticker shape", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }], benchmark: "not a ticker" });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/benchmark/);
    });

    it("rejects an unsupported window", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "PORTFOLIO", shockPercent: -10 }], window: "2y" });
        expect(result.isValid).toBe(false);
    });

    it("rejects a target set on a MARKET/PORTFOLIO rule", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "MARKET", target: "SPY", shockPercent: -10 }] });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/must not be set/);
    });

    it("rejects an invalid targetType", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "COUNTRY", target: "US", shockPercent: -10 }] });
        expect(result.isValid).toBe(false);
    });
});

describe("validateScenarioRequest - shockPercent bounds", () => {
    it("accepts exactly -100% (total wipeout)", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: -100 }] });
        expect(result.isValid).toBe(true);
    });

    it("accepts exactly +100% (doubling)", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: 100 }] });
        expect(result.isValid).toBe(true);
    });

    it("rejects a shock below -100%", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: -150 }] });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/shockPercent must be between/);
    });

    it("rejects a non-numeric shockPercent", () => {
        const result = validateScenarioRequest({ rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: "a lot" }] });
        expect(result.isValid).toBe(false);
    });
});

describe("validateScenarioRequest - duplicate rules", () => {
    it("rejects two rules with the same targetType and target", () => {
        const result = validateScenarioRequest({
            rules: [
                { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
                { targetType: "SECTOR", target: "Technology", shockPercent: -30 },
            ],
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/duplicates/);
    });

    it("allows two MARKET rules to be rejected as duplicates too (both target null)", () => {
        const result = validateScenarioRequest({
            rules: [
                { targetType: "MARKET", shockPercent: -10 },
                { targetType: "MARKET", shockPercent: -20 },
            ],
        });
        expect(result.isValid).toBe(false);
    });

    it("allows an ASSET rule and a SECTOR rule with the same conceptual target (different targetType is not a duplicate)", () => {
        const result = validateScenarioRequest({
            rules: [
                { targetType: "SECTOR", target: "Technology", shockPercent: -20 },
                { targetType: "ASSET", target: "AAPL", shockPercent: -30 },
            ],
        });
        expect(result.isValid).toBe(true);
    });
});

describe("validateScenarioRequest - sensitivity", () => {
    const baseRules = [{ targetType: "SECTOR", target: "Technology", shockPercent: -20 }];

    it("accepts a sensitivity block matching an existing rule", () => {
        const result = validateScenarioRequest({
            rules: baseRules,
            sensitivity: { targetType: "SECTOR", target: "Technology", shockValues: [-10, -15, -20, -25, -30] },
        });
        expect(result.isValid).toBe(true);
        expect(result.normalized.sensitivity.shockValues).toEqual([-10, -15, -20, -25, -30]);
    });

    it("rejects a sensitivity target that doesn't match any rule in the scenario", () => {
        const result = validateScenarioRequest({
            rules: baseRules,
            sensitivity: { targetType: "SECTOR", target: "Financial Services", shockValues: [-10, -20] },
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.join(" ")).toMatch(/must match one of the rules/);
    });

    it("rejects fewer than 2 sensitivity shock values", () => {
        const result = validateScenarioRequest({
            rules: baseRules,
            sensitivity: { targetType: "SECTOR", target: "Technology", shockValues: [-10] },
        });
        expect(result.isValid).toBe(false);
    });

    it("rejects more than 5 sensitivity shock values (no giant matrix)", () => {
        const result = validateScenarioRequest({
            rules: baseRules,
            sensitivity: { targetType: "SECTOR", target: "Technology", shockValues: [-10, -15, -20, -25, -30, -35] },
        });
        expect(result.isValid).toBe(false);
    });
});

describe("validateCompareRequest", () => {
    it("validates each scenario independently and shares benchmark/window", () => {
        const result = validateCompareRequest({
            scenarios: [
                { name: "Bear", rules: [{ targetType: "MARKET", shockPercent: -15 }] },
                { name: "Bull", rules: [{ targetType: "MARKET", shockPercent: 10 }] },
            ],
            benchmark: "spy",
            window: "6m",
        });

        expect(result.isValid).toBe(true);
        expect(result.normalized.scenarios).toHaveLength(2);
        expect(result.normalized.benchmark).toBe("SPY");
        expect(result.normalized.window).toBe("6m");
    });

    it("rejects fewer than 2 scenarios", () => {
        const result = validateCompareRequest({ scenarios: [{ name: "Bear", rules: [{ targetType: "MARKET", shockPercent: -15 }] }] });
        expect(result.isValid).toBe(false);
    });

    it("prefixes a nested scenario's rule errors with its index", () => {
        const result = validateCompareRequest({
            scenarios: [
                { name: "Bear", rules: [{ targetType: "MARKET", shockPercent: -15 }] },
                { name: "Broken", rules: [] },
            ],
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.some((message) => message.startsWith("scenarios[1]."))).toBe(true);
    });
});

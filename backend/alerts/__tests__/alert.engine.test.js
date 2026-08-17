const engine = require("../alert.engine");
const { THRESHOLDS } = require("../alert.rules");

const DEFAULT_INCOME_STATEMENT = {
    totalRevenue: 1000,
    operatingIncome: 300,
    netIncome: 200,
    grossProfit: 500,
    costOfRevenue: 500,
    dilutedSharesOutstanding: 1000,
};
const DEFAULT_BALANCE_SHEET = {
    totalDebt: 300,
    totalStockholderEquity: 400,
    totalAssets: 1200,
    currentAssets: 300,
    currentLiabilities: 150,
    cashAndCashEquivalents: 100,
    accountsReceivable: 50,
};
const DEFAULT_CASH_FLOW = {
    operatingCashFlow: 240,
    capitalExpenditure: -60,
    freeCashFlow: 180,
    depreciationAndAmortization: 20,
};

/** One-year-deep merge, so a test only has to override the fields it cares about. */
const buildStatement = (year, overrides = {}) => ({
    year,
    createdAt: new Date(`${year}-03-01T00:00:00.000Z`),
    incomeStatement: { ...DEFAULT_INCOME_STATEMENT, ...(overrides.incomeStatement || {}) },
    balanceSheet: { ...DEFAULT_BALANCE_SHEET, ...(overrides.balanceSheet || {}) },
    cashFlow: { ...DEFAULT_CASH_FLOW, ...(overrides.cashFlow || {}) },
});

const buildBar = (date, close, overrides = {}) => ({ date, open: close, high: close * 1.01, low: close * 0.99, close, adjClose: close, volume: 1000, ...overrides });

const buildBarSeries = (closes, startDate = "2026-07-01") => {
    const start = new Date(startDate);
    return closes.map((close, index) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + index);
        return buildBar(date.toISOString().slice(0, 10), close);
    });
};

describe("evaluateMarketRules", () => {
    it("returns no candidates with no bars", () => {
        expect(engine.evaluateMarketRules({ ticker: "TEST", bars: [] })).toEqual([]);
    });

    it("returns no candidates with only one bar (can't compute a daily move)", () => {
        expect(engine.evaluateMarketRules({ ticker: "TEST", bars: buildBarSeries([100]) })).toEqual([]);
    });

    it("does not fire PRICE_MOVE_1D just under the threshold", () => {
        const bars = buildBarSeries([100, 104.9]); // 4.9% move, threshold is 5%
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        expect(candidates.find((c) => c.rule === "PRICE_MOVE_1D")).toBeUndefined();
    });

    it("fires PRICE_MOVE_1D at exactly the threshold, as MEDIUM", () => {
        const bars = buildBarSeries([100, 105]); // exactly 5%
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        const alert = candidates.find((c) => c.rule === "PRICE_MOVE_1D");
        expect(alert).toBeDefined();
        expect(alert.severity).toBe("MEDIUM");
        expect(alert.percentChange).toBe(5);
    });

    it("fires PRICE_MOVE_1D as HIGH at 2x the threshold", () => {
        const bars = buildBarSeries([100, 90]); // -10%, 2x the 5% threshold
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        const alert = candidates.find((c) => c.rule === "PRICE_MOVE_1D");
        expect(alert.severity).toBe("HIGH");
        expect(alert.title).toMatch(/single-day/i);
    });

    it("does not evaluate PRICE_DROP_5D/PRICE_GAIN_5D with fewer than 6 bars", () => {
        const bars = buildBarSeries([100, 101, 102, 103, 90]); // 5 bars, -12% overall but not enough history
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        expect(candidates.find((c) => c.rule === "PRICE_DROP_5D")).toBeUndefined();
    });

    it("fires PRICE_DROP_5D when the 5-session decline meets the threshold", () => {
        const bars = buildBarSeries([100, 100, 100, 100, 100, 91]); // -9% over 5 sessions, threshold 8%
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        const alert = candidates.find((c) => c.rule === "PRICE_DROP_5D");
        expect(alert).toBeDefined();
        expect(alert.previousValue).toBe(100);
        expect(alert.currentValue).toBe(91);
    });

    it("fires PRICE_GAIN_5D (not PRICE_DROP_5D) for a significant increase", () => {
        const bars = buildBarSeries([100, 100, 100, 100, 100, 110]);
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        expect(candidates.find((c) => c.rule === "PRICE_GAIN_5D")).toBeDefined();
        expect(candidates.find((c) => c.rule === "PRICE_DROP_5D")).toBeUndefined();
    });

    it("fires TRADING_RANGE_SPIKE only with a genuinely wider range than the trailing average", () => {
        const bars = buildBarSeries([100, 100, 100, 100, 100, 100, 100]);
        bars[bars.length - 1] = buildBar(bars[bars.length - 1].date, 100, { high: 120, low: 90 }); // 30% range vs ~2% trailing
        const candidates = engine.evaluateMarketRules({ ticker: "TEST", bars });
        expect(candidates.find((c) => c.rule === "TRADING_RANGE_SPIKE")).toBeDefined();
    });

    it("does not divide by zero or crash when a bar's close is 0", () => {
        const bars = buildBarSeries([100, 0]);
        expect(() => engine.evaluateMarketRules({ ticker: "TEST", bars })).not.toThrow();
    });
});

describe("evaluateFinancialRules", () => {
    it("returns no candidates for an empty statement list", () => {
        expect(engine.evaluateFinancialRules({ ticker: "TEST", statements: [] })).toEqual([]);
    });

    it("with only one statement, fires only the informational NEW_ANNUAL_RESULTS alert", () => {
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [buildStatement(2026)] });
        expect(candidates).toHaveLength(1);
        expect(candidates[0].rule).toBe("NEW_ANNUAL_RESULTS");
        expect(candidates[0].severity).toBe("INFO");
    });

    it("does not fire a margin alert just under the threshold", () => {
        const latest = buildStatement(2026, { incomeStatement: { operatingIncome: 290 } }); // 29.0% vs 30.0% prior = 1pp, under 3pp threshold
        const prior = buildStatement(2025, { incomeStatement: { operatingIncome: 300 } });
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        expect(candidates.find((c) => c.metric === "operatingMargin")).toBeUndefined();
    });

    it("fires OPERATING_MARGIN_DETERIORATION at exactly the threshold", () => {
        const latest = buildStatement(2026, { incomeStatement: { operatingIncome: 270 } }); // 27% vs 30% = 3pp decline
        const prior = buildStatement(2025, { incomeStatement: { operatingIncome: 300 } });
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        const alert = candidates.find((c) => c.rule === "OPERATING_MARGIN_DETERIORATION");
        expect(alert).toBeDefined();
        expect(alert.evidencePeriod).toBe("FY2025 -> FY2026");
        expect(alert.periodKey).toBe("FY2025-FY2026");
    });

    it("does not fire DEBT_INCREASE when prior debt was zero (percentChange guards against a zero base)", () => {
        const latest = buildStatement(2026, { balanceSheet: { totalDebt: 500 } });
        const prior = buildStatement(2025, { balanceSheet: { totalDebt: 0 } });
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        expect(candidates.find((c) => c.rule === "DEBT_INCREASE")).toBeUndefined();
    });

    it("does not fire DEBT_INCREASE when debt actually decreased", () => {
        const latest = buildStatement(2026, { balanceSheet: { totalDebt: 250 } });
        const prior = buildStatement(2025, { balanceSheet: { totalDebt: 400 } });
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        expect(candidates.find((c) => c.rule === "DEBT_INCREASE")).toBeUndefined();
    });

    it("does not evaluate revenue growth acceleration/deterioration with fewer than 3 statements", () => {
        const latest = buildStatement(2026, { incomeStatement: { totalRevenue: 1300 } });
        const prior = buildStatement(2025, { incomeStatement: { totalRevenue: 1000 } });
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        expect(candidates.find((c) => c.metric === "revenueGrowthYoY")).toBeUndefined();
    });

    it("fires REVENUE_GROWTH_DETERIORATION when YoY growth decelerated by more than the threshold", () => {
        const statements = [
            buildStatement(2026, { incomeStatement: { totalRevenue: 1030 } }), // +3% (1000 -> 1030)
            buildStatement(2025, { incomeStatement: { totalRevenue: 1000 } }), // +25% (800 -> 1000)
            buildStatement(2024, { incomeStatement: { totalRevenue: 800 } }),
        ];
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements });
        const alert = candidates.find((c) => c.rule === "REVENUE_GROWTH_DETERIORATION");
        expect(alert).toBeDefined();
        expect(alert.currentValue).toBeCloseTo(3, 0);
        expect(alert.previousValue).toBeCloseTo(25, 0);
    });

    it("does not crash and skips margin/ROE rules when income statement fields are missing (null)", () => {
        const latest = buildStatement(2026, { incomeStatement: { totalRevenue: null, operatingIncome: null, netIncome: null } });
        const prior = buildStatement(2025);
        expect(() => engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] })).not.toThrow();
        const candidates = engine.evaluateFinancialRules({ ticker: "TEST", statements: [latest, prior] });
        expect(candidates.find((c) => c.metric === "operatingMargin")).toBeUndefined();
        expect(candidates.find((c) => c.metric === "returnOnEquity")).toBeUndefined();
    });
});

describe("evaluateBusinessRules", () => {
    it("returns no candidates with fewer than 3 statements", () => {
        const statements = [buildStatement(2026), buildStatement(2025)];
        expect(engine.evaluateBusinessRules({ ticker: "TEST", statements })).toEqual([]);
    });

    it("fires OPERATING_MARGIN_TREND_DECLINE for a consistent multi-year decline", () => {
        const statements = [
            buildStatement(2026, { incomeStatement: { operatingIncome: 150 } }), // 15%
            buildStatement(2025, { incomeStatement: { operatingIncome: 200 } }), // 20%
            buildStatement(2024, { incomeStatement: { operatingIncome: 250 } }), // 25%
            buildStatement(2023, { incomeStatement: { operatingIncome: 300 } }), // 30%
            buildStatement(2022, { incomeStatement: { operatingIncome: 350 } }), // 35%
        ];
        const candidates = engine.evaluateBusinessRules({ ticker: "TEST", statements });
        expect(candidates.find((c) => c.rule === "OPERATING_MARGIN_TREND_DECLINE")).toBeDefined();
    });

    it("does not fire a trend-decline rule for a volatile (non-consistent) series", () => {
        const statements = [
            buildStatement(2026, { incomeStatement: { operatingIncome: 350 } }),
            buildStatement(2025, { incomeStatement: { operatingIncome: 150 } }),
            buildStatement(2024, { incomeStatement: { operatingIncome: 320 } }),
            buildStatement(2023, { incomeStatement: { operatingIncome: 160 } }),
        ];
        const candidates = engine.evaluateBusinessRules({ ticker: "TEST", statements });
        expect(candidates.find((c) => c.rule === "OPERATING_MARGIN_TREND_DECLINE")).toBeUndefined();
    });

    it("fires a HIGH severity PROFIT_DECLINEDTOLOSS alert on a profit-to-loss sign change", () => {
        const statements = [
            buildStatement(2026, { incomeStatement: { netIncome: -50 } }),
            buildStatement(2025, { incomeStatement: { netIncome: 40 } }),
            buildStatement(2024, { incomeStatement: { netIncome: 60 } }),
        ];
        const candidates = engine.evaluateBusinessRules({ ticker: "TEST", statements });
        const alert = candidates.find((c) => c.rule === "PROFIT_DECLINEDTOLOSS");
        expect(alert).toBeDefined();
        expect(alert.severity).toBe("HIGH");
    });

    it("fires a MEDIUM severity PROFIT_TURNAROUND alert on a loss-to-profit sign change", () => {
        const statements = [
            buildStatement(2026, { incomeStatement: { netIncome: 30 } }),
            buildStatement(2025, { incomeStatement: { netIncome: -20 } }),
            buildStatement(2024, { incomeStatement: { netIncome: -60 } }),
        ];
        const candidates = engine.evaluateBusinessRules({ ticker: "TEST", statements });
        const alert = candidates.find((c) => c.rule === "PROFIT_TURNAROUND");
        expect(alert).toBeDefined();
        expect(alert.severity).toBe("MEDIUM");
    });
});

describe("evaluateNewsRules", () => {
    it("returns no candidates for a non-array input", () => {
        expect(engine.evaluateNewsRules({ ticker: "TEST", articles: null })).toEqual([]);
    });

    it("returns no candidates for an empty article list", () => {
        expect(engine.evaluateNewsRules({ ticker: "TEST", articles: [] })).toEqual([]);
    });

    it("classifies a structurally significant category (Acquisition / Merger) as HIGH", () => {
        const candidates = engine.evaluateNewsRules({
            ticker: "TEST",
            articles: [{ _id: "a1", title: "TEST acquires RivalCo", category: "Acquisition / Merger", source: "Reuters", url: "http://x", publishedAt: new Date() }],
        });
        expect(candidates[0].severity).toBe("HIGH");
        expect(candidates[0].periodKey).toBe("a1");
    });

    it("classifies an ordinary important category (Earnings) as MEDIUM", () => {
        const candidates = engine.evaluateNewsRules({
            ticker: "TEST",
            articles: [{ _id: "a2", title: "TEST reports Q3 earnings", category: "Earnings", source: "Yahoo", url: "http://y", publishedAt: new Date() }],
        });
        expect(candidates[0].severity).toBe("MEDIUM");
    });

    it("produces one candidate per article, each independently deduplicable by article id", () => {
        const candidates = engine.evaluateNewsRules({
            ticker: "TEST",
            articles: [
                { _id: "a1", title: "First", category: "Earnings", url: "http://a", publishedAt: new Date() },
                { _id: "a2", title: "Second", category: "Leadership", url: "http://b", publishedAt: new Date() },
            ],
        });
        expect(candidates).toHaveLength(2);
        expect(new Set(candidates.map((c) => c.periodKey)).size).toBe(2);
    });
});

describe("evaluatePortfolioRules", () => {
    it("returns no candidates and no snapshot updates for an empty portfolio", () => {
        const result = engine.evaluatePortfolioRules({ holdings: [], summary: { totalCurrentValue: 0 }, previousSnapshots: new Map() });
        expect(result.candidates).toEqual([]);
        expect(result.snapshotUpdates).toEqual([]);
    });

    it("does not fire HIGH_CONCENTRATION just under the threshold", () => {
        const holdings = [
            { ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 249, costBasisUSD: 1000, currentValueUSD: 249, priceUnavailable: false, fxRateUnavailable: false },
            { ticker: "MSFT", shares: 1, costBasis: 1000, currentValue: 751, costBasisUSD: 1000, currentValueUSD: 751, priceUnavailable: false, fxRateUnavailable: false },
        ];
        const summary = { totalCurrentValue: 1000 };
        const { candidates } = engine.evaluatePortfolioRules({ holdings, summary, previousSnapshots: new Map() });
        expect(candidates.find((c) => c.rule === "HIGH_CONCENTRATION" && c.ticker === "AAPL")).toBeUndefined();
    });

    it("fires HIGH_CONCENTRATION at MEDIUM at the low threshold and HIGH at the high threshold", () => {
        const holdingsMedium = [
            { ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 250, costBasisUSD: 1000, currentValueUSD: 250, priceUnavailable: false, fxRateUnavailable: false },
            { ticker: "MSFT", shares: 1, costBasis: 1000, currentValue: 750, costBasisUSD: 1000, currentValueUSD: 750, priceUnavailable: false, fxRateUnavailable: false },
        ];
        const { candidates: medium } = engine.evaluatePortfolioRules({
            holdings: holdingsMedium,
            summary: { totalCurrentValue: 1000 },
            previousSnapshots: new Map(),
        });
        expect(medium.find((c) => c.rule === "HIGH_CONCENTRATION").severity).toBe("MEDIUM");

        const holdingsHigh = [
            { ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 400, costBasisUSD: 1000, currentValueUSD: 400, priceUnavailable: false, fxRateUnavailable: false },
            { ticker: "MSFT", shares: 1, costBasis: 1000, currentValue: 600, costBasisUSD: 1000, currentValueUSD: 600, priceUnavailable: false, fxRateUnavailable: false },
        ];
        const { candidates: high } = engine.evaluatePortfolioRules({
            holdings: holdingsHigh,
            summary: { totalCurrentValue: 1000 },
            previousSnapshots: new Map(),
        });
        expect(high.find((c) => c.rule === "HIGH_CONCENTRATION").severity).toBe("HIGH");
    });

    it("fires SIGNIFICANT_UNREALIZED_LOSS for a large negative return and not for a small one", () => {
        const holdings = [
            { ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 750, costBasisUSD: 1000, currentValueUSD: 750, priceUnavailable: false, fxRateUnavailable: false }, // -25%
            { ticker: "MSFT", shares: 1, costBasis: 1000, currentValue: 980, costBasisUSD: 1000, currentValueUSD: 980, priceUnavailable: false, fxRateUnavailable: false }, // -2%
        ];
        const { candidates } = engine.evaluatePortfolioRules({ holdings, summary: { totalCurrentValue: 1730 }, previousSnapshots: new Map() });
        expect(candidates.find((c) => c.ticker === "AAPL" && c.rule === "SIGNIFICANT_UNREALIZED_LOSS")).toBeDefined();
        expect(candidates.find((c) => c.ticker === "MSFT" && c.rule === "SIGNIFICANT_UNREALIZED_LOSS")).toBeUndefined();
        expect(candidates.find((c) => c.ticker === "MSFT" && c.rule === "SIGNIFICANT_UNREALIZED_GAIN")).toBeUndefined();
    });

    it("does not fire HOLDING_VALUE_CHANGE when there is no previous snapshot (first observation), but still returns a snapshot update to establish one", () => {
        const holdings = [{ ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 1100, costBasisUSD: 1000, currentValueUSD: 1100, priceUnavailable: false, fxRateUnavailable: false }];
        const { candidates, snapshotUpdates } = engine.evaluatePortfolioRules({
            holdings,
            summary: { totalCurrentValue: 1100 },
            previousSnapshots: new Map(),
        });
        expect(candidates.find((c) => c.rule === "HOLDING_VALUE_CHANGE")).toBeUndefined();
        expect(snapshotUpdates).toEqual([{ ticker: "AAPL", currentValue: 1100, returnPercent: 10, weightPercent: 100 }]);
    });

    it("fires HOLDING_VALUE_CHANGE when the value has moved enough since the previous snapshot", () => {
        const holdings = [{ ticker: "AAPL", shares: 1, costBasis: 1000, currentValue: 1200, costBasisUSD: 1000, currentValueUSD: 1200, priceUnavailable: false, fxRateUnavailable: false }];
        const previousSnapshots = new Map([["AAPL", { currentValue: 1000, observedAt: new Date() }]]);
        const { candidates } = engine.evaluatePortfolioRules({ holdings, summary: { totalCurrentValue: 1200 }, previousSnapshots });
        expect(candidates.find((c) => c.rule === "HOLDING_VALUE_CHANGE")).toBeDefined();
    });

    it("excludes a holding with an unavailable price from concentration/value-change entirely (no fabricated zero)", () => {
        const holdings = [{ ticker: "ZZZZ", shares: 1, costBasis: 1000, currentValue: null, costBasisUSD: 1000, currentValueUSD: null, priceUnavailable: true, fxRateUnavailable: false }];
        const { candidates, snapshotUpdates } = engine.evaluatePortfolioRules({
            holdings,
            summary: { totalCurrentValue: 0 },
            previousSnapshots: new Map(),
        });
        expect(candidates).toEqual([]);
        expect(snapshotUpdates).toEqual([]);
    });
});

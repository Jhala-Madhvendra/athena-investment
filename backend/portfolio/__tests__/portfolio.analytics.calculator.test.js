const calculator = require("../portfolio.analytics.calculator");

describe("computeDailyReturns", () => {
    it("computes day-over-day returns from ascending bars", () => {
        const bars = [
            { date: "2025-01-01", close: 100 },
            { date: "2025-01-02", close: 110 },
            { date: "2025-01-03", close: 99 },
        ];

        const result = calculator.computeDailyReturns(bars);

        expect(result[0].date).toBe("2025-01-02");
        expect(result[0].return).toBeCloseTo(0.1, 10);
        expect(result[1].date).toBe("2025-01-03");
        expect(result[1].return).toBeCloseTo(-0.1, 10);
    });

    it("returns an empty array with fewer than two bars", () => {
        expect(calculator.computeDailyReturns([])).toEqual([]);
        expect(calculator.computeDailyReturns([{ date: "2025-01-01", close: 100 }])).toEqual([]);
    });

    it("skips a pair when a close is missing or zero", () => {
        const bars = [
            { date: "2025-01-01", close: 100 },
            { date: "2025-01-02", close: null },
            { date: "2025-01-03", close: 105 },
        ];

        expect(calculator.computeDailyReturns(bars)).toEqual([]);
    });
});

describe("buildPortfolioReturnSeries", () => {
    it("weights covered tickers by today's weight on a fully-covered date", () => {
        const returnsByTicker = {
            AAPL: [{ date: "2025-01-02", return: 0.1 }],
            MSFT: [{ date: "2025-01-02", return: -0.02 }],
        };
        const weightsByTicker = { AAPL: 0.6, MSFT: 0.4 };

        const series = calculator.buildPortfolioReturnSeries(returnsByTicker, weightsByTicker);

        expect(series).toHaveLength(1);
        expect(series[0].return).toBeCloseTo(0.6 * 0.1 + 0.4 * -0.02, 10);
    });

    it("renormalizes weights across covered tickers when one ticker is missing that date", () => {
        const returnsByTicker = {
            AAPL: [{ date: "2025-01-02", return: 0.1 }],
            MSFT: [], // no data at all
        };
        const weightsByTicker = { AAPL: 0.6, MSFT: 0.4 };

        const series = calculator.buildPortfolioReturnSeries(returnsByTicker, weightsByTicker);

        // AAPL's 0.6 weight covers >= MIN_COVERAGE_WEIGHT (0.5), renormalized to 1.0
        expect(series).toHaveLength(1);
        expect(series[0].return).toBeCloseTo(0.1, 10);
    });

    it("drops a date when covered weight falls below the minimum coverage threshold", () => {
        const returnsByTicker = {
            AAPL: [{ date: "2025-01-02", return: 0.1 }],
            MSFT: [],
            GOOG: [],
        };
        const weightsByTicker = { AAPL: 0.3, MSFT: 0.35, GOOG: 0.35 };

        expect(calculator.buildPortfolioReturnSeries(returnsByTicker, weightsByTicker)).toEqual([]);
    });

    it("returns an empty series when there are no weighted tickers", () => {
        expect(calculator.buildPortfolioReturnSeries({}, {})).toEqual([]);
    });
});

describe("calculateVolatility", () => {
    it("returns null with fewer observations than the minimum", () => {
        const series = [{ date: "2025-01-02", return: 0.01 }];
        expect(calculator.calculateVolatility(series)).toBeNull();
    });

    it("annualizes daily standard deviation by sqrt(252)", () => {
        const returns = [0.01, -0.01, 0.02, -0.02, 0.005, -0.005, 0.015, -0.015, 0.01, -0.01, 0.02];
        const series = returns.map((r, i) => ({ date: `2025-01-${String(i + 1).padStart(2, "0")}`, return: r }));

        const dailyStdDev = calculator.standardDeviation(returns);
        const expected = dailyStdDev * Math.sqrt(252);

        expect(calculator.calculateVolatility(series)).toBeCloseTo(expected, 10);
    });
});

describe("calculatePeriodReturn", () => {
    it("compounds daily returns rather than summing them", () => {
        const series = [
            { date: "2025-01-02", return: 0.1 },
            { date: "2025-01-03", return: 0.1 },
        ];

        // (1.1 * 1.1) - 1 = 0.21, not 0.2
        expect(calculator.calculatePeriodReturn(series)).toBeCloseTo(0.21, 10);
    });

    it("returns null for an empty series", () => {
        expect(calculator.calculatePeriodReturn([])).toBeNull();
    });
});

describe("annualizeReturn", () => {
    it("annualizes a period return using the actual observed trading days", () => {
        // 252 observed trading days = exactly one year, so annualized == period return
        expect(calculator.annualizeReturn(0.2, 252)).toBeCloseTo(0.2, 10);
    });

    it("scales up a short window's return", () => {
        const result = calculator.annualizeReturn(0.05, 63); // ~1 quarter
        expect(result).toBeGreaterThan(0.05);
    });

    it("returns null for a total loss (period return of -100% or worse)", () => {
        expect(calculator.annualizeReturn(-1, 100)).toBeNull();
    });

    it("returns null for missing inputs", () => {
        expect(calculator.annualizeReturn(null, 100)).toBeNull();
        expect(calculator.annualizeReturn(0.1, 0)).toBeNull();
    });
});

describe("calculateSharpeRatio", () => {
    it("computes excess return over volatility", () => {
        expect(calculator.calculateSharpeRatio(0.12, 0.04, 0.16)).toBeCloseTo(0.5, 10);
    });

    it("returns null on zero volatility rather than Infinity", () => {
        expect(calculator.calculateSharpeRatio(0.1, 0.04, 0)).toBeNull();
    });

    it("returns null when the return is missing", () => {
        expect(calculator.calculateSharpeRatio(null, 0.04, 0.16)).toBeNull();
    });

    it("returns null when the risk-free rate is missing", () => {
        expect(calculator.calculateSharpeRatio(0.1, null, 0.16)).toBeNull();
    });
});

describe("calculateMaxDrawdown", () => {
    it("finds the peak, trough, and recovery dates", () => {
        const series = [
            { date: "2025-01-01", return: 0.1 }, // value 1.10 (new peak)
            { date: "2025-01-02", return: -0.2 }, // value 0.88 (trough)
            { date: "2025-01-03", return: 0.05 }, // value 0.924
            { date: "2025-01-04", return: 0.3 }, // value 1.2012 (recovered above 1.10)
        ];

        const result = calculator.calculateMaxDrawdown(series);

        expect(result.peakDate).toBe("2025-01-01");
        expect(result.troughDate).toBe("2025-01-02");
        expect(result.recoveryDate).toBe("2025-01-04");
        expect(result.maxDrawdownPercent).toBeCloseTo(-20, 5);
    });

    it("reports no recovery when the series never returns to the prior peak", () => {
        const series = [
            { date: "2025-01-01", return: 0.1 },
            { date: "2025-01-02", return: -0.3 },
        ];

        const result = calculator.calculateMaxDrawdown(series);
        expect(result.recoveryDate).toBeNull();
    });

    it("reports zero drawdown for a monotonically increasing series", () => {
        const series = [
            { date: "2025-01-01", return: 0.01 },
            { date: "2025-01-02", return: 0.02 },
        ];

        const result = calculator.calculateMaxDrawdown(series);
        expect(result.maxDrawdownPercent).toBe(0);
        expect(result.troughDate).toBeNull();
    });

    it("handles an empty series", () => {
        expect(calculator.calculateMaxDrawdown([])).toEqual({
            maxDrawdownPercent: null,
            peakDate: null,
            troughDate: null,
            recoveryDate: null,
        });
    });
});

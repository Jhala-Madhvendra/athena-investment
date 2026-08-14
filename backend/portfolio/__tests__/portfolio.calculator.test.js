const calculator = require("../portfolio.calculator");

describe("calculateCostBasis", () => {
    it("multiplies shares by purchase price", () => {
        expect(calculator.calculateCostBasis(10, 150)).toBe(1500);
    });

    it("handles a zero purchase price (e.g. gifted shares)", () => {
        expect(calculator.calculateCostBasis(10, 0)).toBe(0);
    });
});

describe("calculateCurrentValue", () => {
    it("multiplies shares by the current price", () => {
        expect(calculator.calculateCurrentValue(10, 200)).toBe(2000);
    });

    it("returns null (not 0) when the current price is unavailable", () => {
        expect(calculator.calculateCurrentValue(10, null)).toBeNull();
        expect(calculator.calculateCurrentValue(10, undefined)).toBeNull();
        expect(calculator.calculateCurrentValue(10, NaN)).toBeNull();
    });
});

describe("calculateGainLoss", () => {
    it("returns currentValue minus costBasis", () => {
        expect(calculator.calculateGainLoss(2000, 1500)).toBe(500);
    });

    it("returns null when currentValue is unavailable", () => {
        expect(calculator.calculateGainLoss(null, 1500)).toBeNull();
    });
});

describe("calculateReturnPercent", () => {
    it("computes a positive return", () => {
        expect(calculator.calculateReturnPercent(2000, 1000)).toBe(100);
    });

    it("computes a negative return", () => {
        expect(calculator.calculateReturnPercent(900, 1000)).toBeCloseTo(-10);
    });

    it("returns null (not Infinity) on a zero cost basis", () => {
        expect(calculator.calculateReturnPercent(500, 0)).toBeNull();
    });

    it("returns null when currentValue is unavailable", () => {
        expect(calculator.calculateReturnPercent(null, 1000)).toBeNull();
    });
});

describe("enrichHolding", () => {
    it("computes every derived field for a priced holding", () => {
        const holding = { ticker: "AAPL", shares: 10, averagePurchasePrice: 100 };
        const result = calculator.enrichHolding(holding, 150);

        expect(result).toMatchObject({
            costBasis: 1000,
            currentValue: 1500,
            gainLoss: 500,
            returnPercent: 50,
            priceUnavailable: false,
        });
    });

    it("degrades gracefully when the current price is unavailable", () => {
        const holding = { ticker: "ZZZZ", shares: 10, averagePurchasePrice: 100 };
        const result = calculator.enrichHolding(holding, null);

        expect(result.costBasis).toBe(1000);
        expect(result.currentValue).toBeNull();
        expect(result.gainLoss).toBeNull();
        expect(result.returnPercent).toBeNull();
        expect(result.priceUnavailable).toBe(true);
    });
});

describe("groupByTicker", () => {
    it("nets multiple lots of the same ticker into one position", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "AAPL", shares: 5, averagePurchasePrice: 100 }, 150),
            calculator.enrichHolding({ ticker: "AAPL", shares: 5, averagePurchasePrice: 200 }, 150),
        ];

        const positions = calculator.groupByTicker(enriched);

        expect(positions).toHaveLength(1);
        expect(positions[0]).toMatchObject({
            ticker: "AAPL",
            shares: 10,
            costBasis: 1500,
            currentValue: 1500,
            gainLoss: 0,
            returnPercent: 0,
        });
    });

    it("keeps different tickers as separate positions", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "AAPL", shares: 5, averagePurchasePrice: 100 }, 150),
            calculator.enrichHolding({ ticker: "MSFT", shares: 5, averagePurchasePrice: 100 }, 150),
        ];

        expect(calculator.groupByTicker(enriched).map((p) => p.ticker).sort()).toEqual(["AAPL", "MSFT"]);
    });

    it("marks a position's value unknown if any of its lots is unpriced", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "ZZZZ", shares: 5, averagePurchasePrice: 100 }, 150),
            calculator.enrichHolding({ ticker: "ZZZZ", shares: 5, averagePurchasePrice: 100 }, null),
        ];

        const positions = calculator.groupByTicker(enriched);
        expect(positions[0].currentValue).toBeNull();
        expect(positions[0].costBasis).toBe(1000);
    });
});

describe("summarizePortfolio", () => {
    it("returns all-zero/null summary for an empty portfolio", () => {
        const summary = calculator.summarizePortfolio([]);
        expect(summary.totalCostBasis).toBe(0);
        expect(summary.totalCurrentValue).toBe(0);
        expect(summary.totalGainLoss).toBeNull();
        expect(summary.totalReturnPercent).toBeNull();
        expect(summary.numberOfHoldings).toBe(0);
        expect(summary.largestHolding).toBeNull();
    });

    it("is value-weighted, not an average of per-holding returns", () => {
        // A: $100 cost -> $200 (+100%). B: $10,000 cost -> $9,900 (-1%).
        // Naive averaging of returns would report ~+49.5%; the portfolio
        // actually broke exactly even because B's dollar move dwarfs A's.
        const enriched = [
            calculator.enrichHolding({ ticker: "SMALLCAP", shares: 1, averagePurchasePrice: 100 }, 200),
            calculator.enrichHolding({ ticker: "BIGCAP", shares: 1, averagePurchasePrice: 10000 }, 9900),
        ];

        const summary = calculator.summarizePortfolio(enriched);

        expect(summary.totalCostBasis).toBe(10100);
        expect(summary.totalCurrentValue).toBe(10100);
        expect(summary.totalGainLoss).toBe(0);
        expect(summary.totalReturnPercent).toBeCloseTo(0);
    });

    it("excludes unpriced holdings from totals but reports them separately", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "AAPL", shares: 10, averagePurchasePrice: 100 }, 150),
            calculator.enrichHolding({ ticker: "ZZZZ", shares: 5, averagePurchasePrice: 200 }, null),
        ];

        const summary = calculator.summarizePortfolio(enriched);

        expect(summary.totalCostBasis).toBe(1000); // only AAPL's cost basis, not ZZZZ's $1000
        expect(summary.totalCurrentValue).toBe(1500);
        expect(summary.unpricedHoldings).toEqual([{ ticker: "ZZZZ", costBasis: 1000 }]);
    });

    it("identifies largest, best-performing, and worst-performing positions by ticker", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "AAPL", shares: 10, averagePurchasePrice: 100 }, 200), // +100%, $2000
            calculator.enrichHolding({ ticker: "MSFT", shares: 100, averagePurchasePrice: 50 }, 40), // -20%, $4000
            calculator.enrichHolding({ ticker: "TSLA", shares: 1, averagePurchasePrice: 100 }, 101), // +1%, $101
        ];

        const summary = calculator.summarizePortfolio(enriched);

        expect(summary.largestHolding.ticker).toBe("MSFT");
        expect(summary.bestPerformingHolding.ticker).toBe("AAPL");
        expect(summary.worstPerformingHolding.ticker).toBe("MSFT");
        expect(summary.numberOfCompanies).toBe(3);
    });

    it("computes concentration as weight of the current portfolio value", () => {
        const enriched = [
            calculator.enrichHolding({ ticker: "AAPL", shares: 1, averagePurchasePrice: 100 }, 4000), // 80% of value
            calculator.enrichHolding({ ticker: "MSFT", shares: 1, averagePurchasePrice: 100 }, 1000), // 20% of value
        ];

        const summary = calculator.summarizePortfolio(enriched);

        expect(summary.concentration.topHoldingWeightPercent).toBeCloseTo(80);
        expect(summary.concentration.top3WeightPercent).toBeCloseTo(100);
    });
});

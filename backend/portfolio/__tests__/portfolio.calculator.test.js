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

    it("defaults to an fxRateToUSD of 1 (native-currency figures already in USD) when no rate is passed", () => {
        const holding = { ticker: "AAPL", shares: 10, averagePurchasePrice: 100 };
        const result = calculator.enrichHolding(holding, 150);

        expect(result.costBasisUSD).toBe(1000);
        expect(result.currentValueUSD).toBe(1500);
        expect(result.fxRateUnavailable).toBe(false);
    });

    it("converts costBasis/currentValue to USD using the supplied exchange rate, without changing the native-currency figures", () => {
        // TCS.BO: 4 shares @ 70 INR cost, 2315 INR current price. Rate ~1/87.5 USD per INR.
        const holding = { ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 };
        const fxRateToUSD = 1 / 87.5;
        const result = calculator.enrichHolding(holding, 2315, fxRateToUSD);

        expect(result.costBasis).toBe(280); // unchanged, still INR
        expect(result.currentValue).toBe(9260); // unchanged, still INR
        expect(result.costBasisUSD).toBeCloseTo(280 / 87.5, 5);
        expect(result.currentValueUSD).toBeCloseTo(9260 / 87.5, 5);
        // Per-holding return % is a same-currency ratio - completely unaffected by the FX rate.
        expect(result.returnPercent).toBeCloseTo(calculator.calculateReturnPercent(9260, 280), 10);
    });

    it("reports currentValueUSD/costBasisUSD as null (not a wrong number) when the exchange rate is unavailable", () => {
        const holding = { ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 };
        const result = calculator.enrichHolding(holding, 2315, null);

        expect(result.currentValue).toBe(9260); // native currency still known and displayed
        expect(result.costBasisUSD).toBeNull();
        expect(result.currentValueUSD).toBeNull();
        expect(result.fxRateUnavailable).toBe(true);
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

    describe("multi-currency portfolios", () => {
        // Regression coverage for a real bug: an INR holding's raw value was
        // being summed directly with USD holdings as if 1 INR == 1 USD,
        // wildly overstating totalCurrentValue and every weight/concentration
        // figure built on top of it.
        const usdRate = 1; // USD is the base currency
        const inrRate = 1 / 87.5; // ~87.5 INR per USD

        it("sums totals in USD, not as a naive cross-currency sum of raw numbers", () => {
            const enriched = [
                calculator.enrichHolding({ ticker: "AAPL", shares: 10, averagePurchasePrice: 150 }, 300, usdRate), // $3,000
                calculator.enrichHolding({ ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 }, 2315, inrRate), // 9,260 INR ~= $105.83
            ];

            const summary = calculator.summarizePortfolio(enriched);

            // The bug: naive sum would be 3000 + 9260 = 12260. Correct: 3000 + (9260/87.5).
            const expectedTotal = 3000 + 9260 / 87.5;
            expect(summary.totalCurrentValue).toBeCloseTo(expectedTotal, 5);
            expect(summary.totalCurrentValue).not.toBeCloseTo(12260, 0);
        });

        it("weights a large-raw-number-but-small-actual-value INR holding correctly, not as if it dominated the portfolio", () => {
            const enriched = [
                calculator.enrichHolding({ ticker: "AAPL", shares: 10, averagePurchasePrice: 150 }, 300, usdRate), // $3,000
                calculator.enrichHolding({ ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 }, 2315, inrRate), // ~$105.83 - genuinely small
            ];

            const positions = calculator.groupByTicker(enriched).map((p) => ({
                ...p,
                weightPercent: (p.currentValueUSD / (3000 + 9260 / 87.5)) * 100,
            }));

            const tcs = positions.find((p) => p.ticker === "TCS.BO");
            const aapl = positions.find((p) => p.ticker === "AAPL");

            // TCS.BO's raw number (9,260) is larger than AAPL's (300), but its true USD weight is small.
            expect(tcs.weightPercent).toBeLessThan(5);
            expect(aapl.weightPercent).toBeGreaterThan(95);
        });

        it("excludes a holding from USD totals (with a stated reason) when its exchange rate is unavailable, without dropping its native-currency data", () => {
            const enriched = [
                calculator.enrichHolding({ ticker: "AAPL", shares: 10, averagePurchasePrice: 150 }, 300, usdRate),
                calculator.enrichHolding({ ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 }, 2315, null), // rate unavailable
            ];

            const summary = calculator.summarizePortfolio(enriched);

            expect(summary.totalCurrentValue).toBe(3000); // only AAPL - TCS.BO's USD value is unknown, not assumed
            expect(summary.fxUnavailableHoldings).toEqual([{ ticker: "TCS.BO", currency: null, currentValue: 9260 }]);
        });

        it("does not affect a single holding's own return percent, since it's a same-currency ratio", () => {
            const enriched = [calculator.enrichHolding({ ticker: "TCS.BO", shares: 4, averagePurchasePrice: 70 }, 2315, inrRate)];
            const summary = calculator.summarizePortfolio(enriched);

            // Return % should match the native-currency calculation exactly - USD conversion must not distort it.
            expect(summary.totalReturnPercent).toBeCloseTo(calculator.calculateReturnPercent(9260, 280), 10);
        });
    });
});

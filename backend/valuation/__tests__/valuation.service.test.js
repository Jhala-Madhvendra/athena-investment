jest.mock("../../financials/financials.service", () => ({
    getFinancialStatementsByTicker: jest.fn(),
}));
jest.mock("../../market/market.service", () => ({
    getCurrentMarketData: jest.fn(),
}));
jest.mock("../providers/riskFreeRate.provider", () => ({
    getRiskFreeRate: jest.fn(),
}));

const financialsService = require("../../financials/financials.service");
const marketService = require("../../market/market.service");
const riskFreeRateProvider = require("../providers/riskFreeRate.provider");
const valuationService = require("../valuation.service");

const buildStatement = (year, overrides = {}) => ({
    year,
    incomeStatement: {
        totalRevenue: 1000 + year,
        operatingIncome: 220,
        pretaxIncome: 200,
        taxProvision: 50,
        netIncome: 150,
        dilutedSharesOutstanding: 100,
    },
    balanceSheet: {
        cashAndCashEquivalents: 300,
        totalAssets: 2000,
        totalLiabilities: 900,
        totalDebt: 400,
        totalStockholderEquity: 1100,
        currentAssets: 700,
        currentLiabilities: 400,
    },
    cashFlow: {
        operatingCashFlow: 260,
        capitalExpenditure: -80, // stored as a negative outflow, matching real Yahoo data
        depreciationAndAmortization: 60,
    },
    ...overrides,
});

const twoYearsOfStatements = [buildStatement(2022), buildStatement(2023)];

const quote = {
    price: { current: 150, marketCap: 50000 },
    riskMetrics: { beta: 1.2 },
};

const dcfAssumptions = () => ({
    forecastYears: 5,
    revenueGrowth: 0.08,
    ebitMargin: 0.2,
    depreciationPercentRevenue: 0.05,
    capexPercentRevenue: 0.06,
    workingCapitalPercentRevenue: 0.15,
    taxRate: 0.25,
    terminalGrowthRate: 0.02,
    riskFreeRate: 0.04,
    beta: 1.2,
    equityRiskPremium: 0.05,
    preTaxCostOfDebt: 0.06,
});

afterEach(() => {
    jest.clearAllMocks();
});

describe("getDCFDefaults", () => {
    it("throws a 404 NoFinancialDataError when no statements are stored", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue([]);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        await expect(valuationService.getDCFDefaults("AAPL")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns labeled suggested assumptions built from stored financials, the live quote, and the live risk-free rate", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.043);

        const defaults = await valuationService.getDCFDefaults("AAPL");

        expect(defaults.ticker).toBe("AAPL");
        expect(defaults.suggestedAssumptions.forecastYears).toEqual({ value: 5, source: "default", note: expect.any(String) });
        expect(defaults.suggestedAssumptions.ebitMargin.source).toBe("derived");
        expect(defaults.suggestedAssumptions.terminalGrowthRate).toEqual({
            value: 0.025,
            source: "illustrative_default",
            note: expect.any(String),
        });
        expect(defaults.waccInputs.beta).toEqual({ value: 1.2, source: "market", note: expect.any(String) });
        expect(defaults.waccInputs.riskFreeRate).toEqual({ value: 0.043, source: "market", note: expect.any(String) });
        expect(defaults.waccInputs.equityRiskPremium).toEqual({
            value: 0.05,
            source: "illustrative_default",
            note: expect.any(String),
        });
        expect(defaults.waccInputs.preTaxCostOfDebt.source).toBe("required_user_input");
        expect(defaults.waccInputs.preTaxCostOfDebt.value).toBeNull();
        expect(defaults.capitalStructure.dilutedShares.source).toBe("historical");
    });

    it("degrades gracefully (no throw) when the live market quote is unavailable", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockRejectedValue(new Error("Yahoo Finance request failed."));
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.043);

        const defaults = await valuationService.getDCFDefaults("AAPL");

        expect(defaults.waccInputs.beta.source).toBe("unavailable");
        expect(defaults.capitalStructure.marketValueOfEquity.source).toBe("unavailable");
    });

    it("degrades gracefully when the live risk-free rate is unavailable", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(null);

        const defaults = await valuationService.getDCFDefaults("AAPL");

        expect(defaults.waccInputs.riskFreeRate).toEqual({ value: null, source: "unavailable", note: expect.any(String) });
    });
});

describe("calculateDCFValuation", () => {
    it("returns a full, internally consistent valuation for a valid request", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFValuation("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(true);
        expect(result.ticker).toBe("AAPL");
        expect(result.disclaimer).toMatch(/highly sensitive to assumptions/i);
        expect(result.waccBreakdown.wacc).toBeGreaterThan(0);
        expect(result.currentMarketPrice).toBe(150);
        expect(typeof result.upsideDownsidePercent).toBe("number");
        expect(result.historicalFCFF).toHaveLength(2);
        expect(result.intrinsicValuePerShare).toBeCloseTo(result.equityValue / 100);
    });

    it("fails clearly when market capitalization is unavailable (WACC cannot be weighted)", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue({ price: { current: null, marketCap: null }, riskMetrics: {} });

        const result = await valuationService.calculateDCFValuation("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes("market capitalization"))).toBe(true);
    });

    it("fails clearly when diluted shares outstanding is missing rather than fabricating a value", async () => {
        const statementsWithoutShares = [
            buildStatement(2022, { incomeStatement: { ...buildStatement(2022).incomeStatement, dilutedSharesOutstanding: null } }),
            buildStatement(2023, { incomeStatement: { ...buildStatement(2023).incomeStatement, dilutedSharesOutstanding: null } }),
        ];
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(statementsWithoutShares);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFValuation("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("dilutedShares"))).toBe(true);
    });

    it("computes upside/downside as null (not a crash) when the live price is unavailable", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue({ price: { current: null, marketCap: 50000 }, riskMetrics: { beta: 1.2 } });

        const result = await valuationService.calculateDCFValuation("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(true);
        expect(result.currentMarketPrice).toBeNull();
        expect(result.upsideDownsidePercent).toBeNull();
    });
});

describe("calculateDCFScenarios", () => {
    it("returns bear/base/bull with bull > base > bear", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFScenarios("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(true);
        expect(result.ticker).toBe("AAPL");
        expect(result.disclaimer).toMatch(/highly sensitive to assumptions/i);
        expect(result.scenarios.bull.intrinsicValuePerShare).toBeGreaterThan(result.scenarios.base.intrinsicValuePerShare);
        expect(result.scenarios.base.intrinsicValuePerShare).toBeGreaterThan(result.scenarios.bear.intrinsicValuePerShare);
    });

    it("includes market comparison fields on every scenario", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFScenarios("AAPL", dcfAssumptions());

        ["bear", "base", "bull"].forEach((key) => {
            expect(result.scenarios[key].currentMarketPrice).toBe(150);
            expect(typeof result.scenarios[key].upsideDownsidePercent).toBe("number");
        });
    });

    it("fails clearly (all scenarios) when diluted shares outstanding is missing", async () => {
        const statementsWithoutShares = [
            buildStatement(2022, { incomeStatement: { ...buildStatement(2022).incomeStatement, dilutedSharesOutstanding: null } }),
            buildStatement(2023, { incomeStatement: { ...buildStatement(2023).incomeStatement, dilutedSharesOutstanding: null } }),
        ];
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(statementsWithoutShares);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFScenarios("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("dilutedShares"))).toBe(true);
    });
});

describe("calculateDCFSensitivity", () => {
    it("returns a matrix centered on the computed WACC and requested terminal growth", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFSensitivity("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(true);
        expect(result.matrix.waccValues).toHaveLength(5);
        expect(result.matrix.terminalGrowthValues).toHaveLength(5);
        expect(result.matrix.waccValues).toContain(Number(result.baseWacc.toFixed(4)));
    });

    it("uses explicit range overrides when provided", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue(quote);

        const result = await valuationService.calculateDCFSensitivity("AAPL", dcfAssumptions(), {
            waccValues: [0.08, 0.1],
            terminalGrowthValues: [0.02, 0.03],
        });

        expect(result.matrix.waccValues).toEqual([0.08, 0.1]);
        expect(result.matrix.terminalGrowthValues).toEqual([0.02, 0.03]);
    });

    it("fails clearly when WACC cannot be computed, rather than returning a garbage matrix", async () => {
        financialsService.getFinancialStatementsByTicker.mockResolvedValue(twoYearsOfStatements);
        marketService.getCurrentMarketData.mockResolvedValue({ price: { current: null, marketCap: null }, riskMetrics: {} });

        const result = await valuationService.calculateDCFSensitivity("AAPL", dcfAssumptions());

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.toLowerCase().includes("market capitalization"))).toBe(true);
    });
});

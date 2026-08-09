jest.mock("../../providers/riskFreeRate.provider", () => ({
    getRiskFreeRate: jest.fn(),
}));

const riskFreeRateProvider = require("../../providers/riskFreeRate.provider");
const dcfInputMapper = require("../dcfInput.mapper");

const buildStatement = (year, overrides = {}) => ({
    year,
    incomeStatement: {
        totalRevenue: 1000 + year * 10,
        operatingIncome: 220,
        pretaxIncome: 200,
        taxProvision: 50,
        netIncome: 150,
        dilutedSharesOutstanding: 100,
    },
    balanceSheet: {
        cashAndCashEquivalents: 300,
        totalDebt: 400,
        currentAssets: 700,
        currentLiabilities: 400,
    },
    cashFlow: {
        capitalExpenditure: -80, // stored as a negative outflow, matching real Yahoo data
        depreciationAndAmortization: 60,
    },
    ...overrides,
});

const statements = [buildStatement(2022), buildStatement(2023)];
const latestStatement = statements[1];
const quote = { price: { current: 150, marketCap: 50000 }, riskMetrics: { beta: 1.15 } };

afterEach(() => {
    jest.clearAllMocks();
});

describe("buildHistoricalFinancials / buildCapitalStructure / buildWaccCapitalWeights", () => {
    it("pulls revenue, NWC, and capital structure straight from the latest statement", () => {
        expect(dcfInputMapper.buildHistoricalFinancials(latestStatement)).toEqual({
            latestRevenue: latestStatement.incomeStatement.totalRevenue,
            latestNWC: 300, // 700 - 400
        });

        expect(dcfInputMapper.buildCapitalStructure(latestStatement)).toEqual({
            debt: 400,
            cash: 300,
            dilutedShares: 100,
        });

        expect(dcfInputMapper.buildWaccCapitalWeights(latestStatement, quote)).toEqual({
            marketValueOfEquity: 50000,
            marketValueOfDebt: 400,
        });
    });
});

describe("buildDefaults", () => {
    it("labels the live risk-free rate as market-sourced when available", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.0432);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.waccInputs.riskFreeRate).toEqual({ value: 0.0432, source: "market", note: expect.any(String) });
    });

    it("falls back to unavailable when the live risk-free rate fetch fails", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(null);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.waccInputs.riskFreeRate).toEqual({ value: null, source: "unavailable", note: expect.any(String) });
    });

    it("pre-fills equity risk premium and terminal growth as clearly-labeled illustrative defaults, never as market/derived", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.waccInputs.equityRiskPremium.source).toBe("illustrative_default");
        expect(defaults.waccInputs.equityRiskPremium.value).toBe(0.05);
        expect(defaults.suggestedAssumptions.terminalGrowthRate.source).toBe("illustrative_default");
        expect(defaults.suggestedAssumptions.terminalGrowthRate.value).toBe(0.025);
    });

    it("never fabricates a pre-tax cost of debt - always required_user_input with a null value", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.waccInputs.preTaxCostOfDebt).toEqual({
            value: null,
            source: "required_user_input",
            note: expect.any(String),
        });
    });

    it("marks diluted shares unavailable (not fabricated) when missing from stored data", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);
        const statementWithoutShares = buildStatement(2023, {
            incomeStatement: { ...buildStatement(2023).incomeStatement, dilutedSharesOutstanding: null },
        });

        const defaults = await dcfInputMapper.buildDefaults({
            ticker: "AAPL",
            statements: [buildStatement(2022), statementWithoutShares],
            latestStatement: statementWithoutShares,
            quote,
        });

        expect(defaults.capitalStructure.dilutedShares.source).toBe("unavailable");
        expect(defaults.capitalStructure.dilutedShares.value).toBeNull();
    });

    it("derives revenue growth as a historical CAGR across the stored years", async () => {
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.suggestedAssumptions.revenueGrowth.source).toBe("derived");
        expect(typeof defaults.suggestedAssumptions.revenueGrowth.value).toBe("number");
    });

    it("suggests a positive CapEx % of revenue even though stored capitalExpenditure is negative", async () => {
        // Regression test for the CapEx sign bug: statements store capitalExpenditure as a
        // negative outflow (confirmed against real Yahoo data), but the suggested percent-of-
        // revenue assumption must be positive, matching what the forecast engine expects.
        riskFreeRateProvider.getRiskFreeRate.mockResolvedValue(0.04);

        const defaults = await dcfInputMapper.buildDefaults({ ticker: "AAPL", statements, latestStatement, quote });

        expect(defaults.suggestedAssumptions.capexPercentRevenue.source).toBe("derived");
        expect(defaults.suggestedAssumptions.capexPercentRevenue.value).toBeGreaterThan(0);
    });
});

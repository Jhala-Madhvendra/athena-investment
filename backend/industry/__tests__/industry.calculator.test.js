const calculator = require("../industry.calculator");

const statement = ({ year, revenue, netIncome, operatingIncome, equity, assets, debt, cash, dna, ocf, capex }) => ({
    year,
    incomeStatement: { totalRevenue: revenue, netIncome, operatingIncome },
    balanceSheet: { totalStockholderEquity: equity, totalAssets: assets, totalDebt: debt, cashAndCashEquivalents: cash },
    cashFlow: { depreciationAndAmortization: dna, operatingCashFlow: ocf, capitalExpenditure: capex },
});

describe("industry.calculator.calculateRevenueGrowth", () => {
    it("computes YoY growth from two annual statements", () => {
        const latest = statement({ year: 2025, revenue: 1150 });
        const prior = statement({ year: 2024, revenue: 1000 });
        const result = calculator.calculateRevenueGrowth(latest, prior);
        expect(result.value).toBeCloseTo(15);
        expect(result.exclusionReason).toBeNull();
    });

    it("excludes with a reason when there is no prior-year statement", () => {
        const latest = statement({ year: 2025, revenue: 1150 });
        const result = calculator.calculateRevenueGrowth(latest, null);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/prior-year financial statement/i);
    });

    it("excludes with a reason when prior-year revenue is zero or negative", () => {
        const latest = statement({ year: 2025, revenue: 1150 });
        const prior = statement({ year: 2024, revenue: 0 });
        const result = calculator.calculateRevenueGrowth(latest, prior);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/zero\/negative/i);
    });
});

describe("industry.calculator.calculateFCFMargin", () => {
    it("computes FCF margin as a percentage of revenue", () => {
        const s = statement({ revenue: 1000, ocf: 300, capex: -100 });
        const result = calculator.calculateFCFMargin(s);
        expect(result.value).toBeCloseTo(20); // (300-100)/1000 = 20%
    });

    it("excludes when revenue is zero (avoids a division-by-zero outlier)", () => {
        const s = statement({ revenue: 0, ocf: 300, capex: -100 });
        const result = calculator.calculateFCFMargin(s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/zero or negative/i);
    });
});

describe("industry.calculator.calculateDebtToEquity", () => {
    it("computes debt-to-equity for positive equity", () => {
        const s = statement({ debt: 400, equity: 800 });
        const result = calculator.calculateDebtToEquity(s);
        expect(result.value).toBeCloseTo(0.5);
    });

    it("excludes negative equity as an outlier override, even though the raw ratio would be numeric", () => {
        const s = statement({ debt: 400, equity: -200 });
        const result = calculator.calculateDebtToEquity(s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/not meaningful for benchmarking/i);
    });
});

describe("industry.calculator.calculatePE", () => {
    it("computes P/E from market cap and net income", () => {
        const s = statement({ netIncome: 500 });
        const result = calculator.calculatePE(5000, s);
        expect(result.value).toBe(10);
    });

    it("excludes negative earnings rather than inverting into a misleading positive P/E", () => {
        const s = statement({ netIncome: -200 });
        const result = calculator.calculatePE(5000, s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/zero or negative/i);
    });

    it("excludes when market cap is unavailable", () => {
        const s = statement({ netIncome: 500 });
        const result = calculator.calculatePE(null, s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/market capitalization/i);
    });
});

describe("industry.calculator.calculateEvEbitda", () => {
    it("computes EV/EBITDA via the same EBITDA proxy and EV bridge as Comps", () => {
        const s = statement({ operatingIncome: 300, dna: 100, debt: 500, cash: 200 });
        const result = calculator.calculateEvEbitda(2000, s);
        // EBITDA = 400, EV = 2000 + 500 - 200 = 2300, EV/EBITDA = 5.75
        expect(result.value).toBeCloseTo(5.75);
    });

    it("excludes negative EBITDA", () => {
        const s = statement({ operatingIncome: -600, dna: 100, debt: 500, cash: 200 });
        const result = calculator.calculateEvEbitda(2000, s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/EBITDA is zero or negative/i);
    });

    it("excludes when Enterprise Value cannot be computed (missing debt/cash)", () => {
        const s = statement({ operatingIncome: 300, dna: 100, debt: null, cash: 200 });
        const result = calculator.calculateEvEbitda(2000, s);
        expect(result.value).toBeNull();
        expect(result.exclusionReason).toMatch(/Enterprise Value could not be computed/i);
    });
});

describe("industry.calculator.buildCompanyMetricBundle", () => {
    it("computes every metric key for a fully-populated company", () => {
        const latest = statement({ year: 2025, revenue: 1150, netIncome: 200, operatingIncome: 300, equity: 800, assets: 2000, debt: 400, cash: 100, dna: 50, ocf: 250, capex: -50 });
        const prior = statement({ year: 2024, revenue: 1000 });

        const bundle = calculator.buildCompanyMetricBundle({
            ticker: "TEST",
            name: "Test Co",
            marketCap: 4000,
            latestStatement: latest,
            priorStatement: prior,
        });

        expect(bundle.ticker).toBe("TEST");
        expect(bundle.fiscalYear).toBe(2025);
        expect(bundle.priorFiscalYear).toBe(2024);
        expect(Object.keys(bundle.metrics).sort()).toEqual(
            ["debtToEquity", "evEbitda", "fcfMargin", "netMargin", "operatingMargin", "pe", "revenueGrowth", "roa", "roe"].sort()
        );
        expect(bundle.metrics.revenueGrowth.value).toBeCloseTo(15);
        expect(bundle.metrics.operatingMargin.value).not.toBeNull();
    });

    it("never throws when no market cap or prior statement is available - metrics degrade to null with reasons instead", () => {
        const latest = statement({ year: 2025, revenue: 1150, netIncome: 200, operatingIncome: 300, equity: 800, assets: 2000, debt: 400, cash: 100, dna: 50 });

        const bundle = calculator.buildCompanyMetricBundle({
            ticker: "TEST",
            name: "Test Co",
            marketCap: null,
            latestStatement: latest,
            priorStatement: null,
        });

        expect(bundle.metrics.pe.value).toBeNull();
        expect(bundle.metrics.revenueGrowth.value).toBeNull();
        expect(bundle.metrics.operatingMargin.value).not.toBeNull(); // doesn't depend on market cap or prior year
    });
});

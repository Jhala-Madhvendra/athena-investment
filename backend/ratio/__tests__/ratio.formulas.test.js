const formulas = require("../ratio.formulas");

const buildStatement = (overrides = {}) => ({
    incomeStatement: {
        totalRevenue: 1000,
        grossProfit: 400,
        operatingIncome: 200,
        netIncome: 150,
    },
    balanceSheet: {
        totalStockholderEquity: 500,
        totalAssets: 2000,
        currentAssets: 700,
        currentLiabilities: 400,
        cashAndCashEquivalents: 300,
        accountsReceivable: 100,
        totalDebt: 400,
    },
    cashFlow: {
        operatingCashFlow: 260,
        capitalExpenditure: -80,
    },
    ...overrides,
});

describe("freeCashFlow", () => {
    // Regression coverage for a real bug: capitalExpenditure is stored as a
    // negative outflow (standard cash-flow-statement sign, confirmed against
    // real Yahoo data where OCF + capitalExpenditure == Yahoo's own reported
    // FCF). The original `OCF - capitalExpenditure` implementation silently
    // ADDED CapEx back instead of subtracting it whenever the stored value
    // was negative - inflating "Free Cash Flow" on every ratio card since
    // Sprint 1. This test locks in the corrected sign handling.
    it("subtracts the CapEx magnitude when capitalExpenditure is stored as a negative outflow", () => {
        const statement = buildStatement({ cashFlow: { operatingCashFlow: 260, capitalExpenditure: -80 } });
        expect(formulas.freeCashFlow(statement)).toBe(180); // 260 - 80, not 260 + 80
    });

    it("produces the same result whether CapEx is stored as negative or positive", () => {
        const negative = buildStatement({ cashFlow: { operatingCashFlow: 260, capitalExpenditure: -80 } });
        const positive = buildStatement({ cashFlow: { operatingCashFlow: 260, capitalExpenditure: 80 } });
        expect(formulas.freeCashFlow(negative)).toBe(formulas.freeCashFlow(positive));
    });

    it("returns null when either input is missing", () => {
        const statement = buildStatement({ cashFlow: { operatingCashFlow: null, capitalExpenditure: -80 } });
        expect(formulas.freeCashFlow(statement)).toBeNull();
    });
});

describe("other ratio formulas (smoke coverage)", () => {
    const statement = buildStatement();

    it("grossMargin, operatingMargin, netProfitMargin return percentages", () => {
        expect(formulas.grossMargin(statement)).toBeCloseTo(40);
        expect(formulas.operatingMargin(statement)).toBeCloseTo(20);
        expect(formulas.netProfitMargin(statement)).toBeCloseTo(15);
    });

    it("returnOnEquity and returnOnAssets return percentages", () => {
        expect(formulas.returnOnEquity(statement)).toBeCloseTo(30);
        expect(formulas.returnOnAssets(statement)).toBeCloseTo(7.5);
    });

    it("currentRatio and quickRatio return ratios", () => {
        expect(formulas.currentRatio(statement)).toBeCloseTo(1.75);
        expect(formulas.quickRatio(statement)).toBeCloseTo(1);
    });

    it("debtToEquity and debtRatio return ratios", () => {
        expect(formulas.debtToEquity(statement)).toBeCloseTo(0.8);
        expect(formulas.debtRatio(statement)).toBeCloseTo(0.2);
    });

    it("assetTurnover returns a ratio", () => {
        expect(formulas.assetTurnover(statement)).toBeCloseTo(0.5);
    });

    it("returns null instead of NaN when a denominator is zero", () => {
        const zeroRevenue = buildStatement({ incomeStatement: { ...statement.incomeStatement, totalRevenue: 0 } });
        expect(formulas.grossMargin(zeroRevenue)).toBeNull();
    });
});

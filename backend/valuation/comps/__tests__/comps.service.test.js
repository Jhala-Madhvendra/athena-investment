jest.mock("../../../financials/financials.service", () => ({
    getFinancialStatementsByTicker: jest.fn(),
}));
jest.mock("../../../market/market.service", () => ({
    getCurrentMarketData: jest.fn(),
}));
jest.mock("../../../services/company.service", () => ({
    getCompanyDetails: jest.fn(),
}));

const financialsService = require("../../../financials/financials.service");
const marketService = require("../../../market/market.service");
const companyService = require("../../../services/company.service");
const compsService = require("../comps.service");

const statement = ({ revenue, netIncome, equity, operatingIncome, dna, debt, cash, shares }) => ({
    year: 2023,
    incomeStatement: {
        totalRevenue: revenue,
        netIncome,
        operatingIncome,
        dilutedSharesOutstanding: shares,
    },
    balanceSheet: {
        totalStockholderEquity: equity,
        totalDebt: debt,
        cashAndCashEquivalents: cash,
    },
    cashFlow: {
        depreciationAndAmortization: dna,
    },
});

const TARGET_STATEMENT = statement({
    revenue: 5000,
    netIncome: 500,
    equity: 2500,
    operatingIncome: 800,
    dna: 200,
    debt: 2000,
    cash: 1000,
    shares: 100,
});

const PEER_A_STATEMENT = statement({
    revenue: 4000,
    netIncome: 400,
    equity: 2000,
    operatingIncome: 750,
    dna: 250,
    debt: 1000,
    cash: 0,
    shares: 80,
});

const PEER_B_STATEMENT = statement({
    revenue: 5000,
    netIncome: -300,
    equity: 3000,
    operatingIncome: 700,
    dna: 300,
    debt: 1500,
    cash: 500,
    shares: 90,
});

const quoteFor = (price, marketCap) => ({ price: { current: price, marketCap }, asOf: "2024-01-01T00:00:00.000Z" });

const mockFinancialsFor = (map) => {
    financialsService.getFinancialStatementsByTicker.mockImplementation((ticker) => {
        const statements = map[ticker];
        if (statements === undefined) {
            const error = new Error(`Company ${ticker} was not found.`);
            error.statusCode = 404;
            return Promise.reject(error);
        }
        return Promise.resolve(statements);
    });
};

const mockMarketFor = (map) => {
    marketService.getCurrentMarketData.mockImplementation((ticker) => {
        const quote = map[ticker];
        return quote ? Promise.resolve(quote) : Promise.reject(new Error("no quote"));
    });
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("comps.service.calculateComparableCompanyAnalysis", () => {
    it("throws a 404 NoFinancialDataError when the target has no statements", async () => {
        mockFinancialsFor({ TARGET: [] });

        await expect(compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB"], "median")).rejects.toMatchObject({
            statusCode: 404,
        });
        expect(marketService.getCurrentMarketData).not.toHaveBeenCalled();
    });

    it("returns isValid: false for structural peer errors without fetching any data", async () => {
        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["ONLYONE"], "median");

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(financialsService.getFinancialStatementsByTicker).not.toHaveBeenCalled();
    });

    it("returns isValid: false for an unsupported statistic", async () => {
        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB"], "mode");

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/must be one of/);
    });

    it("computes a full comps result for a valid target and peers", async () => {
        mockFinancialsFor({
            TARGET: [TARGET_STATEMENT],
            PEERA: [PEER_A_STATEMENT],
            PEERB: [PEER_B_STATEMENT],
        });
        mockMarketFor({
            TARGET: quoteFor(100, 10000),
            PEERA: quoteFor(100, 8000),
            PEERB: quoteFor(133.33, 12000),
        });
        companyService.getCompanyDetails.mockResolvedValue({ name: "Some Co", sector: "Technology" });

        const result = await compsService.calculateComparableCompanyAnalysis("target", ["peera", "peerb"], "median");

        expect(result.isValid).toBe(true);
        expect(result.ticker).toBe("TARGET");
        expect(result.target.marketCap).toBe(10000);
        expect(result.peers).toHaveLength(2);
        expect(result.unavailablePeers).toEqual([]);
        expect(result.currentMarketPrice).toBe(100);
        expect(result.disclaimer).toMatch(/relative valuation/);
        expect(result.calculatedAt).toEqual(expect.any(String));

        // P/E: peers A (8000/400=20) and B (excluded, negative income) -> only A valid -> median 20
        expect(result.peerStatistics.pe.count).toBe(1);
        expect(result.impliedValuations.pe.impliedValuePerShare).toBe(100); // 20 * 500 / 100
        expect(result.impliedValuations.pe.currentMarketPrice).toBe(100);
        expect(result.impliedValuations.pe.upsideDownsidePercent).toBe(0);
    });

    it("excludes a peer with no imported statements and reports it in unavailablePeers, but still succeeds with the rest", async () => {
        mockFinancialsFor({
            TARGET: [TARGET_STATEMENT],
            PEERA: [PEER_A_STATEMENT],
            PEERB: [PEER_B_STATEMENT],
            // PEERC intentionally not in the map -> financialsService rejects with 404
        });
        mockMarketFor({ TARGET: quoteFor(100, 10000), PEERA: quoteFor(100, 8000), PEERB: quoteFor(133, 12000) });
        companyService.getCompanyDetails.mockResolvedValue({ name: "Some Co" });

        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB", "PEERC"], "median");

        expect(result.isValid).toBe(true);
        expect(result.peers).toHaveLength(2);
        expect(result.unavailablePeers).toEqual([{ ticker: "PEERC", reason: expect.any(String) }]);
    });

    it("fails when fewer than the minimum number of peers have usable data", async () => {
        mockFinancialsFor({
            TARGET: [TARGET_STATEMENT],
            PEERA: [PEER_A_STATEMENT],
            // PEERB and PEERC both unavailable
        });
        mockMarketFor({ TARGET: quoteFor(100, 10000), PEERA: quoteFor(100, 8000) });
        companyService.getCompanyDetails.mockResolvedValue({ name: "Some Co" });

        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB", "PEERC"], "median");

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/At least 2 peers with usable financial data/);
    });

    it("still succeeds with a null current market price when the live quote fails", async () => {
        mockFinancialsFor({
            TARGET: [TARGET_STATEMENT],
            PEERA: [PEER_A_STATEMENT],
            PEERB: [PEER_B_STATEMENT],
        });
        // No market data mocked at all -> getCurrentMarketData rejects for every ticker
        marketService.getCurrentMarketData.mockRejectedValue(new Error("quote unavailable"));
        companyService.getCompanyDetails.mockResolvedValue({ name: "Some Co" });

        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB"], "median");

        expect(result.isValid).toBe(true);
        expect(result.currentMarketPrice).toBeNull();
        expect(result.impliedValuations.pe.upsideDownsidePercent).toBeNull();
    });

    it("defaults to the median statistic when none is supplied", async () => {
        mockFinancialsFor({
            TARGET: [TARGET_STATEMENT],
            PEERA: [PEER_A_STATEMENT],
            PEERB: [PEER_B_STATEMENT],
        });
        mockMarketFor({ TARGET: quoteFor(100, 10000), PEERA: quoteFor(100, 8000), PEERB: quoteFor(133, 12000) });
        companyService.getCompanyDetails.mockResolvedValue({ name: "Some Co" });

        const result = await compsService.calculateComparableCompanyAnalysis("TARGET", ["PEERA", "PEERB"], undefined);

        expect(result.isValid).toBe(true);
        expect(result.statistic).toBe("median");
    });
});

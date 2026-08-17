const { buildCompanyBundle } = require("../compsInput.mapper");

const statement = {
    year: 2025,
    incomeStatement: { totalRevenue: 1000, netIncome: 150, operatingIncome: 200, dilutedSharesOutstanding: 50 },
    balanceSheet: { totalStockholderEquity: 800, totalDebt: 300, cashAndCashEquivalents: 100 },
    cashFlow: { depreciationAndAmortization: 40 },
};

describe("compsInput.mapper buildCompanyBundle", () => {
    it("maps company/statement/quote fields into the flat bundle shape comps.engine.js expects", () => {
        const bundle = buildCompanyBundle({
            ticker: "AAPL",
            company: { name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics" },
            latestStatement: statement,
            quote: { price: { current: 150, marketCap: 3_000_000 }, currency: "USD", asOf: "2026-01-01T00:00:00.000Z" },
        });

        expect(bundle).toMatchObject({
            ticker: "AAPL",
            name: "Apple Inc.",
            sector: "Technology",
            industry: "Consumer Electronics",
            currency: "USD",
            price: 150,
            marketCap: 3_000_000,
            revenue: 1000,
            netIncome: 150,
            bookValue: 800,
            debt: 300,
            cash: 100,
            dilutedShares: 50,
            fiscalYear: 2025,
        });
    });

    // Regression coverage: an earlier version had no currency field at all, so every cross-company
    // comparison built on this bundle (Comps peer table) silently assumed the target's currency for
    // every peer. See PortfolioCurrencyNormalization.md for the same bug class fixed elsewhere.
    describe("currency", () => {
        it("prefers the live quote's currency over the stored Company record's", () => {
            const bundle = buildCompanyBundle({
                ticker: "TCS.BO",
                company: { currency: "INR" },
                latestStatement: statement,
                quote: { price: { current: 1 }, currency: "INR" },
            });
            expect(bundle.currency).toBe("INR");
        });

        it("falls back to the stored Company record's currency when there is no live quote", () => {
            const bundle = buildCompanyBundle({
                ticker: "TCS.BO",
                company: { currency: "INR" },
                latestStatement: statement,
                quote: null,
            });
            expect(bundle.currency).toBe("INR");
        });

        it("is null (not a fabricated default) when neither source has a currency", () => {
            const bundle = buildCompanyBundle({ ticker: "X", company: null, latestStatement: statement, quote: null });
            expect(bundle.currency).toBeNull();
        });
    });

    it("degrades gracefully when company/latestStatement/quote are all missing", () => {
        const bundle = buildCompanyBundle({ ticker: "ZZZZ", company: null, latestStatement: null, quote: null });

        expect(bundle.ticker).toBe("ZZZZ");
        expect(bundle.name).toBeNull();
        expect(bundle.currency).toBeNull();
        expect(bundle.price).toBeNull();
        expect(bundle.revenue).toBeNull();
        expect(bundle.ebitdaInputs).toEqual({ operatingIncome: null, depreciationAndAmortization: null });
    });
});

const FinancialDataProvider = require("../financialDataProvider");

describe("FinancialDataProvider base class", () => {
    it("throws a 501 'not supported' error for searchCompaniesByClassification when a provider doesn't implement it", async () => {
        const provider = new FinancialDataProvider();

        await expect(provider.searchCompaniesByClassification({ industry: "Consumer Electronics", sector: null })).rejects.toMatchObject({
            statusCode: 501,
            message: expect.stringMatching(/not supported/i),
        });
    });
});

jest.mock("../../models/company.model", () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock("../../services/company.service", () => ({ importCompany: jest.fn() }));
jest.mock("../../financials/financials.service", () => ({ importFinancialStatements: jest.fn() }));
jest.mock("../../providers/financialDataProvider.registry", () => ({ searchCompaniesByClassification: jest.fn() }));

const Company = require("../../models/company.model");
const companyService = require("../../services/company.service");
const financialsService = require("../../financials/financials.service");
const financialDataProvider = require("../../providers/financialDataProvider.registry");
const { discoverCandidates, importSelectedCompanies, CompanyNotFoundError, NoClassificationError } = require("../industry.discovery");

/** Chainable mock matching Mongoose's find()/findOne() usage in industry.discovery.js. */
const chainableResult = (result) => {
    const chain = {
        select: jest.fn(() => chain),
        lean: jest.fn(() => Promise.resolve(result)),
    };
    return chain;
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("industry.discovery.discoverCandidates", () => {
    it("throws CompanyNotFoundError when the target ticker has no company record", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));

        await expect(discoverCandidates("ZZZZ")).rejects.toThrow(CompanyNotFoundError);
        expect(financialDataProvider.searchCompaniesByClassification).not.toHaveBeenCalled();
    });

    it("throws NoClassificationError when the target has neither sector nor industry", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: null, industry: null }));

        await expect(discoverCandidates("AAPL")).rejects.toThrow(NoClassificationError);
    });

    it("queries by the target's industry and reports classificationLevel as 'industry'", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }));
        financialDataProvider.searchCompaniesByClassification.mockResolvedValue([
            { ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000 },
        ]);
        Company.find.mockReturnValue(chainableResult([]));

        const result = await discoverCandidates("AAPL");

        expect(financialDataProvider.searchCompaniesByClassification).toHaveBeenCalledWith({
            industry: "Consumer Electronics",
            sector: "Technology",
        });
        expect(result.classificationLevel).toBe("industry");
        expect(result.classificationValue).toBe("Consumer Electronics");
        expect(result.candidates).toHaveLength(1);
    });

    it("excludes the target itself from the candidate list", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }));
        financialDataProvider.searchCompaniesByClassification.mockResolvedValue([
            { ticker: "AAPL", name: "Apple Inc.", exchange: "NMS", marketCap: 5000 },
            { ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000 },
        ]);
        Company.find.mockReturnValue(chainableResult([]));

        const result = await discoverCandidates("AAPL");

        expect(result.candidates.map((c) => c.ticker)).toEqual(["SONY"]);
    });

    it("excludes candidates already tracked in Athena's database", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }));
        financialDataProvider.searchCompaniesByClassification.mockResolvedValue([
            { ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000 },
            { ticker: "SSNLF", name: "Samsung Electronics", exchange: "OTC", marketCap: 900 },
        ]);
        Company.find.mockReturnValue(chainableResult([{ ticker: "SONY" }])); // SONY already tracked

        const result = await discoverCandidates("AAPL");

        expect(result.candidates.map((c) => c.ticker)).toEqual(["SSNLF"]);
    });

    it("caps the candidate list at DISCOVERY_LIMIT", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: "Technology", industry: "Consumer Electronics" }));
        const manyCandidates = Array.from({ length: 30 }, (_, i) => ({ ticker: `T${i}`, name: `Company ${i}`, exchange: "NMS", marketCap: 100 - i }));
        financialDataProvider.searchCompaniesByClassification.mockResolvedValue(manyCandidates);
        Company.find.mockReturnValue(chainableResult([]));

        const result = await discoverCandidates("AAPL");

        expect(result.candidates.length).toBeLessThanOrEqual(20);
    });

    it("falls back to sector-level classification when the target has no industry", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", sector: "Technology", industry: null }));
        financialDataProvider.searchCompaniesByClassification.mockResolvedValue([]);
        Company.find.mockReturnValue(chainableResult([]));

        const result = await discoverCandidates("AAPL");

        expect(result.classificationLevel).toBe("sector");
        expect(result.classificationValue).toBe("Technology");
    });
});

describe("industry.discovery.importSelectedCompanies", () => {
    it("imports company profile and financial statements for a successful ticker", async () => {
        companyService.importCompany.mockResolvedValue({ ticker: "SONY" });
        financialsService.importFinancialStatements.mockResolvedValue([{ year: 2025 }]);

        const [result] = await importSelectedCompanies(["SONY"]);

        expect(result).toEqual({ ticker: "SONY", companyImported: true, financialsImported: true, error: null });
    });

    it("reports a partial result when the company imports but financial statements fail", async () => {
        companyService.importCompany.mockResolvedValue({ ticker: "SONY" });
        financialsService.importFinancialStatements.mockRejectedValue(new Error("No annual financial statements were returned."));

        const [result] = await importSelectedCompanies(["SONY"]);

        expect(result.companyImported).toBe(true);
        expect(result.financialsImported).toBe(false);
        expect(result.error).toMatch(/financial statements could not be imported/i);
    });

    it("reports failure with a stated reason when the company itself cannot be imported", async () => {
        companyService.importCompany.mockResolvedValue(null);

        const [result] = await importSelectedCompanies(["ZZZZ"]);

        expect(result).toEqual({ ticker: "ZZZZ", companyImported: false, financialsImported: false, error: "Company could not be found." });
        expect(financialsService.importFinancialStatements).not.toHaveBeenCalled();
    });

    it("never fails the whole batch because one ticker fails - each ticker gets its own independent result", async () => {
        companyService.importCompany.mockImplementation((ticker) =>
            ticker === "GOOD" ? Promise.resolve({ ticker: "GOOD" }) : Promise.reject(new Error("Yahoo Finance could not find BAD."))
        );
        financialsService.importFinancialStatements.mockResolvedValue([{ year: 2025 }]);

        const results = await importSelectedCompanies(["GOOD", "BAD"]);

        expect(results.find((r) => r.ticker === "GOOD").companyImported).toBe(true);
        expect(results.find((r) => r.ticker === "BAD").companyImported).toBe(false);
        expect(results.find((r) => r.ticker === "BAD").error).toMatch(/could not find BAD/i);
    });
});

jest.mock("../../../models/company.model", () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock("../../../financials/financials.model", () => ({ find: jest.fn() }));
jest.mock("../../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const Company = require("../../../models/company.model");
const FinancialStatement = require("../../../financials/financials.model");
const companyService = require("../../../services/company.service");
const { getAvailablePeerCandidates, findLivePeerCandidate, CANDIDATE_LIMIT } = require("../comps.peerSelector");

/** Chainable mock matching Mongoose's find()/findOne() usage in comps.peerSelector.js. */
const chainableResult = (result) => {
    const chain = {
        select: jest.fn(() => chain),
        sort: jest.fn(() => chain),
        limit: jest.fn(() => chain),
        lean: jest.fn(() => Promise.resolve(result)),
    };
    return chain;
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("comps.peerSelector.getAvailablePeerCandidates", () => {
    it("excludes the target from its own candidate list", async () => {
        Company.findOne.mockReturnValue(chainableResult({ ticker: "AAPL", name: "Apple Inc.", sector: "Technology" }));
        Company.find.mockReturnValue(chainableResult([]));
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        await getAvailablePeerCandidates("aapl");

        expect(Company.find).toHaveBeenCalledWith(expect.objectContaining({ ticker: { $ne: "AAPL" } }));
    });

    it("applies a case-insensitive name/ticker filter when a search query is given", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        Company.find.mockReturnValue(chainableResult([]));
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        await getAvailablePeerCandidates("AAPL", "micro");

        const filterArg = Company.find.mock.calls[0][0];
        expect(filterArg.$or).toEqual([{ name: expect.any(RegExp) }, { ticker: expect.any(RegExp) }]);
    });

    it("caps candidates at CANDIDATE_LIMIT via the query", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        const findChain = chainableResult([]);
        Company.find.mockReturnValue(findChain);
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        await getAvailablePeerCandidates("AAPL");

        expect(findChain.limit).toHaveBeenCalledWith(CANDIDATE_LIMIT);
    });

    it("attaches each candidate's latest reported revenue without fabricating one for tickers with no statements", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        Company.find.mockReturnValue(
            chainableResult([
                { ticker: "MSFT", name: "Microsoft", exchange: "NASDAQ", sector: "Technology", marketCap: 3000000 },
                { ticker: "GOOGL", name: "Alphabet", exchange: "NASDAQ", sector: "Technology", marketCap: 2000000 },
            ])
        );
        FinancialStatement.find.mockReturnValue(
            chainableResult([
                { ticker: "MSFT", year: 2022, incomeStatement: { totalRevenue: 190000 } },
                { ticker: "MSFT", year: 2023, incomeStatement: { totalRevenue: 210000 } },
                // GOOGL intentionally has no statements imported
            ])
        );

        const result = await getAvailablePeerCandidates("AAPL");

        const msft = result.candidates.find((c) => c.ticker === "MSFT");
        expect(msft.revenue).toBe(210000); // latest year (2023), not 2022
        expect(msft.revenueFiscalYear).toBe(2023);
        expect(msft.hasFinancialStatements).toBe(true);

        const googl = result.candidates.find((c) => c.ticker === "GOOGL");
        expect(googl.revenue).toBeNull();
        expect(googl.hasFinancialStatements).toBe(false);
    });

    it("returns target: null when the target itself is not in Athena's DB, without throwing", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        Company.find.mockReturnValue(chainableResult([]));
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        const result = await getAvailablePeerCandidates("ZZZZ");
        expect(result.target).toBeNull();
    });

    it("always includes a limitation notice explaining this is a convenience list, not a recommendation", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        Company.find.mockReturnValue(chainableResult([]));
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        const result = await getAvailablePeerCandidates("AAPL");
        expect(result.limitation).toMatch(/not an automatically computed set of comparable companies/);
    });

    it("does not query FinancialStatement at all when there are no candidates", async () => {
        Company.findOne.mockReturnValue(chainableResult(null));
        Company.find.mockReturnValue(chainableResult([]));

        await getAvailablePeerCandidates("AAPL");

        expect(FinancialStatement.find).not.toHaveBeenCalled();
    });
});

describe("comps.peerSelector.findLivePeerCandidate", () => {
    it("returns null without calling resolveTicker when the query is blank", async () => {
        const result = await findLivePeerCandidate("AAPL", "   ");

        expect(result).toBeNull();
        expect(companyService.resolveTicker).not.toHaveBeenCalled();
    });

    it("returns null when resolveTicker cannot find a matching company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const result = await findLivePeerCandidate("AAPL", "Realme");

        expect(result).toBeNull();
    });

    it("throws a 422 when the resolved company is the target itself", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");

        await expect(findLivePeerCandidate("aapl", "Apple")).rejects.toMatchObject({
            statusCode: 422,
            message: "A company cannot be its own peer.",
        });
        expect(Company.findOne).not.toHaveBeenCalled();
    });

    it("shapes a resolved company into the same candidate format as getAvailablePeerCandidates", async () => {
        companyService.resolveTicker.mockResolvedValue("MSFT");
        Company.findOne.mockReturnValue(
            chainableResult({ ticker: "MSFT", name: "Microsoft", exchange: "NASDAQ", sector: "Technology", marketCap: 3000000 })
        );
        FinancialStatement.find.mockReturnValue(chainableResult([]));

        const candidate = await findLivePeerCandidate("AAPL", "Microsoft");

        expect(candidate).toEqual(
            expect.objectContaining({ ticker: "MSFT", name: "Microsoft", hasFinancialStatements: false, revenue: null })
        );
    });
});

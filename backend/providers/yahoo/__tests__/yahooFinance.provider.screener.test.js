jest.mock("../../../utils/fetchWithTimeout");
jest.mock("../yahooAuth");

const fetchWithTimeout = require("../../../utils/fetchWithTimeout");
const getYahooAuthentication = require("../yahooAuth");
const YahooFinanceProvider = require("../yahooFinance.provider");

const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const screenerBody = (quotes = []) => ({ finance: { result: [{ quotes }] } });

describe("YahooFinanceProvider.searchCompaniesByClassification", () => {
    beforeEach(() => {
        getYahooAuthentication.mockResolvedValue({ cookie: "cookie=abc", crumb: "crumb123" });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("queries by industry when an industry classification is available", async () => {
        fetchWithTimeout.mockResolvedValue(jsonResponse(200, screenerBody()));
        const provider = new YahooFinanceProvider();

        await provider.searchCompaniesByClassification({ industry: "Consumer Electronics", sector: "Technology" });

        const [, options] = fetchWithTimeout.mock.calls[0];
        const requestBody = JSON.parse(options.body);
        expect(requestBody.query).toEqual({ operator: "eq", operands: ["industry", "Consumer Electronics"] });
    });

    it("falls back to sector when no industry classification is available", async () => {
        fetchWithTimeout.mockResolvedValue(jsonResponse(200, screenerBody()));
        const provider = new YahooFinanceProvider();

        await provider.searchCompaniesByClassification({ industry: null, sector: "Technology" });

        const [, options] = fetchWithTimeout.mock.calls[0];
        const requestBody = JSON.parse(options.body);
        expect(requestBody.query).toEqual({ operator: "eq", operands: ["sector", "Technology"] });
    });

    it("returns an empty array without making a request when neither industry nor sector is available", async () => {
        const provider = new YahooFinanceProvider();

        const result = await provider.searchCompaniesByClassification({ industry: null, sector: null });

        expect(result).toEqual([]);
        expect(fetchWithTimeout).not.toHaveBeenCalled();
    });

    it("throws a clear error when the screener request fails", async () => {
        fetchWithTimeout.mockResolvedValue(jsonResponse(500, {}));
        const provider = new YahooFinanceProvider();

        await expect(
            provider.searchCompaniesByClassification({ industry: "Consumer Electronics", sector: null })
        ).rejects.toThrow(/status 500/);
    });

    it("maps the raw screener response into deduplicated candidates", async () => {
        fetchWithTimeout.mockResolvedValue(
            jsonResponse(
                200,
                screenerBody([
                    { symbol: "AAPL", longName: "Apple Inc.", exchange: "NMS", fullExchangeName: "NasdaqGS", marketCap: 4000, averageDailyVolume3Month: 5000 },
                ])
            )
        );
        const provider = new YahooFinanceProvider();

        const result = await provider.searchCompaniesByClassification({ industry: "Consumer Electronics", sector: null });

        expect(result).toEqual([{ ticker: "AAPL", name: "Apple Inc.", exchange: "NasdaqGS", marketCap: 4000 }]);
    });

    it("authenticates with cookie+crumb the same way as every other Yahoo call", async () => {
        fetchWithTimeout.mockResolvedValue(jsonResponse(200, screenerBody()));
        const provider = new YahooFinanceProvider();

        await provider.searchCompaniesByClassification({ industry: "Consumer Electronics", sector: null });

        const [url, options] = fetchWithTimeout.mock.calls[0];
        expect(url.toString()).toContain("crumb=crumb123");
        expect(options.headers.Cookie).toBe("cookie=abc");
        expect(options.method).toBe("POST");
    });
});

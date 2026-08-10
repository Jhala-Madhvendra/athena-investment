const express = require("express");
const request = require("supertest");

jest.mock("../comps.service", () => ({
    calculateComparableCompanyAnalysis: jest.fn(),
}));
jest.mock("../comps.peerSelector", () => ({
    getAvailablePeerCandidates: jest.fn(),
    findLivePeerCandidate: jest.fn(),
    LIMITATION_NOTICE: "note",
}));
jest.mock("../../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const compsService = require("../comps.service");
const peerSelector = require("../comps.peerSelector");
const companyService = require("../../../services/company.service");
const compsRoutes = require("../comps.routes");

const app = express();
app.use(express.json());
app.use("/api/valuation", compsRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("POST /api/valuation/:ticker/comps", () => {
    it("returns 404 when the ticker cannot be resolved and never calls the service", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).post("/api/valuation/ZZZZ/comps").send({ peers: ["MSFT", "GOOGL"] });

        expect(response.status).toBe(404);
        expect(compsService.calculateComparableCompanyAnalysis).not.toHaveBeenCalled();
    });

    it("passes the resolved ticker and body fields through to the service", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        compsService.calculateComparableCompanyAnalysis.mockResolvedValue({ isValid: true, ticker: "AAPL" });

        const response = await request(app)
            .post("/api/valuation/aapl/comps")
            .send({ peers: ["MSFT", "GOOGL"], statistic: "mean" });

        expect(response.status).toBe(200);
        expect(response.body.ticker).toBe("AAPL");
        expect(compsService.calculateComparableCompanyAnalysis).toHaveBeenCalledWith("AAPL", ["MSFT", "GOOGL"], "mean");
    });

    it("returns 422 with errors when the service reports a validation failure", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        compsService.calculateComparableCompanyAnalysis.mockResolvedValue({
            isValid: false,
            errors: ["At least 2 distinct peer companies are required."],
        });

        const response = await request(app).post("/api/valuation/AAPL/comps").send({ peers: ["MSFT"] });

        expect(response.status).toBe(422);
        expect(response.body.errors).toEqual(["At least 2 distinct peer companies are required."]);
    });

    it("returns 404 when the service throws a NoFinancialDataError-style error", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("No financial statements are available for AAPL.");
        error.statusCode = 404;
        compsService.calculateComparableCompanyAnalysis.mockRejectedValue(error);

        const response = await request(app).post("/api/valuation/AAPL/comps").send({ peers: ["MSFT", "GOOGL"] });

        expect(response.status).toBe(404);
    });

    it("handles a missing request body without throwing", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        compsService.calculateComparableCompanyAnalysis.mockResolvedValue({ isValid: false, errors: ["peers required"] });

        const response = await request(app).post("/api/valuation/AAPL/comps");

        expect(response.status).toBe(422);
        expect(compsService.calculateComparableCompanyAnalysis).toHaveBeenCalledWith("AAPL", undefined, undefined);
    });
});

describe("GET /api/valuation/:ticker/comps/available-peers", () => {
    it("returns 404 when the ticker cannot be resolved and never calls the peer selector", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/valuation/ZZZZ/comps/available-peers");

        expect(response.status).toBe(404);
        expect(peerSelector.getAvailablePeerCandidates).not.toHaveBeenCalled();
    });

    it("passes the resolved ticker and optional search query through to the peer selector", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        peerSelector.getAvailablePeerCandidates.mockResolvedValue({ target: null, candidates: [], limitation: "note" });

        const response = await request(app).get("/api/valuation/aapl/comps/available-peers?q=micro");

        expect(response.status).toBe(200);
        expect(response.body.limitation).toBe("note");
        expect(peerSelector.getAvailablePeerCandidates).toHaveBeenCalledWith("AAPL", "micro");
    });

    it("passes undefined when no search query is given", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        peerSelector.getAvailablePeerCandidates.mockResolvedValue({ target: null, candidates: [], limitation: "note" });

        await request(app).get("/api/valuation/AAPL/comps/available-peers");

        expect(peerSelector.getAvailablePeerCandidates).toHaveBeenCalledWith("AAPL", undefined);
    });
});

describe("GET /api/valuation/:ticker/comps/available-peers/live-search", () => {
    it("returns 404 when the target ticker cannot be resolved and never searches live", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/valuation/ZZZZ/comps/available-peers/live-search?q=Realme");

        expect(response.status).toBe(404);
        expect(peerSelector.findLivePeerCandidate).not.toHaveBeenCalled();
    });

    it("returns 404 when no company can be found for the query", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        peerSelector.findLivePeerCandidate.mockResolvedValue(null);

        const response = await request(app).get("/api/valuation/AAPL/comps/available-peers/live-search?q=Realme");

        expect(response.status).toBe(404);
    });

    it("returns the resolved candidate and limitation notice on success", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        peerSelector.findLivePeerCandidate.mockResolvedValue({ ticker: "MSFT", name: "Microsoft" });

        const response = await request(app).get("/api/valuation/AAPL/comps/available-peers/live-search?q=Microsoft");

        expect(response.status).toBe(200);
        expect(response.body.candidate).toEqual({ ticker: "MSFT", name: "Microsoft" });
        expect(response.body.limitation).toBe("note");
        expect(peerSelector.findLivePeerCandidate).toHaveBeenCalledWith("AAPL", "Microsoft");
    });

    it("propagates a 422 when the live-resolved company is the target itself", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("A company cannot be its own peer.");
        error.statusCode = 422;
        peerSelector.findLivePeerCandidate.mockRejectedValue(error);

        const response = await request(app).get("/api/valuation/AAPL/comps/available-peers/live-search?q=Apple");

        expect(response.status).toBe(422);
        expect(response.body.message).toBe("A company cannot be its own peer.");
    });
});

const express = require("express");
const request = require("supertest");

jest.mock("../valuationScenario.service", () => ({
    saveScenario: jest.fn(),
    listScenarios: jest.fn(),
    deleteScenario: jest.fn(),
    compareScenarios: jest.fn(),
    backtestScenario: jest.fn(),
}));
jest.mock("../../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const scenarioService = require("../valuationScenario.service");
const companyService = require("../../../services/company.service");
const identityService = require("../../../identity/identity.service");
const scenarioRoutes = require("../valuationScenario.routes");

const app = express();
app.use(express.json());
app.use("/api/valuation", scenarioRoutes);

const validAssumptions = { riskFreeRate: 0.04, beta: 1.1, equityRiskPremium: 0.05, preTaxCostOfDebt: 0.06 };

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects POST /:ticker/dcf/saved with no Authorization header", async () => {
        const response = await request(app).post("/api/valuation/AAPL/dcf/saved").send({ name: "Base", ...validAssumptions });
        expect(response.status).toBe(401);
        expect(scenarioService.saveScenario).not.toHaveBeenCalled();
    });
});

describe("POST /:ticker/dcf/saved", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
    });

    it("rejects an invalid body before calling the service", async () => {
        const response = await request(app)
            .post("/api/valuation/AAPL/dcf/saved")
            .set("Authorization", "Bearer token-a")
            .send({ ...validAssumptions });

        expect(response.status).toBe(422);
        expect(scenarioService.saveScenario).not.toHaveBeenCalled();
    });

    it("resolves the ticker and passes the validated, normalized body to the service", async () => {
        scenarioService.saveScenario.mockResolvedValue({ scenario: { _id: "s1" }, dcfResult: { isValid: true } });

        const response = await request(app)
            .post("/api/valuation/aapl/dcf/saved")
            .set("Authorization", "Bearer token-a")
            .send({ name: "Base case", ...validAssumptions });

        expect(response.status).toBe(201);
        expect(scenarioService.saveScenario).toHaveBeenCalledWith(
            "userA",
            "AAPL",
            expect.objectContaining({ name: "Base case", assumptions: expect.objectContaining(validAssumptions) })
        );
    });

    it("returns 422 when the service rejects the assumptions", async () => {
        const error = new Error("DCF assumptions failed validation.");
        error.statusCode = 422;
        error.errors = ["bad wacc"];
        scenarioService.saveScenario.mockRejectedValue(error);

        const response = await request(app)
            .post("/api/valuation/AAPL/dcf/saved")
            .set("Authorization", "Bearer token-a")
            .send({ name: "Base", ...validAssumptions });

        expect(response.status).toBe(422);
        expect(response.body.errors).toEqual(["bad wacc"]);
    });
});

describe("GET /:ticker/dcf/saved", () => {
    it("returns the service's scenario list", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        scenarioService.listScenarios.mockResolvedValue([{ _id: "s1", name: "Base" }]);

        const response = await request(app).get("/api/valuation/AAPL/dcf/saved").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.scenarios[0].name).toBe("Base");
    });
});

describe("DELETE /:ticker/dcf/saved/:id", () => {
    it("returns 404 when the service reports the scenario wasn't found", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("Saved valuation scenario not found.");
        error.statusCode = 404;
        scenarioService.deleteScenario.mockRejectedValue(error);

        const response = await request(app).delete("/api/valuation/AAPL/dcf/saved/s1").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(404);
    });

    it("returns 204 on success", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        scenarioService.deleteScenario.mockResolvedValue({ _id: "s1" });

        const response = await request(app).delete("/api/valuation/AAPL/dcf/saved/s1").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(204);
    });
});

describe("POST /:ticker/dcf/saved/compare", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
    });

    it("rejects a comparison request with fewer than 2 entries before calling the service", async () => {
        const response = await request(app)
            .post("/api/valuation/AAPL/dcf/saved/compare")
            .set("Authorization", "Bearer token-a")
            .send({ savedIds: ["507f1f77bcf86cd799439011"] });

        expect(response.status).toBe(422);
        expect(scenarioService.compareScenarios).not.toHaveBeenCalled();
    });

    it("passes the validated comparison request through to the service", async () => {
        scenarioService.compareScenarios.mockResolvedValue({ results: [], comparisonTable: [], unavailable: [] });

        const response = await request(app)
            .post("/api/valuation/AAPL/dcf/saved/compare")
            .set("Authorization", "Bearer token-a")
            .send({ adHoc: [{ name: "Bear", ...validAssumptions }, { name: "Bull", ...validAssumptions }] });

        expect(response.status).toBe(200);
        expect(scenarioService.compareScenarios).toHaveBeenCalledWith("userA", "AAPL", expect.any(Object));
    });
});

describe("GET /:ticker/dcf/saved/:id/backtest", () => {
    it("returns the service's backtest payload", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        companyService.resolveTicker.mockResolvedValue("AAPL");
        scenarioService.backtestScenario.mockResolvedValue({ scenarioId: "s1", priceChangeSinceSavePercent: 10 });

        const response = await request(app).get("/api/valuation/AAPL/dcf/saved/s1/backtest").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.priceChangeSinceSavePercent).toBe(10);
    });
});

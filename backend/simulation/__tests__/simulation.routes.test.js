const express = require("express");
const request = require("supertest");

jest.mock("../simulation.service", () => ({
    createPortfolio: jest.fn(),
    listPortfolios: jest.fn(),
    loadOwnedPortfolio: jest.fn(),
    updatePortfolio: jest.fn(),
    deletePortfolio: jest.fn(),
    getSyntheticPortfolio: jest.fn(),
}));
jest.mock("../simulation.analytics.service", () => ({ getSimulationAnalytics: jest.fn() }));
jest.mock("../simulation.scenario.service", () => ({ runSyntheticScenario: jest.fn(), compareSyntheticScenarios: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const simulationService = require("../simulation.service");
const simulationAnalyticsService = require("../simulation.analytics.service");
const simulationScenarioService = require("../simulation.scenario.service");
const identityService = require("../../identity/identity.service");
const simulationRoutes = require("../simulation.routes");

const app = express();
app.use(express.json());
app.use("/api/simulation", simulationRoutes);

const validId = "507f1f77bcf86cd799439011";
const validRule = { targetType: "PORTFOLIO", shockPercent: -10 };

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects POST /portfolios with no Authorization header", async () => {
        const response = await request(app).post("/api/simulation/portfolios").send({ name: "X" });
        expect(response.status).toBe(401);
        expect(simulationService.createPortfolio).not.toHaveBeenCalled();
    });
});

describe("POST /portfolios", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("userA"));

    it("passes the body through to the service and scopes it to the caller", async () => {
        simulationService.createPortfolio.mockResolvedValue({ _id: "p1", name: "My what-if" });

        const response = await request(app)
            .post("/api/simulation/portfolios")
            .set("Authorization", "Bearer token-a")
            .send({ name: "My what-if", holdings: [{ ticker: "AAPL", shares: 5 }] });

        expect(response.status).toBe(201);
        expect(simulationService.createPortfolio).toHaveBeenCalledWith("userA", { name: "My what-if", holdings: [{ ticker: "AAPL", shares: 5 }] });
    });

    it("returns 422 when the service rejects the request", async () => {
        const error = new Error("Paper portfolio validation failed.");
        error.statusCode = 422;
        error.errors = ["name is required"];
        simulationService.createPortfolio.mockRejectedValue(error);

        const response = await request(app).post("/api/simulation/portfolios").set("Authorization", "Bearer token-a").send({});

        expect(response.status).toBe(422);
    });
});

describe("GET /portfolios/:id", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("userA"));

    it("rejects a malformed id before calling the service", async () => {
        const response = await request(app).get("/api/simulation/portfolios/not-an-id").set("Authorization", "Bearer token-a");
        expect(response.status).toBe(400);
        expect(simulationService.loadOwnedPortfolio).not.toHaveBeenCalled();
    });

    it("returns 404 when the portfolio isn't owned by the caller", async () => {
        const error = new Error("Paper portfolio not found.");
        error.statusCode = 404;
        simulationService.loadOwnedPortfolio.mockRejectedValue(error);

        const response = await request(app).get(`/api/simulation/portfolios/${validId}`).set("Authorization", "Bearer token-a");

        expect(response.status).toBe(404);
    });

    it("returns the live-priced synthetic portfolio", async () => {
        simulationService.loadOwnedPortfolio.mockResolvedValue({ _id: validId, name: "X", createdAt: "t1", updatedAt: "t2" });
        simulationService.getSyntheticPortfolio.mockResolvedValue({ holdings: [{ ticker: "AAPL" }], summary: { numberOfHoldings: 1 } });

        const response = await request(app).get(`/api/simulation/portfolios/${validId}`).set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.holdings).toHaveLength(1);
        expect(response.body.summary.numberOfHoldings).toBe(1);
    });
});

describe("POST /portfolios/:id/scenarios/run", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("userA"));

    it("rejects an invalid scenario body before calling the service", async () => {
        const response = await request(app)
            .post(`/api/simulation/portfolios/${validId}/scenarios/run`)
            .set("Authorization", "Bearer token-a")
            .send({ rules: [] });

        expect(response.status).toBe(400);
        expect(simulationScenarioService.runSyntheticScenario).not.toHaveBeenCalled();
    });

    it("passes the validated request through, scoped to userId and portfolioId", async () => {
        simulationScenarioService.runSyntheticScenario.mockResolvedValue({ scenario: { name: "Bear" } });

        const response = await request(app)
            .post(`/api/simulation/portfolios/${validId}/scenarios/run`)
            .set("Authorization", "Bearer token-a")
            .send({ rules: [validRule] });

        expect(response.status).toBe(200);
        expect(simulationScenarioService.runSyntheticScenario).toHaveBeenCalledWith(
            "userA",
            validId,
            expect.objectContaining({ rules: [{ ...validRule, target: null }] })
        );
    });
});

describe("GET /portfolios/:id/analytics", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("userA"));

    it("rejects an invalid window before calling the service", async () => {
        const response = await request(app)
            .get(`/api/simulation/portfolios/${validId}/analytics?window=decade`)
            .set("Authorization", "Bearer token-a");

        expect(response.status).toBe(400);
        expect(simulationAnalyticsService.getSimulationAnalytics).not.toHaveBeenCalled();
    });

    it("returns the service's analytics payload", async () => {
        simulationAnalyticsService.getSimulationAnalytics.mockResolvedValue({ isEmpty: false, risk: { beta: 1.1 } });

        const response = await request(app).get(`/api/simulation/portfolios/${validId}/analytics`).set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.risk.beta).toBe(1.1);
    });
});

describe("user isolation", () => {
    it("scopes GET /portfolios to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        simulationService.listPortfolios.mockResolvedValue([]);

        await request(app).get("/api/simulation/portfolios").set("Authorization", "Bearer token-a");
        await request(app).get("/api/simulation/portfolios").set("Authorization", "Bearer token-b");

        expect(simulationService.listPortfolios).toHaveBeenNthCalledWith(1, "userA");
        expect(simulationService.listPortfolios).toHaveBeenNthCalledWith(2, "userB");
    });
});

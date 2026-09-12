const express = require("express");
const request = require("supertest");

jest.mock("../portfolio.scenario.service", () => ({
    runScenario: jest.fn(),
    compareScenarios: jest.fn(),
    getPresets: jest.fn(),
}));
jest.mock("../portfolio.scenario.explanation.service", () => ({ explainScenario: jest.fn() }));
jest.mock("../savedScenario.service", () => ({
    createSavedScenario: jest.fn(),
    listSavedScenarios: jest.fn(),
    deleteSavedScenario: jest.fn(),
    SavedScenarioNotFoundError: class SavedScenarioNotFoundError extends Error {
        constructor() {
            super("Saved scenario not found.");
            this.statusCode = 404;
        }
    },
}));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const scenarioService = require("../portfolio.scenario.service");
const explanationService = require("../portfolio.scenario.explanation.service");
const savedScenarioService = require("../savedScenario.service");
const identityService = require("../../identity/identity.service");
const scenarioRoutes = require("../portfolio.scenario.routes");

const VALID_ID = "507f1f77bcf86cd799439011";

const app = express();
app.use(express.json());
app.use("/api/portfolio/scenarios", scenarioRoutes);

const validRule = { targetType: "PORTFOLIO", shockPercent: -10 };

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects POST /run with no Authorization header", async () => {
        const response = await request(app).post("/api/portfolio/scenarios/run").send({ rules: [validRule] });
        expect(response.status).toBe(401);
        expect(scenarioService.runScenario).not.toHaveBeenCalled();
    });

    it("rejects GET /presets with no Authorization header", async () => {
        const response = await request(app).get("/api/portfolio/scenarios/presets");
        expect(response.status).toBe(401);
    });
});

describe("POST /run", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("rejects an invalid request before calling the service", async () => {
        const response = await request(app)
            .post("/api/portfolio/scenarios/run")
            .set("Authorization", "Bearer token-a")
            .send({ rules: [] });

        expect(response.status).toBe(400);
        expect(scenarioService.runScenario).not.toHaveBeenCalled();
    });

    it("passes the validated, normalized body to the service", async () => {
        scenarioService.runScenario.mockResolvedValue({ scenario: { name: "Custom Scenario" } });

        const response = await request(app)
            .post("/api/portfolio/scenarios/run")
            .set("Authorization", "Bearer token-a")
            .send({ rules: [{ targetType: "asset", target: "aapl", shockPercent: -30 }] });

        expect(response.status).toBe(200);
        expect(scenarioService.runScenario).toHaveBeenCalledWith(
            "userA",
            expect.objectContaining({ rules: [{ targetType: "ASSET", target: "AAPL", shockPercent: -30 }] })
        );
    });

    it("returns 500 when the service throws", async () => {
        scenarioService.runScenario.mockRejectedValue(new Error("boom"));

        const response = await request(app)
            .post("/api/portfolio/scenarios/run")
            .set("Authorization", "Bearer token-a")
            .send({ rules: [validRule] });

        expect(response.status).toBe(500);
    });
});

describe("POST /compare", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("rejects fewer than 2 scenarios before calling the service", async () => {
        const response = await request(app)
            .post("/api/portfolio/scenarios/compare")
            .set("Authorization", "Bearer token-a")
            .send({ scenarios: [{ name: "Bear", rules: [validRule] }] });

        expect(response.status).toBe(400);
        expect(scenarioService.compareScenarios).not.toHaveBeenCalled();
    });

    it("passes validated scenarios through to the service", async () => {
        scenarioService.compareScenarios.mockResolvedValue({ scenarios: [], comparisonTable: [] });

        const response = await request(app)
            .post("/api/portfolio/scenarios/compare")
            .set("Authorization", "Bearer token-a")
            .send({
                scenarios: [
                    { name: "Bear", rules: [{ targetType: "MARKET", shockPercent: -15 }] },
                    { name: "Bull", rules: [{ targetType: "MARKET", shockPercent: 10 }] },
                ],
            });

        expect(response.status).toBe(200);
        expect(scenarioService.compareScenarios).toHaveBeenCalledWith("userA", expect.objectContaining({ scenarios: expect.any(Array) }));
    });
});

describe("GET /presets", () => {
    it("returns the service's preset list", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        scenarioService.getPresets.mockReturnValue({ presets: [{ key: "bear", name: "Bear Case" }] });

        const response = await request(app).get("/api/portfolio/scenarios/presets").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.presets[0].key).toBe("bear");
    });
});

describe("user isolation", () => {
    it("scopes /run to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        scenarioService.runScenario.mockResolvedValue({ scenario: {} });

        await request(app).post("/api/portfolio/scenarios/run").set("Authorization", "Bearer token-a").send({ rules: [validRule] });
        await request(app).post("/api/portfolio/scenarios/run").set("Authorization", "Bearer token-b").send({ rules: [validRule] });

        expect(scenarioService.runScenario).toHaveBeenNthCalledWith(1, "userA", expect.any(Object));
        expect(scenarioService.runScenario).toHaveBeenNthCalledWith(2, "userB", expect.any(Object));
    });
});

const validExplainBody = () => ({
    scenario: { name: "Bear Case", rules: [validRule] },
    currentPortfolioValueUSD: 100000,
    scenarioPortfolioValueUSD: 88000,
    absoluteChangeUSD: -12000,
    percentageChange: -12,
    holdingImpact: [],
    sectorImpact: [],
});

describe("POST /explain", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("rejects an unauthenticated request without calling the explanation service", async () => {
        const response = await request(app).post("/api/portfolio/scenarios/explain").send(validExplainBody());
        expect(response.status).toBe(401);
        expect(explanationService.explainScenario).not.toHaveBeenCalled();
    });

    it("rejects a malformed scenario result before calling the explanation service", async () => {
        const response = await request(app)
            .post("/api/portfolio/scenarios/explain")
            .set("Authorization", "Bearer token-a")
            .send({ scenario: { name: "Bear Case", rules: [] } });

        expect(response.status).toBe(400);
        expect(explanationService.explainScenario).not.toHaveBeenCalled();
    });

    it("passes the validated, normalized scenario result to the explanation service and returns its prose", async () => {
        explanationService.explainScenario.mockResolvedValue({ explanation: "The portfolio falls 12%.", generatedAt: "2026-08-21T00:00:00.000Z" });

        const response = await request(app)
            .post("/api/portfolio/scenarios/explain")
            .set("Authorization", "Bearer token-a")
            .send(validExplainBody());

        expect(response.status).toBe(200);
        expect(response.body.explanation).toBe("The portfolio falls 12%.");
        expect(explanationService.explainScenario).toHaveBeenCalledWith(
            expect.objectContaining({ scenario: expect.objectContaining({ name: "Bear Case" }) })
        );
    });

    it("returns 502 when the explanation service throws", async () => {
        explanationService.explainScenario.mockRejectedValue(new Error("The AI provider did not return a usable scenario explanation."));

        const response = await request(app)
            .post("/api/portfolio/scenarios/explain")
            .set("Authorization", "Bearer token-a")
            .send(validExplainBody());

        expect(response.status).toBe(502);
    });
});

describe("POST /saved", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("rejects requests with no Authorization header", async () => {
        const response = await request(app)
            .post("/api/portfolio/scenarios/saved")
            .send({ rules: [validRule], alertThresholdPercent: -15 });

        expect(response.status).toBe(401);
        expect(savedScenarioService.createSavedScenario).not.toHaveBeenCalled();
    });

    it("rejects a missing/invalid alertThresholdPercent before calling the service", async () => {
        const response = await request(app)
            .post("/api/portfolio/scenarios/saved")
            .set("Authorization", "Bearer token-a")
            .send({ rules: [validRule], alertThresholdPercent: 5 });

        expect(response.status).toBe(400);
        expect(savedScenarioService.createSavedScenario).not.toHaveBeenCalled();
    });

    it("creates a saved scenario, scoped to the caller", async () => {
        savedScenarioService.createSavedScenario.mockResolvedValue({ _id: "s1", name: "Custom Scenario" });

        const response = await request(app)
            .post("/api/portfolio/scenarios/saved")
            .set("Authorization", "Bearer token-a")
            .send({ rules: [validRule], alertThresholdPercent: -15 });

        expect(response.status).toBe(201);
        expect(savedScenarioService.createSavedScenario).toHaveBeenCalledWith(
            "userA",
            expect.objectContaining({ alertThresholdPercent: -15 })
        );
    });
});

describe("GET /saved", () => {
    it("scopes the list to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        savedScenarioService.listSavedScenarios.mockResolvedValue([{ _id: "s1" }]);

        const response = await request(app).get("/api/portfolio/scenarios/saved").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(savedScenarioService.listSavedScenarios).toHaveBeenCalledWith("userA");
        expect(response.body.savedScenarios).toHaveLength(1);
    });
});

describe("DELETE /saved/:id", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("returns 400 for a malformed id without calling the service", async () => {
        const response = await request(app).delete("/api/portfolio/scenarios/saved/not-an-id").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(400);
        expect(savedScenarioService.deleteSavedScenario).not.toHaveBeenCalled();
    });

    it("returns 404 when the saved scenario doesn't belong to the caller", async () => {
        savedScenarioService.deleteSavedScenario.mockRejectedValue(new savedScenarioService.SavedScenarioNotFoundError());

        const response = await request(app).delete(`/api/portfolio/scenarios/saved/${VALID_ID}`).set("Authorization", "Bearer token-a");

        expect(response.status).toBe(404);
    });

    it("deletes when owned by the caller", async () => {
        savedScenarioService.deleteSavedScenario.mockResolvedValue({ _id: VALID_ID });

        const response = await request(app).delete(`/api/portfolio/scenarios/saved/${VALID_ID}`).set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(savedScenarioService.deleteSavedScenario).toHaveBeenCalledWith("userA", VALID_ID);
    });
});

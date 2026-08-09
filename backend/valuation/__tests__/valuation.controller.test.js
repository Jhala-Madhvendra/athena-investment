const express = require("express");
const request = require("supertest");

jest.mock("../valuation.service", () => ({
    getDCFDefaults: jest.fn(),
    calculateDCFValuation: jest.fn(),
    calculateDCFScenarios: jest.fn(),
    calculateDCFSensitivity: jest.fn(),
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const valuationService = require("../valuation.service");
const companyService = require("../../services/company.service");
const valuationRoutes = require("../valuation.routes");

const app = express();
app.use(express.json());
app.use("/api/valuation", valuationRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

const validBody = () => ({
    forecastYears: 5,
    revenueGrowth: 0.08,
    ebitMargin: 0.2,
    depreciationPercentRevenue: 0.04,
    capexPercentRevenue: 0.05,
    workingCapitalPercentRevenue: 0.03,
    taxRate: 0.25,
    terminalGrowthRate: 0.025,
    riskFreeRate: 0.04,
    beta: 1.1,
    equityRiskPremium: 0.05,
    preTaxCostOfDebt: 0.06,
});

describe("GET /api/valuation/:ticker/dcf/defaults", () => {
    it("returns 404 when the ticker cannot be resolved", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/valuation/ZZZZ/dcf/defaults");

        expect(response.status).toBe(404);
        expect(valuationService.getDCFDefaults).not.toHaveBeenCalled();
    });

    it("returns defaults for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.getDCFDefaults.mockResolvedValue({ ticker: "AAPL", suggestedAssumptions: {} });

        const response = await request(app).get("/api/valuation/aapl/dcf/defaults");

        expect(response.status).toBe(200);
        expect(response.body.ticker).toBe("AAPL");
        expect(valuationService.getDCFDefaults).toHaveBeenCalledWith("AAPL");
    });

    it("returns 404 when no financial statements have been imported", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const error = new Error("No financial statements are available for AAPL.");
        error.statusCode = 404;
        valuationService.getDCFDefaults.mockRejectedValue(error);

        const response = await request(app).get("/api/valuation/AAPL/dcf/defaults");

        expect(response.status).toBe(404);
    });
});

describe("POST /api/valuation/:ticker/dcf", () => {
    it("rejects a request missing WACC inputs before resolving the ticker or calling the service", async () => {
        const response = await request(app).post("/api/valuation/AAPL/dcf").send({});

        expect(response.status).toBe(422);
        expect(response.body.errors.length).toBeGreaterThan(0);
        expect(companyService.resolveTicker).not.toHaveBeenCalled();
        expect(valuationService.calculateDCFValuation).not.toHaveBeenCalled();
    });

    it("returns 422 when the engine/service rejects the assumptions", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: false,
            errors: ["Terminal growth rate must be strictly less than WACC."],
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf").send(validBody());

        expect(response.status).toBe(422);
        expect(response.body.errors[0]).toMatch(/terminal growth/i);
    });

    it("returns 200 with the full DCF result for a valid request", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            errors: [],
            intrinsicValuePerShare: 187.32,
            disclaimer: "DCF valuation is highly sensitive to assumptions and should not be interpreted as a guaranteed future price.",
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf").send(validBody());

        expect(response.status).toBe(200);
        expect(response.body.intrinsicValuePerShare).toBe(187.32);
        expect(response.body.disclaimer).toMatch(/highly sensitive to assumptions/i);
        expect(valuationService.calculateDCFValuation).toHaveBeenCalledWith("AAPL", expect.objectContaining(validBody()));
    });

    it("never returns a buy/sell recommendation string anywhere in the payload", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFValuation.mockResolvedValue({
            isValid: true,
            errors: [],
            intrinsicValuePerShare: 187.32,
            upsideDownsidePercent: 12.4,
            disclaimer: "DCF valuation is highly sensitive to assumptions and should not be interpreted as a guaranteed future price.",
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf").send(validBody());
        const serialized = JSON.stringify(response.body).toLowerCase();

        expect(serialized).not.toMatch(/\bbuy\b|\bsell\b|strong buy|strong sell/);
    });
});

describe("POST /api/valuation/:ticker/dcf/scenarios", () => {
    it("rejects a request missing WACC inputs before calling the service", async () => {
        const response = await request(app).post("/api/valuation/AAPL/dcf/scenarios").send({});

        expect(response.status).toBe(422);
        expect(valuationService.calculateDCFScenarios).not.toHaveBeenCalled();
    });

    it("returns 200 with bear/base/bull results for a valid request", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFScenarios.mockResolvedValue({
            isValid: true,
            scenarios: {
                bear: { intrinsicValuePerShare: 80 },
                base: { intrinsicValuePerShare: 100 },
                bull: { intrinsicValuePerShare: 120 },
            },
            deltas: { bear: { revenueGrowth: -0.02 }, base: {}, bull: { revenueGrowth: 0.02 } },
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf/scenarios").send(validBody());

        expect(response.status).toBe(200);
        expect(response.body.scenarios.bull.intrinsicValuePerShare).toBeGreaterThan(
            response.body.scenarios.bear.intrinsicValuePerShare
        );
    });

    it("returns 422 when the service rejects the scenario request", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFScenarios.mockResolvedValue({
            isValid: false,
            errors: ["capitalStructure.dilutedShares must be a positive number."],
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf/scenarios").send(validBody());

        expect(response.status).toBe(422);
    });
});

describe("POST /api/valuation/:ticker/dcf/sensitivity", () => {
    it("rejects a request missing WACC inputs before calling the service", async () => {
        const response = await request(app).post("/api/valuation/AAPL/dcf/sensitivity").send({});

        expect(response.status).toBe(422);
        expect(valuationService.calculateDCFSensitivity).not.toHaveBeenCalled();
    });

    it("rejects a malformed waccValues override", async () => {
        const response = await request(app)
            .post("/api/valuation/AAPL/dcf/sensitivity")
            .send({ ...validBody(), waccValues: "not-an-array" });

        expect(response.status).toBe(422);
        expect(valuationService.calculateDCFSensitivity).not.toHaveBeenCalled();
    });

    it("returns 200 with the sensitivity matrix for a valid request", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFSensitivity.mockResolvedValue({
            isValid: true,
            matrix: { waccValues: [0.08, 0.09], terminalGrowthValues: [0.02, 0.03], rows: [] },
        });

        const response = await request(app).post("/api/valuation/AAPL/dcf/sensitivity").send(validBody());

        expect(response.status).toBe(200);
        expect(response.body.matrix.waccValues).toEqual([0.08, 0.09]);
    });

    it("passes explicit range overrides through to the service", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        valuationService.calculateDCFSensitivity.mockResolvedValue({ isValid: true, matrix: {} });

        await request(app)
            .post("/api/valuation/AAPL/dcf/sensitivity")
            .send({ ...validBody(), waccValues: [0.08, 0.1], terminalGrowthValues: [0.02, 0.03] });

        expect(valuationService.calculateDCFSensitivity).toHaveBeenCalledWith(
            "AAPL",
            expect.any(Object),
            { waccValues: [0.08, 0.1], terminalGrowthValues: [0.02, 0.03] }
        );
    });
});

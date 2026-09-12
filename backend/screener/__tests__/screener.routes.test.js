const express = require("express");
const request = require("supertest");

jest.mock("../screener.service", () => ({ runScreener: jest.fn(), getFacets: jest.fn() }));

const screenerService = require("../screener.service");
const screenerRoutes = require("../screener.routes");

const app = express();
app.use(express.json());
app.use("/api/screener", screenerRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/screener", () => {
    it("is public - no Authorization header required", async () => {
        screenerService.runScreener.mockResolvedValue({ companies: [] });

        const response = await request(app).get("/api/screener");

        expect(response.status).toBe(200);
    });

    it("rejects an invalid query before calling the service", async () => {
        const response = await request(app).get("/api/screener?sortBy=notAField");

        expect(response.status).toBe(400);
        expect(screenerService.runScreener).not.toHaveBeenCalled();
    });

    it("passes the validated, normalized query to the service", async () => {
        screenerService.runScreener.mockResolvedValue({ companies: [{ ticker: "AAPL" }] });

        const response = await request(app).get("/api/screener?sector=Technology&minHealthScore=60");

        expect(response.status).toBe(200);
        expect(response.body.companies[0].ticker).toBe("AAPL");
        expect(screenerService.runScreener).toHaveBeenCalledWith(
            expect.objectContaining({ sector: "Technology", minHealthScore: 60 })
        );
    });

    it("returns 500 when the service throws", async () => {
        screenerService.runScreener.mockRejectedValue(new Error("boom"));

        const response = await request(app).get("/api/screener");

        expect(response.status).toBe(500);
    });
});

describe("GET /api/screener/facets", () => {
    it("is public and returns the distinct sector/industry lists", async () => {
        screenerService.getFacets.mockResolvedValue({ sectors: ["Technology"], industries: ["Software - Application"] });

        const response = await request(app).get("/api/screener/facets");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ sectors: ["Technology"], industries: ["Software - Application"] });
    });

    it("returns 500 when the service throws", async () => {
        screenerService.getFacets.mockRejectedValue(new Error("boom"));

        const response = await request(app).get("/api/screener/facets");

        expect(response.status).toBe(500);
    });
});

const express = require("express");
const request = require("supertest");

jest.mock("../watchlist.service", () => ({
    getWatchlistWithMetrics: jest.fn(),
    addCompany: jest.fn(),
    removeCompany: jest.fn(),
    DuplicateCompanyError: class DuplicateCompanyError extends Error {
        constructor(ticker) {
            super(`${ticker} is already in your watchlist.`);
            this.statusCode = 409;
        }
    },
    CompanyNotInWatchlistError: class CompanyNotInWatchlistError extends Error {
        constructor(ticker) {
            super(`${ticker} is not in your watchlist.`);
            this.statusCode = 404;
        }
    },
}));
jest.mock("../watchlistInsights.service", () => ({ getInsights: jest.fn() }));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const watchlistService = require("../watchlist.service");
const watchlistInsightsService = require("../watchlistInsights.service");
const companyService = require("../../services/company.service");
const identityService = require("../../identity/identity.service");
const watchlistRoutes = require("../watchlist.routes");

const app = express();
app.use(express.json());
app.use("/api/watchlist", watchlistRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/watchlist");

        expect(response.status).toBe(401);
        expect(watchlistService.getWatchlistWithMetrics).not.toHaveBeenCalled();
    });

    it("rejects requests with an unrecognized token", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue(null);

        const response = await request(app).get("/api/watchlist").set("Authorization", "Bearer bad-token");

        expect(response.status).toBe(401);
        expect(watchlistService.getWatchlistWithMetrics).not.toHaveBeenCalled();
    });
});

describe("user isolation", () => {
    it("scopes GET /api/watchlist to the userId resolved from the caller's own token", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) =>
            token === "token-a" ? "userA" : "userB"
        );
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({ name: "My Watchlist", companies: [] });

        await request(app).get("/api/watchlist").set("Authorization", "Bearer token-a");
        await request(app).get("/api/watchlist").set("Authorization", "Bearer token-b");

        expect(watchlistService.getWatchlistWithMetrics).toHaveBeenNthCalledWith(1, "userA");
        expect(watchlistService.getWatchlistWithMetrics).toHaveBeenNthCalledWith(2, "userB");
    });
});

describe("GET /api/watchlist", () => {
    it("returns the enriched watchlist for a valid token", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        watchlistService.getWatchlistWithMetrics.mockResolvedValue({
            name: "My Watchlist",
            companies: [{ ticker: "AAPL" }],
        });

        const response = await request(app).get("/api/watchlist").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(response.body.watchlist.companies).toHaveLength(1);
    });
});

describe("GET /api/watchlist/insights", () => {
    it("rejects unauthenticated requests", async () => {
        const response = await request(app).get("/api/watchlist/insights");
        expect(response.status).toBe(401);
        expect(watchlistInsightsService.getInsights).not.toHaveBeenCalled();
    });

    it("scopes insights to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        watchlistInsightsService.getInsights.mockResolvedValue({ insights: [], generatedAt: "2026-08-13T00:00:00.000Z" });

        const response = await request(app).get("/api/watchlist/insights").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(watchlistInsightsService.getInsights).toHaveBeenCalledWith("user1");
    });
});

describe("POST /api/watchlist", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 404 when the ticker/name cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "ZZZZ" });

        expect(response.status).toBe(404);
        expect(watchlistService.addCompany).not.toHaveBeenCalled();
    });

    it("adds a resolved company to the caller's watchlist", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        watchlistService.addCompany.mockResolvedValue({ companies: [{ ticker: "AAPL" }] });

        const response = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "aapl" });

        expect(response.status).toBe(201);
        expect(watchlistService.addCompany).toHaveBeenCalledWith("user1", "AAPL");
    });

    it("returns 409 when the company is already on the watchlist", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        watchlistService.addCompany.mockRejectedValue(new watchlistService.DuplicateCompanyError("AAPL"));

        const response = await request(app)
            .post("/api/watchlist")
            .set("Authorization", "Bearer good-token")
            .send({ ticker: "AAPL" });

        expect(response.status).toBe(409);
    });
});

describe("DELETE /api/watchlist/:ticker", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
    });

    it("returns 400 for a malformed ticker", async () => {
        const response = await request(app)
            .delete("/api/watchlist/not valid!")
            .set("Authorization", "Bearer good-token");

        expect(response.status).toBe(400);
        expect(watchlistService.removeCompany).not.toHaveBeenCalled();
    });

    it("returns 404 when the company isn't on the watchlist", async () => {
        watchlistService.removeCompany.mockRejectedValue(new watchlistService.CompanyNotInWatchlistError("AAPL"));

        const response = await request(app).delete("/api/watchlist/AAPL").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(404);
    });

    it("removes the company and returns 200", async () => {
        watchlistService.removeCompany.mockResolvedValue({ companies: [] });

        const response = await request(app).delete("/api/watchlist/AAPL").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(watchlistService.removeCompany).toHaveBeenCalledWith("user1", "AAPL");
    });
});

const express = require("express");
const request = require("supertest");

jest.mock("../portfolio.analytics.service", () => ({ getPortfolioAnalytics: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const portfolioAnalyticsService = require("../portfolio.analytics.service");
const identityService = require("../../identity/identity.service");
const portfolioAnalyticsRoutes = require("../portfolio.analytics.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolio/analytics", portfolioAnalyticsRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/portfolio/analytics");
        expect(response.status).toBe(401);
        expect(portfolioAnalyticsService.getPortfolioAnalytics).not.toHaveBeenCalled();
    });
});

describe("query validation", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("rejects an unsupported window before calling the service", async () => {
        const response = await request(app)
            .get("/api/portfolio/analytics?window=2y")
            .set("Authorization", "Bearer token-a");

        expect(response.status).toBe(400);
        expect(portfolioAnalyticsService.getPortfolioAnalytics).not.toHaveBeenCalled();
    });

    it("defaults to the 1y window and no benchmark override when none are given", async () => {
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });

        await request(app).get("/api/portfolio/analytics").set("Authorization", "Bearer token-a");

        expect(portfolioAnalyticsService.getPortfolioAnalytics).toHaveBeenCalledWith("userA", { window: "1y", benchmark: null });
    });

    it("passes a validated window and benchmark through to the service", async () => {
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });

        await request(app)
            .get("/api/portfolio/analytics?window=6m&benchmark=spy")
            .set("Authorization", "Bearer token-a");

        expect(portfolioAnalyticsService.getPortfolioAnalytics).toHaveBeenCalledWith("userA", { window: "6m", benchmark: "SPY" });
    });
});

describe("user isolation", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) =>
            token === "token-a" ? "userA" : "userB"
        );
        portfolioAnalyticsService.getPortfolioAnalytics.mockResolvedValue({ isEmpty: true });
    });

    it("scopes the analytics request to the caller's own userId", async () => {
        await request(app).get("/api/portfolio/analytics").set("Authorization", "Bearer token-a");
        await request(app).get("/api/portfolio/analytics").set("Authorization", "Bearer token-b");

        expect(portfolioAnalyticsService.getPortfolioAnalytics).toHaveBeenNthCalledWith(1, "userA", expect.any(Object));
        expect(portfolioAnalyticsService.getPortfolioAnalytics).toHaveBeenNthCalledWith(2, "userB", expect.any(Object));
    });
});

describe("error handling", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
    });

    it("returns 500 when the service throws", async () => {
        portfolioAnalyticsService.getPortfolioAnalytics.mockRejectedValue(new Error("boom"));

        const response = await request(app).get("/api/portfolio/analytics").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(500);
    });
});

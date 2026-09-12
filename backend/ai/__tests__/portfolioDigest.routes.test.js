const express = require("express");
const request = require("supertest");

jest.mock("../portfolioDigest.service", () => ({ getPersistedDigest: jest.fn() }));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const portfolioDigestService = require("../portfolioDigest.service");
const identityService = require("../../identity/identity.service");
const portfolioDigestRoutes = require("../portfolioDigest.routes");

const app = express();
app.use(express.json());
app.use("/api/ai/digest", portfolioDigestRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/ai/digest", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/ai/digest");
        expect(response.status).toBe(401);
        expect(portfolioDigestService.getPersistedDigest).not.toHaveBeenCalled();
    });

    it("scopes the lookup to the caller's own userId and never triggers generation", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        portfolioDigestService.getPersistedDigest.mockResolvedValue({ narrative: "cached" });

        const response = await request(app).get("/api/ai/digest").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body.narrative).toBe("cached");
        expect(portfolioDigestService.getPersistedDigest).toHaveBeenCalledWith("user1");
    });

    it("returns null when no digest exists yet", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        portfolioDigestService.getPersistedDigest.mockResolvedValue(null);

        const response = await request(app).get("/api/ai/digest").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
    });
});

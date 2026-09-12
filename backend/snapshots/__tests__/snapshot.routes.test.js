const express = require("express");
const request = require("supertest");

jest.mock("../snapshot.service", () => ({
    createSnapshot: jest.fn(),
    listSnapshots: jest.fn(),
    deleteSnapshot: jest.fn(),
    getSharedSnapshot: jest.fn(),
}));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const snapshotService = require("../snapshot.service");
const identityService = require("../../identity/identity.service");
const snapshotRoutes = require("../snapshot.routes");

const app = express();
app.use(express.json());
app.use("/api/snapshots", snapshotRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /shared/:token - public", () => {
    it("is reachable with no Authorization header", async () => {
        snapshotService.getSharedSnapshot.mockResolvedValue({ type: "portfolio", label: null, payload: {}, createdAt: new Date() });

        const response = await request(app).get("/api/snapshots/shared/abc123");

        expect(response.status).toBe(200);
        expect(identityService.resolveUserIdByToken).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown/revoked token", async () => {
        const error = new Error("Snapshot not found, or this link is no longer available.");
        error.statusCode = 404;
        snapshotService.getSharedSnapshot.mockRejectedValue(error);

        const response = await request(app).get("/api/snapshots/shared/bogus");

        expect(response.status).toBe(404);
    });
});

describe("authentication on owner routes", () => {
    it.each([
        ["post", "/api/snapshots"],
        ["get", "/api/snapshots"],
        ["delete", "/api/snapshots/s1"],
    ])("rejects %s %s with no Authorization header", async (method, path) => {
        const response = await request(app)[method](path).send({ type: "portfolio", payload: {} });
        expect(response.status).toBe(401);
    });
});

describe("POST /", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("userA"));

    it("rejects an invalid body before calling the service", async () => {
        const response = await request(app).post("/api/snapshots").set("Authorization", "Bearer token-a").send({ type: "bogus" });

        expect(response.status).toBe(422);
        expect(snapshotService.createSnapshot).not.toHaveBeenCalled();
    });

    it("creates a snapshot scoped to the caller and returns the raw token", async () => {
        snapshotService.createSnapshot.mockResolvedValue({
            snapshot: { _id: "s1", type: "portfolio", label: "Mine", createdAt: new Date() },
            token: "raw-token-value",
        });

        const response = await request(app)
            .post("/api/snapshots")
            .set("Authorization", "Bearer token-a")
            .send({ type: "portfolio", label: "Mine", payload: { holdings: [] } });

        expect(response.status).toBe(201);
        expect(response.body.token).toBe("raw-token-value");
        expect(snapshotService.createSnapshot).toHaveBeenCalledWith("userA", { type: "portfolio", label: "Mine", payload: { holdings: [] } });
    });
});

describe("DELETE /:id", () => {
    it("returns 404 when the service reports the snapshot wasn't found", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userA");
        const error = new Error("Snapshot not found, or this link is no longer available.");
        error.statusCode = 404;
        snapshotService.deleteSnapshot.mockRejectedValue(error);

        const response = await request(app).delete("/api/snapshots/s1").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(404);
    });
});

describe("user isolation", () => {
    it("scopes GET / to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        snapshotService.listSnapshots.mockResolvedValue([]);

        await request(app).get("/api/snapshots").set("Authorization", "Bearer token-a");
        await request(app).get("/api/snapshots").set("Authorization", "Bearer token-b");

        expect(snapshotService.listSnapshots).toHaveBeenNthCalledWith(1, "userA");
        expect(snapshotService.listSnapshots).toHaveBeenNthCalledWith(2, "userB");
    });
});

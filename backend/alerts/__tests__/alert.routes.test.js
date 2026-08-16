const express = require("express");
const request = require("supertest");

jest.mock("../alert.service", () => ({
    getAlerts: jest.fn(),
    markAsRead: jest.fn(),
    dismissAlert: jest.fn(),
    getUnreadCount: jest.fn(),
    getAlertCountsByTicker: jest.fn(),
    runMonitoring: jest.fn(),
    AlertNotFoundError: class AlertNotFoundError extends Error {
        constructor() {
            super("Alert not found.");
            this.statusCode = 404;
        }
    },
}));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const alertService = require("../alert.service");
const identityService = require("../../identity/identity.service");
const alertRoutes = require("../alert.routes");

const app = express();
app.use(express.json());
app.use("/api/alerts", alertRoutes);

const VALID_ID = "507f1f77bcf86cd799439011";

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
        const response = await request(app).get("/api/alerts");
        expect(response.status).toBe(401);
        expect(alertService.getAlerts).not.toHaveBeenCalled();
    });

    it("rejects requests with an unrecognized token", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue(null);
        const response = await request(app).get("/api/alerts").set("Authorization", "Bearer bad-token");
        expect(response.status).toBe(401);
    });
});

describe("user isolation", () => {
    it("scopes GET /api/alerts to the userId resolved from the caller's own token", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        alertService.getAlerts.mockResolvedValue({ alerts: [], total: 0, page: 1, limit: 20 });

        await request(app).get("/api/alerts").set("Authorization", "Bearer token-a");
        await request(app).get("/api/alerts").set("Authorization", "Bearer token-b");

        expect(alertService.getAlerts).toHaveBeenNthCalledWith(1, "userA", expect.anything());
        expect(alertService.getAlerts).toHaveBeenNthCalledWith(2, "userB", expect.anything());
    });
});

describe("GET /api/alerts", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("returns 400 with no service call for an invalid type filter", async () => {
        const response = await request(app).get("/api/alerts?type=BOGUS").set("Authorization", "Bearer good-token");
        expect(response.status).toBe(400);
        expect(alertService.getAlerts).not.toHaveBeenCalled();
    });

    it("returns the alerts list for a valid request", async () => {
        alertService.getAlerts.mockResolvedValue({ alerts: [{ ticker: "AAPL" }], total: 1, page: 1, limit: 20 });

        const response = await request(app).get("/api/alerts").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(response.body.alerts).toHaveLength(1);
    });
});

describe("PATCH /api/alerts/:id/read and /dismiss", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("returns 400 for a malformed alert id, without calling the service", async () => {
        const response = await request(app).patch("/api/alerts/not-an-id/read").set("Authorization", "Bearer good-token");
        expect(response.status).toBe(400);
        expect(alertService.markAsRead).not.toHaveBeenCalled();
    });

    it("returns 404 when the alert doesn't belong to the caller (or doesn't exist)", async () => {
        alertService.markAsRead.mockRejectedValue(new alertService.AlertNotFoundError());
        const response = await request(app).patch(`/api/alerts/${VALID_ID}/read`).set("Authorization", "Bearer good-token");
        expect(response.status).toBe(404);
    });

    it("marks an owned alert as read", async () => {
        alertService.markAsRead.mockResolvedValue({ _id: VALID_ID, isRead: true });
        const response = await request(app).patch(`/api/alerts/${VALID_ID}/read`).set("Authorization", "Bearer good-token");
        expect(response.status).toBe(200);
        expect(alertService.markAsRead).toHaveBeenCalledWith("user1", VALID_ID);
    });

    it("dismisses an owned alert", async () => {
        alertService.dismissAlert.mockResolvedValue({ _id: VALID_ID, isDismissed: true });
        const response = await request(app).patch(`/api/alerts/${VALID_ID}/dismiss`).set("Authorization", "Bearer good-token");
        expect(response.status).toBe(200);
        expect(alertService.dismissAlert).toHaveBeenCalledWith("user1", VALID_ID);
    });
});

describe("GET /api/alerts/unread-count", () => {
    it("rejects unauthenticated requests", async () => {
        const response = await request(app).get("/api/alerts/unread-count");
        expect(response.status).toBe(401);
    });

    it("returns the caller's unread count", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        alertService.getUnreadCount.mockResolvedValue({ count: 4 });

        const response = await request(app).get("/api/alerts/unread-count").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ count: 4 });
    });
});

describe("POST /api/alerts/monitor", () => {
    it("rejects unauthenticated requests without running monitoring", async () => {
        const response = await request(app).post("/api/alerts/monitor");
        expect(response.status).toBe(401);
        expect(alertService.runMonitoring).not.toHaveBeenCalled();
    });

    it("runs monitoring for the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("user1");
        alertService.runMonitoring.mockResolvedValue({ tickersMonitored: ["AAPL"], alertsCreated: 2, alerts: [], generatedAt: "now" });

        const response = await request(app).post("/api/alerts/monitor").set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(alertService.runMonitoring).toHaveBeenCalledWith("user1");
        expect(response.body.alertsCreated).toBe(2);
    });
});

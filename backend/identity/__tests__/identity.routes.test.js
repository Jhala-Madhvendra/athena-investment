const express = require("express");
const request = require("supertest");

jest.mock("../identity.service", () => ({
    issueIdentity: jest.fn(),
    resolveUserIdByToken: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getIdentity: jest.fn(),
    updatePreferences: jest.fn(),
    EmailAlreadyRegisteredError: class EmailAlreadyRegisteredError extends Error {
        constructor() {
            super("An account with that email already exists.");
            this.statusCode = 409;
        }
    },
    InvalidCredentialsError: class InvalidCredentialsError extends Error {
        constructor() {
            super("Invalid email or password.");
            this.statusCode = 401;
        }
    },
}));

const identityService = require("../identity.service");
const identityRoutes = require("../identity.routes");

const app = express();
app.use(express.json());
app.use("/api/identity", identityRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("POST /api/identity/signup", () => {
    it("returns 400 for an invalid body without calling the service", async () => {
        const response = await request(app).post("/api/identity/signup").send({ email: "not-an-email", password: "short" });

        expect(response.status).toBe(400);
        expect(identityService.signup).not.toHaveBeenCalled();
    });

    it("returns 409 when the service reports the email is already taken", async () => {
        identityService.signup.mockRejectedValue(new identityService.EmailAlreadyRegisteredError());

        const response = await request(app)
            .post("/api/identity/signup")
            .send({ email: "taken@example.com", password: "longenough" });

        expect(response.status).toBe(409);
    });

    it("creates an account and returns the token when no prior session exists", async () => {
        identityService.signup.mockResolvedValue({ userId: "u1", email: "new@example.com", token: "raw-token" });

        const response = await request(app)
            .post("/api/identity/signup")
            .send({ email: "New@Example.com", password: "longenough" });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ userId: "u1", email: "new@example.com", token: "raw-token" });
        expect(identityService.signup).toHaveBeenCalledWith({ email: "new@example.com", password: "longenough", existingUserId: null });
        expect(identityService.resolveUserIdByToken).not.toHaveBeenCalled();
    });

    it("resolves an Authorization header to existingUserId so an anonymous session can be upgraded in place", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("anon-user");
        identityService.signup.mockResolvedValue({ userId: "anon-user", email: "new@example.com" });

        const response = await request(app)
            .post("/api/identity/signup")
            .set("Authorization", "Bearer existing-token")
            .send({ email: "new@example.com", password: "longenough" });

        expect(response.status).toBe(201);
        expect(identityService.resolveUserIdByToken).toHaveBeenCalledWith("existing-token");
        expect(identityService.signup).toHaveBeenCalledWith({ email: "new@example.com", password: "longenough", existingUserId: "anon-user" });
    });
});

describe("POST /api/identity/login", () => {
    it("returns 400 for a missing email/password without calling the service", async () => {
        const response = await request(app).post("/api/identity/login").send({});

        expect(response.status).toBe(400);
        expect(identityService.login).not.toHaveBeenCalled();
    });

    it("returns 401 on invalid credentials", async () => {
        identityService.login.mockRejectedValue(new identityService.InvalidCredentialsError());

        const response = await request(app).post("/api/identity/login").send({ email: "test@example.com", password: "wrong" });

        expect(response.status).toBe(401);
    });

    it("returns the re-minted token on success", async () => {
        identityService.login.mockResolvedValue({ userId: "u1", email: "test@example.com", token: "new-token" });

        const response = await request(app).post("/api/identity/login").send({ email: "test@example.com", password: "correct" });

        expect(response.status).toBe(200);
        expect(response.body.token).toBe("new-token");
    });
});

describe("authentication on GET /me and POST /logout", () => {
    it.each([
        ["get", "/api/identity/me"],
        ["post", "/api/identity/logout"],
        ["put", "/api/identity/notification-preferences"],
    ])("rejects %s %s with no Authorization header", async (method, path) => {
        const response = await request(app)[method](path);
        expect(response.status).toBe(401);
    });

    it("scopes /me to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("u1");
        identityService.getIdentity.mockResolvedValue({ email: "test@example.com", isAnonymous: false });

        const response = await request(app).get("/api/identity/me").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ email: "test@example.com", isAnonymous: false });
        expect(identityService.getIdentity).toHaveBeenCalledWith("u1");
    });

    it("scopes /logout to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("u1");
        identityService.logout.mockResolvedValue(undefined);

        const response = await request(app).post("/api/identity/logout").set("Authorization", "Bearer token-a");

        expect(response.status).toBe(200);
        expect(identityService.logout).toHaveBeenCalledWith("u1");
    });
});

describe("PUT /api/identity/notification-preferences", () => {
    beforeEach(() => {
        identityService.resolveUserIdByToken.mockResolvedValue("u1");
    });

    it("returns 400 for an invalid body without calling the service", async () => {
        const response = await request(app)
            .put("/api/identity/notification-preferences")
            .set("Authorization", "Bearer token-a")
            .send({ emailEnabled: "yes" });

        expect(response.status).toBe(400);
        expect(identityService.updatePreferences).not.toHaveBeenCalled();
    });

    it("scopes the update to the caller's own userId and returns the updated preferences", async () => {
        identityService.updatePreferences.mockResolvedValue({ emailEnabled: true, slackWebhookUrl: null, telegramChatId: null, digestEnabled: false });

        const response = await request(app)
            .put("/api/identity/notification-preferences")
            .set("Authorization", "Bearer token-a")
            .send({ emailEnabled: true });

        expect(response.status).toBe(200);
        expect(identityService.updatePreferences).toHaveBeenCalledWith("u1", { emailEnabled: true });
        expect(response.body.notificationPreferences.emailEnabled).toBe(true);
    });
});

const express = require("express");
const request = require("supertest");

const VALID_ID = "507f1f77bcf86cd799439011";

jest.mock("../portfolioAccount.service", () => ({
    listAccounts: jest.fn(),
    createAccount: jest.fn(),
    renameAccount: jest.fn(),
    deleteAccount: jest.fn(),
}));
jest.mock("../../identity/identity.service", () => ({ resolveUserIdByToken: jest.fn() }));

const portfolioAccountService = require("../portfolioAccount.service");
const identityService = require("../../identity/identity.service");
const portfolioAccountRoutes = require("../portfolioAccount.routes");

const app = express();
app.use(express.json());
app.use("/api/portfolio-accounts", portfolioAccountRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("authentication", () => {
    it.each([
        ["get", "/api/portfolio-accounts"],
        ["post", "/api/portfolio-accounts"],
        ["put", `/api/portfolio-accounts/${VALID_ID}`],
        ["delete", `/api/portfolio-accounts/${VALID_ID}`],
    ])("rejects %s %s with no Authorization header", async (method, path) => {
        const response = await request(app)[method](path).send({ name: "Retirement" });
        expect(response.status).toBe(401);
    });
});

describe("user isolation", () => {
    it("scopes GET / to the caller's own userId", async () => {
        identityService.resolveUserIdByToken.mockImplementation(async (token) => (token === "token-a" ? "userA" : "userB"));
        portfolioAccountService.listAccounts.mockResolvedValue([]);

        await request(app).get("/api/portfolio-accounts").set("Authorization", "Bearer token-a");
        await request(app).get("/api/portfolio-accounts").set("Authorization", "Bearer token-b");

        expect(portfolioAccountService.listAccounts).toHaveBeenNthCalledWith(1, "userA");
        expect(portfolioAccountService.listAccounts).toHaveBeenNthCalledWith(2, "userB");
    });

    it("returns 404 (not another user's account) when userB tries to rename userA's account", async () => {
        identityService.resolveUserIdByToken.mockResolvedValue("userB");

        const error = new Error("Portfolio account not found.");
        error.statusCode = 404;
        portfolioAccountService.renameAccount.mockRejectedValue(error);

        const response = await request(app)
            .put(`/api/portfolio-accounts/${VALID_ID}`)
            .set("Authorization", "Bearer token-b")
            .send({ name: "Hijacked" });

        expect(response.status).toBe(404);
    });
});

describe("POST /", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("creates an account scoped to the caller", async () => {
        portfolioAccountService.createAccount.mockResolvedValue({ _id: "acct-2", name: "Retirement" });

        const response = await request(app).post("/api/portfolio-accounts").set("Authorization", "Bearer good-token").send({ name: "Retirement" });

        expect(response.status).toBe(201);
        expect(portfolioAccountService.createAccount).toHaveBeenCalledWith("user1", { name: "Retirement" });
    });

    it("returns 422 when the service reports a validation error", async () => {
        const error = new Error("A name is required.");
        error.statusCode = 422;
        error.errors = ["A name is required."];
        portfolioAccountService.createAccount.mockRejectedValue(error);

        const response = await request(app).post("/api/portfolio-accounts").set("Authorization", "Bearer good-token").send({ name: "" });

        expect(response.status).toBe(422);
    });
});

describe("DELETE /:id", () => {
    beforeEach(() => identityService.resolveUserIdByToken.mockResolvedValue("user1"));

    it("returns 422 when the account still has holdings/transactions", async () => {
        const error = new Error("This account still has holdings, transactions, or dividends recorded against it. Move or delete them first.");
        error.statusCode = 422;
        portfolioAccountService.deleteAccount.mockRejectedValue(error);

        const response = await request(app).delete(`/api/portfolio-accounts/${VALID_ID}`).set("Authorization", "Bearer good-token");

        expect(response.status).toBe(422);
    });

    it("returns 200 and removes an empty account", async () => {
        portfolioAccountService.deleteAccount.mockResolvedValue({ _id: VALID_ID });

        const response = await request(app).delete(`/api/portfolio-accounts/${VALID_ID}`).set("Authorization", "Bearer good-token");

        expect(response.status).toBe(200);
        expect(portfolioAccountService.deleteAccount).toHaveBeenCalledWith("user1", VALID_ID);
    });
});

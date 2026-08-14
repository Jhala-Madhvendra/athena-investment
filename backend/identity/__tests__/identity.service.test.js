const crypto = require("crypto");

jest.mock("../identity.model", () => ({
    create: jest.fn(),
    findOne: jest.fn(),
}));

const User = require("../identity.model");
const identityService = require("../identity.service");

afterEach(() => {
    jest.clearAllMocks();
});

describe("issueIdentity", () => {
    it("returns a raw token and stores only its hash", async () => {
        User.create.mockImplementation(async ({ tokenHash }) => ({ _id: "user1", tokenHash }));

        const { token, userId } = await identityService.issueIdentity();

        expect(userId).toBe("user1");
        expect(token).toMatch(/^[a-f0-9]{64}$/);

        const storedHash = User.create.mock.calls[0][0].tokenHash;
        expect(storedHash).not.toBe(token);
        expect(storedHash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    });

    it("mints a different token on every call", async () => {
        User.create.mockImplementation(async ({ tokenHash }) => ({ _id: "user1", tokenHash }));

        const first = await identityService.issueIdentity();
        const second = await identityService.issueIdentity();

        expect(first.token).not.toBe(second.token);
    });
});

describe("resolveUserIdByToken", () => {
    const selectLean = (result) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(result)) })) });

    it("returns null for a missing/blank token without querying the database", async () => {
        expect(await identityService.resolveUserIdByToken(undefined)).toBeNull();
        expect(await identityService.resolveUserIdByToken("")).toBeNull();
        expect(await identityService.resolveUserIdByToken("   ")).toBeNull();
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it("returns null when the token's hash matches no user", async () => {
        User.findOne.mockReturnValue(selectLean(null));

        expect(await identityService.resolveUserIdByToken("unknown-token")).toBeNull();
    });

    it("returns the userId when the token's hash matches a user", async () => {
        const rawToken = "a-real-token";
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        User.findOne.mockReturnValue(selectLean({ _id: "user42" }));

        const userId = await identityService.resolveUserIdByToken(rawToken);

        expect(userId).toBe("user42");
        expect(User.findOne).toHaveBeenCalledWith({ tokenHash: expectedHash });
    });
});

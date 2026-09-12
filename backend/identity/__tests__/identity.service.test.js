const crypto = require("crypto");

jest.mock("../identity.model", () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
}));
jest.mock("bcryptjs", () => ({ hash: jest.fn(), compare: jest.fn() }));

const User = require("../identity.model");
const bcrypt = require("bcryptjs");
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

describe("getIdentity", () => {
    const selectLean = (result) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(result)) })) });

    it("reports isAnonymous:true when the user has no email", async () => {
        User.findById.mockReturnValue(selectLean({ email: null }));

        expect(await identityService.getIdentity("user1")).toEqual({ email: null, isAnonymous: true, notificationPreferences: null });
    });

    it("reports the email, isAnonymous:false, and notificationPreferences for a signed-up account", async () => {
        User.findById.mockReturnValue(selectLean({ email: "test@example.com", notificationPreferences: { emailEnabled: true } }));

        expect(await identityService.getIdentity("user1")).toEqual({
            email: "test@example.com",
            isAnonymous: false,
            notificationPreferences: { emailEnabled: true },
        });
    });
});

describe("signup", () => {
    const selectLean = (result) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(result)) })) });

    beforeEach(() => {
        bcrypt.hash.mockResolvedValue("hashed-password");
    });

    it("throws EmailAlreadyRegisteredError without hashing the password or touching anything else", async () => {
        User.findOne.mockReturnValue(selectLean({ _id: "existing" }));

        await expect(identityService.signup({ email: "taken@example.com", password: "longenough" })).rejects.toThrow(
            identityService.EmailAlreadyRegisteredError
        );
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(User.create).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("upgrades an existing anonymous session in place - same userId, no new token", async () => {
        User.findOne.mockReturnValue(selectLean(null)); // email not taken
        User.findById.mockReturnValue(selectLean({ email: null })); // genuinely anonymous
        User.findByIdAndUpdate.mockResolvedValue({});

        const result = await identityService.signup({ email: "new@example.com", password: "longenough", existingUserId: "anon-user" });

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith("anon-user", { email: "new@example.com", passwordHash: "hashed-password" });
        expect(User.create).not.toHaveBeenCalled();
        expect(result).toEqual({ userId: "anon-user", email: "new@example.com" });
    });

    it("mints a brand-new account when there is no existingUserId", async () => {
        User.findOne.mockReturnValue(selectLean(null));
        User.create.mockResolvedValue({ _id: "new-user" });

        const result = await identityService.signup({ email: "new@example.com", password: "longenough" });

        expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ email: "new@example.com", passwordHash: "hashed-password" }));
        expect(result.userId).toBe("new-user");
        expect(result.email).toBe("new@example.com");
        expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("mints a brand-new account when the existingUserId already has an email (not a fresh anonymous session)", async () => {
        User.findOne.mockReturnValue(selectLean(null));
        User.findById.mockReturnValue(selectLean({ email: "already-signed-up@example.com" }));
        User.create.mockResolvedValue({ _id: "second-account" });

        const result = await identityService.signup({ email: "new@example.com", password: "longenough", existingUserId: "signed-in-user" });

        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(User.create).toHaveBeenCalled();
        expect(result.userId).toBe("second-account");
    });
});

describe("login", () => {
    beforeEach(() => {
        bcrypt.compare.mockResolvedValue(false);
    });

    it("throws InvalidCredentialsError for an unknown email", async () => {
        User.findOne.mockResolvedValue(null);

        await expect(identityService.login({ email: "nobody@example.com", password: "x" })).rejects.toThrow(
            identityService.InvalidCredentialsError
        );
    });

    it("throws InvalidCredentialsError for an anonymous-only account (no passwordHash to check)", async () => {
        User.findOne.mockResolvedValue({ _id: "u1", email: "test@example.com", passwordHash: null });

        await expect(identityService.login({ email: "test@example.com", password: "x" })).rejects.toThrow(
            identityService.InvalidCredentialsError
        );
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("throws InvalidCredentialsError on a wrong password, identical to the unknown-email case", async () => {
        User.findOne.mockResolvedValue({ _id: "u1", email: "test@example.com", passwordHash: "hashed" });
        bcrypt.compare.mockResolvedValue(false);

        await expect(identityService.login({ email: "test@example.com", password: "wrong" })).rejects.toThrow(
            identityService.InvalidCredentialsError
        );
    });

    it("re-mints the token on success, retiring whatever was active before", async () => {
        const save = jest.fn().mockResolvedValue({});
        const user = { _id: "u1", email: "test@example.com", passwordHash: "hashed", tokenHash: "old-hash", save };
        User.findOne.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);

        const result = await identityService.login({ email: "test@example.com", password: "correct" });

        expect(save).toHaveBeenCalled();
        expect(user.tokenHash).not.toBe("old-hash");
        expect(result.userId).toBe("u1");
        expect(result.email).toBe("test@example.com");
        expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe("logout", () => {
    it("overwrites tokenHash with a fresh value nobody is given", async () => {
        User.findByIdAndUpdate.mockResolvedValue({});

        await identityService.logout("u1");

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    });
});

describe("updatePreferences", () => {
    const selectLean = (result) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(result)) })) });

    it("only touches the fields present in the update, using dot-notation $set", async () => {
        User.findByIdAndUpdate.mockReturnValue(selectLean({ notificationPreferences: { emailEnabled: true } }));

        await identityService.updatePreferences("u1", { emailEnabled: true });

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            "u1",
            { $set: { "notificationPreferences.emailEnabled": true } },
            { new: true }
        );
    });

    it("returns the updated notificationPreferences", async () => {
        const prefs = { emailEnabled: true, slackWebhookUrl: null, telegramChatId: null, digestEnabled: false };
        User.findByIdAndUpdate.mockReturnValue(selectLean({ notificationPreferences: prefs }));

        const result = await identityService.updatePreferences("u1", { emailEnabled: true });

        expect(result).toEqual(prefs);
    });

    it("sets multiple fields in one update", async () => {
        User.findByIdAndUpdate.mockReturnValue(selectLean({ notificationPreferences: {} }));

        await identityService.updatePreferences("u1", { slackWebhookUrl: "https://hooks.slack.com/services/x", digestEnabled: true });

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            "u1",
            { $set: { "notificationPreferences.slackWebhookUrl": "https://hooks.slack.com/services/x", "notificationPreferences.digestEnabled": true } },
            { new: true }
        );
    });
});

jest.mock("../snapshot.model", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
}));

const crypto = require("crypto");
const Snapshot = require("../snapshot.model");
const snapshotService = require("../snapshot.service");

const chainableSortSelectLean = (docs) => ({
    select: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })) })),
});
const chainableSelectLean = (doc) => ({ select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(doc)) })) });

afterEach(() => {
    jest.clearAllMocks();
});

describe("createSnapshot", () => {
    it("stores only a hash of the generated token, never the raw value", async () => {
        Snapshot.create.mockResolvedValue({ _id: "s1", type: "portfolio", label: null, createdAt: new Date() });

        const { token } = await snapshotService.createSnapshot("user1", { type: "portfolio", label: null, payload: { holdings: [] } });

        const expectedHash = crypto.createHash("sha256").update(token).digest("hex");
        expect(Snapshot.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "user1", type: "portfolio", tokenHash: expectedHash })
        );
        expect(Snapshot.create.mock.calls[0][0]).not.toHaveProperty("token");
    });

    it("returns the raw token to the caller exactly once", async () => {
        Snapshot.create.mockResolvedValue({ _id: "s1" });

        const { token } = await snapshotService.createSnapshot("user1", { type: "dcf", label: null, payload: {} });

        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(32);
    });
});

describe("listSnapshots", () => {
    it("selects only type/label/createdAt - never payload or tokenHash", async () => {
        Snapshot.find.mockReturnValue(chainableSortSelectLean([{ _id: "s1", type: "portfolio" }]));

        await snapshotService.listSnapshots("user1");

        expect(Snapshot.find).toHaveBeenCalledWith({ userId: "user1" });
        const selectArg = Snapshot.find.mock.results[0].value.select.mock.calls[0][0];
        expect(selectArg).toBe("type label createdAt");
    });
});

describe("deleteSnapshot", () => {
    it("throws SnapshotNotFoundError when nothing matches", async () => {
        Snapshot.findOneAndDelete.mockResolvedValue(null);

        await expect(snapshotService.deleteSnapshot("user1", "s1")).rejects.toThrow(snapshotService.SnapshotNotFoundError);
    });

    it("scopes the delete to _id and userId together", async () => {
        Snapshot.findOneAndDelete.mockResolvedValue({ _id: "s1" });

        await snapshotService.deleteSnapshot("user1", "s1");

        expect(Snapshot.findOneAndDelete).toHaveBeenCalledWith({ _id: "s1", userId: "user1" });
    });
});

describe("getSharedSnapshot", () => {
    it("throws SnapshotNotFoundError for an unknown token", async () => {
        Snapshot.findOne.mockReturnValue(chainableSelectLean(null));

        await expect(snapshotService.getSharedSnapshot("bogus-token")).rejects.toThrow(snapshotService.SnapshotNotFoundError);
    });

    it("looks up by the SHA-256 hash of the provided raw token", async () => {
        Snapshot.findOne.mockReturnValue(chainableSelectLean({ type: "portfolio", label: "Mine", payload: { holdings: [] }, createdAt: new Date(), userId: "user1" }));

        const rawToken = "abc123";
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        await snapshotService.getSharedSnapshot(rawToken);

        expect(Snapshot.findOne).toHaveBeenCalledWith({ tokenHash: expectedHash });
    });

    it("never returns userId to the caller", async () => {
        Snapshot.findOne.mockReturnValue(
            chainableSelectLean({ type: "portfolio", label: "Mine", payload: { holdings: [] }, createdAt: new Date(), userId: "user1" })
        );

        const result = await snapshotService.getSharedSnapshot("abc123");

        expect(result).not.toHaveProperty("userId");
    });
});

const dedup = require("../alert.deduplicator");

describe("dayKey", () => {
    it("formats as an ISO date (YYYY-MM-DD)", () => {
        expect(dedup.dayKey(new Date("2026-08-15T23:59:00.000Z"))).toBe("2026-08-15");
    });

    it("defaults to the current date when called with no argument", () => {
        expect(dedup.dayKey()).toBe(new Date().toISOString().slice(0, 10));
    });
});

describe("fiscalYearPairKey / fiscalYearKey / articleKey", () => {
    it("builds a stable fiscal-year-pair key", () => {
        expect(dedup.fiscalYearPairKey(2025, 2026)).toBe("FY2025-FY2026");
    });

    it("builds a stable single fiscal-year key", () => {
        expect(dedup.fiscalYearKey(2026)).toBe("FY2026");
    });

    it("coerces an ObjectId-like article id to a string", () => {
        const fakeObjectId = { toString: () => "6a80b274e17b6f602c0cc620" };
        expect(dedup.articleKey(fakeObjectId)).toBe("6a80b274e17b6f602c0cc620");
    });
});

describe("insertIfNew", () => {
    const buildAlertModel = () => ({ create: jest.fn() });

    it("returns the created document when the insert succeeds", async () => {
        const Alert = buildAlertModel();
        const created = { _id: "a1", rule: "PRICE_MOVE_1D" };
        Alert.create.mockResolvedValue(created);

        const result = await dedup.insertIfNew(Alert, { rule: "PRICE_MOVE_1D" });

        expect(result).toBe(created);
    });

    it("returns null (not an error) when the identity already exists (duplicate key, E11000)", async () => {
        const Alert = buildAlertModel();
        const duplicateKeyError = Object.assign(new Error("duplicate"), { code: 11000 });
        Alert.create.mockRejectedValue(duplicateKeyError);

        const result = await dedup.insertIfNew(Alert, { rule: "PRICE_MOVE_1D" });

        expect(result).toBeNull();
    });

    it("re-throws any other error (e.g. a genuine validation failure)", async () => {
        const Alert = buildAlertModel();
        Alert.create.mockRejectedValue(new Error("something else went wrong"));

        await expect(dedup.insertIfNew(Alert, { rule: "PRICE_MOVE_1D" })).rejects.toThrow("something else went wrong");
    });
});

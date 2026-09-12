const { validateCreateRequest, MAX_PAYLOAD_BYTES } = require("../snapshot.validator");

describe("validateCreateRequest", () => {
    it("rejects an unsupported type", () => {
        const result = validateCreateRequest({ type: "watchlist", payload: {} });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("type"))).toBe(true);
    });

    it("rejects a missing payload", () => {
        const result = validateCreateRequest({ type: "portfolio" });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("payload"))).toBe(true);
    });

    it("rejects an oversized payload", () => {
        const bigPayload = { holdings: "x".repeat(MAX_PAYLOAD_BYTES + 1) };
        const result = validateCreateRequest({ type: "portfolio", payload: bigPayload });
        expect(result.isValid).toBe(false);
        expect(result.errors.some((m) => m.includes("too large"))).toBe(true);
    });

    it("accepts a well-formed portfolio snapshot request", () => {
        const result = validateCreateRequest({ type: "portfolio", label: "My Portfolio", payload: { holdings: [], summary: {} } });
        expect(result.isValid).toBe(true);
        expect(result.normalized).toEqual({ type: "portfolio", label: "My Portfolio", payload: { holdings: [], summary: {} } });
    });

    it("defaults label to null when omitted", () => {
        const result = validateCreateRequest({ type: "dcf", payload: { intrinsicValuePerShare: 200 } });
        expect(result.isValid).toBe(true);
        expect(result.normalized.label).toBeNull();
    });
});

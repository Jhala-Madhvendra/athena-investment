const { validatePeers, validateStatistic } = require("../comps.validator");

describe("comps.validator validatePeers", () => {
    it("accepts a clean list of distinct peers", () => {
        const result = validatePeers("AAPL", ["MSFT", "GOOGL", "META"]);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.peers).toEqual(["MSFT", "GOOGL", "META"]);
    });

    it("normalizes casing and whitespace", () => {
        const result = validatePeers("aapl", [" msft ", "googl"]);
        expect(result.peers).toEqual(["MSFT", "GOOGL"]);
    });

    it("rejects fewer than two peers", () => {
        const result = validatePeers("AAPL", ["MSFT"]);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/At least 2/);
    });

    it("rejects a missing/non-array peers value", () => {
        expect(validatePeers("AAPL", undefined).isValid).toBe(false);
        expect(validatePeers("AAPL", "MSFT").isValid).toBe(false);
    });

    it("removes the target from its own peer list and notes it, without erroring if enough peers remain", () => {
        const result = validatePeers("AAPL", ["AAPL", "MSFT", "GOOGL"]);
        expect(result.isValid).toBe(true);
        expect(result.peers).toEqual(["MSFT", "GOOGL"]);
        expect(result.notes.some((note) => note.includes("cannot be its own peer"))).toBe(true);
    });

    it("errors when removing the target leaves fewer than two peers", () => {
        const result = validatePeers("AAPL", ["AAPL", "MSFT"]);
        expect(result.isValid).toBe(false);
        expect(result.peers).toEqual(["MSFT"]);
    });

    it("deduplicates repeated peers and notes it", () => {
        const result = validatePeers("AAPL", ["MSFT", "MSFT", "GOOGL"]);
        expect(result.isValid).toBe(true);
        expect(result.peers).toEqual(["MSFT", "GOOGL"]);
        expect(result.notes.some((note) => note.includes("Duplicate"))).toBe(true);
    });

    it("rejects invalidly formatted tickers", () => {
        const result = validatePeers("AAPL", ["MSFT", "not a ticker!"]);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/not validly formatted/);
    });
});

describe("comps.validator validateStatistic", () => {
    it("defaults to median when omitted", () => {
        const result = validateStatistic(undefined);
        expect(result.isValid).toBe(true);
        expect(result.statistic).toBe("median");
    });

    it("accepts mean, median, p25, p75", () => {
        ["mean", "median", "p25", "p75"].forEach((statistic) => {
            expect(validateStatistic(statistic).isValid).toBe(true);
        });
    });

    it("rejects an unsupported statistic", () => {
        const result = validateStatistic("mode");
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/must be one of/);
    });
});

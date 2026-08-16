const { resolvePeriods, formatAnnualLabel, PERIOD_TYPES } = require("../earnings.periods");

const statement = (year) => ({ year, ticker: "AAPL" });

describe("resolvePeriods", () => {
    it("returns an empty, comparison-unavailable result when no statements exist", () => {
        const result = resolvePeriods([]);

        expect(result).toEqual({
            periodType: PERIOD_TYPES.ANNUAL,
            latest: null,
            previous: null,
            latestPeriodLabel: null,
            previousPeriodLabel: null,
            comparisonAvailable: false,
            comparisonType: null,
        });
    });

    it("returns the same empty result for non-array input rather than throwing", () => {
        expect(resolvePeriods(null).latest).toBeNull();
        expect(resolvePeriods(undefined).latest).toBeNull();
    });

    it("identifies the latest period but marks comparison unavailable with only one statement", () => {
        const result = resolvePeriods([statement(2026)]);

        expect(result.latest.year).toBe(2026);
        expect(result.previous).toBeNull();
        expect(result.latestPeriodLabel).toBe("FY2026");
        expect(result.previousPeriodLabel).toBeNull();
        expect(result.comparisonAvailable).toBe(false);
        expect(result.comparisonType).toBeNull();
    });

    it("pairs the latest year with the immediately preceding year as a YoY comparison", () => {
        const result = resolvePeriods([statement(2024), statement(2026), statement(2025)]);

        expect(result.latest.year).toBe(2026);
        expect(result.previous.year).toBe(2025);
        expect(result.comparisonAvailable).toBe(true);
        expect(result.comparisonType).toBe("YoY");
    });

    it("does not depend on input order - always sorts descending by year first", () => {
        const ascending = resolvePeriods([statement(2023), statement(2024), statement(2025)]);
        const descending = resolvePeriods([statement(2025), statement(2024), statement(2023)]);

        expect(ascending).toEqual(descending);
    });

    it("ignores statements with a missing or non-numeric year", () => {
        const result = resolvePeriods([{ year: null }, statement(2025), { ticker: "AAPL" }]);

        expect(result.latest.year).toBe(2025);
        expect(result.previous).toBeNull();
    });

    it("always reports periodType ANNUAL - Athena has no quarterly data source today", () => {
        expect(resolvePeriods([statement(2025), statement(2024)]).periodType).toBe("ANNUAL");
    });
});

describe("formatAnnualLabel", () => {
    it("formats a numeric year as FYxxxx", () => {
        expect(formatAnnualLabel(2026)).toBe("FY2026");
    });

    it("returns null for a non-numeric year", () => {
        expect(formatAnnualLabel(null)).toBeNull();
        expect(formatAnnualLabel(undefined)).toBeNull();
        expect(formatAnnualLabel("2026")).toBeNull();
    });
});

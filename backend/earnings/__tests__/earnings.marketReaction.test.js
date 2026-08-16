const { computeMarketReaction, MARKET_REACTION_BASIS } = require("../earnings.marketReaction");

const bar = (date, close) => ({ date, open: close, high: close, low: close, close, adjClose: close, volume: 1000 });

const article = (publishedAt) => [{ title: "AAPL reports earnings", publishedAt, category: "Earnings", url: "https://example.com/a" }];

describe("computeMarketReaction", () => {
    it("is unavailable when there is no Earnings-category news at all", () => {
        const result = computeMarketReaction([], [bar("2026-02-01", 100)]);
        expect(result.available).toBe(false);
        expect(result.reason).toMatch(/no earnings-category news/i);
    });

    it("is unavailable when there is no price history at all", () => {
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), []);
        expect(result.available).toBe(false);
        expect(result.reason).toMatch(/no market price history/i);
    });

    it("is unavailable when every bar is before the news date (no trading data since)", () => {
        const bars = [bar("2026-01-01", 100), bar("2026-01-02", 101)];
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), bars);
        expect(result.available).toBe(false);
        expect(result.reason).toMatch(/on or after/i);
    });

    it("is unavailable when the news date is on/before the very first available bar (no baseline to measure from)", () => {
        const bars = [bar("2026-02-01", 100), bar("2026-02-02", 105)];
        const result = computeMarketReaction(article("2026-01-15T00:00:00.000Z"), bars);
        expect(result.available).toBe(false);
        expect(result.reason).toMatch(/before the earnings-related news date/i);
    });

    it("computes the 1-day return as the move from the last close before the news to the first close on/after it", () => {
        const bars = [bar("2026-01-30", 100), bar("2026-02-02", 110), bar("2026-02-03", 111)];
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), bars);

        expect(result.available).toBe(true);
        expect(result.anchorDate).toBe("2026-02-02");
        expect(result.oneDayReturnPercent).toBe(10); // 100 -> 110
        expect(result.basis).toBe(MARKET_REACTION_BASIS);
    });

    it("computes the 5-day return across a 5-trading-session window from the same baseline", () => {
        const bars = [
            bar("2026-01-30", 100), // baseline
            bar("2026-02-02", 105), // reaction day (anchor)
            bar("2026-02-03", 106),
            bar("2026-02-04", 107),
            bar("2026-02-05", 108),
            bar("2026-02-06", 120), // 5 sessions after baseline
        ];
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), bars);

        expect(result.fiveDayReturnPercent).toBe(20); // 100 -> 120
    });

    it("leaves fiveDayReturnPercent null when fewer than 5 sessions of data exist after the baseline, but still reports the 1-day return", () => {
        const bars = [bar("2026-01-30", 100), bar("2026-02-02", 110)];
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), bars);

        expect(result.available).toBe(true);
        expect(result.oneDayReturnPercent).toBe(10);
        expect(result.fiveDayReturnPercent).toBeNull();
    });

    it("never claims the anchor date is the earnings release date - reason/basis describe the news article instead", () => {
        const bars = [bar("2026-01-30", 100), bar("2026-02-02", 110)];
        const result = computeMarketReaction(article("2026-02-01T00:00:00.000Z"), bars);

        expect(result.basis).toMatch(/earnings-category news article/i);
        expect(result.basis).not.toMatch(/release date/i);
    });

    it("treats a missing publishedAt on the article as no usable anchor", () => {
        const result = computeMarketReaction([{ title: "no date" }], [bar("2026-02-01", 100)]);
        expect(result.available).toBe(false);
    });
});

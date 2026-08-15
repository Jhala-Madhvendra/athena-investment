const { titleSimilarity, findDuplicate } = require("../news.deduplicator");

describe("titleSimilarity", () => {
    it("scores identical titles as fully similar", () => {
        expect(titleSimilarity("Apple reports record earnings", "Apple reports record earnings")).toBe(1);
    });

    it("scores unrelated titles as dissimilar", () => {
        expect(titleSimilarity("Apple reports record earnings", "Weather forecast for the weekend")).toBeLessThan(0.3);
    });

    it("returns 0 for empty input", () => {
        expect(titleSimilarity("", "Apple reports earnings")).toBe(0);
    });
});

describe("findDuplicate", () => {
    const existing = [
        {
            _id: "existing-1",
            provider: "yahoo",
            providerArticleId: "uuid-1",
            canonicalUrl: "https://example.com/story-1",
            title: "Apple reports record quarterly earnings",
            publishedAt: "2026-08-10T09:00:00.000Z",
        },
    ];

    it("matches on providerArticleId + provider", () => {
        const candidate = {
            provider: "yahoo",
            providerArticleId: "uuid-1",
            canonicalUrl: "https://example.com/different-link",
            title: "A totally different headline",
            publishedAt: "2026-08-10T10:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBe(existing[0]);
    });

    it("does not match providerArticleId across different providers", () => {
        const candidate = {
            provider: "marketaux",
            providerArticleId: "uuid-1",
            canonicalUrl: "https://example.com/different-link",
            title: "A totally different headline",
            publishedAt: "2026-08-10T10:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBeNull();
    });

    it("matches on canonicalUrl when providerArticleId is absent", () => {
        const candidate = {
            provider: "marketaux",
            providerArticleId: null,
            canonicalUrl: "https://example.com/story-1",
            title: "Different headline, same link",
            publishedAt: "2026-08-10T10:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBe(existing[0]);
    });

    it("matches on same-day title similarity as a last resort", () => {
        const candidate = {
            provider: "marketaux",
            providerArticleId: null,
            canonicalUrl: "https://example.com/a-different-syndicated-link",
            title: "Apple reports record quarterly earnings",
            publishedAt: "2026-08-10T18:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBe(existing[0]);
    });

    it("matches on same-day title similarity when the existing article's publishedAt is a Date instance, not a string", () => {
        // Regression: NewsArticle.find(...).lean() returns publishedAt as a
        // native Date for anything read back from Mongo, while a
        // not-yet-persisted candidate carries an ISO string - isSameDay
        // must handle both without throwing.
        const existingWithDateObject = [
            { ...existing[0], publishedAt: new Date("2026-08-10T09:00:00.000Z") },
        ];
        const candidate = {
            provider: "marketaux",
            providerArticleId: null,
            canonicalUrl: "https://example.com/a-different-syndicated-link",
            title: "Apple reports record quarterly earnings",
            publishedAt: "2026-08-10T18:00:00.000Z",
        };

        expect(findDuplicate(candidate, existingWithDateObject)).toBe(existingWithDateObject[0]);
    });

    it("does not match similar titles published on different days", () => {
        const candidate = {
            provider: "marketaux",
            providerArticleId: null,
            canonicalUrl: "https://example.com/a-different-syndicated-link",
            title: "Apple reports record quarterly earnings",
            publishedAt: "2026-08-12T18:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBeNull();
    });

    it("returns null when nothing matches", () => {
        const candidate = {
            provider: "yahoo",
            providerArticleId: "uuid-999",
            canonicalUrl: "https://example.com/unrelated",
            title: "Completely unrelated news",
            publishedAt: "2026-08-10T18:00:00.000Z",
        };

        expect(findDuplicate(candidate, existing)).toBeNull();
    });
});

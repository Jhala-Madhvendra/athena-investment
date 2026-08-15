const { normalizeArticle, normalizeArticles, canonicalizeUrl } = require("../news.normalizer");

const baseContext = { providerName: "yahoo", ticker: "AAPL", companyName: "Apple Inc." };

describe("normalizeArticle - yahoo", () => {
    it("maps a well-formed Yahoo article into Athena's internal schema", () => {
        const raw = {
            uuid: "abc-123",
            title: "Apple reports record quarterly earnings",
            publisher: "Reuters",
            link: "https://finance.yahoo.com/news/apple-earnings.html?utm_source=twitter",
            providerPublishTime: 1750000000,
            thumbnail: { resolutions: [{ url: "https://example.com/thumb.jpg" }] },
            relatedTickers: ["AAPL", "MSFT"],
        };

        const result = normalizeArticle(raw, baseContext);

        expect(result.title).toBe("Apple reports record quarterly earnings");
        expect(result.source).toBe("Reuters");
        expect(result.url).toBe(raw.link);
        expect(result.canonicalUrl).not.toContain("utm_source");
        expect(result.provider).toBe("yahoo");
        expect(result.providerArticleId).toBe("abc-123");
        expect(result.ticker).toBe("AAPL");
        expect(result.companyName).toBe("Apple Inc.");
        expect(result.description).toBeNull();
        expect(result.imageUrl).toBe("https://example.com/thumb.jpg");
        expect(new Date(result.publishedAt).getTime()).toBe(1750000000 * 1000);
        expect(result.retrievedAt).toBeTruthy();
    });

    it("drops an article missing a title", () => {
        const raw = { link: "https://example.com/a", providerPublishTime: 1750000000 };
        expect(normalizeArticle(raw, baseContext)).toBeNull();
    });

    it("drops an article missing a url", () => {
        const raw = { title: "Headline", providerPublishTime: 1750000000 };
        expect(normalizeArticle(raw, baseContext)).toBeNull();
    });

    it("drops an article missing a publish time", () => {
        const raw = { title: "Headline", link: "https://example.com/a" };
        expect(normalizeArticle(raw, baseContext)).toBeNull();
    });
});

describe("normalizeArticle - marketaux", () => {
    it("maps a well-formed Marketaux article, preferring description over snippet", () => {
        const raw = {
            uuid: "mtx-1",
            title: "Apple announces new partnership",
            description: "Apple confirmed a new strategic partnership.",
            snippet: "short snippet",
            url: "https://example.com/mtx-article",
            image_url: "https://example.com/img.jpg",
            published_at: "2026-08-10T12:00:00.000Z",
            source: "Bloomberg",
            entities: [{ symbol: "AAPL" }, { symbol: "MSFT" }],
        };

        const result = normalizeArticle(raw, { ...baseContext, providerName: "marketaux" });

        expect(result.description).toBe("Apple confirmed a new strategic partnership.");
        expect(result.source).toBe("Bloomberg");
        expect(result.relatedTickers).toEqual(["AAPL", "MSFT"]);
        expect(result.publishedAt).toBe("2026-08-10T12:00:00.000Z");
    });
});

describe("normalizeArticles", () => {
    it("filters out unusable raw items and keeps the rest", () => {
        const rawArticles = [
            { title: "Good", link: "https://example.com/1", providerPublishTime: 1750000000 },
            { title: "Missing url", providerPublishTime: 1750000000 },
        ];

        const result = normalizeArticles(rawArticles, baseContext);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Good");
    });

    it("returns an empty array for an unusable input", () => {
        expect(normalizeArticles(null, baseContext)).toEqual([]);
        expect(normalizeArticles(undefined, baseContext)).toEqual([]);
    });
});

describe("canonicalizeUrl", () => {
    it("strips utm tracking params and trailing slashes", () => {
        const a = canonicalizeUrl("https://Example.com/news/story/?utm_source=x&utm_medium=y");
        const b = canonicalizeUrl("https://example.com/news/story");

        expect(a).toBe(b);
    });

    it("falls back to the raw string for an unparseable url", () => {
        expect(canonicalizeUrl("not-a-url")).toBe("not-a-url");
    });
});

const express = require("express");
const request = require("supertest");

jest.mock("../news.service", () => ({
    getNews: jest.fn(),
    getCategorySummary: jest.fn(),
    refreshNews: jest.fn(),
}));
jest.mock("../../services/company.service", () => ({ resolveTicker: jest.fn() }));

const newsService = require("../news.service");
const companyService = require("../../services/company.service");
const newsRoutes = require("../news.routes");

const app = express();
app.use(express.json());
app.use("/api/news", newsRoutes);

afterEach(() => {
    jest.clearAllMocks();
});

describe("GET /api/news/:ticker", () => {
    it("returns 404 when the ticker cannot be resolved to a company", async () => {
        companyService.resolveTicker.mockResolvedValue(null);

        const response = await request(app).get("/api/news/ZZZZ");

        expect(response.status).toBe(404);
        expect(newsService.getNews).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid category, without calling the service", async () => {
        const response = await request(app).get("/api/news/AAPL?category=Rumors");

        expect(response.status).toBe(400);
        expect(newsService.getNews).not.toHaveBeenCalled();
    });

    it("returns 400 for an out-of-range limit", async () => {
        const response = await request(app).get("/api/news/AAPL?limit=1000");

        expect(response.status).toBe(400);
    });

    it("returns normalized news for a resolved ticker", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        newsService.getNews.mockResolvedValue({
            ticker: "AAPL",
            articles: [{ title: "Apple reports earnings" }],
            lastRefreshedAt: "2026-08-15T00:00:00.000Z",
            provider: "yahoo",
        });

        const response = await request(app).get("/api/news/aapl?limit=10&category=Earnings");

        expect(response.status).toBe(200);
        expect(response.body.articles).toHaveLength(1);
        expect(newsService.getNews).toHaveBeenCalledWith("AAPL", {
            limit: 10,
            category: "Earnings",
            from: undefined,
            to: undefined,
        });
    });

    it("returns 502 when the news service fails unexpectedly", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        newsService.getNews.mockRejectedValue(new Error("Provider unavailable"));

        const response = await request(app).get("/api/news/AAPL");

        expect(response.status).toBe(502);
    });

    it("propagates a service error's own statusCode instead of the fallback", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        const notFound = new Error("Company AAPL was not found.");
        notFound.statusCode = 404;
        newsService.getNews.mockRejectedValue(notFound);

        const response = await request(app).get("/api/news/AAPL");

        expect(response.status).toBe(404);
    });
});

describe("GET /api/news/:ticker/categories", () => {
    it("returns category counts", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        newsService.getCategorySummary.mockResolvedValue({
            ticker: "AAPL",
            categories: [{ category: "Earnings", count: 2 }],
            total: 2,
        });

        const response = await request(app).get("/api/news/AAPL/categories");

        expect(response.status).toBe(200);
        expect(response.body.total).toBe(2);
    });
});

describe("POST /api/news/:ticker/refresh", () => {
    it("triggers a live refresh and returns the summary", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        newsService.refreshNews.mockResolvedValue({
            ticker: "AAPL",
            inserted: 2,
            merged: 1,
            lastRefreshedAt: "2026-08-15T00:00:00.000Z",
            provider: "yahoo",
        });

        const response = await request(app).post("/api/news/AAPL/refresh");

        expect(response.status).toBe(200);
        expect(response.body.inserted).toBe(2);
        expect(newsService.refreshNews).toHaveBeenCalledWith("AAPL");
    });

    it("returns 502 when the refresh fails", async () => {
        companyService.resolveTicker.mockResolvedValue("AAPL");
        newsService.refreshNews.mockRejectedValue(new Error("Provider timed out"));

        const response = await request(app).post("/api/news/AAPL/refresh");

        expect(response.status).toBe(502);
    });
});

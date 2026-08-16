const {
    formatIndustryResponse,
    formatPeersResponse,
    formatMetricsResponse,
    formatDiscoveryResponse,
    formatImportResponse,
} = require("../industry.formatter");

const benchmarkEntry = (overrides = {}) => ({
    metric: "operatingMargin",
    label: "Operating Margin",
    unit: "percent",
    category: "profitability",
    dataType: "financial",
    company: 28,
    companyExclusionReason: null,
    universe: { available: true, count: 5, mean: 20, median: 21, min: 10, max: 30, p25: 15, p75: 25 },
    comparison: { available: true, companyValue: 28, universeMedian: 21, difference: 7, relative: null, unit: "percent", note: "+7.0 percentage points versus the industry median." },
    percentile: 78,
    classification: "strength",
    ...overrides,
});

describe("industry.formatter.formatIndustryResponse", () => {
    const baseResult = {
        ticker: "AAPL",
        company: "Apple Inc.",
        sector: "Technology",
        industry: "Software",
        universe: { level: "industry", key: "Software", size: 5, note: "Industry benchmark based on 5 tracked companies." },
        dataFreshness: { financialPeriod: 2025, financialStatementSource: "yahoo", marketDataAsOf: "2026-08-16T00:00:00.000Z" },
        benchmarks: [
            benchmarkEntry(),
            benchmarkEntry({ metric: "revenueGrowth", label: "Revenue Growth", category: "growth", classification: "neutral" }),
            benchmarkEntry({ metric: "pe", label: "P/E", category: "valuation", unit: "multiple", classification: "not_classified", comparison: { available: true, companyValue: 27, universeMedian: 23, difference: null, relative: 1.17, unit: "multiple", note: "Trading at 1.17x the industry median." } }),
            benchmarkEntry({ metric: "netMargin", label: "Net Margin", category: "profitability", classification: "weakness", comparison: { available: true, companyValue: 10, universeMedian: 18, difference: -8, relative: null, unit: "percent", note: "-8.0 percentage points versus the industry median." } }),
        ],
    };

    it("exposes exactly the top-level fields the Sprint 13 API contract requires", () => {
        const response = formatIndustryResponse(baseResult);

        expect(Object.keys(response)).toEqual(
            expect.arrayContaining([
                "ticker", "company", "sector", "industry", "universe", "benchmarks", "positioning",
                "strengths", "weaknesses", "growthComparison", "profitabilityComparison", "valuationComparison",
            ])
        );
    });

    it("groups benchmarks into growth/profitability/valuation comparison tables by category", () => {
        const response = formatIndustryResponse(baseResult);

        expect(response.growthComparison).toHaveLength(1);
        expect(response.growthComparison[0].metric).toBe("revenueGrowth");
        expect(response.profitabilityComparison.map((e) => e.metric).sort()).toEqual(["netMargin", "operatingMargin"]);
        expect(response.valuationComparison).toHaveLength(1);
        expect(response.valuationComparison[0].metric).toBe("pe");
    });

    it("only surfaces strengths/weaknesses classified as such, never valuation multiples", () => {
        const response = formatIndustryResponse(baseResult);

        expect(response.strengths.map((e) => e.metric)).toEqual(["operatingMargin"]);
        expect(response.weaknesses.map((e) => e.metric)).toEqual(["netMargin"]);
    });

    it("reports the difference for percent metrics and the relative multiple for valuation, never both", () => {
        const response = formatIndustryResponse(baseResult);
        const pe = response.valuationComparison[0];

        expect(pe.difference).toBeNull();
        expect(pe.relative).toBeCloseTo(1.17);

        const operatingMargin = response.profitabilityComparison.find((e) => e.metric === "operatingMargin");
        expect(operatingMargin.difference).toBe(7);
        expect(operatingMargin.relative).toBeNull();
    });

    it("carries the universe note through to the response for transparency about the reference set", () => {
        const response = formatIndustryResponse(baseResult);
        expect(response.universe.note).toMatch(/5 tracked companies/);
    });

    it("never labels the response with a buy/sell recommendation", () => {
        const response = formatIndustryResponse(baseResult);
        const serialized = JSON.stringify(response).toLowerCase();
        expect(serialized).not.toMatch(/\bbuy\b|\bsell\b|strong buy|strong sell/);
    });
});

describe("industry.formatter.formatPeersResponse", () => {
    it("shapes suggested peers with the fields the Potential Peers table needs", () => {
        const response = formatPeersResponse({
            target: { ticker: "AAPL" },
            universe: { level: "industry", key: "Software", size: 5, note: "note" },
            suggestedPeers: [
                { ticker: "MSFT", name: "Microsoft", sector: "Technology", industry: "Software", marketCap: 3000, metrics: { revenueGrowth: { value: 12 }, operatingMargin: { value: 40 }, pe: { value: 30 } } },
            ],
        });

        expect(response.peers).toEqual([
            { ticker: "MSFT", name: "Microsoft", sector: "Technology", industry: "Software", marketCap: 3000, revenueGrowth: 12, operatingMargin: 40, pe: 30 },
        ]);
        expect(response.limitation).toMatch(/not.*canonical peer set/i);
    });
});

describe("industry.formatter.formatMetricsResponse", () => {
    it("flattens the metric catalog into an array with the metric key attached", () => {
        const response = formatMetricsResponse({ ticker: "AAPL", metrics: { pe: { label: "P/E", unit: "multiple", category: "valuation", type: "market" } } });
        expect(response.metrics).toEqual([{ metric: "pe", label: "P/E", unit: "multiple", category: "valuation", type: "market" }]);
    });
});

describe("industry.formatter.formatDiscoveryResponse", () => {
    it("shapes candidates and carries the not-yet-reviewed limitation notice", () => {
        const response = formatDiscoveryResponse({
            classificationLevel: "industry",
            classificationValue: "Consumer Electronics",
            candidates: [{ ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000, volume: 123 }],
        });

        expect(response.classificationLevel).toBe("industry");
        expect(response.candidates).toEqual([{ ticker: "SONY", name: "Sony Group Corporation", exchange: "TYO", marketCap: 1000 }]);
        expect(response.limitation).toMatch(/not yet tracked/i);
        expect(response.limitation).toMatch(/not.*curated or verified/i);
    });
});

describe("industry.formatter.formatImportResponse", () => {
    it("buckets results into imported, partial, and failed", () => {
        const response = formatImportResponse([
            { ticker: "SONY", companyImported: true, financialsImported: true, error: null },
            { ticker: "LG", companyImported: true, financialsImported: false, error: "Company imported, but financial statements could not be imported: no data." },
            { ticker: "ZZZZ", companyImported: false, financialsImported: false, error: "Company could not be found." },
        ]);

        expect(response.imported).toEqual(["SONY"]);
        expect(response.partial.map((r) => r.ticker)).toEqual(["LG"]);
        expect(response.failed.map((r) => r.ticker)).toEqual(["ZZZZ"]);
    });
});

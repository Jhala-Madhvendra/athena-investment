const FinancialDataProvider = require("../financialDataProvider");
const mapYahooFinanceCompany = require("./yahooFinance.mapper");
const fetchWithTimeout = require("../../utils/fetchWithTimeout");
const getYahooAuthentication = require("./yahooAuth");

class YahooFinanceProvider extends FinancialDataProvider {
    async getCompanyProfile(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();
        const { cookie, crumb } = await this.getAuthentication();
        const url = new URL(
            `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(normalizedTicker)}`
        );

        url.searchParams.set("modules", "assetProfile,price");
        url.searchParams.set("crumb", crumb);

        const response = await fetchWithTimeout(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
                Cookie: cookie,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Yahoo Finance request failed for ${normalizedTicker} with status ${response.status}.`
            );
        }

        const yahooResponse = await response.json();

        if (yahooResponse.quoteSummary?.error) {
            throw new Error(
                yahooResponse.quoteSummary.error.description ||
                    `Yahoo Finance could not find ${normalizedTicker}.`
            );
        }

        const company = mapYahooFinanceCompany(yahooResponse, normalizedTicker);

        if (!company || !company.name) {
            throw new Error(`Yahoo Finance returned no company profile for ${normalizedTicker}.`);
        }

        return company;
    }

    async searchTickerByName(name) {
        const normalizedName = name.trim();
        const lowerQuery = normalizedName.toLowerCase();
        const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");

        url.searchParams.set("q", normalizedName);
        url.searchParams.set("quotesCount", "20");
        url.searchParams.set("newsCount", "0");

        const response = await fetchWithTimeout(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(
                `Yahoo Finance search request failed for ${normalizedName} with status ${response.status}.`
            );
        }

        const yahooResponse = await response.json();
        const quotes = Array.isArray(yahooResponse.quotes) ? yahooResponse.quotes : [];
        const candidates = quotes.filter(
            (item) => item?.quoteType === "EQUITY" || item?.quoteType === "ETF"
        );

        const exactSymbol = candidates.find(
            (item) => item.symbol?.toLowerCase() === lowerQuery
        );
        if (exactSymbol) {
            return exactSymbol.symbol.toUpperCase();
        }

        const exactName = candidates.find((item) => {
            const itemName = `${item.longname || ""}`.trim().toLowerCase();
            return itemName === lowerQuery;
        });
        if (exactName) {
            return exactName.symbol.toUpperCase();
        }

        const scored = candidates
            .map((item) => {
                const symbol = item.symbol?.toUpperCase() || "";
                const lowerSymbol = symbol.toLowerCase();
                const itemName = `${item.longname || ""}`.trim().toLowerCase();
                const itemShort = `${item.shortname || ""}`.trim().toLowerCase();
                let score = 0;

                if (lowerSymbol.includes(lowerQuery)) {
                    score += 40;
                }
                if (itemName.includes(lowerQuery)) {
                    score += 30;
                }
                if (itemShort.includes(lowerQuery)) {
                    score += 10;
                }
                if (lowerSymbol.startsWith(lowerQuery) && !lowerSymbol.includes(".")) {
                    score += 20;
                }
                if (lowerSymbol.startsWith(lowerQuery) && lowerSymbol.includes(".")) {
                    score += 10;
                }
                if (item.exchange === "NMS" || item.exchange === "NAS" || item.exchange === "NYQ") {
                    score += 20;
                }
                if (!lowerSymbol.includes('.')) {
                    score += 10;
                }

                return { item, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        return scored[0]?.item?.symbol?.toUpperCase() || candidates[0]?.symbol?.toUpperCase() || null;
    }

    async getAuthentication() {
        return getYahooAuthentication();
    }

    /**
     * Queries Yahoo's unofficial equity screener for companies sharing a
     * sector/industry classification - the same reverse-engineered,
     * cookie+crumb-authenticated pattern already used for getCompanyProfile
     * and searchTickerByName, just against a different Yahoo endpoint.
     * Prefers `industry` (finer-grained) and falls back to `sector` only
     * when no industry classification is available, mirroring
     * industry.peerDiscovery.js's own industry-then-sector fallback.
     *
     * @param {{industry: string|null, sector: string|null, limit?: number}} params
     * @returns {Promise<Array<{ticker, name, exchange, marketCap}>>} deduplicated candidates (see yahooFinance.mapper.mapYahooScreenerCandidates)
     */
    async searchCompaniesByClassification({ industry, sector, limit = 50 }) {
        const classificationField = industry ? "industry" : sector ? "sector" : null;
        const classificationValue = industry || sector;

        if (!classificationField) {
            return [];
        }

        const { cookie, crumb } = await this.getAuthentication();
        const url = new URL("https://query1.finance.yahoo.com/v1/finance/screener");
        url.searchParams.set("crumb", crumb);
        url.searchParams.set("lang", "en-US");
        url.searchParams.set("region", "US");

        const requestBody = {
            size: limit,
            offset: 0,
            sortField: "intradaymarketcap",
            sortType: "desc",
            quoteType: "EQUITY",
            query: { operator: "eq", operands: [classificationField, classificationValue] },
        };

        const response = await fetchWithTimeout(url, {
            method: "POST",
            headers: {
                "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
                "Content-Type": "application/json",
                Accept: "application/json",
                Cookie: cookie,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Yahoo Finance screener request failed with status ${response.status}.`);
        }

        const yahooResponse = await response.json();
        return mapYahooFinanceCompany.mapYahooScreenerCandidates(yahooResponse);
    }
}

module.exports = YahooFinanceProvider;

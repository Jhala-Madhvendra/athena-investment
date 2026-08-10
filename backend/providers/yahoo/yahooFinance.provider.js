const FinancialDataProvider = require("../financialDataProvider");
const mapYahooFinanceCompany = require("./yahooFinance.mapper");
const fetchWithTimeout = require("../../utils/fetchWithTimeout");

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
        const headers = {
            "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
        };
        const cookieResponse = await fetchWithTimeout("https://fc.yahoo.com", {
            headers,
            redirect: "manual",
        });
        const rawCookie = cookieResponse.headers.getSetCookie
            ? cookieResponse.headers.getSetCookie()[0]
            : cookieResponse.headers.get("set-cookie");
        const cookie = rawCookie?.split(";")[0];

        if (!cookie) {
            throw new Error("Yahoo Finance authentication cookie could not be retrieved.");
        }

        const crumbResponse = await fetchWithTimeout(
            "https://query1.finance.yahoo.com/v1/test/getcrumb",
            { headers: { ...headers, Cookie: cookie } }
        );

        if (!crumbResponse.ok) {
            throw new Error("Yahoo Finance authentication crumb could not be retrieved.");
        }

        const crumb = await crumbResponse.text();

        if (!crumb) {
            throw new Error("Yahoo Finance returned an empty authentication crumb.");
        }

        return { cookie, crumb };
    }
}

module.exports = YahooFinanceProvider;

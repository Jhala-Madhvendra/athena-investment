const FinancialDataProvider = require("../financialDataProvider");
const { twelveDataGet } = require("./twelveDataClient");

const PREFERRED_US_EXCHANGES = new Set(["NASDAQ", "NYSE", "NYSE MKT", "AMEX"]);

class TwelveDataFinancialDataProvider extends FinancialDataProvider {
    async getCompanyProfile(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();
        let profile;

        try {
            profile = await twelveDataGet("/profile", { symbol: normalizedTicker });
        } catch (error) {
            throw new Error(`Twelve Data returned no company profile for ${normalizedTicker}.`);
        }

        if (!profile?.name) {
            throw new Error(`Twelve Data returned no company profile for ${normalizedTicker}.`);
        }

        let quote = null;
        let statistics = null;

        try {
            [quote, statistics] = await Promise.all([
                twelveDataGet("/quote", { symbol: normalizedTicker }),
                twelveDataGet("/statistics", { symbol: normalizedTicker }),
            ]);
        } catch (error) {
            // Profile is the source of truth here; quote/statistics only add
            // currency and marketCap, so a failure here shouldn't fail the import.
        }

        return {
            ticker: profile.symbol || normalizedTicker,
            name: profile.name,
            exchange: profile.exchange,
            sector: profile.sector ?? null,
            industry: profile.industry ?? null,
            country: profile.country ?? null,
            currency: quote?.currency ?? null,
            website: profile.website ?? null,
            marketCap: statistics?.statistics?.valuations_metrics?.market_capitalization ?? null,
            employees: profile.employees ?? null,
            description: profile.description ?? null,
            logo: null,
        };
    }

    async searchTickerByName(name) {
        const normalizedName = name.trim();
        const lowerQuery = normalizedName.toLowerCase();

        let response;

        try {
            response = await twelveDataGet("/symbol_search", { symbol: normalizedName, outputsize: 20 });
        } catch (error) {
            return null;
        }

        const candidates = (response?.data || []).filter(
            (item) =>
                item.country === "United States" &&
                (item.instrument_type === "Common Stock" || item.instrument_type === "ETF")
        );

        if (!candidates.length) {
            return null;
        }

        const exactSymbol = candidates.find((item) => item.symbol?.toLowerCase() === lowerQuery);
        if (exactSymbol) {
            return exactSymbol.symbol.toUpperCase();
        }

        const exactName = candidates.find(
            (item) => `${item.instrument_name || ""}`.trim().toLowerCase() === lowerQuery
        );
        if (exactName) {
            return exactName.symbol.toUpperCase();
        }

        const scored = candidates
            .map((item) => {
                const symbol = (item.symbol || "").toUpperCase();
                const lowerSymbol = symbol.toLowerCase();
                const itemName = `${item.instrument_name || ""}`.trim().toLowerCase();
                let score = 0;

                if (lowerSymbol.includes(lowerQuery)) {
                    score += 40;
                }
                if (itemName.includes(lowerQuery)) {
                    score += 30;
                }
                if (lowerSymbol.startsWith(lowerQuery)) {
                    score += 20;
                }
                if (PREFERRED_US_EXCHANGES.has(item.exchange)) {
                    score += 20;
                }

                return { item, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score);

        return scored[0]?.item?.symbol?.toUpperCase() || candidates[0]?.symbol?.toUpperCase() || null;
    }
}

module.exports = TwelveDataFinancialDataProvider;

const MarketDataProvider = require("../../market/providers/marketData.provider");
const { twelveDataGet, isRateLimitError } = require("./twelveDataClient");

const rateLimitError = () => {
    const error = new Error("Twelve Data rate limit reached. Please try again in a moment.");
    error.statusCode = 429;
    return error;
};

const toNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const RANGE_TO_OFFSET = {
    "1mo": { months: 1 },
    "3mo": { months: 3 },
    "6mo": { months: 6 },
    "1y": { years: 1 },
    "5y": { years: 5 },
};

const getStartDate = (range) => {
    const offset = RANGE_TO_OFFSET[range] || { years: 5 };
    const date = new Date();

    if (offset.years) {
        date.setUTCFullYear(date.getUTCFullYear() - offset.years);
    }
    if (offset.months) {
        date.setUTCMonth(date.getUTCMonth() - offset.months);
    }

    return date.toISOString().slice(0, 10);
};

const mapQuote = (quote, statistics, requestedTicker) => {
    if (!quote) {
        return null;
    }

    const stats = statistics?.statistics || {};
    const valuationMetrics = stats.valuations_metrics || {};
    const priceSummary = stats.stock_price_summary || {};
    const dividends = stats.dividends_and_splits || {};
    const incomeStats = stats.financials?.income_statement || {};

    return {
        ticker: quote.symbol || requestedTicker,
        currency: quote.currency ?? null,
        price: {
            current: toNumber(quote.close),
            previousClose: toNumber(quote.previous_close),
            open: toNumber(quote.open),
            dayHigh: toNumber(quote.high),
            dayLow: toNumber(quote.low),
            fiftyTwoWeekHigh: toNumber(quote.fifty_two_week?.high) ?? toNumber(priceSummary.fifty_two_week_high),
            fiftyTwoWeekLow: toNumber(quote.fifty_two_week?.low) ?? toNumber(priceSummary.fifty_two_week_low),
            volume: toNumber(quote.volume),
            averageVolume: toNumber(quote.average_volume),
            marketCap: toNumber(valuationMetrics.market_capitalization),
        },
        valuation: {
            peRatio: toNumber(valuationMetrics.trailing_pe),
            forwardPE: toNumber(valuationMetrics.forward_pe),
            priceToBook: toNumber(valuationMetrics.price_to_book_mrq),
            eps: toNumber(incomeStats.diluted_eps_ttm),
            forwardEps: null,
        },
        dividend: {
            yield: toNumber(dividends.trailing_annual_dividend_yield),
            rate: toNumber(dividends.trailing_annual_dividend_rate),
        },
        riskMetrics: {
            beta: toNumber(priceSummary.beta),
        },
        asOf: new Date().toISOString(),
    };
};

class TwelveDataMarketDataProvider extends MarketDataProvider {
    async getQuote(ticker) {
        const normalizedTicker = ticker.trim().toUpperCase();
        let quote;

        try {
            quote = await twelveDataGet("/quote", { symbol: normalizedTicker });
        } catch (error) {
            if (isRateLimitError(error)) {
                throw rateLimitError();
            }
            throw new Error(`Twelve Data could not find ${normalizedTicker}.`);
        }

        let statistics = null;

        try {
            statistics = await twelveDataGet("/statistics", { symbol: normalizedTicker });
        } catch (error) {
            // Statistics only supplies valuation/dividend/beta extras - quote alone is still usable.
        }

        const mapped = mapQuote(quote, statistics, normalizedTicker);

        if (!mapped) {
            throw new Error(`Twelve Data returned no market data for ${normalizedTicker}.`);
        }

        return mapped;
    }

    async getHistoricalPrices(ticker, range) {
        const normalizedTicker = ticker.trim().toUpperCase();
        let response;

        try {
            response = await twelveDataGet("/time_series", {
                symbol: normalizedTicker,
                interval: "1day",
                start_date: getStartDate(range),
                order: "ASC",
            });
        } catch (error) {
            if (isRateLimitError(error)) {
                throw rateLimitError();
            }
            throw new Error(`Twelve Data could not find historical prices for ${normalizedTicker}.`);
        }

        const values = response?.values || [];

        return values
            .map((bar) => {
                const close = toNumber(bar.close);

                if (close === null) {
                    return null;
                }

                return {
                    date: bar.datetime,
                    open: toNumber(bar.open),
                    high: toNumber(bar.high),
                    low: toNumber(bar.low),
                    close,
                    adjClose: null,
                    volume: toNumber(bar.volume),
                };
            })
            .filter(Boolean);
    }
}

module.exports = TwelveDataMarketDataProvider;

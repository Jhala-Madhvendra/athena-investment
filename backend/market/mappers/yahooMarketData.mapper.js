const getValue = (value) => {
    if (value && typeof value === "object" && "raw" in value) {
        return value.raw;
    }

    return typeof value === "number" ? value : null;
};

/** Yahoo's regularMarketTime is raw epoch seconds when present - converts to ISO, falling back to fetch-time only when Yahoo didn't supply one. */
const getMarketTime = (rawMarketTime) => {
    const epochSeconds = getValue(rawMarketTime);
    return typeof epochSeconds === "number" ? new Date(epochSeconds * 1000).toISOString() : new Date().toISOString();
};

const mapYahooQuote = (response, requestedTicker) => {
    const quoteSummary = response?.quoteSummary?.result?.[0];

    if (!quoteSummary) {
        return null;
    }

    const price = quoteSummary.price || {};
    const summaryDetail = quoteSummary.summaryDetail || {};
    const keyStatistics = quoteSummary.defaultKeyStatistics || {};

    return {
        ticker: requestedTicker,
        currency: price.currency ?? summaryDetail.currency ?? null,
        price: {
            current: getValue(price.regularMarketPrice),
            previousClose: getValue(summaryDetail.previousClose) ?? getValue(price.regularMarketPreviousClose),
            open: getValue(summaryDetail.open) ?? getValue(price.regularMarketOpen),
            dayHigh: getValue(summaryDetail.dayHigh) ?? getValue(price.regularMarketDayHigh),
            dayLow: getValue(summaryDetail.dayLow) ?? getValue(price.regularMarketDayLow),
            fiftyTwoWeekHigh: getValue(summaryDetail.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: getValue(summaryDetail.fiftyTwoWeekLow),
            volume: getValue(summaryDetail.volume) ?? getValue(price.regularMarketVolume),
            averageVolume: getValue(summaryDetail.averageVolume),
            marketCap: getValue(summaryDetail.marketCap) ?? getValue(price.marketCap),
        },
        valuation: {
            peRatio: getValue(summaryDetail.trailingPE),
            forwardPE: getValue(summaryDetail.forwardPE),
            priceToBook: getValue(keyStatistics.priceToBook),
            eps: getValue(keyStatistics.trailingEps),
            forwardEps: getValue(keyStatistics.forwardEps),
        },
        dividend: {
            yield: getValue(summaryDetail.dividendYield),
            rate: getValue(summaryDetail.dividendRate),
        },
        riskMetrics: {
            beta: getValue(keyStatistics.beta),
        },
        // Prefers Yahoo's own reported quote timestamp (regularMarketTime,
        // raw epoch seconds) over "whenever Athena's mapper happened to run" -
        // the two are usually close given the short quote cache TTL, but
        // asOf should describe the market data's own freshness, not
        // Athena's fetch time, so staleness disclosure in the UI stays
        // honest even if a request is ever delayed after the actual fetch.
        asOf: getMarketTime(price.regularMarketTime),
    };
};

const mapYahooHistoricalPrices = (response) => {
    const result = response?.chart?.result?.[0];

    if (!result || !Array.isArray(result.timestamp)) {
        return [];
    }

    const quote = result.indicators?.quote?.[0] || {};
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose || [];

    return result.timestamp
        .map((timestamp, index) => {
            const close = quote.close?.[index];

            if (close === null || close === undefined) {
                return null;
            }

            return {
                date: new Date(timestamp * 1000).toISOString().slice(0, 10),
                open: quote.open?.[index] ?? null,
                high: quote.high?.[index] ?? null,
                low: quote.low?.[index] ?? null,
                close,
                adjClose: adjclose[index] ?? null,
                volume: quote.volume?.[index] ?? null,
            };
        })
        .filter(Boolean);
};

module.exports = { mapYahooQuote, mapYahooHistoricalPrices };

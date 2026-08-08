const getValue = (value) => {
    if (value && typeof value === "object" && "raw" in value) {
        return value.raw;
    }

    return typeof value === "number" ? value : null;
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
        asOf: new Date().toISOString(),
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

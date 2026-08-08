const getValue = (value) => {
    if (value && typeof value === "object") {
        // Yahoo sometimes returns a malformed/empty object (e.g. {} for an
        // ETF's marketCap) instead of the usual {raw, fmt} shape or a plain
        // null - only a genuine {raw} value is usable, anything else isn't.
        return "raw" in value ? value.raw : null;
    }

    return value ?? null;
};

const mapYahooFinanceCompany = (response, requestedTicker) => {
    const quoteSummary = response?.quoteSummary?.result?.[0] || response?.result?.[0];

    if (!quoteSummary) {
        return null;
    }

    const profile = quoteSummary.assetProfile || quoteSummary.summaryProfile || {};
    const price = quoteSummary.price || {};

    return {
        ticker: getValue(price.symbol) || requestedTicker.toUpperCase(),
        name: getValue(price.longName) || getValue(price.shortName),
        exchange: getValue(price.exchangeName) || getValue(price.fullExchangeName),
        sector: getValue(profile.sector),
        industry: getValue(profile.industry),
        country: getValue(profile.country),
        currency: getValue(price.currency),
        website: getValue(profile.website),
        marketCap: getValue(price.marketCap),
        employees: getValue(profile.fullTimeEmployees),
        description: getValue(profile.longBusinessSummary),
        logo: getValue(profile.logo_url) || getValue(quoteSummary.logo_url),
    };
};

module.exports = mapYahooFinanceCompany;

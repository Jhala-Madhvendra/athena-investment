/**
 * Cross-Company Screener
 *
 * Filters/ranks companies ALREADY in Athena's database (the organic
 * "reference universe" - see research/engineering/ReferenceUniverse.md and
 * industry.peerDiscovery.js's resolveReferenceUniverse, whose "only
 * companies with real imported financial statements count" pattern this
 * module reuses directly) by Health Score and financial ratios. Never a
 * live external scan - a company only appears here if some user has
 * already researched it into Athena's own Company + FinancialStatement
 * collections.
 *
 * COST BOUND
 * -----------
 * Every scored company triggers analysisService.calculateAnalysis, which
 * reads (and, on a cold cache, indirectly costs the operator via) a
 * financial-data fetch. Regardless of how broad the sector/industry filter
 * is, at most SCREENER_LIMIT_MAX companies are ever scored per request
 * (mirrors industry.discovery.js's DISCOVERY_LIMIT bound), and each scored
 * ticker's result is cached for SCREENER_CACHE_TTL_MS (same local
 * Map+TTL idiom as market.service.js's quoteCache - no shared cache
 * utility exists in this codebase yet).
 *
 * PRODUCT BOUNDARY
 * -----------------
 * Results are a sorted list, never a ranking framed as advice - copy stays
 * "sorted by," never "top picks" or "recommended." See
 * research/product/ProductBoundaries.md.
 */

const Company = require("../models/company.model");
const FinancialStatement = require("../financials/financials.model");
const analysisService = require("../analysis/analysis.service");
const ratioService = require("../ratio/ratio.service");
const fxRateProvider = require("../market/providers/fxRate.provider");

const SCREENER_CACHE_TTL_MS = 15 * 60 * 1000;
const OVERFETCH_MULTIPLIER = 3;

const screenerCache = new Map();

const DISCLAIMER =
    "This is a sorted list based on Athena's Health Score and financial ratios, not investment advice or a ranking of quality. Health Score methodology is documented alongside each company's own analysis.";

/**
 * Sector/industry only - minMarketCap/maxMarketCap are deliberately NOT
 * pushed down into this Mongo filter. Company.marketCap is stored in each
 * company's own native currency (see the earlier screenshot's "4432.5B USD"
 * next to "4413.3B INR"), so a raw $gte/$lte against it would silently
 * compare, say, an INR figure against a USD bound as if they were the same
 * unit - the exact cross-currency bug PortfolioCurrencyNormalization.md and
 * fxRate.provider.js's attachMarketCapUSD already exist to prevent
 * elsewhere (Industry peer discovery, AI auto-peer selection). Market cap
 * bounds are applied after fetching, once each candidate's marketCapUSD is
 * known - see applyMarketCapFilter below.
 */
const buildCompanyFilter = ({ sector, industry }) => {
    const filter = {};

    if (sector) filter.sector = sector;
    if (industry) filter.industry = industry;

    return filter;
};

/** Narrows candidates by USD-normalized market cap. A no-op (no FX lookups) when neither bound is set - the common case. */
const applyMarketCapFilter = async (candidates, minMarketCap, maxMarketCap) => {
    if (minMarketCap === null && maxMarketCap === null) {
        return candidates;
    }

    const withUSD = await fxRateProvider.attachMarketCapUSD(candidates);

    return withUSD.filter((company) => {
        if (company.marketCapUSD === null) return false;
        if (minMarketCap !== null && company.marketCapUSD < minMarketCap) return false;
        if (maxMarketCap !== null && company.marketCapUSD > maxMarketCap) return false;
        return true;
    });
};

/** Fetches (or reuses a cached) Health Score + ratios for one ticker. Never throws - a failure degrades to `{available: false, reason}` so one bad ticker never fails the whole screener request. */
const scoreCompany = async (ticker) => {
    const cached = screenerCache.get(ticker);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const [analysis, ratios] = await Promise.all([
        analysisService.calculateAnalysis(ticker, {}),
        ratioService.getRatiosByTicker(ticker).catch(() => null),
    ]);

    const data = analysis?.error
        ? { available: false, reason: analysis.error, healthScore: null, ratios: null }
        : { available: true, reason: null, healthScore: analysis.healthScore, ratios: ratios?.ratios ?? null };

    screenerCache.set(ticker, { data, expiresAt: Date.now() + SCREENER_CACHE_TTL_MS });
    return data;
};

const compareValues = (a, b, direction) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1; // nulls always sort last, regardless of direction
    if (b === null) return -1;

    const result = typeof a === "string" ? a.localeCompare(b) : a - b;
    return direction === "asc" ? result : -result;
};

const sortKeyFor = (company, sortBy) => {
    if (sortBy === "healthScore") return company.healthScore?.overall ?? null;
    if (sortBy === "marketCap") return company.marketCap ?? null;
    return company.name ?? null;
};

/**
 * @param {{sector: string|null, industry: string|null, minMarketCap: number|null, maxMarketCap: number|null, minHealthScore: number|null, maxHealthScore: number|null, sortBy: string, sortDirection: string, limit: number}} criteria
 */
const runScreener = async (criteria) => {
    const { sector, industry, minMarketCap, maxMarketCap, minHealthScore, maxHealthScore, sortBy, sortDirection, limit } = criteria;

    const filter = buildCompanyFilter(criteria);
    const candidates = await Company.find(filter)
        .select("ticker name sector industry marketCap currency exchange")
        .limit(limit * OVERFETCH_MULTIPLIER)
        .lean();

    const candidateTickers = candidates.map((c) => c.ticker);
    const tickersWithFinancials = new Set(
        candidateTickers.length ? await FinancialStatement.distinct("ticker", { ticker: { $in: candidateTickers } }) : []
    );

    const withFinancials = candidates.filter((c) => tickersWithFinancials.has(c.ticker));
    const universeMatched = await applyMarketCapFilter(withFinancials, minMarketCap, maxMarketCap);
    const universeMatchedCount = universeMatched.length;
    const toScore = universeMatched.slice(0, limit);

    const scored = await Promise.all(
        toScore.map(async (company) => {
            const { available, reason, healthScore, ratios } = await scoreCompany(company.ticker);
            return {
                ticker: company.ticker,
                name: company.name,
                sector: company.sector ?? null,
                industry: company.industry ?? null,
                marketCap: company.marketCap ?? null,
                currency: company.currency ?? null,
                healthScore: available ? { overall: healthScore.overall, label: healthScore.label, riskLevel: healthScore.riskLevel } : null,
                ratios: available ? ratios : null,
                dataAvailable: available,
                unavailableReason: available ? null : reason,
            };
        })
    );

    const filtered = scored.filter((company) => {
        if (minHealthScore !== null && (company.healthScore === null || company.healthScore.overall < minHealthScore)) return false;
        if (maxHealthScore !== null && (company.healthScore === null || company.healthScore.overall > maxHealthScore)) return false;
        return true;
    });

    const sorted = [...filtered].sort((a, b) => compareValues(sortKeyFor(a, sortBy), sortKeyFor(b, sortBy), sortDirection));

    return {
        criteria,
        universeMatchedCount,
        scoredCount: toScore.length,
        cappedNote:
            toScore.length < universeMatchedCount
                ? `Showing ${toScore.length} of ${universeMatchedCount} matching companies - Health Score is computed on demand and capped per request to bound cost.`
                : null,
        companies: sorted,
        disclaimer: DISCLAIMER,
        generatedAt: new Date().toISOString(),
    };
};

const FACETS_CACHE_TTL_MS = 15 * 60 * 1000;
let facetsCache = null;

/**
 * Distinct sector/industry values already in Athena's Company collection -
 * lets the Screener's filters be a dropdown of real values instead of free
 * text, so a typo (or a casing mismatch, since Company.sector/industry are
 * matched with exact equality) can no longer silently produce zero results.
 * Cached in-memory like the rest of this module - the value set only grows
 * as new companies get imported, so a few minutes of staleness just means a
 * just-imported company's sector doesn't appear in the dropdown yet.
 */
const getFacets = async () => {
    if (facetsCache && facetsCache.expiresAt > Date.now()) {
        return facetsCache.data;
    }

    const [sectors, industries] = await Promise.all([
        Company.distinct("sector", { sector: { $ne: null } }),
        Company.distinct("industry", { industry: { $ne: null } }),
    ]);

    const data = {
        sectors: sectors.filter(Boolean).sort(),
        industries: industries.filter(Boolean).sort(),
    };

    facetsCache = { data, expiresAt: Date.now() + FACETS_CACHE_TTL_MS };
    return data;
};

/** Test-only: clears the in-memory screener cache (same pattern as portfolio.analytics.service.js's _resetCache). */
const _resetCache = () => {
    screenerCache.clear();
    facetsCache = null;
};

module.exports = {
    runScreener,
    getFacets,
    DISCLAIMER,
    SCREENER_CACHE_TTL_MS,
    _resetCache,
};

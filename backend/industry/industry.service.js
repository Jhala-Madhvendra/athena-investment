/**
 * Industry Service
 *
 * Orchestrates Industry & Sector Intelligence: resolves the reference
 * universe (industry.peerDiscovery.js), builds each member's metric
 * bundle (industry.calculator.js, reusing Ratio Engine/Comps formulas),
 * benchmarks the target against the universe (industry.benchmark.js,
 * reusing comps.statistics.js), and assembles relative positioning,
 * strengths, and weaknesses.
 *
 * Never talks to Yahoo Finance directly - only Athena's own
 * company/financials/market services, per the Sprint 13 brief.
 *
 * CACHING
 * -------
 * Financial-statement-derived metrics are cheap (DB-only) and are never
 * cached - recomputed every request, matching ratio.service.js/
 * comps.service.js's "always recompute from current storage" philosophy.
 *
 * Market-quote-derived metrics (P/E, EV/EBITDA) are the expensive part:
 * benchmarking a universe of up to MAX_UNIVERSE_SIZE companies means one
 * live quote per company. Each individual quote is already cached for 60s
 * by market.service.js's own quoteCache, but re-fetching an entire
 * universe on every page view is still wasteful. This module adds a
 * second, coarser cache over the *whole assembled universe bundle*
 * (financial + market metrics together), keyed by reference-universe
 * identity (level + key) and TTL'd for INDUSTRY_CACHE_TTL_MS (5 minutes) -
 * long enough that browsing between companies in the same industry doesn't
 * re-fetch N quotes each time, short enough that valuation multiples don't
 * go stale within a trading session. In-memory Map, same pattern as
 * market.service.js's quoteCache - no new infra dependency. The target
 * company's own bundle is always computed fresh (never cached), since it's
 * a single company and must reflect the latest data on every request.
 */

const companyService = require("../services/company.service");
const financialsService = require("../financials/financials.service");
const marketService = require("../market/market.service");
const fxRateProvider = require("../market/providers/fxRate.provider");
const { resolveReferenceUniverse, rankByMarketCapProximity, SUGGESTED_PEERS_LIMIT } = require("./industry.peerDiscovery");
const { buildCompanyMetricBundle, METRIC_DEFINITIONS } = require("./industry.calculator");
const benchmark = require("./industry.benchmark");

const INDUSTRY_CACHE_TTL_MS = 5 * 60 * 1000;
const universeCache = new Map();

class NoFinancialDataError extends Error {
    constructor(ticker) {
        super(
            `No financial statements are available for ${ticker}. Import financial statements before requesting Industry Intelligence.`
        );
        this.name = "NoFinancialDataError";
        this.statusCode = 404;
    }
}

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Loads the two most recent statements + a best-effort live quote for one ticker, and builds its metric bundle. Never throws - a member with no statements or no quote degrades gracefully rather than failing the whole universe. */
const loadMemberBundle = async (member) => {
    let statements = [];
    try {
        statements = await financialsService.getFinancialStatementsByTicker(member.ticker);
    } catch {
        statements = [];
    }

    const quote = await marketService.getCurrentMarketData(member.ticker).catch(() => null);

    if (!statements || statements.length === 0) {
        return null;
    }

    const metricBundle = buildCompanyMetricBundle({
        ticker: member.ticker,
        name: member.name,
        marketCap: quote?.price?.marketCap ?? member.marketCap ?? null,
        latestStatement: statements[0],
        priorStatement: statements[1] ?? null,
    });

    return {
        ...member,
        ...metricBundle,
        // The live quote's own currency (matches the live marketCap above) takes priority over the stored Company record's, same fallback order as marketCap itself.
        currency: quote?.currency ?? member.currency ?? null,
        marketDataAsOf: quote?.asOf ?? null,
    };
};

/** Builds (or returns cached) metric bundles for every universe member - never includes the target itself. */
const getUniverseBundles = async (universe, candidates) => {
    if (universe.level === "none" || candidates.length === 0) {
        return [];
    }

    const cacheKey = `${universe.level}:${universe.key}`;
    const cached = universeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.members;
    }

    const loaded = await Promise.all(candidates.map(loadMemberBundle));
    const members = loaded.filter(Boolean);

    universeCache.set(cacheKey, { members, expiresAt: Date.now() + INDUSTRY_CACHE_TTL_MS, cachedAt: new Date().toISOString() });

    return members;
};

/**
 * Ranks universe members by market-cap proximity to the target, first
 * normalizing every market cap to USD (see fxRate.provider.js's
 * attachMarketCapUSD) - comparing raw market caps across currencies would
 * silently misrank "closest peer" the same way Portfolio's raw
 * cross-currency totals were silently wrong; see
 * PortfolioCurrencyNormalization.md.
 */
const rankSuggestedPeers = async (targetForRanking, universeMembers, limit) => {
    const [targetWithUSD, ...membersWithUSD] = await fxRateProvider.attachMarketCapUSD([targetForRanking, ...universeMembers]);
    return rankByMarketCapProximity(targetWithUSD, membersWithUSD, limit);
};

/** Builds one benchmark entry for a single metric: universe summary, target comparison, percentile position, and (for percent metrics only) a strength/weakness classification. */
const buildMetricBenchmark = (metricKey, targetMetric, universeMembers) => {
    const definition = METRIC_DEFINITIONS[metricKey];
    const universeValues = universeMembers.map((member) => member.metrics[metricKey].value);
    const validUniverseValues = universeValues.filter(isFiniteNumber);

    const summary = benchmark.summarizeMetric(universeValues);
    const comparison = benchmark.compareToTarget(targetMetric.value, summary, definition.unit);
    const percentile = comparison.available ? benchmark.percentileRank(validUniverseValues, targetMetric.value) : null;
    const classification = definition.unit === "percent" ? benchmark.classifyPosition(comparison) : "not_classified";

    return {
        metric: metricKey,
        label: definition.label,
        unit: definition.unit,
        category: definition.category,
        dataType: definition.type,
        company: targetMetric.value,
        companyExclusionReason: targetMetric.exclusionReason,
        universe: summary,
        comparison,
        percentile,
        classification,
    };
};

/**
 * GET /api/industry/:ticker - full Industry Intelligence payload.
 * @param {string} rawTicker
 * @returns {Promise<object>} plain result object; industry.formatter.js shapes this into the wire response
 */
const getIndustryIntelligence = async (rawTicker) => {
    const { target, universe, candidates } = await resolveReferenceUniverse(rawTicker);

    const [targetStatements, targetQuote, targetCompany] = await Promise.all([
        financialsService.getFinancialStatementsByTicker(target.ticker),
        marketService.getCurrentMarketData(target.ticker).catch(() => null),
        companyService.getCompanyDetails(target.ticker),
    ]);

    if (!targetStatements || targetStatements.length === 0) {
        throw new NoFinancialDataError(target.ticker);
    }

    const targetBundle = buildCompanyMetricBundle({
        ticker: target.ticker,
        name: target.name,
        marketCap: targetQuote?.price?.marketCap ?? target.marketCap ?? null,
        latestStatement: targetStatements[0],
        priorStatement: targetStatements[1] ?? null,
    });

    const universeMembers = await getUniverseBundles(universe, candidates);

    const benchmarks = Object.keys(METRIC_DEFINITIONS).map((metricKey) =>
        buildMetricBenchmark(metricKey, targetBundle.metrics[metricKey], universeMembers)
    );

    const suggestedPeers = await rankSuggestedPeers(
        { marketCap: targetBundle.marketCap, currency: targetQuote?.currency ?? target.currency ?? null },
        universeMembers,
        SUGGESTED_PEERS_LIMIT
    );

    return {
        ticker: target.ticker,
        company: targetCompany?.name ?? target.name,
        sector: target.sector,
        industry: target.industry,
        universe,
        target: targetBundle,
        benchmarks,
        universeMembers,
        suggestedPeers,
        dataFreshness: {
            financialPeriod: targetBundle.fiscalYear,
            financialStatementSource: targetStatements[0]?.source ?? null,
            marketDataAsOf: targetQuote?.asOf ?? null,
        },
    };
};

/** GET /api/industry/:ticker/peers - suggested peers only (no full benchmark computation of every metric needed by the caller, but reuses the same cached universe bundle). */
const getPeerSuggestions = async (rawTicker, limit = SUGGESTED_PEERS_LIMIT) => {
    const { target, universe, candidates } = await resolveReferenceUniverse(rawTicker);
    const universeMembers = await getUniverseBundles(universe, candidates);
    const suggestedPeers = await rankSuggestedPeers(target, universeMembers, limit);

    return { target, universe, suggestedPeers };
};

/** GET /api/industry/:ticker/metrics - static metric catalog, ticker only used to validate the company exists. */
const getSupportedMetrics = async (rawTicker) => {
    const target = await companyService.getCompanyDetails(rawTicker);

    if (!target) {
        const error = new Error(`Company ${rawTicker} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    return { ticker: target.ticker, metrics: METRIC_DEFINITIONS };
};

/**
 * Clears every cached universe bundle. Called after "Find More Companies"
 * imports new companies - the cheap, safe option over trying to compute
 * exactly which single `level:key` entry a newly-imported company's
 * industry/sector affects (a company can plausibly join more than one
 * cached entry, e.g. both an industry-level and a sector-level fallback
 * cache built for different target companies). The cache is small and
 * inexpensive to rebuild, so clearing all of it trades a little extra
 * recomputation for guaranteed correctness after an import.
 */
const invalidateUniverseCache = () => {
    universeCache.clear();
};

module.exports = {
    getIndustryIntelligence,
    getPeerSuggestions,
    getSupportedMetrics,
    invalidateUniverseCache,
    NoFinancialDataError,
    INDUSTRY_CACHE_TTL_MS,
};

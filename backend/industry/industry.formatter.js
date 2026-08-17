/**
 * Industry Formatter
 *
 * Assembles the public API response shapes from industry.service.js's
 * internal result objects - the only place that decides the wire format,
 * so internal shapes (raw universe member bundles, cache metadata) never
 * leak directly onto the wire. Mirrors earnings.formatter.js's role.
 */

const NOTE_UNAVAILABLE = "Not available.";

const formatUniverseSummary = (summary) => {
    if (!summary?.available) {
        return { available: false, count: summary?.count ?? 0, mean: null, median: null, min: null, max: null, p25: null, p75: null, reason: summary?.reason ?? NOTE_UNAVAILABLE };
    }

    const { available, count, mean, median, min, max, p25, p75 } = summary;
    return { available, count, mean, median, min, max, p25, p75, reason: null };
};

/** One row of the "Company vs Industry" comparison table. */
const formatBenchmarkEntry = (entry) => ({
    metric: entry.metric,
    label: entry.label,
    unit: entry.unit,
    category: entry.category,
    company: entry.company,
    companyExclusionReason: entry.companyExclusionReason,
    industry: formatUniverseSummary(entry.universe),
});

/** Percentile positioning row - deliberately carries only the percentile + a neutral descriptive note, never a judgment (see Sprint 13 COMPANY POSITION guidance). */
const formatPositioningEntry = (entry) => ({
    metric: entry.metric,
    label: entry.label,
    unit: entry.unit,
    percentile: entry.percentile,
    note:
        entry.percentile === null
            ? entry.comparison.reason || NOTE_UNAVAILABLE
            : `${entry.label} is around the ${entry.percentile}th percentile of the reference universe.`,
});

/** One row of a growth/profitability/valuation comparison table. */
const formatComparisonEntry = (entry) => ({
    metric: entry.metric,
    label: entry.label,
    unit: entry.unit,
    company: entry.comparison.companyValue,
    industryMedian: entry.comparison.universeMedian,
    difference: entry.unit === "multiple" ? null : entry.comparison.difference,
    relative: entry.unit === "multiple" ? entry.comparison.relative : null,
    available: entry.comparison.available,
    note: entry.comparison.available ? entry.comparison.note : entry.comparison.reason || NOTE_UNAVAILABLE,
});

const formatStrengthOrWeakness = (entry) => ({
    metric: entry.metric,
    label: entry.label,
    company: entry.comparison.companyValue,
    industryMedian: entry.comparison.universeMedian,
    difference: entry.comparison.difference,
    note: entry.comparison.note,
});

/**
 * @param {object} result - industry.service.getIndustryIntelligence()'s output
 * @returns {object} the GET /api/industry/:ticker response body
 */
const formatIndustryResponse = (result) => {
    const { benchmarks } = result;

    const growthComparison = benchmarks.filter((entry) => entry.category === "growth").map(formatComparisonEntry);
    const profitabilityComparison = benchmarks.filter((entry) => entry.category === "profitability").map(formatComparisonEntry);
    const valuationComparison = benchmarks.filter((entry) => entry.category === "valuation").map(formatComparisonEntry);

    const strengths = benchmarks.filter((entry) => entry.classification === "strength").map(formatStrengthOrWeakness);
    const weaknesses = benchmarks.filter((entry) => entry.classification === "weakness").map(formatStrengthOrWeakness);

    return {
        ticker: result.ticker,
        company: result.company,
        sector: result.sector,
        industry: result.industry,
        universe: {
            level: result.universe.level,
            key: result.universe.key,
            size: result.universe.size,
            note: result.universe.note,
        },
        benchmarks: benchmarks.map(formatBenchmarkEntry),
        positioning: benchmarks.map(formatPositioningEntry),
        strengths,
        weaknesses,
        growthComparison,
        profitabilityComparison,
        valuationComparison,
        dataFreshness: result.dataFreshness,
        methodology:
            "Industry benchmarks use the median of the reference universe (less sensitive to outliers than the mean) and are only " +
            "computed when at least the minimum number of tracked companies report a valid observation for that metric. Differences " +
            "are reported in neutral terms (percentage points for margins/growth/ROE/ROA/FCF margin, and \"Nx the industry median\" for " +
            "valuation multiples) - Athena does not label any comparison as an investment recommendation.",
        disclaimer:
            "Industry Intelligence reflects Athena's own tracked company database, not a complete industry census - see the " +
            "`universe` field for the exact reference set used. It is not investment advice.",
        calculatedAt: new Date().toISOString(),
    };
};

/** @param {{target: object, universe: object, suggestedPeers: object[]}} result - industry.service.getPeerSuggestions()'s output */
const formatPeersResponse = (result) => ({
    ticker: result.target.ticker,
    universe: {
        level: result.universe.level,
        key: result.universe.key,
        size: result.universe.size,
        note: result.universe.note,
    },
    peers: result.suggestedPeers.map((peer) => ({
        ticker: peer.ticker,
        name: peer.name,
        sector: peer.sector,
        industry: peer.industry,
        marketCap: peer.marketCap,
        currency: peer.currency ?? null,
        revenueGrowth: peer.metrics?.revenueGrowth?.value ?? null,
        operatingMargin: peer.metrics?.operatingMargin?.value ?? null,
        pe: peer.metrics?.pe?.value ?? null,
    })),
    limitation:
        "These are potential comparable companies suggested from Athena's own tracked database, ranked by closest market " +
        "capitalization within the reference universe - not an automatically computed or canonical peer set. Selecting a company here " +
        "does not add it to a Comparable Company Analysis; you must still explicitly choose peers on the Valuation > Comps workflow.",
    generatedAt: new Date().toISOString(),
});

/** @param {{ticker: string, metrics: object}} result - industry.service.getSupportedMetrics()'s output */
const formatMetricsResponse = (result) => ({
    ticker: result.ticker,
    metrics: Object.entries(result.metrics).map(([key, definition]) => ({ metric: key, ...definition })),
});

/** @param {{classificationLevel: string, classificationValue: string, candidates: object[]}} result - industry.discovery.discoverCandidates()'s output */
const formatDiscoveryResponse = (result) => ({
    classificationLevel: result.classificationLevel,
    classificationValue: result.classificationValue,
    candidates: result.candidates.map((candidate) => ({
        ticker: candidate.ticker,
        name: candidate.name,
        exchange: candidate.exchange,
        marketCap: candidate.marketCap,
    })),
    limitation:
        "These companies are not yet tracked by Athena and have not been reviewed - they are drawn from a live external " +
        "classification search, not a curated or verified list. Selecting and adding one imports its company profile and " +
        "financial statements into Athena so it can join this industry's reference universe.",
    generatedAt: new Date().toISOString(),
});

/** @param {Array<{ticker: string, companyImported: boolean, financialsImported: boolean, error: string|null}>} results - industry.discovery.importSelectedCompanies()'s output */
const formatImportResponse = (results) => ({
    imported: results.filter((result) => result.companyImported && result.financialsImported).map((result) => result.ticker),
    partial: results.filter((result) => result.companyImported && !result.financialsImported),
    failed: results.filter((result) => !result.companyImported),
    generatedAt: new Date().toISOString(),
});

module.exports = {
    formatIndustryResponse,
    formatPeersResponse,
    formatMetricsResponse,
    formatDiscoveryResponse,
    formatImportResponse,
};

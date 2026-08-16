/**
 * Industry Peer Discovery
 *
 * Resolves the reference universe for Industry Intelligence and ranks
 * "potential peer" suggestions within it. Deliberately separate from
 * Sprint 7's comps.peerSelector.js:
 *  - comps.peerSelector.js returns EVERY company Athena knows about, for a
 *    human to browse/search while manually building a Comps peer list.
 *  - This module returns a NARROWER, industry/sector-matched, ranked list -
 *    closer to ai.contextBuilder.js's private selectAutoPeers() heuristic
 *    (same-sector, ranked by closest market cap), but exposed as a public
 *    "potential peers" suggestion rather than silently feeding an LLM
 *    report. It is exported as a pure ranking function specifically so a
 *    future automatic-peer-selection system could reuse it - see
 *    research/product/IndustryIntelligenceProductDesign.md.
 *
 * IMPORTANT: These are suggestions only. Selecting one in the UI passes it
 * into Sprint 7's existing user-driven Comps peer picker - it is never
 * auto-applied as the Comps peer set (see comps.service.js/comps.validator.js,
 * both untouched by this module).
 *
 * Like comps.peerSelector.js, this module only reads companies already
 * stored in Athena's own database (previously searched/imported by some
 * user) - it never calls Yahoo Finance directly, and it is not a claim
 * that Athena has visibility into every company in a given industry.
 */

const Company = require("../models/company.model");
const FinancialStatement = require("../financials/financials.model");
const { MIN_UNIVERSE_SIZE } = require("./industry.benchmark");

/** Caps how many universe members get their financial statements/market data pulled for benchmarking - keeps a single request bounded regardless of how many companies happen to share a sector string. */
const MAX_UNIVERSE_SIZE = 30;

/** Caps the "potential peers" suggestion list shown in the UI - a curated shortlist, not a directory dump. */
const SUGGESTED_PEERS_LIMIT = 10;

class CompanyNotFoundError extends Error {
    constructor(ticker) {
        super(`Company ${ticker} was not found. Import the company before requesting industry intelligence.`);
        this.name = "CompanyNotFoundError";
        this.statusCode = 404;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/** Which of a set of candidate tickers have at least one imported financial statement - membership in the reference universe requires real, usable data, not just a matching sector/industry label. */
const filterHasFinancialStatements = async (tickers) => {
    if (tickers.length === 0) {
        return new Set();
    }

    const withStatements = await FinancialStatement.distinct("ticker", { ticker: { $in: tickers } });
    return new Set(withStatements);
};

const toUniverseMember = (company) => ({
    ticker: company.ticker,
    name: company.name,
    sector: company.sector ?? null,
    industry: company.industry ?? null,
    marketCap: company.marketCap ?? null,
});

/**
 * Determines the reference universe for a target company: same-industry
 * companies with imported financial statements, falling back to
 * same-sector when the industry-level set is too small (mirrors
 * ai.contextBuilder.js's selectAutoPeers() sector fallback). Never claims
 * "industry" when the underlying set is actually sector-level - the
 * returned `level` and `note` make the fallback explicit (see Sprint 13's
 * REFERENCE UNIVERSE section).
 *
 * @param {string} targetTicker
 * @returns {Promise<{target: object, universe: {level: "industry"|"sector"|"none", key: string|null, size: number, note: string}, candidates: object[]}>}
 */
const resolveReferenceUniverse = async (targetTicker) => {
    const normalizedTicker = normalizeTicker(targetTicker);
    const targetCompany = await Company.findOne({ ticker: normalizedTicker }).lean();

    if (!targetCompany) {
        throw new CompanyNotFoundError(normalizedTicker);
    }

    const target = {
        ticker: targetCompany.ticker,
        name: targetCompany.name,
        sector: targetCompany.sector ?? null,
        industry: targetCompany.industry ?? null,
        marketCap: targetCompany.marketCap ?? null,
    };

    const [industryPool, sectorPool] = await Promise.all([
        target.industry
            ? Company.find({ industry: target.industry, ticker: { $ne: normalizedTicker } })
                  .select("ticker name sector industry marketCap")
                  .limit(MAX_UNIVERSE_SIZE * 2)
                  .lean()
            : [],
        target.sector
            ? Company.find({ sector: target.sector, ticker: { $ne: normalizedTicker } })
                  .select("ticker name sector industry marketCap")
                  .limit(MAX_UNIVERSE_SIZE * 2)
                  .lean()
            : [],
    ]);

    const allCandidateTickers = [...new Set([...industryPool, ...sectorPool].map((c) => c.ticker))];
    const withStatements = await filterHasFinancialStatements(allCandidateTickers);

    const industryCandidates = industryPool.filter((c) => withStatements.has(c.ticker)).slice(0, MAX_UNIVERSE_SIZE);
    const sectorCandidates = sectorPool.filter((c) => withStatements.has(c.ticker)).slice(0, MAX_UNIVERSE_SIZE);

    if (industryCandidates.length >= MIN_UNIVERSE_SIZE) {
        return {
            target,
            universe: {
                level: "industry",
                key: target.industry,
                size: industryCandidates.length,
                note: `Industry benchmark based on ${industryCandidates.length} tracked companies in "${target.industry}" with imported financial statements.`,
            },
            candidates: industryCandidates.map(toUniverseMember),
        };
    }

    if (sectorCandidates.length >= MIN_UNIVERSE_SIZE) {
        return {
            target,
            universe: {
                level: "sector",
                key: target.sector,
                size: sectorCandidates.length,
                note: `Fewer than ${MIN_UNIVERSE_SIZE} tracked companies share the exact industry "${target.industry ?? "unknown"}", so this benchmark was computed at the broader sector level ("${target.sector}") using ${sectorCandidates.length} tracked companies.`,
            },
            candidates: sectorCandidates.map(toUniverseMember),
        };
    }

    const bestEffort = industryCandidates.length >= sectorCandidates.length ? industryCandidates : sectorCandidates;
    const bestEffortLevel = industryCandidates.length >= sectorCandidates.length ? "industry" : "sector";

    return {
        target,
        universe: {
            level: bestEffort.length > 0 ? bestEffortLevel : "none",
            key: bestEffort.length > 0 ? (bestEffortLevel === "industry" ? target.industry : target.sector) : null,
            size: bestEffort.length,
            note:
                bestEffort.length > 0
                    ? `Only ${bestEffort.length} tracked companies with financial statements share this company's ${bestEffortLevel} - below the minimum of ${MIN_UNIVERSE_SIZE} required for a benchmark. Import more companies in this ${bestEffortLevel} to enable industry benchmarking.`
                    : `No other tracked companies share this company's sector or industry yet. Import more companies to enable industry benchmarking.`,
        },
        candidates: bestEffort.map(toUniverseMember),
    };
};

const distanceByMarketCap = (targetMarketCap) => (candidate) => {
    if (typeof targetMarketCap !== "number" || typeof candidate.marketCap !== "number") {
        return Number.POSITIVE_INFINITY;
    }
    return Math.abs(candidate.marketCap - targetMarketCap);
};

/**
 * Pure ranking function - ranks universe candidates by closest market
 * capitalization to the target, the same signal ai.contextBuilder.js's
 * selectAutoPeers() already uses. Exported standalone (not just used
 * internally) so a future automatic-peer-selection system can reuse this
 * exact ranking without duplicating it.
 *
 * @param {{marketCap: number|null}} target
 * @param {object[]} candidates - universe members (toUniverseMember shape)
 * @param {number} [limit]
 * @returns {object[]} candidates sorted by market-cap proximity, capped to `limit`
 */
const rankByMarketCapProximity = (target, candidates, limit = SUGGESTED_PEERS_LIMIT) =>
    [...candidates]
        .sort((a, b) => distanceByMarketCap(target?.marketCap)(a) - distanceByMarketCap(target?.marketCap)(b))
        .slice(0, limit);

module.exports = {
    resolveReferenceUniverse,
    rankByMarketCapProximity,
    CompanyNotFoundError,
    MAX_UNIVERSE_SIZE,
    SUGGESTED_PEERS_LIMIT,
};

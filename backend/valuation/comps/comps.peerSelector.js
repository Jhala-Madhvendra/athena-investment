/**
 * Comps Peer Selector
 *
 * Candidate-peer discovery for GET /:ticker/comps/available-peers.
 *
 * LIMITATION (see research/finance/PeerSelection.md for the full writeup):
 * Athena has no industry-classification similarity engine, no revenue-scale
 * or geography-based scoring, and no automatic "these companies are
 * comparable" judgment. This module can only surface companies that are
 * ALREADY in Athena's database (previously searched or imported by some
 * user) as raw candidates for a human to evaluate - it is a convenience
 * list, not a recommendation engine. Peer selection stays entirely
 * user-controlled, per the Sprint 7 brief.
 *
 * Deliberately reuses the Company and FinancialStatement models directly
 * rather than duplicating a Yahoo Finance client - this module never
 * fetches live data (no market quotes), it only reads what Athena has
 * already stored, keeping candidate browsing fast and free of live API
 * calls for every row in the list.
 */

const Company = require("../../models/company.model");
const FinancialStatement = require("../../financials/financials.model");
const companyService = require("../../services/company.service");

/** Caps how many candidates are returned - this is a browsing list, not a full company directory dump. */
const CANDIDATE_LIMIT = 25;

const LIMITATION_NOTICE =
    "These are companies already known to Athena (previously searched or imported), not an automatically " +
    "computed set of comparable companies. Athena does not score industry similarity, business model, revenue " +
    "scale, geography, or growth profile. Review each candidate's sector, industry, market cap, and revenue " +
    "yourself before adding it as a peer.";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Attaches each candidate's most recent reported revenue (if statements have been imported), without making any live API call. */
const attachLatestRevenue = async (companies) => {
    if (companies.length === 0) {
        return [];
    }

    const tickers = companies.map((company) => company.ticker);
    const statements = await FinancialStatement.find({ ticker: { $in: tickers } })
        .select("ticker year incomeStatement.totalRevenue -_id")
        .lean();

    const latestByTicker = new Map();
    statements.forEach((statement) => {
        const existing = latestByTicker.get(statement.ticker);
        if (!existing || statement.year > existing.year) {
            latestByTicker.set(statement.ticker, {
                year: statement.year,
                revenue: statement.incomeStatement?.totalRevenue ?? null,
            });
        }
    });

    return companies.map((company) => {
        const latest = latestByTicker.get(company.ticker);

        return {
            ticker: company.ticker,
            name: company.name,
            exchange: company.exchange ?? null,
            sector: company.sector ?? null,
            industry: company.industry ?? null,
            marketCap: company.marketCap ?? null,
            revenue: latest?.revenue ?? null,
            revenueFiscalYear: latest?.year ?? null,
            hasFinancialStatements: Boolean(latest),
        };
    });
};

/**
 * @param {string} targetTicker
 * @param {string} [searchQuery] - optional free-text filter over candidate name/ticker
 * @returns {Promise<{target: object|null, candidates: object[], limitation: string}>}
 */
const getAvailablePeerCandidates = async (targetTicker, searchQuery) => {
    const normalizedTarget = targetTicker.trim().toUpperCase();

    const filter = { ticker: { $ne: normalizedTarget } };
    const normalizedQuery = typeof searchQuery === "string" ? searchQuery.trim() : "";
    if (normalizedQuery) {
        const searchExpression = new RegExp(escapeRegex(normalizedQuery), "i");
        filter.$or = [{ name: searchExpression }, { ticker: searchExpression }];
    }

    const [targetCompany, candidateCompanies] = await Promise.all([
        Company.findOne({ ticker: normalizedTarget }).select("ticker name sector industry marketCap").lean(),
        Company.find(filter).select("ticker name exchange sector industry marketCap").sort({ name: 1 }).limit(CANDIDATE_LIMIT).lean(),
    ]);

    const candidates = await attachLatestRevenue(candidateCompanies);

    return {
        target: targetCompany
            ? {
                  ticker: targetCompany.ticker,
                  name: targetCompany.name,
                  sector: targetCompany.sector ?? null,
                  industry: targetCompany.industry ?? null,
                  marketCap: targetCompany.marketCap ?? null,
              }
            : null,
        candidates,
        limitation: LIMITATION_NOTICE,
    };
};

/**
 * Explicit live fallback for GET /:ticker/comps/available-peers/live-search.
 *
 * getAvailablePeerCandidates above deliberately never leaves Athena's own database - that
 * keeps browsing candidates while typing fast and free of live API calls. But that means a
 * real company Athena simply hasn't seen yet (never searched or imported by any user) shows
 * up as "no matching companies found," which is misleading rather than a genuine limitation.
 *
 * This function is only ever invoked from one explicit user action ("search Yahoo Finance for
 * X"), never per keystroke, and reuses companyService.resolveTicker - the same DB-first-then-
 * live-import logic already backing the main ticker search bar (see Sidebar.jsx) - rather than
 * duplicating a Yahoo Finance client here. A resolved company is upserted into Athena's
 * database as a side effect of resolveTicker, so it becomes an ordinary local candidate for
 * every future search.
 *
 * @param {string} targetTicker
 * @param {string} query - free text the user typed (ticker or company name)
 * @returns {Promise<object|null>} a candidate shaped like getAvailablePeerCandidates' entries, or null if nothing resolved
 */
const findLivePeerCandidate = async (targetTicker, query) => {
    const normalizedTarget = targetTicker.trim().toUpperCase();
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
        return null;
    }

    const resolvedTicker = await companyService.resolveTicker(normalizedQuery);

    if (!resolvedTicker) {
        return null;
    }

    if (resolvedTicker === normalizedTarget) {
        const error = new Error("A company cannot be its own peer.");
        error.statusCode = 422;
        throw error;
    }

    const company = await Company.findOne({ ticker: resolvedTicker })
        .select("ticker name exchange sector industry marketCap")
        .lean();

    const [candidate] = await attachLatestRevenue([company]);
    return candidate;
};

module.exports = { getAvailablePeerCandidates, findLivePeerCandidate, CANDIDATE_LIMIT, LIMITATION_NOTICE };

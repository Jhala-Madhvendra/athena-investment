/**
 * Industry Company Discovery ("Find More Companies")
 *
 * Distinct from industry.peerDiscovery.js: peerDiscovery ranks companies
 * ALREADY in Athena's database; this module finds companies NOT yet in
 * Athena's database, via a live external query, so a user can grow a too-
 * small reference universe on demand. This is the "additional external
 * retrieval" the Sprint 13 brief anticipated - kept in its own dedicated
 * provider abstraction (financialDataProvider.searchCompaniesByClassification,
 * implemented for Yahoo only) rather than scattering a raw fetch call
 * through the industry module. See research/engineering/IndustryCompanyDiscovery.md.
 *
 * Candidates are suggestions only, exactly like industry.peerDiscovery.js's
 * ranked list - nothing is imported until the user explicitly selects
 * companies and confirms.
 */

const Company = require("../models/company.model");
const companyService = require("../services/company.service");
const financialsService = require("../financials/financials.service");
const financialDataProvider = require("../providers/financialDataProvider.registry");

/** Caps the candidate list actually returned to the UI - a curated shortlist, not the raw ~50-row screener response. */
const DISCOVERY_LIMIT = 20;

class CompanyNotFoundError extends Error {
    constructor(ticker) {
        super(`Company ${ticker} was not found. Import the company before discovering related companies.`);
        this.name = "CompanyNotFoundError";
        this.statusCode = 404;
    }
}

class NoClassificationError extends Error {
    constructor(ticker) {
        super(`${ticker} has no sector or industry classification, so related companies cannot be discovered.`);
        this.name = "NoClassificationError";
        this.statusCode = 422;
    }
}

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

/**
 * @param {string} rawTicker
 * @returns {Promise<{classificationLevel: "industry"|"sector", classificationValue: string, candidates: object[]}>}
 */
const discoverCandidates = async (rawTicker) => {
    const normalizedTicker = normalizeTicker(rawTicker);
    const target = await Company.findOne({ ticker: normalizedTicker }).lean();

    if (!target) {
        throw new CompanyNotFoundError(normalizedTicker);
    }

    if (!target.industry && !target.sector) {
        throw new NoClassificationError(normalizedTicker);
    }

    const rawCandidates = await financialDataProvider.searchCompaniesByClassification({
        industry: target.industry,
        sector: target.sector,
    });

    const candidateTickers = rawCandidates.map((candidate) => candidate.ticker);
    const alreadyTracked = new Set(
        (await Company.find({ ticker: { $in: candidateTickers } }).select("ticker -_id").lean()).map((c) => c.ticker)
    );

    const newCandidates = rawCandidates
        .filter((candidate) => candidate.ticker !== normalizedTicker && !alreadyTracked.has(candidate.ticker))
        .slice(0, DISCOVERY_LIMIT);

    return {
        classificationLevel: target.industry ? "industry" : "sector",
        classificationValue: target.industry || target.sector,
        candidates: newCandidates,
    };
};

/**
 * Imports company profile + financial statements for each selected ticker,
 * so it immediately counts toward the industry benchmark (which requires
 * FinancialStatement records, not just a Company record - see
 * industry.peerDiscovery.js's resolveReferenceUniverse). Never fails the
 * whole batch for one bad ticker - every ticker gets its own result with a
 * stated reason on failure, the same "exclude and explain" discipline as
 * every other Athena import flow (comps.service.js's unavailablePeers).
 *
 * @param {string[]} tickers
 * @returns {Promise<Array<{ticker: string, companyImported: boolean, financialsImported: boolean, error: string|null}>>}
 */
const importSelectedCompanies = async (tickers) => {
    const results = await Promise.all(
        tickers.map(async (rawTicker) => {
            const ticker = normalizeTicker(rawTicker);

            try {
                const company = await companyService.importCompany(ticker);

                if (!company) {
                    return { ticker, companyImported: false, financialsImported: false, error: "Company could not be found." };
                }

                try {
                    await financialsService.importFinancialStatements(company.ticker);
                    return { ticker: company.ticker, companyImported: true, financialsImported: true, error: null };
                } catch (financialsError) {
                    return {
                        ticker: company.ticker,
                        companyImported: true,
                        financialsImported: false,
                        error: `Company imported, but financial statements could not be imported: ${financialsError.message}`,
                    };
                }
            } catch (error) {
                return { ticker, companyImported: false, financialsImported: false, error: error.message };
            }
        })
    );

    return results;
};

module.exports = {
    discoverCandidates,
    importSelectedCompanies,
    CompanyNotFoundError,
    NoClassificationError,
    DISCOVERY_LIMIT,
};

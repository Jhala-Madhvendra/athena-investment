/**
 * AI Context Builder
 *
 * Aggregates Athena's existing deterministic engines - company profile,
 * ratios, business intelligence (growth/health score/insights), market
 * data, DCF valuation, comparable company analysis - in-process into one
 * compact context object for the LLM. Nothing here recalculates anything;
 * every number is read exactly as the corresponding service already
 * computes it (see backend/services, backend/ratio, backend/analysis,
 * backend/market, backend/valuation).
 *
 * Each section is fetched independently and tolerates its own failure - a
 * ticker with no comps peers, or a market data outage, must not block the
 * rest of the report. Failed/unavailable sections are returned as
 * {available: false, reason} so the prompt can instruct the model to say
 * "Data unavailable" for that aspect instead of guessing.
 *
 * DCF COST-OF-DEBT NOTE: Athena's interactive DCF tool deliberately never
 * fabricates preTaxCostOfDebt - Athena has no interest-expense or credit
 * spread data for any ticker, so GET /:ticker/dcf/defaults always returns
 * it as null with source "required_user_input" (see
 * valuation/mappers/dcfInput.mapper.js). There is no user in the loop for
 * an AI-triggered report to supply that value interactively, so callers of
 * this module may pass one explicitly via `options.preTaxCostOfDebt`; if
 * omitted, this module falls back to a clearly-labeled illustrative
 * estimate (risk-free rate + a flat investment-grade credit spread) that
 * exists ONLY in this file, not in the interactive DCF path. The context
 * always records which one happened (costOfDebtSource: "user_provided" |
 * "illustrative_default") so the report/evidence layer can disclose it.
 *
 * COMPS PEER SELECTION NOTE: Sprint 7 made peer selection deliberately
 * user-controlled - Athena has no industry-similarity scoring engine (see
 * valuation/comps/comps.peerSelector.js). An AI-triggered report has no
 * user to pick peers, so this module applies a documented, best-effort
 * heuristic (same sector where possible, ranked by closest market cap, up
 * to MAX_AUTO_PEERS) and records peerSelectionMethod so the report can
 * caveat it - never presented as equivalent to a human-reviewed peer set.
 */

const companyService = require("../services/company.service");
const ratioService = require("../ratio/ratio.service");
const analysisService = require("../analysis/analysis.service");
const marketService = require("../market/market.service");
const valuationService = require("../valuation/valuation.service");
const compsService = require("../valuation/comps/comps.service");
const compsPeerSelector = require("../valuation/comps/comps.peerSelector");
const newsService = require("../news/news.service");
const fxRateProvider = require("../market/providers/fxRate.provider");

const ANALYSIS_YEARS = 5;
const MAX_AUTO_PEERS = 5;
// Kept small deliberately - this feeds an LLM prompt, not a news feed. Only
// the deterministic pipeline's already-stored, already-classified articles
// are used (news.service.js's DB-only read, never a live provider call
// from here) - see research/engineering/AIContextWithExternalSources.md.
const MAX_RECENT_EVENTS = 5;
const COMPS_STATISTIC = "median";
// 150bps over the risk-free rate - a generic investment-grade proxy, NOT
// derived from this company's actual data. Only used when the caller
// doesn't supply preTaxCostOfDebt themselves.
const ILLUSTRATIVE_CREDIT_SPREAD = 0.015;
// Only used if even the risk-free rate is unavailable to anchor the spread.
const FALLBACK_COST_OF_DEBT = 0.05;

const available = (fields) => ({ available: true, ...fields });
const unavailable = (reason) => ({ available: false, reason: String(reason) });

const round4 = (value) => (typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(4)) : null);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const buildProfileSection = async (ticker) => {
    try {
        const company = await companyService.getCompanyDetails(ticker);
        if (!company) {
            return unavailable(`No company profile is stored for ${ticker}.`);
        }

        const description = typeof company.description === "string" ? company.description.trim() : "";

        return available({
            name: company.name ?? null,
            ticker: company.ticker,
            sector: company.sector ?? null,
            industry: company.industry ?? null,
            exchange: company.exchange ?? null,
            country: company.country ?? null,
            currency: company.currency ?? null,
            marketCap: company.marketCap ?? null,
            // Truncated: full descriptions run long and add little for an
            // interpretive report, but a short blurb helps frame the business.
            description: description ? description.slice(0, 280) : null,
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Ratios
// ---------------------------------------------------------------------------

const flattenRatioGroup = (group) =>
    Object.fromEntries(Object.entries(group || {}).map(([key, leaf]) => [key, leaf?.value ?? null]));

const buildRatiosSection = async (ticker) => {
    try {
        const result = await ratioService.getRatiosByTicker(ticker);
        return available({
            asOfYear: result.year,
            profitability: flattenRatioGroup(result.ratios.profitability),
            liquidity: flattenRatioGroup(result.ratios.liquidity),
            solvency: flattenRatioGroup(result.ratios.solvency),
            cashFlow: flattenRatioGroup(result.ratios.cashFlow),
            efficiency: flattenRatioGroup(result.ratios.efficiency),
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Business intelligence (growth / trends / health score / insights)
// ---------------------------------------------------------------------------

const buildAnalysisSection = async (ticker) => {
    try {
        // calculateAnalysis never throws for business errors - it returns
        // {error, status} instead (see analysis.service.js). Real throws
        // here mean something unexpected went wrong.
        const result = await analysisService.calculateAnalysis(ticker, { years: ANALYSIS_YEARS });

        if (result.error) {
            return unavailable(result.error);
        }

        return available({
            period: result.period,
            growth: result.growth,
            healthScore: {
                overall: result.healthScore.overall,
                label: result.healthScore.label,
                riskLevel: result.healthScore.riskLevel,
                components: result.healthScore.components,
                explanation: result.healthScore.explanation,
            },
            // category/text/confidence/investorImportance only - priority,
            // categoryLabel and forward are derivable/redundant for the LLM.
            insights: (result.insights || []).map((insight) => ({
                category: insight.category,
                text: insight.text,
                confidence: insight.confidence,
                investorImportance: insight.investorImportance,
            })),
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

const buildMarketDataSection = async (ticker) => {
    const [quoteResult, performanceResult] = await Promise.allSettled([
        marketService.getCurrentMarketData(ticker),
        marketService.getPerformance(ticker),
    ]);

    if (quoteResult.status === "rejected") {
        return unavailable(quoteResult.reason.message);
    }

    const quote = quoteResult.value;

    return available({
        asOf: quote.asOf,
        price: {
            current: quote.price?.current ?? null,
            fiftyTwoWeekHigh: quote.price?.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: quote.price?.fiftyTwoWeekLow ?? null,
            marketCap: quote.price?.marketCap ?? null,
        },
        valuation: {
            peRatio: quote.valuation?.peRatio ?? null,
            forwardPE: quote.valuation?.forwardPE ?? null,
            priceToBook: quote.valuation?.priceToBook ?? null,
            eps: quote.valuation?.eps ?? null,
        },
        dividend: quote.dividend ?? null,
        riskMetrics: quote.riskMetrics ?? null,
        performance: performanceResult.status === "fulfilled" ? performanceResult.value : null,
    });
};

// ---------------------------------------------------------------------------
// DCF valuation
// ---------------------------------------------------------------------------

/** Fields Athena derives from this company's own historical data - null means genuinely insufficient data, never fabricated. */
const REQUIRED_DERIVED_ASSUMPTION_KEYS = [
    "revenueGrowth",
    "ebitMargin",
    "taxRate",
    "depreciationPercentRevenue",
    "capexPercentRevenue",
    "workingCapitalPercentRevenue",
];
const REQUIRED_MARKET_WACC_INPUT_KEYS = ["riskFreeRate", "beta"];

const buildDcfSection = async (ticker, options) => {
    try {
        const defaults = await valuationService.getDCFDefaults(ticker);
        const { suggestedAssumptions, waccInputs } = defaults;

        const missingDerived = REQUIRED_DERIVED_ASSUMPTION_KEYS.filter((key) => suggestedAssumptions[key]?.value == null);
        const missingWaccInputs = REQUIRED_MARKET_WACC_INPUT_KEYS.filter((key) => waccInputs[key]?.value == null);

        if (missingDerived.length > 0 || missingWaccInputs.length > 0) {
            return unavailable(
                `DCF valuation requires data Athena does not have for ${ticker}: ${[...missingDerived, ...missingWaccInputs].join(", ")}.`
            );
        }

        let preTaxCostOfDebt = options.preTaxCostOfDebt;
        let costOfDebtSource = "user_provided";

        if (typeof preTaxCostOfDebt !== "number" || !Number.isFinite(preTaxCostOfDebt)) {
            const riskFreeRate = waccInputs.riskFreeRate.value;
            preTaxCostOfDebt =
                typeof riskFreeRate === "number" ? riskFreeRate + ILLUSTRATIVE_CREDIT_SPREAD : FALLBACK_COST_OF_DEBT;
            costOfDebtSource = "illustrative_default";
        }

        const requestAssumptions = {
            revenueGrowth: suggestedAssumptions.revenueGrowth.value,
            ebitMargin: suggestedAssumptions.ebitMargin.value,
            taxRate: suggestedAssumptions.taxRate.value,
            depreciationPercentRevenue: suggestedAssumptions.depreciationPercentRevenue.value,
            capexPercentRevenue: suggestedAssumptions.capexPercentRevenue.value,
            workingCapitalPercentRevenue: suggestedAssumptions.workingCapitalPercentRevenue.value,
            terminalGrowthRate: suggestedAssumptions.terminalGrowthRate.value,
            forecastYears: suggestedAssumptions.forecastYears.value,
            riskFreeRate: waccInputs.riskFreeRate.value,
            beta: waccInputs.beta.value,
            equityRiskPremium: waccInputs.equityRiskPremium.value,
            preTaxCostOfDebt,
        };

        const result = await valuationService.calculateDCFValuation(ticker, requestAssumptions);

        if (!result.isValid) {
            return unavailable((result.errors || []).join("; ") || "DCF valuation could not be calculated.");
        }

        return available({
            calculatedAt: result.calculatedAt,
            intrinsicValuePerShare: round4(result.intrinsicValuePerShare),
            currentMarketPrice: result.currentMarketPrice,
            upsideDownsidePercent: round4(result.upsideDownsidePercent),
            wacc: round4(result.waccBreakdown?.wacc),
            terminalGrowthRate: requestAssumptions.terminalGrowthRate,
            forecastYears: requestAssumptions.forecastYears,
            costOfDebtSource,
            disclaimer: result.disclaimer,
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Comparable company analysis
// ---------------------------------------------------------------------------

const distanceByMarketCap = (targetMarketCapUSD) => (candidate) => {
    if (typeof targetMarketCapUSD !== "number" || typeof candidate.marketCapUSD !== "number") {
        return Number.POSITIVE_INFINITY;
    }
    return Math.abs(candidate.marketCapUSD - targetMarketCapUSD);
};

/**
 * Ranks on `marketCapUSD`, not the native-currency `marketCap` - comparing
 * raw market caps across currencies (e.g. an INR figure against a USD
 * target) silently misselects auto-peers for the AI report the same way
 * it silently misranked Industry Intelligence's suggested peers and
 * misweighted Portfolio holdings; see PortfolioCurrencyNormalization.md.
 * Callers must attach `marketCapUSD` first (fxRate.provider.js's
 * attachMarketCapUSD) - this function stays synchronous/pure.
 */
const selectAutoPeers = (target, candidates) => {
    const withStatements = candidates.filter((c) => c.hasFinancialStatements);
    const sameSector = target?.sector ? withStatements.filter((c) => c.sector === target.sector) : [];
    const pool = sameSector.length >= 2 ? sameSector : withStatements;

    return [...pool]
        .sort((a, b) => distanceByMarketCap(target?.marketCapUSD)(a) - distanceByMarketCap(target?.marketCapUSD)(b))
        .slice(0, MAX_AUTO_PEERS);
};

const buildCompsSection = async (ticker) => {
    try {
        const { target, candidates } = await compsPeerSelector.getAvailablePeerCandidates(ticker);
        const [targetWithUSD, ...candidatesWithUSD] = await fxRateProvider.attachMarketCapUSD([
            target ?? { marketCap: null, currency: null },
            ...candidates,
        ]);
        const autoPeers = selectAutoPeers(target ? targetWithUSD : null, candidatesWithUSD);

        if (autoPeers.length < 2) {
            return unavailable(
                `Fewer than 2 usable peer companies are available in Athena's database for ${ticker} to run a comparable company analysis.`
            );
        }

        const peerTickers = autoPeers.map((peer) => peer.ticker);
        const result = await compsService.calculateComparableCompanyAnalysis(ticker, peerTickers, COMPS_STATISTIC);

        if (!result.isValid) {
            return unavailable((result.errors || []).join("; ") || "Comparable company analysis could not be calculated.");
        }

        const impliedValuations = Object.fromEntries(
            Object.entries(result.impliedValuations || {}).map(([key, entry]) => [
                key,
                {
                    isApplicable: entry.isApplicable,
                    impliedValuePerShare: entry.impliedValuePerShare ?? null,
                    upsideDownsidePercent: entry.upsideDownsidePercent ?? null,
                },
            ])
        );

        return available({
            statistic: result.statistic,
            peerSelectionMethod:
                "auto: same-sector peers already known to Athena, ranked by closest market capitalization - not manually reviewed by a user",
            peersUsed: peerTickers,
            unavailablePeers: result.unavailablePeers || [],
            impliedValuations,
            valuationRange: result.valuationRange,
            marketDataAsOf: result.marketDataAsOf,
            disclaimer: result.disclaimer,
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Recent news/events (Sprint 10)
// ---------------------------------------------------------------------------

/**
 * Only title/description/source/publishedAt/category/url - never full
 * article text (see Sprint 10 brief). Reads whatever the deterministic
 * news pipeline has already stored; does not trigger a live provider
 * fetch, so this section being "unavailable" just means no news has been
 * retrieved for this ticker yet, not that anything failed.
 */
const buildRecentEventsSection = async (ticker) => {
    try {
        const articles = await newsService.getRecentArticlesForContext(ticker, MAX_RECENT_EVENTS);

        if (!articles || articles.length === 0) {
            return unavailable(`No recent news has been retrieved for ${ticker} yet.`);
        }

        return available({
            events: articles.map((article) => ({
                title: article.title,
                description: article.description ?? null,
                source: article.source ?? null,
                publishedAt: article.publishedAt,
                category: article.category,
                url: article.url,
            })),
        });
    } catch (error) {
        return unavailable(error.message);
    }
};

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * @param {string} ticker - already-resolved, normalized ticker (callers use
 *   resolveTickerParam the same way every other domain controller does).
 * @param {{preTaxCostOfDebt?: number}} [options]
 */
const buildResearchContext = async (ticker, options = {}) => {
    const normalizedTicker = ticker.trim().toUpperCase();

    const [profile, ratios, analysis, marketData, dcf, comps, recentEvents] = await Promise.all([
        buildProfileSection(normalizedTicker),
        buildRatiosSection(normalizedTicker),
        buildAnalysisSection(normalizedTicker),
        buildMarketDataSection(normalizedTicker),
        buildDcfSection(normalizedTicker, options),
        buildCompsSection(normalizedTicker),
        buildRecentEventsSection(normalizedTicker),
    ]);

    const context = {
        ticker: normalizedTicker,
        generatedAt: new Date().toISOString(),
        profile,
        ratios,
        analysis,
        marketData,
        dcf,
        comps,
        recentEvents,
    };

    const dataFreshness = {
        marketDataAsOf: marketData.available ? marketData.asOf : null,
        financialDataPeriod: analysis.available ? analysis.period : null,
        dcfCalculatedAt: dcf.available ? dcf.calculatedAt : null,
    };

    return { context, dataFreshness };
};

// ---------------------------------------------------------------------------
// Evidence allow-list - flat dot-paths of every leaf value actually present
// in an available section, so the prompt can offer the model a closed set
// of citations instead of letting it invent field names.
// ---------------------------------------------------------------------------

const STRUCTURAL_KEYS = new Set(["available", "reason"]);

const flattenPaths = (value, prefix, paths) => {
    if (value === null || value === undefined) {
        return;
    }
    if (Array.isArray(value)) {
        if (value.every((item) => typeof item !== "object" || item === null)) {
            paths.push(prefix);
        }
        return;
    }
    if (typeof value === "object") {
        Object.entries(value).forEach(([key, nested]) => {
            if (STRUCTURAL_KEYS.has(key)) return;
            flattenPaths(nested, prefix ? `${prefix}.${key}` : key, paths);
        });
        return;
    }
    paths.push(prefix);
};

const buildEvidenceAllowList = (context) => {
    const paths = [];
    ["profile", "ratios", "analysis", "marketData", "dcf", "comps"].forEach((section) => {
        if (context[section]?.available) {
            flattenPaths(context[section], section, paths);
        }
    });

    // recentEvents.events is an array of objects (title/url/...), so the
    // generic flattenPaths above deliberately skips it (same as
    // analysis.insights) rather than emitting per-field dot-paths. For
    // "Recent Developments" citations, the meaningful citable unit is the
    // whole article - so its `url` itself becomes an allow-listed value,
    // reusing the exact same sectionEvidence sanitization every other
    // section already goes through instead of adding a parallel mechanism.
    if (context.recentEvents?.available) {
        context.recentEvents.events.forEach((event) => {
            if (event.url) paths.push(event.url);
        });
    }

    return paths;
};

module.exports = {
    buildResearchContext,
    buildEvidenceAllowList,
    ANALYSIS_YEARS,
    MAX_AUTO_PEERS,
    MAX_RECENT_EVENTS,
    COMPS_STATISTIC,
    ILLUSTRATIVE_CREDIT_SPREAD,
    FALLBACK_COST_OF_DEBT,
};

/**
 * Portfolio Scenario Service
 *
 * The I/O layer for POST /api/portfolio/scenarios/run and /compare. Fetches
 * a user's current holdings + each held ticker's sector/industry/beta ONCE
 * per request (even for /compare, which runs several scenario definitions
 * against that same fetched context - see loadScenarioContext), then hands
 * everything to the pure resolver/calculator (portfolio.scenario.resolver.js
 * / portfolio.scenario.calculator.js) to do the actual math. This module
 * never computes a shock itself.
 *
 * REUSE, NOT RECOMPUTATION
 * -------------------------
 * - Current holdings/value: portfolio.service.js's getPortfolio (Sprint 9).
 * - Sector/industry: Company.sector/Company.industry (Sprint 13), the same
 *   fields portfolio.analytics.exposure.js groups by - no new taxonomy.
 * - Per-holding beta: marketService quote's riskMetrics.beta, the same
 *   field portfolio.analytics.risk.js's calculatePortfolioBeta reads.
 * - Historical context (volatility/beta/max drawdown/benchmark): the
 *   ENTIRE block is produced by calling portfolio.analytics.service's
 *   getPortfolioAnalytics() as-is (Sprint 14/15, already cached 5 minutes)
 *   and lifting out the fields relevant to scenario context. This module
 *   never recomputes volatility, drawdown, or historical beta itself, and
 *   never lets that historical data influence a rule's shockPercent - see
 *   research/finance/HistoricalStressContext.md.
 *
 * SCENARIOS ARE NOT PERSISTED
 * -----------------------------
 * No Scenario collection. A run/compare request is computed and returned;
 * nothing is written to the database. Presets (portfolio.scenario.presets.js)
 * are static code, not stored templates. See research/product/
 * AdvancedScenarioProductDesign.md for why this is deferred, not an oversight.
 */

const Company = require("../models/company.model");
const portfolioService = require("./portfolio.service");
const portfolioCalculator = require("./portfolio.calculator");
const marketService = require("../market/market.service");
const riskCalculator = require("./portfolio.analytics.risk");
const portfolioAnalyticsService = require("./portfolio.analytics.service");
const resolver = require("./portfolio.scenario.resolver");
const calculator = require("./portfolio.scenario.calculator");
const presets = require("./portfolio.scenario.presets");

const HYPOTHETICAL_DISCLAIMER =
    "This is a hypothetical scenario, not a forecast or prediction. Actual market behavior may differ significantly from these modeled assumptions.";

const PRECEDENCE_METHODOLOGY_NOTE =
    "Each holding is affected by exactly one rule - the most specific one (Asset > Industry > Sector > Market > Portfolio-wide). Overlapping rules are never stacked or multiplied together.";

const MARKET_SHOCK_METHODOLOGY_NOTE =
    "Market shocks are scaled per holding by that holding's own beta (Yahoo Finance) - the same methodology Sprint 14's Portfolio Beta uses. This is a beta-based estimate, not a forecast.";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Fetches everything the resolver/calculator need about the current
 * portfolio, once. Mirrors portfolio.analytics.service.js's computeAnalytics
 * prologue (same positions/quotes/companies shape) so the two modules stay
 * consistent about what "current holdings" means, without importing each
 * other's internals.
 */
const loadScenarioContext = async (userId) => {
    const { holdings } = await portfolioService.getPortfolio(userId);

    if (holdings.length === 0) {
        return { hasHoldings: false, holdings: [], currentPortfolioValueUSD: 0, unpricedTickers: [], portfolioBeta: null, generatedAt: new Date().toISOString() };
    }

    const positions = portfolioCalculator.groupByTicker(holdings);
    const totalCurrentValueUSD = positions.reduce((sum, p) => sum + (p.currentValueUSD || 0), 0);
    const pricedPositions = positions.filter((p) => p.currentValueUSD !== null);
    const unpricedTickers = positions.filter((p) => p.currentValueUSD === null).map((p) => p.ticker);

    if (pricedPositions.length === 0) {
        return { hasHoldings: false, holdings: [], currentPortfolioValueUSD: 0, unpricedTickers, portfolioBeta: null, generatedAt: new Date().toISOString() };
    }

    const uniqueTickers = pricedPositions.map((p) => p.ticker);
    const [quoteEntries, companies] = await Promise.all([
        Promise.all(uniqueTickers.map(async (ticker) => [ticker, await marketService.getCurrentMarketData(ticker).catch(() => null)])),
        Company.find({ ticker: { $in: uniqueTickers } }).select("ticker sector industry").lean(),
    ]);

    const quotesByTicker = new Map(quoteEntries);
    const companiesByTicker = new Map(companies.map((c) => [c.ticker, c]));

    const contextHoldings = pricedPositions.map((position) => {
        const company = companiesByTicker.get(position.ticker);
        const beta = quotesByTicker.get(position.ticker)?.riskMetrics?.beta;
        return {
            ticker: position.ticker,
            currentValueUSD: position.currentValueUSD,
            weightPercent: totalCurrentValueUSD > 0 ? (position.currentValueUSD / totalCurrentValueUSD) * 100 : null,
            sector: company?.sector || null,
            industry: company?.industry || null,
            beta: isFiniteNumber(beta) ? beta : null,
        };
    });

    const portfolioBeta = riskCalculator.calculatePortfolioBeta(
        contextHoldings.map((h) => ({ ticker: h.ticker, weight: h.currentValueUSD / totalCurrentValueUSD, beta: h.beta }))
    );

    return {
        hasHoldings: true,
        holdings: contextHoldings,
        currentPortfolioValueUSD: totalCurrentValueUSD,
        unpricedTickers,
        portfolioBeta,
        generatedAt: new Date().toISOString(),
    };
};

/** Runs one scenario definition against an already-loaded context - pure aside from the sensitivity re-runs, which just call the resolver/calculator again over the same in-memory holdings. */
const runScenarioAgainstContext = (context, { name, rules, sensitivity }) => {
    const resolved = resolver.resolveScenario(context.holdings, rules);
    const impact = calculator.calculateScenarioImpact(resolved);

    let sensitivityResult = null;
    if (sensitivity) {
        sensitivityResult = sensitivity.shockValues.map((shockPercent) => {
            const flexedRules = rules.map((rule) =>
                rule.targetType === sensitivity.targetType && rule.target === sensitivity.target ? { ...rule, shockPercent } : rule
            );
            const flexedImpact = calculator.calculateScenarioImpact(resolver.resolveScenario(context.holdings, flexedRules));
            return {
                shockPercent,
                scenarioPortfolioValueUSD: flexedImpact.scenarioPortfolioValueUSD,
                absoluteChangeUSD: flexedImpact.absoluteChangeUSD,
                percentageChange: flexedImpact.percentageChange,
            };
        });
    }

    return {
        scenario: { name, rules },
        ...impact,
        sensitivity: sensitivityResult,
    };
};

const buildAssumptions = (context, { name, rules, window }) => ({
    scenarioName: name,
    rules,
    portfolioValueUSD: context.currentPortfolioValueUSD,
    dataTimestamp: context.generatedAt,
    unpricedHoldingsExcluded: context.unpricedTickers,
    betaUsed: context.portfolioBeta?.beta ?? null,
    betaCoveragePercent: context.portfolioBeta?.coveragePercent ?? null,
    historicalContextWindow: window,
    methodologyNotes: [PRECEDENCE_METHODOLOGY_NOTE, MARKET_SHOCK_METHODOLOGY_NOTE, HYPOTHETICAL_DISCLAIMER],
});

/**
 * Lifts historical context out of Sprint 14/15's existing analytics
 * response - never recomputed here. Kept as a clearly separate block from
 * the scenario result so a caller can never confuse "what the scenario
 * assumes" with "what actually happened historically."
 */
const buildHistoricalContext = async (userId, window, benchmark) => {
    const analytics = await portfolioAnalyticsService.getPortfolioAnalytics(userId, { window, benchmark }).catch(() => null);

    if (!analytics || analytics.isEmpty) {
        return { available: false, message: "Historical context unavailable for the selected period." };
    }

    return {
        available: true,
        window: analytics.window,
        volatilityPercent: analytics.risk?.volatilityPercent ?? null,
        beta: analytics.risk?.beta ?? null,
        maxDrawdown: analytics.risk?.maxDrawdown ?? null,
        benchmark: analytics.performance?.benchmark ?? null,
        note: "Historical context only - does not change the scenario assumptions above. Past behavior is not a prediction of future behavior.",
    };
};

const emptyScenarioResponse = (name, rules, window) => ({
    scenario: { name, rules },
    currentPortfolioValueUSD: 0,
    scenarioPortfolioValueUSD: 0,
    absoluteChangeUSD: 0,
    percentageChange: null,
    holdingImpact: [],
    sectorImpact: [],
    sensitivity: null,
    historicalContext: { available: false, message: "Add priced holdings to run a scenario." },
    assumptions: {
        scenarioName: name,
        rules,
        portfolioValueUSD: 0,
        dataTimestamp: new Date().toISOString(),
        unpricedHoldingsExcluded: [],
        betaUsed: null,
        betaCoveragePercent: null,
        historicalContextWindow: window,
        methodologyNotes: [PRECEDENCE_METHODOLOGY_NOTE, MARKET_SHOCK_METHODOLOGY_NOTE, HYPOTHETICAL_DISCLAIMER],
    },
});

/** POST /api/portfolio/scenarios/run */
const runScenario = async (userId, { name, rules, benchmark, window, sensitivity }) => {
    const context = await loadScenarioContext(userId);

    if (!context.hasHoldings) {
        return emptyScenarioResponse(name, rules, window);
    }

    const [result, historicalContext] = await Promise.all([
        Promise.resolve(runScenarioAgainstContext(context, { name, rules, sensitivity })),
        buildHistoricalContext(userId, window, benchmark),
    ]);

    return { ...result, historicalContext, assumptions: buildAssumptions(context, { name, rules, window }) };
};

/** POST /api/portfolio/scenarios/compare - loads context and historical data ONCE, runs every scenario definition against the same in-memory context. */
const compareScenarios = async (userId, { scenarios, benchmark, window }) => {
    const context = await loadScenarioContext(userId);
    const historicalContext = await buildHistoricalContext(userId, window, benchmark);

    const results = context.hasHoldings
        ? scenarios.map((s) => ({
              ...runScenarioAgainstContext(context, s),
              historicalContext,
              assumptions: buildAssumptions(context, { name: s.name, rules: s.rules, window }),
          }))
        : scenarios.map((s) => emptyScenarioResponse(s.name, s.rules, window));

    const comparisonTable = results.map((r) => ({
        name: r.scenario.name,
        scenarioPortfolioValueUSD: r.scenarioPortfolioValueUSD,
        absoluteChangeUSD: r.absoluteChangeUSD,
        percentageChange: r.percentageChange,
    }));

    return { scenarios: results, comparisonTable, historicalContext };
};

const getPresets = () => ({ presets: presets.listPresets() });

module.exports = {
    loadScenarioContext,
    runScenarioAgainstContext,
    runScenario,
    compareScenarios,
    getPresets,
    HYPOTHETICAL_DISCLAIMER,
    PRECEDENCE_METHODOLOGY_NOTE,
    MARKET_SHOCK_METHODOLOGY_NOTE,
};

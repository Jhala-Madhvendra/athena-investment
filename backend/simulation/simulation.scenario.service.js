/**
 * Simulation Scenario Service
 *
 * Runs Bear/Base/Bull-style stress tests against a hypothetical
 * (PaperPortfolio) holdings set. The rule-resolution and impact math is
 * NEVER re-implemented here - runScenarioAgainstContext,
 * calculateClassificationCoverage, and the methodology-note constants are
 * all reused directly from the real portfolio.scenario.service.js, which
 * already exports them for exactly this kind of reuse. Only the I/O layer
 * (loading a synthetic "current holdings" context from a PaperPortfolio
 * doc instead of the real Holding collection) is re-authored, mirroring
 * portfolio.scenario.service.js's loadScenarioContext/buildAssumptions/
 * buildHistoricalContext structure.
 *
 * SCENARIOS ARE NOT PERSISTED - same as the real service: a run/compare
 * request is computed and returned, nothing is written to the database.
 */

const Company = require("../models/company.model");
const marketService = require("../market/market.service");
const riskCalculator = require("../portfolio/portfolio.analytics.risk");
const portfolioCalculator = require("../portfolio/portfolio.calculator");
const resolver = require("../portfolio/portfolio.scenario.resolver");
const {
    runScenarioAgainstContext,
    calculateClassificationCoverage,
    HYPOTHETICAL_DISCLAIMER,
    PRECEDENCE_METHODOLOGY_NOTE,
    MARKET_SHOCK_METHODOLOGY_NOTE,
} = require("../portfolio/portfolio.scenario.service");
const simulationService = require("./simulation.service");
const simulationAnalyticsService = require("./simulation.analytics.service");

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Mirrors portfolio.scenario.service.js's loadScenarioContext, sourced from a PaperPortfolio doc via getSyntheticPortfolio instead of the real Holding collection. */
const loadSyntheticScenarioContext = async (userId, portfolioId) => {
    const portfolio = await simulationService.loadOwnedPortfolio(userId, portfolioId);
    const { holdings } = await simulationService.getSyntheticPortfolio(portfolio);

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

const buildAssumptions = (context, { name, rules, window }) => {
    const { sectorCoveragePercent, industryCoveragePercent } = calculateClassificationCoverage(context.holdings);

    return {
        scenarioName: name,
        rules,
        portfolioValueUSD: context.currentPortfolioValueUSD,
        dataTimestamp: context.generatedAt,
        unpricedHoldingsExcluded: context.unpricedTickers,
        betaUsed: context.portfolioBeta?.beta ?? null,
        betaCoveragePercent: context.portfolioBeta?.coveragePercent ?? null,
        sectorCoveragePercent,
        industryCoveragePercent,
        unmatchedRules: resolver.findUnmatchedRules(context.holdings, rules),
        historicalContextWindow: window,
        methodologyNotes: [PRECEDENCE_METHODOLOGY_NOTE, MARKET_SHOCK_METHODOLOGY_NOTE, HYPOTHETICAL_DISCLAIMER],
    };
};

/** Lifts historical context out of simulation.analytics.service.js's own output - never recomputed here, same discipline as the real buildHistoricalContext. */
const buildHistoricalContext = async (userId, portfolioId, window, benchmark) => {
    const analytics = await simulationAnalyticsService.getSimulationAnalytics(userId, portfolioId, { window, benchmark }).catch(() => null);

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
    historicalContext: { available: false, message: "Add priced holdings to this what-if portfolio to run a scenario." },
    assumptions: {
        scenarioName: name,
        rules,
        portfolioValueUSD: 0,
        dataTimestamp: new Date().toISOString(),
        unpricedHoldingsExcluded: [],
        betaUsed: null,
        betaCoveragePercent: null,
        sectorCoveragePercent: 0,
        industryCoveragePercent: 0,
        unmatchedRules: [],
        historicalContextWindow: window,
        methodologyNotes: [PRECEDENCE_METHODOLOGY_NOTE, MARKET_SHOCK_METHODOLOGY_NOTE, HYPOTHETICAL_DISCLAIMER],
    },
});

/** POST /api/simulation/portfolios/:id/scenarios/run */
const runSyntheticScenario = async (userId, portfolioId, { name, rules, benchmark, window, sensitivity }) => {
    const context = await loadSyntheticScenarioContext(userId, portfolioId);

    if (!context.hasHoldings) {
        return emptyScenarioResponse(name, rules, window);
    }

    const [result, historicalContext] = await Promise.all([
        Promise.resolve(runScenarioAgainstContext(context, { name, rules, sensitivity })),
        buildHistoricalContext(userId, portfolioId, window, benchmark),
    ]);

    return { ...result, historicalContext, assumptions: buildAssumptions(context, { name, rules, window }) };
};

/** POST /api/simulation/portfolios/:id/scenarios/compare */
const compareSyntheticScenarios = async (userId, portfolioId, { scenarios, benchmark, window }) => {
    const context = await loadSyntheticScenarioContext(userId, portfolioId);
    const historicalContext = await buildHistoricalContext(userId, portfolioId, window, benchmark);

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

module.exports = {
    loadSyntheticScenarioContext,
    runSyntheticScenario,
    compareSyntheticScenarios,
};

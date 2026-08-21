/**
 * Portfolio Scenario Calculator
 *
 * Pure functions only - no I/O (same shape as portfolio.analytics.calculator.js
 * and portfolio.scenario.resolver.js, which this module consumes). Turns
 * resolver output (one governing rule per holding) into the numbers the
 * product actually shows: scenario value, holding attribution, sector
 * attribution, and portfolio-level totals. See research/finance/
 * ScenarioAttribution.md for the definitions below.
 *
 * CONTRIBUTION vs. WEIGHT - READ THIS FIRST
 * --------------------------------------------
 * `contributionToScenarioImpactPercent` is a holding's (or sector's) share
 * of the scenario's TOTAL DOLLAR CHANGE - not its share of portfolio value
 * (that's `weightPercent`, already computed upstream by portfolio.service).
 * A 3%-weight holding shocked -80% can contribute far more than 3% of the
 * total loss; a 40%-weight holding left unaffected contributes 0%. The two
 * numbers answer different questions and must never be conflated - see
 * ScenarioAttribution.md's "Common mistakes" section.
 *
 * When holdings move in OPPOSITE directions (some up, some down), individual
 * contributions can be negative or exceed 100% of the (smaller, netted)
 * total change - this is a correct, well-known property of attribution
 * against a net total, not a bug. `contributionToScenarioImpactPercent` is
 * left as `null` (never a fabricated 0) when the total change is exactly 0,
 * since dividing by a zero total is undefined.
 */

const UNCLASSIFIED_SECTOR_LABEL = "Unclassified";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const round = (value, decimals = 6) => (isFiniteNumber(value) ? Number(value.toFixed(decimals)) : null);

/**
 * Scenario value + absolute change for one resolved holding.
 * Unaffected holdings (no governing rule) keep their current value exactly
 * - never shocked by 0% dressed up as "no change" through a different code
 * path, so downstream logic has one consistent shape either way.
 */
const applyHoldingShock = (resolvedHolding) => {
    const shockPercent = resolvedHolding.effectiveShockPercent ?? 0;
    const scenarioValueUSD = resolvedHolding.currentValueUSD * (1 + shockPercent / 100);
    return {
        ...resolvedHolding,
        scenarioValueUSD,
        absoluteChangeUSD: scenarioValueUSD - resolvedHolding.currentValueUSD,
    };
};

/**
 * Attaches portfolioImpactPercentagePoints (this holding's absolute change
 * as a share of the portfolio's CURRENT total value) and
 * contributionToScenarioImpactPercent (this holding's share of the
 * scenario's TOTAL dollar change) to every shocked holding.
 * @param {object[]} shockedHoldings - output of applyHoldingShock, one per holding
 * @param {number} currentPortfolioValueUSD
 * @param {number} totalAbsoluteChangeUSD - signed sum of every holding's absoluteChangeUSD
 */
const attributeHoldingImpact = (shockedHoldings, currentPortfolioValueUSD, totalAbsoluteChangeUSD) =>
    shockedHoldings.map((holding) => ({
        ...holding,
        portfolioImpactPercentagePoints:
            currentPortfolioValueUSD > 0 ? round((holding.absoluteChangeUSD / currentPortfolioValueUSD) * 100, 4) : null,
        contributionToScenarioImpactPercent:
            totalAbsoluteChangeUSD !== 0 ? round((holding.absoluteChangeUSD / totalAbsoluteChangeUSD) * 100, 4) : null,
    }));

/**
 * Aggregates already-attributed holdings by sector. Unclassified holdings
 * (no Company.sector on record) group under UNCLASSIFIED_SECTOR_LABEL
 * rather than being dropped - their dollar impact is still real. Mirrors
 * portfolio.analytics.exposure.js's groupByClassification grouping
 * convention, but aggregates scenario impact instead of static weight.
 * @param {object[]} attributedHoldings
 * @param {number} currentPortfolioValueUSD
 * @param {number} totalAbsoluteChangeUSD
 */
const attributeSectorImpact = (attributedHoldings, currentPortfolioValueUSD, totalAbsoluteChangeUSD) => {
    const groups = new Map();

    attributedHoldings.forEach((holding) => {
        const label = holding.sector || UNCLASSIFIED_SECTOR_LABEL;
        const existing = groups.get(label) || {
            sector: label,
            currentValueUSD: 0,
            scenarioValueUSD: 0,
            absoluteChangeUSD: 0,
            tickers: [],
        };
        existing.currentValueUSD += holding.currentValueUSD;
        existing.scenarioValueUSD += holding.scenarioValueUSD;
        existing.absoluteChangeUSD += holding.absoluteChangeUSD;
        existing.tickers.push(holding.ticker);
        groups.set(label, existing);
    });

    return [...groups.values()]
        .map((group) => ({
            ...group,
            currentValueUSD: round(group.currentValueUSD, 2),
            scenarioValueUSD: round(group.scenarioValueUSD, 2),
            absoluteChangeUSD: round(group.absoluteChangeUSD, 2),
            portfolioImpactPercentagePoints:
                currentPortfolioValueUSD > 0 ? round((group.absoluteChangeUSD / currentPortfolioValueUSD) * 100, 4) : null,
            contributionToScenarioImpactPercent:
                totalAbsoluteChangeUSD !== 0 ? round((group.absoluteChangeUSD / totalAbsoluteChangeUSD) * 100, 4) : null,
        }))
        .sort((a, b) => Math.abs(b.absoluteChangeUSD) - Math.abs(a.absoluteChangeUSD));
};

/**
 * Runs a fully-resolved scenario (holdings already carrying appliedRule/
 * effectiveShockPercent from portfolio.scenario.resolver.js) end to end:
 * per-holding shock -> holding attribution -> sector attribution ->
 * portfolio totals. The single function every other entry point (run,
 * compare, sensitivity) calls so the math has exactly one implementation.
 * @param {object[]} resolvedHoldings - portfolio.scenario.resolver.resolveScenario() output
 * @returns {object} {currentPortfolioValueUSD, scenarioPortfolioValueUSD, absoluteChangeUSD, percentageChange, holdingImpact, sectorImpact}
 */
const calculateScenarioImpact = (resolvedHoldings) => {
    const shocked = (resolvedHoldings || []).map(applyHoldingShock);

    const currentPortfolioValueUSD = shocked.reduce((sum, h) => sum + h.currentValueUSD, 0);
    const scenarioPortfolioValueUSD = shocked.reduce((sum, h) => sum + h.scenarioValueUSD, 0);
    const totalAbsoluteChangeUSD = scenarioPortfolioValueUSD - currentPortfolioValueUSD;

    const holdingImpact = attributeHoldingImpact(shocked, currentPortfolioValueUSD, totalAbsoluteChangeUSD);
    const sectorImpact = attributeSectorImpact(holdingImpact, currentPortfolioValueUSD, totalAbsoluteChangeUSD);

    return {
        currentPortfolioValueUSD: round(currentPortfolioValueUSD, 2),
        scenarioPortfolioValueUSD: round(scenarioPortfolioValueUSD, 2),
        absoluteChangeUSD: round(totalAbsoluteChangeUSD, 2),
        percentageChange: currentPortfolioValueUSD > 0 ? round((totalAbsoluteChangeUSD / currentPortfolioValueUSD) * 100, 4) : null,
        holdingImpact: holdingImpact.map((h) => ({
            ticker: h.ticker,
            sector: h.sector,
            industry: h.industry,
            currentValueUSD: round(h.currentValueUSD, 2),
            appliedRule: h.appliedRule,
            effectiveShockPercent: round(h.effectiveShockPercent, 4),
            overriddenRules: h.overriddenRules,
            unevaluableRules: h.unevaluableRules,
            scenarioValueUSD: round(h.scenarioValueUSD, 2),
            absoluteChangeUSD: round(h.absoluteChangeUSD, 2),
            portfolioImpactPercentagePoints: h.portfolioImpactPercentagePoints,
            contributionToScenarioImpactPercent: h.contributionToScenarioImpactPercent,
            unaffected: h.unaffected,
        })),
        sectorImpact,
    };
};

module.exports = {
    UNCLASSIFIED_SECTOR_LABEL,
    applyHoldingShock,
    attributeHoldingImpact,
    attributeSectorImpact,
    calculateScenarioImpact,
};

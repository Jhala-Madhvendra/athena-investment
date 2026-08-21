/**
 * Portfolio Scenario Explanation Validator
 *
 * POST /api/portfolio/scenarios/explain takes the client's own already-
 * received /run (or one entry of a /compare) response body and asks an
 * LLM to explain it in prose - it never recomputes the scenario itself.
 * This validator has two jobs, both in service of
 * research/engineering/GroundedScenarioExplanation.md's "the AI's only
 * input is the already-computed structured JSON" rule:
 *
 *  1. Reject a request that doesn't look like a real scenario result -
 *     an incomplete/malformed body would just make the LLM's context
 *     confusing or force it to invent what's missing.
 *  2. Build `normalized` as an explicit allow-list of fields copied out of
 *     the request body. This is NOT a courtesy trim - it is the mechanism
 *     that guarantees nothing outside the known scenario-result shape
 *     (arbitrary extra keys a caller could attach) ever reaches the
 *     prompt builder.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// Bounds how much of a large portfolio's holding/sector attribution is ever
// forwarded into a prompt - keeps token usage predictable regardless of
// portfolio size, same motivation as ai.promptBuilder.js's TokenOptimization
// note. The result is still a truthful summary: entries are expected to
// already be present in whatever ranking the client is displaying.
const MAX_HOLDING_ENTRIES = 25;
const MAX_SECTOR_ENTRIES = 15;
const MAX_RULES = 20;
const MAX_METHODOLOGY_NOTES = 10;

const normalizeRule = (rule) => {
    if (!isPlainObject(rule) || typeof rule.targetType !== "string" || !isFiniteNumber(rule.shockPercent)) return null;
    return {
        targetType: rule.targetType,
        target: typeof rule.target === "string" ? rule.target : null,
        shockPercent: rule.shockPercent,
    };
};

const normalizeHoldingEntry = (entry) => {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.ticker)) return null;
    return {
        ticker: entry.ticker,
        sector: typeof entry.sector === "string" ? entry.sector : null,
        industry: typeof entry.industry === "string" ? entry.industry : null,
        appliedRule: isPlainObject(entry.appliedRule) ? entry.appliedRule : null,
        effectiveShockPercent: isFiniteNumber(entry.effectiveShockPercent) ? entry.effectiveShockPercent : null,
        currentValueUSD: isFiniteNumber(entry.currentValueUSD) ? entry.currentValueUSD : null,
        scenarioValueUSD: isFiniteNumber(entry.scenarioValueUSD) ? entry.scenarioValueUSD : null,
        absoluteChangeUSD: isFiniteNumber(entry.absoluteChangeUSD) ? entry.absoluteChangeUSD : null,
        portfolioImpactPercentagePoints: isFiniteNumber(entry.portfolioImpactPercentagePoints)
            ? entry.portfolioImpactPercentagePoints
            : null,
        contributionToScenarioImpactPercent: isFiniteNumber(entry.contributionToScenarioImpactPercent)
            ? entry.contributionToScenarioImpactPercent
            : null,
        unaffected: Boolean(entry.unaffected),
    };
};

const normalizeSectorEntry = (entry) => {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.sector)) return null;
    return {
        sector: entry.sector,
        currentValueUSD: isFiniteNumber(entry.currentValueUSD) ? entry.currentValueUSD : null,
        scenarioValueUSD: isFiniteNumber(entry.scenarioValueUSD) ? entry.scenarioValueUSD : null,
        absoluteChangeUSD: isFiniteNumber(entry.absoluteChangeUSD) ? entry.absoluteChangeUSD : null,
        portfolioImpactPercentagePoints: isFiniteNumber(entry.portfolioImpactPercentagePoints)
            ? entry.portfolioImpactPercentagePoints
            : null,
        contributionToScenarioImpactPercent: isFiniteNumber(entry.contributionToScenarioImpactPercent)
            ? entry.contributionToScenarioImpactPercent
            : null,
    };
};

const normalizeHistoricalContext = (historicalContext) => {
    if (!isPlainObject(historicalContext) || historicalContext.available !== true) {
        return { available: false };
    }
    return {
        available: true,
        window: typeof historicalContext.window === "string" ? historicalContext.window : null,
        volatilityPercent: isFiniteNumber(historicalContext.volatilityPercent) ? historicalContext.volatilityPercent : null,
        beta: isFiniteNumber(historicalContext.beta) ? historicalContext.beta : null,
        maxDrawdownPercent: isFiniteNumber(historicalContext.maxDrawdown?.maxDrawdownPercent)
            ? historicalContext.maxDrawdown.maxDrawdownPercent
            : null,
    };
};

const normalizeAssumptions = (assumptions) => {
    if (!isPlainObject(assumptions)) return null;
    return {
        scenarioName: isNonEmptyString(assumptions.scenarioName) ? assumptions.scenarioName : null,
        portfolioValueUSD: isFiniteNumber(assumptions.portfolioValueUSD) ? assumptions.portfolioValueUSD : null,
        betaUsed: isFiniteNumber(assumptions.betaUsed) ? assumptions.betaUsed : null,
        betaCoveragePercent: isFiniteNumber(assumptions.betaCoveragePercent) ? assumptions.betaCoveragePercent : null,
        sectorCoveragePercent: isFiniteNumber(assumptions.sectorCoveragePercent) ? assumptions.sectorCoveragePercent : null,
        industryCoveragePercent: isFiniteNumber(assumptions.industryCoveragePercent) ? assumptions.industryCoveragePercent : null,
        unmatchedRules: Array.isArray(assumptions.unmatchedRules) ? assumptions.unmatchedRules.map(normalizeRule).filter(Boolean) : [],
        methodologyNotes: Array.isArray(assumptions.methodologyNotes)
            ? assumptions.methodologyNotes.filter(isNonEmptyString).slice(0, MAX_METHODOLOGY_NOTES)
            : [],
    };
};

/**
 * @param {object} body - req.body for POST /api/portfolio/scenarios/explain
 * @returns {{isValid: boolean, errors: string[], normalized: object|null}}
 */
const validateExplanationRequest = (body) => {
    const errors = [];
    const raw = isPlainObject(body) ? body : {};

    if (!isPlainObject(raw.scenario) || !isNonEmptyString(raw.scenario.name)) {
        errors.push("scenario.name must be a non-empty string.");
    }
    if (!Array.isArray(raw.scenario?.rules) || raw.scenario.rules.length === 0) {
        errors.push("scenario.rules must be a non-empty array.");
    }

    ["currentPortfolioValueUSD", "scenarioPortfolioValueUSD", "absoluteChangeUSD"].forEach((key) => {
        if (!isFiniteNumber(raw[key])) {
            errors.push(`${key} must be a finite number.`);
        }
    });

    if (raw.percentageChange !== null && !isFiniteNumber(raw.percentageChange)) {
        errors.push("percentageChange must be a finite number or null.");
    }

    if (!Array.isArray(raw.holdingImpact)) {
        errors.push("holdingImpact must be an array.");
    }
    if (!Array.isArray(raw.sectorImpact)) {
        errors.push("sectorImpact must be an array.");
    }

    if (errors.length > 0) {
        return { isValid: false, errors, normalized: null };
    }

    const rules = raw.scenario.rules.slice(0, MAX_RULES).map(normalizeRule).filter(Boolean);
    if (rules.length === 0) {
        return { isValid: false, errors: ["scenario.rules did not contain any well-formed rules."], normalized: null };
    }

    const normalized = {
        scenario: { name: raw.scenario.name.trim(), rules },
        currentPortfolioValueUSD: raw.currentPortfolioValueUSD,
        scenarioPortfolioValueUSD: raw.scenarioPortfolioValueUSD,
        absoluteChangeUSD: raw.absoluteChangeUSD,
        percentageChange: raw.percentageChange,
        holdingImpact: raw.holdingImpact.map(normalizeHoldingEntry).filter(Boolean).slice(0, MAX_HOLDING_ENTRIES),
        sectorImpact: raw.sectorImpact.map(normalizeSectorEntry).filter(Boolean).slice(0, MAX_SECTOR_ENTRIES),
        historicalContext: normalizeHistoricalContext(raw.historicalContext),
        assumptions: normalizeAssumptions(raw.assumptions),
    };

    return { isValid: true, errors: [], normalized };
};

module.exports = { validateExplanationRequest, MAX_HOLDING_ENTRIES, MAX_SECTOR_ENTRIES };

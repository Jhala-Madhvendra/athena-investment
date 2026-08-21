/**
 * Portfolio Scenario Resolver
 *
 * Pure functions only - no I/O (same shape as portfolio.analytics.calculator.js).
 * Owns the scenario RULE MODEL and PRECEDENCE - the part of the engine that
 * decides, for a portfolio of holdings and a set of hypothetical shock
 * rules, which single rule actually governs each holding.
 *
 * RULE MODEL
 * ----------
 * A scenario rule is `{ targetType, target, shockPercent }`:
 *   - targetType: one of TARGET_TYPES below
 *   - target: a ticker (ASSET), an industry name (INDUSTRY), a sector name
 *     (SECTOR) - all matched against Company.industry/Company.sector
 *     (Sprint 13's classification, no new taxonomy) - or null (MARKET,
 *     PORTFOLIO, which target every holding, not a named group)
 *   - shockPercent: a hypothetical percentage move (-20 means -20%), never
 *     a probability and never derived from historical data - see
 *     research/finance/AdvancedScenarioAnalysis.md
 *
 * PRECEDENCE - READ THIS BEFORE CHANGING MATCH LOGIC
 * -----------------------------------------------------
 * A holding can be matched by more than one rule at once (e.g. a Technology
 * sector shock AND an explicit AAPL shock in the same scenario). Athena
 * does NOT stack or multiply overlapping shocks - only ONE rule ever
 * applies to a holding: the most specific one. Precedence (most to least
 * specific):
 *
 *     ASSET > INDUSTRY > SECTOR > MARKET > PORTFOLIO
 *
 * Industry outranks sector because Athena's Company model carries them as
 * two independent free-text fields (Sprint 13), where industry is always
 * the finer-grained label (e.g. sector "Technology", industry "Consumer
 * Electronics") - more specific still beats less specific. MARKET outranks
 * PORTFOLIO because a market/beta shock reflects a stated methodology
 * (holding's own beta x market move) rather than a flat override, so it is
 * treated as more informative than a blanket "apply to everything" rule.
 *
 * A rule that matches a holding but loses to a higher-precedence rule is
 * recorded in that holding's `overriddenRules`, not silently dropped -
 * "which rule affected each holding" must always be answerable. This is a
 * documented product decision (transparent precedence over additive/
 * multiplicative stacking), not a mathematical inevitability - see
 * research/engineering/ScenarioPrecedence.md.
 *
 * MARKET RULE MECHANICS
 * ----------------------
 * A MARKET rule's shockPercent is a hypothetical benchmark move (e.g. "SPY
 * -20%"), not a per-holding shock. Reusing Sprint 14's methodology exactly
 * (portfolio.analytics.risk.js's weighted-average-of-Yahoo-betas), each
 * holding's effective shock under a MARKET rule is
 * `holding.beta x rule.shockPercent`. A holding with an unknown beta cannot
 * be evaluated under a MARKET rule and falls through to the next
 * lower-precedence rule that matches it (typically PORTFOLIO, if present) -
 * it is never silently assigned a 0% or an assumed beta.
 */

const TARGET_TYPES = ["ASSET", "INDUSTRY", "SECTOR", "MARKET", "PORTFOLIO"];

/** Lower rank = higher precedence (more specific). Single source of truth for ordering - validator/presets import this instead of re-declaring it. */
const PRECEDENCE_RANK = { ASSET: 0, INDUSTRY: 1, SECTOR: 2, MARKET: 3, PORTFOLIO: 4 };

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Whether `rule` targets `holding` at all (before precedence is considered). MARKET/PORTFOLIO always match; ASSET/INDUSTRY/SECTOR match on an exact, case-sensitive field comparison (same convention as portfolio.analytics.exposure.js's groupByClassification). */
const ruleMatchesHolding = (rule, holding) => {
    switch (rule.targetType) {
        case "ASSET":
            return rule.target === holding.ticker;
        case "INDUSTRY":
            return rule.target !== null && rule.target === holding.industry;
        case "SECTOR":
            return rule.target !== null && rule.target === holding.sector;
        case "MARKET":
        case "PORTFOLIO":
            return true;
        default:
            return false;
    }
};

/**
 * The effective (post-methodology) shock a matching rule applies to a
 * holding, or null if the rule cannot be evaluated for this holding (only
 * possible for MARKET when beta is unknown - see module header).
 */
const effectiveShockForRule = (rule, holding) => {
    if (rule.targetType === "MARKET") {
        return isFiniteNumber(holding.beta) ? holding.beta * rule.shockPercent : null;
    }
    return rule.shockPercent;
};

/**
 * Resolves the single governing rule for one holding out of every rule that
 * targets it, honoring PRECEDENCE_RANK and the MARKET beta-availability
 * fallthrough described above.
 *
 * Two different reasons a matching rule can fail to apply are kept
 * separate, never merged into one bucket:
 *   - `overriddenRules`: the rule COULD be evaluated but a more specific
 *     rule outranked it (normal precedence).
 *   - `unevaluableRules`: the rule matched but could not be computed at all
 *     (currently only a MARKET rule with no holding beta) - a data gap,
 *     not a precedence outcome, and surfaced distinctly so a caller never
 *     reads "beta unavailable" as "a sector shock won instead."
 *
 * @param {{ticker: string, sector: string|null, industry: string|null, beta: number|null}} holding
 * @param {{targetType: string, target: string|null, shockPercent: number}[]} rules
 * @returns {{appliedRule: object|null, effectiveShockPercent: number|null, overriddenRules: object[], unevaluableRules: object[]}}
 */
const resolveHoldingRule = (holding, rules) => {
    const matched = (rules || [])
        .filter((rule) => ruleMatchesHolding(rule, holding))
        .map((rule) => ({ rule, effectiveShockPercent: effectiveShockForRule(rule, holding) }))
        .sort((a, b) => PRECEDENCE_RANK[a.rule.targetType] - PRECEDENCE_RANK[b.rule.targetType]);

    const evaluable = matched.filter((candidate) => candidate.effectiveShockPercent !== null);
    const unevaluableRules = matched.filter((candidate) => candidate.effectiveShockPercent === null).map((candidate) => candidate.rule);

    const winner = evaluable[0] || null;
    const overriddenRules = evaluable.slice(1).map((candidate) => candidate.rule);

    return {
        appliedRule: winner ? winner.rule : null,
        effectiveShockPercent: winner ? winner.effectiveShockPercent : null,
        overriddenRules,
        unevaluableRules,
    };
};

/**
 * Resolves every holding against the full rule set. Holdings matched by no
 * rule (no PORTFOLIO/MARKET catch-all present, and no specific match) are
 * unaffected - held at their current value, not assumed flat.
 * @param {{ticker: string, currentValueUSD: number, weightPercent: number, sector: string|null, industry: string|null, beta: number|null}[]} holdings
 * @param {{targetType: string, target: string|null, shockPercent: number}[]} rules
 * @returns {object[]} one entry per holding, holding fields preserved plus appliedRule/effectiveShockPercent/overriddenRules/unaffected
 */
const resolveScenario = (holdings, rules) =>
    (holdings || []).map((holding) => {
        const { appliedRule, effectiveShockPercent, overriddenRules, unevaluableRules } = resolveHoldingRule(holding, rules);
        return {
            ...holding,
            appliedRule,
            effectiveShockPercent,
            overriddenRules,
            unevaluableRules,
            unaffected: appliedRule === null,
        };
    });

module.exports = {
    TARGET_TYPES,
    PRECEDENCE_RANK,
    ruleMatchesHolding,
    effectiveShockForRule,
    resolveHoldingRule,
    resolveScenario,
};

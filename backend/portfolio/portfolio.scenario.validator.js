/**
 * Portfolio Scenario Validator
 *
 * Structural validation for POST /api/portfolio/scenarios/run and /compare.
 * Same {isValid, errors} shape as portfolio.analytics.validator.js. Ticker
 * resolution (does this ASSET target actually exist as a company Athena
 * knows about) is NOT done here - like portfolio.analytics.validator.js,
 * this only checks the request is well-formed; the service layer resolves
 * against real data and simply produces an unaffected holding if a target
 * matches nothing.
 */

const { SUPPORTED_PERIODS } = require("../market/market.service");
const { TARGET_TYPES } = require("./portfolio.scenario.resolver");

const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;
const DEFAULT_WINDOW = "1y";
const DEFAULT_SCENARIO_NAME = "Custom Scenario";
const MAX_NAME_LENGTH = 100;
const MAX_TARGET_LENGTH = 100;
const MAX_RULES = 20;
/** Sanity bound, not a business rule - a shock beyond this is almost certainly a data-entry error (e.g. a misplaced decimal), not a deliberate hypothetical. -100% (total wipeout) and +100% (doubling) must both validate cleanly. */
const MIN_SHOCK_PERCENT = -100;
const MAX_SHOCK_PERCENT = 1000;
const MIN_SENSITIVITY_VALUES = 2;
const MAX_SENSITIVITY_VALUES = 5;

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const ruleKey = (rule) => `${rule.targetType}:${rule.target ?? ""}`;

/** Validates and normalizes a single rule. Returns {rule, errors} - `rule` is null if unrecoverable (e.g. unknown targetType). */
const validateRule = (rawRule, index) => {
    const errors = [];
    const label = `rules[${index}]`;

    if (typeof rawRule !== "object" || rawRule === null) {
        return { rule: null, errors: [`${label} must be an object.`] };
    }

    const targetType = typeof rawRule.targetType === "string" ? rawRule.targetType.toUpperCase() : null;
    if (!targetType || !TARGET_TYPES.includes(targetType)) {
        errors.push(`${label}.targetType must be one of ${TARGET_TYPES.join(", ")} - got ${JSON.stringify(rawRule.targetType)}.`);
        return { rule: null, errors };
    }

    const needsTarget = targetType === "ASSET" || targetType === "INDUSTRY" || targetType === "SECTOR";
    let target = null;

    if (needsTarget) {
        const rawTarget = typeof rawRule.target === "string" ? rawRule.target.trim() : "";
        if (!rawTarget) {
            errors.push(`${label}.target is required for targetType ${targetType}.`);
        } else if (rawTarget.length > MAX_TARGET_LENGTH) {
            errors.push(`${label}.target must be at most ${MAX_TARGET_LENGTH} characters.`);
        } else if (targetType === "ASSET") {
            if (!TICKER_PATTERN.test(rawTarget)) {
                errors.push(`${label}.target must be a valid ticker symbol - got ${JSON.stringify(rawTarget)}.`);
            } else {
                target = rawTarget.toUpperCase();
            }
        } else {
            target = rawTarget;
        }
    } else if (rawRule.target !== undefined && rawRule.target !== null) {
        errors.push(`${label}.target must not be set for targetType ${targetType}.`);
    }

    const shockPercent = typeof rawRule.shockPercent === "number" ? rawRule.shockPercent : Number(rawRule.shockPercent);
    if (!isFiniteNumber(shockPercent)) {
        errors.push(`${label}.shockPercent must be a number - got ${JSON.stringify(rawRule.shockPercent)}.`);
    } else if (shockPercent < MIN_SHOCK_PERCENT || shockPercent > MAX_SHOCK_PERCENT) {
        errors.push(`${label}.shockPercent must be between ${MIN_SHOCK_PERCENT} and ${MAX_SHOCK_PERCENT} - got ${shockPercent}.`);
    }

    if (errors.length > 0) {
        return { rule: null, errors };
    }

    return { rule: { targetType, target, shockPercent }, errors: [] };
};

/**
 * @param {{name?: unknown, rules?: unknown, benchmark?: unknown, window?: unknown, sensitivity?: unknown}} body
 * @returns {{isValid: boolean, errors: string[], normalized: {name: string, rules: object[], benchmark: string|null, window: string, sensitivity: object|null}}}
 */
const validateScenarioRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    let name = DEFAULT_SCENARIO_NAME;
    if (raw.name !== undefined) {
        const trimmed = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!trimmed) {
            errors.push("name must be a non-empty string when provided.");
        } else if (trimmed.length > MAX_NAME_LENGTH) {
            errors.push(`name must be at most ${MAX_NAME_LENGTH} characters.`);
        } else {
            name = trimmed;
        }
    }

    if (!Array.isArray(raw.rules) || raw.rules.length === 0) {
        errors.push("rules must be a non-empty array.");
    } else if (raw.rules.length > MAX_RULES) {
        errors.push(`rules must contain at most ${MAX_RULES} entries.`);
    }

    const rules = [];
    if (Array.isArray(raw.rules)) {
        raw.rules.slice(0, MAX_RULES).forEach((rawRule, index) => {
            const { rule, errors: ruleErrors } = validateRule(rawRule, index);
            errors.push(...ruleErrors);
            if (rule) rules.push(rule);
        });
    }

    // A duplicate (targetType, target) pair is ambiguous under the precedence model (portfolio.scenario.resolver.js)
    // - which of the two identically-ranked rules should win is undefined, so this is rejected outright rather than
    // silently picking one.
    const seen = new Set();
    rules.forEach((rule, index) => {
        const key = ruleKey(rule);
        if (seen.has(key)) {
            errors.push(`rules[${index}] duplicates an earlier rule for ${rule.targetType}${rule.target ? ` "${rule.target}"` : ""} - combine into a single rule instead.`);
        }
        seen.add(key);
    });

    let benchmark = null;
    if (raw.benchmark !== undefined && raw.benchmark !== "") {
        const trimmed = typeof raw.benchmark === "string" ? raw.benchmark.trim().toUpperCase() : "";
        if (!TICKER_PATTERN.test(trimmed)) {
            errors.push(`benchmark must be a valid ticker symbol - got ${JSON.stringify(raw.benchmark)}.`);
        } else {
            benchmark = trimmed;
        }
    }

    const window = raw.window === undefined ? DEFAULT_WINDOW : String(raw.window).toLowerCase();
    if (!SUPPORTED_PERIODS.includes(window)) {
        errors.push(`window must be one of ${SUPPORTED_PERIODS.join(", ")} - got ${JSON.stringify(raw.window)}.`);
    }

    let sensitivity = null;
    if (raw.sensitivity !== undefined && raw.sensitivity !== null) {
        const rawSensitivity = typeof raw.sensitivity === "object" ? raw.sensitivity : {};
        const targetType = typeof rawSensitivity.targetType === "string" ? rawSensitivity.targetType.toUpperCase() : null;
        const target =
            typeof rawSensitivity.target === "string" && rawSensitivity.target.trim()
                ? targetType === "ASSET"
                    ? rawSensitivity.target.trim().toUpperCase()
                    : rawSensitivity.target.trim()
                : null;

        if (!targetType || !TARGET_TYPES.includes(targetType)) {
            errors.push(`sensitivity.targetType must be one of ${TARGET_TYPES.join(", ")}.`);
        }

        const matchesExistingRule = rules.some((rule) => rule.targetType === targetType && rule.target === target);
        if (targetType && !matchesExistingRule) {
            errors.push("sensitivity.targetType/target must match one of the rules already in this scenario.");
        }

        const shockValues = Array.isArray(rawSensitivity.shockValues) ? rawSensitivity.shockValues.map(Number) : [];
        if (shockValues.length < MIN_SENSITIVITY_VALUES || shockValues.length > MAX_SENSITIVITY_VALUES) {
            errors.push(`sensitivity.shockValues must contain between ${MIN_SENSITIVITY_VALUES} and ${MAX_SENSITIVITY_VALUES} values.`);
        } else if (shockValues.some((value) => !isFiniteNumber(value) || value < MIN_SHOCK_PERCENT || value > MAX_SHOCK_PERCENT)) {
            errors.push(`sensitivity.shockValues must all be numbers between ${MIN_SHOCK_PERCENT} and ${MAX_SHOCK_PERCENT}.`);
        } else if (new Set(shockValues).size !== shockValues.length) {
            errors.push("sensitivity.shockValues must not contain duplicates.");
        }

        if (targetType && matchesExistingRule) {
            sensitivity = { targetType, target, shockValues };
        }
    }

    return { isValid: errors.length === 0, errors, normalized: { name, rules, benchmark, window, sensitivity } };
};

const MAX_COMPARE_SCENARIOS = 5;

/**
 * Validates POST /api/portfolio/scenarios/compare. Reuses
 * validateScenarioRequest per scenario entry (each still needs its own
 * name/rules validated the same way /run does) - benchmark/window are
 * shared across the whole comparison since they describe the historical
 * context lens, not any one scenario's hypothetical assumptions.
 * @param {{scenarios?: unknown, benchmark?: unknown, window?: unknown}} body
 */
const validateCompareRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    if (!Array.isArray(raw.scenarios) || raw.scenarios.length < 2) {
        errors.push("scenarios must be an array of at least 2 scenarios to compare.");
    } else if (raw.scenarios.length > MAX_COMPARE_SCENARIOS) {
        errors.push(`scenarios must contain at most ${MAX_COMPARE_SCENARIOS} entries.`);
    }

    const scenarios = [];
    if (Array.isArray(raw.scenarios)) {
        raw.scenarios.slice(0, MAX_COMPARE_SCENARIOS).forEach((rawScenario, index) => {
            const { isValid, errors: scenarioErrors, normalized } = validateScenarioRequest({
                ...rawScenario,
                benchmark: rawScenario?.benchmark ?? raw.benchmark,
                window: rawScenario?.window ?? raw.window,
            });
            if (!isValid) {
                errors.push(...scenarioErrors.map((message) => `scenarios[${index}].${message}`));
            } else {
                scenarios.push({ name: normalized.name, rules: normalized.rules, sensitivity: normalized.sensitivity });
            }
        });
    }

    let benchmark = null;
    if (raw.benchmark !== undefined && raw.benchmark !== "") {
        const trimmed = typeof raw.benchmark === "string" ? raw.benchmark.trim().toUpperCase() : "";
        if (!TICKER_PATTERN.test(trimmed)) {
            errors.push(`benchmark must be a valid ticker symbol - got ${JSON.stringify(raw.benchmark)}.`);
        } else {
            benchmark = trimmed;
        }
    }

    const window = raw.window === undefined ? DEFAULT_WINDOW : String(raw.window).toLowerCase();
    if (!SUPPORTED_PERIODS.includes(window)) {
        errors.push(`window must be one of ${SUPPORTED_PERIODS.join(", ")} - got ${JSON.stringify(raw.window)}.`);
    }

    return { isValid: errors.length === 0, errors, normalized: { scenarios, benchmark, window } };
};

module.exports = {
    validateScenarioRequest,
    validateCompareRequest,
    DEFAULT_WINDOW,
    DEFAULT_SCENARIO_NAME,
    MAX_RULES,
    MAX_COMPARE_SCENARIOS,
    MIN_SHOCK_PERCENT,
    MAX_SHOCK_PERCENT,
};

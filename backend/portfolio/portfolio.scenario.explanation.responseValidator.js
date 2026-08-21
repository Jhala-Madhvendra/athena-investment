/**
 * Portfolio Scenario Explanation Response Validator
 *
 * Implements the mechanical hallucination check
 * research/engineering/GroundedScenarioExplanation.md specifies: since the
 * LLM's entire input is a closed, already-verified set of numbers (the
 * normalized scenario result), any number appearing in its output that
 * does NOT trace back to that input is a hallucination by definition -
 * checkable without re-reading the prose for meaning.
 *
 * This is deliberately a numeric check, not a semantic one - it cannot
 * catch a claim that misinterprets a real number, only one that invents a
 * number that was never given. That narrower guarantee is the one this
 * layer promises; see the docstring on validateExplanationText.
 */

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

// Small integers (counts, ordinals - "3 holdings", "one of two rules") are
// extremely common in ordinary prose and are not meaningful financial
// claims on their own; flagging them would make the check too noisy to be
// useful. Anything at or below this magnitude is always allowed.
const ALWAYS_ALLOWED_MAGNITUDE = 25;

// Absolute + relative tolerance so a legitimately-rounded restatement
// ("-8.2%" for -8.1963...) isn't flagged as invented. Relative tolerance
// dominates for large dollar figures, absolute tolerance for small
// percentages near zero.
const ABSOLUTE_TOLERANCE = 0.5;
const RELATIVE_TOLERANCE = 0.01;

const NUMBER_TOKEN_PATTERN = /-?\d[\d,]*\.?\d*/g;

/** Recursively collects every finite number appearing anywhere in a JSON-shaped value. */
const collectKnownNumbers = (value, out = []) => {
    if (isFiniteNumber(value)) {
        out.push(value);
    } else if (Array.isArray(value)) {
        value.forEach((entry) => collectKnownNumbers(entry, out));
    } else if (value && typeof value === "object") {
        Object.values(value).forEach((entry) => collectKnownNumbers(entry, out));
    }
    return out;
};

const parseNumberToken = (token) => {
    const cleaned = token.replace(/,/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

// Matched against both the known value and its sign-flipped counterpart:
// prose naturally drops an explicit minus sign when a word already carries
// the direction ("a decline of 12%", "-$12,000" where the "-" binds to the
// "$" token and never reaches the digit regex) - that's a legitimate
// restatement of a known magnitude, not an invented number. A candidate
// with the wrong sign AND the wrong magnitude still won't match either way.
const isKnown = (candidate, knownNumbers) => {
    if (Math.abs(candidate) <= ALWAYS_ALLOWED_MAGNITUDE) return true;
    return knownNumbers.some((known) => {
        const tolerance = Math.max(ABSOLUTE_TOLERANCE, Math.abs(known) * RELATIVE_TOLERANCE);
        return Math.abs(candidate - known) <= tolerance || Math.abs(candidate + known) <= tolerance;
    });
};

/**
 * @param {string} explanationText - the already-extracted prose string (portfolio.scenario.explanation.responseParser's output) - NOT the LLM's raw response, which is a JSON envelope; parsing/unwrapping is a separate concern handled before this runs.
 * @param {object} normalizedScenarioResult - the exact input the LLM was given (portfolio.scenario.explanation.validator's `normalized`)
 * @returns {{isValid: boolean, errors: string[], unverifiedNumbers: number[]}}
 */
const validateExplanationText = (explanationText, normalizedScenarioResult) => {
    const errors = [];

    if (typeof explanationText !== "string" || explanationText.trim().length === 0) {
        return { isValid: false, errors: ["The AI response was empty."], unverifiedNumbers: [] };
    }

    const knownNumbers = collectKnownNumbers(normalizedScenarioResult);
    const tokens = explanationText.match(NUMBER_TOKEN_PATTERN) || [];

    const unverifiedNumbers = [];
    tokens.forEach((token) => {
        const candidate = parseNumberToken(token);
        if (candidate === null) return;
        if (!isKnown(candidate, knownNumbers)) {
            unverifiedNumbers.push(candidate);
        }
    });

    if (unverifiedNumbers.length > 0) {
        errors.push(
            `The AI response contains number(s) that do not trace back to the scenario result it was given: ${unverifiedNumbers.join(", ")}.`
        );
    }

    return { isValid: errors.length === 0, errors, unverifiedNumbers };
};

module.exports = { validateExplanationText, ALWAYS_ALLOWED_MAGNITUDE, ABSOLUTE_TOLERANCE, RELATIVE_TOLERANCE };

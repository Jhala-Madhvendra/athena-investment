/**
 * Structural validation for a portfolio account write (create/rename) - same
 * {isValid, errors, normalized} shape as portfolio.validator.js.
 */

const MAX_NAME_LENGTH = 60;

const validateAccountName = ({ name }) => {
    const errors = [];

    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
        errors.push("A name is required.");
    } else if (trimmed.length > MAX_NAME_LENGTH) {
        errors.push(`Name must be at most ${MAX_NAME_LENGTH} characters.`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized: errors.length === 0 ? { name: trimmed } : null,
    };
};

module.exports = { validateAccountName, MAX_NAME_LENGTH };

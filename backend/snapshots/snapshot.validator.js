const ALLOWED_TYPES = ["portfolio", "dcf"];
const MAX_LABEL_LENGTH = 100;
/** Sanity bound against abuse, not a business rule - a legitimate portfolio or DCF snapshot is a few KB at most. */
const MAX_PAYLOAD_BYTES = 200_000;

/**
 * @param {{type?: unknown, label?: unknown, payload?: unknown}} body
 * @returns {{isValid: boolean, errors: string[], normalized: {type: string, label: string|null, payload: object}}}
 */
const validateCreateRequest = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};

    const type = typeof raw.type === "string" ? raw.type : null;
    if (!type || !ALLOWED_TYPES.includes(type)) {
        errors.push(`type must be one of ${ALLOWED_TYPES.join(", ")}.`);
    }

    let label = null;
    if (raw.label !== undefined && raw.label !== null && raw.label !== "") {
        const trimmed = typeof raw.label === "string" ? raw.label.trim() : "";
        if (!trimmed) {
            errors.push("label, if provided, must be a non-empty string.");
        } else if (trimmed.length > MAX_LABEL_LENGTH) {
            errors.push(`label must be at most ${MAX_LABEL_LENGTH} characters.`);
        } else {
            label = trimmed;
        }
    }

    if (typeof raw.payload !== "object" || raw.payload === null || Array.isArray(raw.payload)) {
        errors.push("payload is required and must be an object.");
    } else {
        const byteLength = Buffer.byteLength(JSON.stringify(raw.payload), "utf8");
        if (byteLength > MAX_PAYLOAD_BYTES) {
            errors.push(`payload is too large (${byteLength} bytes) - at most ${MAX_PAYLOAD_BYTES} bytes are allowed.`);
        }
    }

    return { isValid: errors.length === 0, errors, normalized: { type, label, payload: raw.payload } };
};

module.exports = { validateCreateRequest, ALLOWED_TYPES, MAX_LABEL_LENGTH, MAX_PAYLOAD_BYTES };

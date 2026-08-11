const fetchWithTimeout = require("../../utils/fetchWithTimeout");

const BASE_URL = "https://api.twelvedata.com";

/**
 * GETs a Twelve Data endpoint and returns the parsed JSON body.
 * Twelve Data reports both HTTP-level failures and in-body failures
 * (`{code, message, status:"error"}` with a 200 status) - both are treated
 * as errors here. The raw message (which can include "consider upgrading
 * your plan") is deliberately not exposed - callers get a generic message
 * and decide what to throw in its place.
 */
const twelveDataGet = async (path, params = {}) => {
    const url = new URL(`${BASE_URL}${path}`);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });

    if (!url.searchParams.has("apikey")) {
        url.searchParams.set("apikey", process.env.TWELVE_DATA_API_KEY || "");
    }

    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });

    if (!response.ok) {
        const error = new Error(`Twelve Data request to ${path} failed with status ${response.status}.`);
        error.twelveDataStatus = response.status;
        throw error;
    }

    const body = await response.json();

    if (body?.status === "error" || body?.code >= 400) {
        const error = new Error(`Twelve Data could not resolve the request to ${path}.`);
        error.twelveDataStatus = body?.code;
        throw error;
    }

    return body;
};

// Callers use this to tell "genuinely not found" apart from "temporarily
// unavailable" (rate limit) - conflating the two turns a transient 429 into
// a misleading "this company doesn't exist" error further up the stack.
const isRateLimitError = (error) => error?.twelveDataStatus === 429;

module.exports = { twelveDataGet, isRateLimitError };

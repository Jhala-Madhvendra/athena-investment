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
        throw new Error(`Twelve Data request to ${path} failed with status ${response.status}.`);
    }

    const body = await response.json();

    if (body?.status === "error" || body?.code >= 400) {
        throw new Error(`Twelve Data could not resolve the request to ${path}.`);
    }

    return body;
};

module.exports = { twelveDataGet };

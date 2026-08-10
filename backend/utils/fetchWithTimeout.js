const env = require("../config/env");

/**
 * Wraps the global fetch with a timeout so a stalled upstream (e.g. Yahoo
 * Finance) can't hang a request indefinitely. Same signature as fetch.
 */
const fetchWithTimeout = async (resource, options = {}, timeoutMs = env.externalApiTimeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(resource, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The upstream financial data provider timed out. Please try again.");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

module.exports = fetchWithTimeout;

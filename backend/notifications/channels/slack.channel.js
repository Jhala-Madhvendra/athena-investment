/**
 * Slack Channel
 *
 * A plain incoming-webhook POST - no SDK needed. Webhook URLs are per-
 * workspace/per-channel, so each user configures their own (there's no
 * single "Athena's Slack" that would make sense for arbitrary users'
 * personal alerts) - see identity.model.js's notificationPreferences.
 */

const fetchWithTimeout = require("../../utils/fetchWithTimeout");
const env = require("../../config/env");

/**
 * @param {string} webhookUrl
 * @param {{title: string, message: string, url?: string}} content
 */
const send = async (webhookUrl, { title, message, url }) => {
    const text = [`*${title}*`, message, url].filter(Boolean).join("\n");

    const response = await fetchWithTimeout(
        webhookUrl,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        },
        env.externalApiTimeoutMs
    );

    if (!response.ok) {
        throw new Error(`Slack webhook request failed with status ${response.status}.`);
    }
};

module.exports = { send };

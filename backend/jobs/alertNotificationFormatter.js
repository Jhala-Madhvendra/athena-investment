/**
 * Alert Notification Formatter
 *
 * Pure function - batches every alert a single monitoring run just created
 * for one user into ONE notification (never one message per alert, which
 * would be spammy across three channels for a user tracking many tickers).
 */

const ALERTS_URL_PATH = "/alerts";

/**
 * @param {object[]} alerts - newly-created Alert documents (alert.service.js's runMonitoring's `alerts`)
 * @param {string} [appBaseUrl]
 * @returns {{title: string, message: string, url: string|undefined}}
 */
const formatAlertBatch = (alerts, appBaseUrl) => {
    const count = alerts.length;
    const title = `${count} new alert${count === 1 ? "" : "s"} on your portfolio`;

    const message = alerts
        .slice(0, 10)
        .map((alert) => `${alert.ticker}: ${alert.title}`)
        .join("\n");

    const remainder = count > 10 ? `\n...and ${count - 10} more.` : "";

    return {
        title,
        message: message + remainder,
        url: appBaseUrl ? `${appBaseUrl}${ALERTS_URL_PATH}` : undefined,
    };
};

module.exports = { formatAlertBatch };

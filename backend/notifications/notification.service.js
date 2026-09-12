/**
 * Notification Service
 *
 * Fans a single notification out to every channel a user has enabled/
 * configured. Each channel's failure (bad webhook URL, unconfigured SMTP,
 * a transient network error) is caught independently and logged - never
 * blocks another channel or throws back to the caller (the same degrade-
 * not-fail pattern used throughout this codebase, e.g.
 * watchlist.service.js's buildWatchlistRow). A channel that's enabled but
 * missing its required app-wide credential (email with no SMTP configured,
 * Telegram with no bot token) fails the same way - logged, not thrown.
 */

const emailChannel = require("./channels/email.channel");
const slackChannel = require("./channels/slack.channel");
const telegramChannel = require("./channels/telegram.channel");
const logger = require("../utils/logger");

/**
 * @param {{_id: string, email: string|null, notificationPreferences: object}} user
 * @param {{title: string, message: string, url?: string}} content
 * @returns {Promise<{channel: string, ok: boolean}[]>}
 */
const sendToUser = async (user, content) => {
    const prefs = user.notificationPreferences || {};
    const attempts = [];

    if (prefs.emailEnabled && user.email) {
        attempts.push(["email", () => emailChannel.send(user.email, content)]);
    }
    if (prefs.slackWebhookUrl) {
        attempts.push(["slack", () => slackChannel.send(prefs.slackWebhookUrl, content)]);
    }
    if (prefs.telegramChatId) {
        attempts.push(["telegram", () => telegramChannel.send(prefs.telegramChatId, content)]);
    }

    const results = [];
    for (const [channel, run] of attempts) {
        try {
            await run();
            results.push({ channel, ok: true });
        } catch (error) {
            logger.warn({ err: error, userId: String(user._id), channel }, "Notification delivery failed on one channel");
            results.push({ channel, ok: false });
        }
    }

    return results;
};

module.exports = { sendToUser };

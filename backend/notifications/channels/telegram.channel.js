/**
 * Telegram Channel
 *
 * The bot token is app-wide (one bot, one env var); the destination
 * (chat_id) is per-user, obtained by messaging the bot once - see
 * backend/jobs/telegramBotPoller.js for the /start reply that hands a user
 * their own chat_id to paste into their notification preferences.
 */

const fetchWithTimeout = require("../../utils/fetchWithTimeout");
const env = require("../../config/env");

const isConfigured = () => Boolean(env.telegramBotToken);

/**
 * @param {string} chatId
 * @param {{title: string, message: string, url?: string}} content
 */
const send = async (chatId, { title, message, url }) => {
    if (!isConfigured()) {
        throw new Error("Telegram channel is not configured (TELEGRAM_BOT_TOKEN).");
    }

    const text = [`*${title}*`, message, url].filter(Boolean).join("\n");

    const response = await fetchWithTimeout(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });

    if (!response.ok) {
        throw new Error(`Telegram sendMessage request failed with status ${response.status}.`);
    }
};

module.exports = { send, isConfigured };

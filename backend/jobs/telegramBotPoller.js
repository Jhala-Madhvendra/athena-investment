/**
 * Telegram Bot Poller
 *
 * Telegram doesn't push a chat_id to you - the standard zero-infrastructure
 * way to learn it is long-polling getUpdates. This is a single small
 * interval, not a webhook server: every POLL_INTERVAL_MS, fetch new
 * updates and reply to any /start message with the sender's own chat_id,
 * which they paste into Account settings to enable Telegram alerts.
 *
 * State (the last-seen update id) is held in a closure per poller instance
 * (see createPoller) rather than module-level, so tests can create a fresh,
 * isolated poller instead of fighting shared mutable state across cases.
 */

const fetchWithTimeout = require("../utils/fetchWithTimeout");
const env = require("../config/env");
const logger = require("../utils/logger");

const POLL_INTERVAL_MS = 30_000;

const telegramUrl = (method) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;

const replyWithChatId = async (chatId) => {
    const response = await fetchWithTimeout(telegramUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: `Your Telegram chat id is: ${chatId}\n\nPaste this into Athena's Account settings to enable Telegram alerts.`,
        }),
    });

    if (!response.ok) {
        throw new Error(`Telegram sendMessage request failed with status ${response.status}.`);
    }
};

/** @returns {{pollOnce: () => Promise<void>}} */
const createPoller = () => {
    let lastUpdateId = 0;

    const pollOnce = async () => {
        if (!env.telegramBotToken) return;

        const response = await fetchWithTimeout(`${telegramUrl("getUpdates")}?offset=${lastUpdateId + 1}&timeout=0`);
        if (!response.ok) {
            logger.warn({ status: response.status }, "Telegram getUpdates request failed");
            return;
        }

        const data = await response.json();
        for (const update of data.result || []) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);

            const text = update.message?.text;
            const chatId = update.message?.chat?.id;
            if (text === "/start" && chatId) {
                await replyWithChatId(chatId).catch((error) => logger.warn({ err: error }, "Failed to reply to Telegram /start"));
            }
        }
    };

    return { pollOnce };
};

let activePoller = null;
let pollTimer = null;

const start = () => {
    if (!env.telegramBotToken || pollTimer) return;
    activePoller = createPoller();
    pollTimer = setInterval(() => {
        activePoller.pollOnce().catch((error) => logger.warn({ err: error }, "Telegram poll failed"));
    }, POLL_INTERVAL_MS);
};

const stop = () => {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        activePoller = null;
    }
};

module.exports = { createPoller, start, stop, POLL_INTERVAL_MS };

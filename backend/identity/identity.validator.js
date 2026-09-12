/**
 * Structural validation for signup/login - same {isValid, errors, normalized}
 * shape as every other validator in this codebase. Ownership/uniqueness
 * checks (does this email already exist, does the password match) require a
 * database round trip, so they live in identity.service.js, not here - this
 * module only owns what can be checked in isolation.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const validateSignupInput = ({ email, password }) => {
    const errors = [];

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
        errors.push("A valid email address is required.");
    }

    const normalizedPassword = typeof password === "string" ? password : "";
    if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
        errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized: errors.length === 0 ? { email: normalizedEmail, password: normalizedPassword } : null,
    };
};

/**
 * Deliberately no format/length re-check here beyond presence - a login
 * attempt must never leak signup's password policy (e.g. "too short" would
 * tell an attacker a 7-character guess can't possibly be right).
 */
const validateLoginInput = ({ email, password }) => {
    const errors = [];

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) {
        errors.push("Email is required.");
    }

    const normalizedPassword = typeof password === "string" ? password : "";
    if (!normalizedPassword) {
        errors.push("Password is required.");
    }

    return {
        isValid: errors.length === 0,
        errors,
        normalized: errors.length === 0 ? { email: normalizedEmail, password: normalizedPassword } : null,
    };
};

const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/.+$/;
const TELEGRAM_CHAT_ID_PATTERN = /^-?\d+$/;

/**
 * Light sanity checks only - not a live verification ping (Slack/Telegram
 * are only ever actually contacted when a notification is sent, see
 * backend/notifications/). A malformed value here would just mean every
 * future send attempt fails and gets logged, never a crash.
 */
const validatePreferencesInput = (body) => {
    const errors = [];
    const raw = typeof body === "object" && body !== null ? body : {};
    const normalized = {};

    if (raw.emailEnabled !== undefined) {
        if (typeof raw.emailEnabled !== "boolean") {
            errors.push("emailEnabled must be a boolean.");
        } else {
            normalized.emailEnabled = raw.emailEnabled;
        }
    }

    if (raw.digestEnabled !== undefined) {
        if (typeof raw.digestEnabled !== "boolean") {
            errors.push("digestEnabled must be a boolean.");
        } else {
            normalized.digestEnabled = raw.digestEnabled;
        }
    }

    if (raw.slackWebhookUrl !== undefined) {
        if (raw.slackWebhookUrl === null || raw.slackWebhookUrl === "") {
            normalized.slackWebhookUrl = null;
        } else if (typeof raw.slackWebhookUrl !== "string" || !SLACK_WEBHOOK_PATTERN.test(raw.slackWebhookUrl.trim())) {
            errors.push("slackWebhookUrl must be a valid https://hooks.slack.com/services/... URL, or null to clear it.");
        } else {
            normalized.slackWebhookUrl = raw.slackWebhookUrl.trim();
        }
    }

    if (raw.telegramChatId !== undefined) {
        if (raw.telegramChatId === null || raw.telegramChatId === "") {
            normalized.telegramChatId = null;
        } else if (typeof raw.telegramChatId !== "string" || !TELEGRAM_CHAT_ID_PATTERN.test(raw.telegramChatId.trim())) {
            errors.push("telegramChatId must be a numeric chat id string, or null to clear it.");
        } else {
            normalized.telegramChatId = raw.telegramChatId.trim();
        }
    }

    return { isValid: errors.length === 0, errors, normalized };
};

module.exports = { validateSignupInput, validateLoginInput, validatePreferencesInput, MIN_PASSWORD_LENGTH };

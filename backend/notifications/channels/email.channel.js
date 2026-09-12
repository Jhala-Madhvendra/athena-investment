/**
 * Email Channel
 *
 * SMTP is a universal transport nearly every provider (Resend, SendGrid,
 * AWS SES, Mailgun, even Gmail) exposes identically - one nodemailer
 * integration covers any vendor the operator picks, unlike the LLM/market-
 * data providers (which have no shared protocol and need one client per
 * vendor). Configured entirely by env vars - see backend/config/env.js.
 */

const nodemailer = require("nodemailer");
const env = require("../../config/env");

const isConfigured = () => Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom);

let cachedTransport = null;
const getTransport = () => {
    if (!cachedTransport) {
        cachedTransport = nodemailer.createTransport({
            host: env.smtpHost,
            port: env.smtpPort,
            secure: env.smtpPort === 465,
            auth: { user: env.smtpUser, pass: env.smtpPass },
        });
    }
    return cachedTransport;
};

/**
 * @param {string} toEmail
 * @param {{title: string, message: string, url?: string}} content
 */
const send = async (toEmail, { title, message, url }) => {
    if (!isConfigured()) {
        throw new Error("Email channel is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM).");
    }

    const bodyLines = [message, url ? `\n${url}` : null].filter(Boolean);

    await getTransport().sendMail({
        from: env.smtpFrom,
        to: toEmail,
        subject: title,
        text: bodyLines.join("\n"),
    });
};

module.exports = { send, isConfigured };

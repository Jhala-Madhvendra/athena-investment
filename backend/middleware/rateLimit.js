const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const skipInTest = () => env.nodeEnv === "test";

const generalLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: "Too many requests. Please slow down and try again shortly." },
});

// Tighter limit for routes that trigger expensive external API calls
// (Yahoo Finance imports, DCF/comps calculations).
const expensiveLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: Math.max(20, Math.floor(env.rateLimitMax / 10)),
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: "Too many requests to this endpoint. Please slow down and try again shortly." },
});

// Stricter limit for POST /api/alerts/monitor - it iterates every ticker a
// user tracks across Market/Financial/Business/Valuation/News/Portfolio
// rules, so it gets its own, tighter budget rather than sharing
// expensiveLimiter's (which many cheaper fan-out endpoints also use).
const monitorLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.alertMonitorRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: "Too many monitoring requests. Please wait before checking for new alerts again." },
});

// Stricter limit for POST /api/identity/signup and /login - the first
// meaningful brute-force targets this app has ever had. Keyed by IP like
// every other limiter here (no per-account keying exists anywhere yet).
const authLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    message: { message: "Too many attempts. Please wait before trying again." },
});

module.exports = { generalLimiter, expensiveLimiter, monitorLimiter, authLimiter };

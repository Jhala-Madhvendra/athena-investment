require("dotenv").config();

const required = ["MONGO_URI"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    console.error("Copy backend/.env.example to backend/.env and fill in real values.");
    process.exit(1);
}

const parseOrigins = (value) =>
    (value || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction: process.env.NODE_ENV === "production",
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI,
    frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
    externalApiTimeoutMs: Number(process.env.EXTERNAL_API_TIMEOUT_MS) || 10000,
    financialDataProvider: (process.env.FINANCIAL_DATA_PROVIDER || "yahoo").toLowerCase(),
    financialStatementsProvider: (process.env.FINANCIAL_STATEMENTS_PROVIDER || "yahoo").toLowerCase(),
    marketDataProvider: (process.env.MARKET_DATA_PROVIDER || "yahoo").toLowerCase(),
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY || null,
    aiLlmProvider: (process.env.AI_LLM_PROVIDER || "anthropic").toLowerCase(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    geminiModel: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
    // Kept below server.js's requestTimeout/headersTimeout (see server.js)
    // so the AI route's own timeout error can fire before Express kills the
    // socket first. 90s, not 25s, because a "thinking" model can spend
    // several thousand tokens on hidden reasoning before any visible output
    // - confirmed empirically (a real report needed ~6500 combined
    // thinking+output tokens, comfortably exceeding a 25s generation
    // budget on a rate-limited endpoint). A provider that responds faster
    // simply returns sooner; this is a ceiling, not a target latency.
    aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS) || 90000,
    // Bumped whenever the context or report schema changes shape, so a
    // stored report from an old schema is treated as "no report" instead
    // of being served stale/incompatible - see ai.model.js.
    // Bumped to v2 in Sprint 10: the context gained a `recentEvents` section
    // and the report schema gained an optional `recentDevelopments` field,
    // so any report persisted under v1 is treated as stale and regenerated
    // once rather than served in the old shape.
    aiPromptVersion: process.env.AI_PROMPT_VERSION || "v2",
    // Earnings AI Summary's own cache-key version, kept separate from
    // aiPromptVersion above so bumping one feature's prompt/schema doesn't
    // invalidate the other's cached output.
    earningsAiPromptVersion: process.env.EARNINGS_AI_PROMPT_VERSION || "v1",
    // Shared monthly free-generation pool across every LLM-cost-bearing
    // feature (AI Research Reports, Earnings AI Summaries) - see
    // backend/ai/aiQuota.service.js.
    aiReportMonthlyQuota: Number(process.env.AI_REPORT_MONTHLY_QUOTA) || 5,
    // News & Event Intelligence (Sprint 10) - "yahoo" (default, unofficial,
    // no key), "marketaux" (dedicated news API, needs MARKETAUX_API_KEY),
    // or "mock" (development-only fixtures, never real news).
    newsProvider: (process.env.NEWS_PROVIDER || "yahoo").toLowerCase(),
    marketauxApiKey: process.env.MARKETAUX_API_KEY || null,
    // How long stored news for a ticker is considered fresh before a GET
    // triggers one live provider refresh. Deliberately not per-request -
    // see backend/news/news.service.js and research/engineering/NewsCaching.md.
    newsCacheTtlMs: Number(process.env.NEWS_CACHE_TTL_MS) || 4 * 60 * 60 * 1000,
    // How long a stored article is kept before Mongo's TTL index expires it
    // (backend/news/news.model.js). Not an archive - see NewsCaching.md.
    newsRetentionDays: Number(process.env.NEWS_RETENTION_DAYS) || 90,
    // Intelligent Alerts (Sprint 11) - how long an Alert is kept before
    // Mongo's TTL index expires it (backend/alerts/alert.model.js). Matches
    // newsRetentionDays: a 90-day-old alert has no decision value once
    // newer financials/prices have superseded it. Not an archive - see
    // research/engineering/AlertLifecycle.md.
    alertRetentionDays: Number(process.env.ALERT_RETENTION_DAYS) || 90,
    // POST /api/alerts/monitor is the single most expensive endpoint in the
    // app (iterates every tracked ticker across five rule categories), so
    // it gets its own, tighter rate-limit cap - see middleware/rateLimit.js.
    alertMonitorRateLimitMax: Number(process.env.ALERT_MONITOR_RATE_LIMIT_MAX) || 10,
    // Login/signup are the first meaningful brute-force target this app has
    // ever had (no password existed before the real-login/signup upgrade to
    // the anonymous identity system) - stricter than expensiveLimiter, keyed
    // by IP like every other limiter here (see middleware/rateLimit.js).
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 15,
    // AI Monitoring & Alerts - scheduler cadences (node-cron expressions).
    // Cron jobs themselves are only started outside test (see
    // backend/jobs/scheduler.js), so these defaults never fire during Jest.
    alertMonitoringCron: process.env.ALERT_MONITORING_CRON || "0 */6 * * *",
    scenarioWatchCron: process.env.SCENARIO_WATCH_CRON || "0 */6 * * *",
    digestCron: process.env.DIGEST_CRON || "0 13 * * 1",
    // Push notification channels (backend/notifications/) - each is null by
    // default and simply unusable until configured; no channel crashes
    // startup for being unconfigured, see notification.service.js.
    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || null,
    smtpPass: process.env.SMTP_PASS || null,
    smtpFrom: process.env.SMTP_FROM || null,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
};

if (env.isProduction && env.frontendOrigins.length === 0) {
    console.warn(
        "WARNING: FRONTEND_ORIGIN is not set in production. All cross-origin requests will be blocked until it is configured."
    );
}

module.exports = env;

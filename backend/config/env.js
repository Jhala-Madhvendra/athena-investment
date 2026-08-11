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
    aiPromptVersion: process.env.AI_PROMPT_VERSION || "v1",
};

if (env.isProduction && env.frontendOrigins.length === 0) {
    console.warn(
        "WARNING: FRONTEND_ORIGIN is not set in production. All cross-origin requests will be blocked until it is configured."
    );
}

module.exports = env;

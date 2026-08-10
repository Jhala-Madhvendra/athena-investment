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
};

if (env.isProduction && env.frontendOrigins.length === 0) {
    console.warn(
        "WARNING: FRONTEND_ORIGIN is not set in production. All cross-origin requests will be blocked until it is configured."
    );
}

module.exports = env;

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pinoHttp = require("pino-http");

const env = require("./config/env");
const { ALLOWED_CORS_METHODS } = require("./config/corsOptions");
const logger = require("./utils/logger");
const { sendServiceError } = require("./utils/httpErrors");
const { generalLimiter } = require("./middleware/rateLimit");

const app = express();
const connectDB = require("./config/db");
const companyRoutes = require("./routes/company.routes");
const financialsRoutes = require("./financials/financials.routes");
const ratioRoutes = require("./ratio/ratio.routes");
const analysisRoutes = require("./analysis/analysis.routes");
const marketRoutes = require("./market/market.routes");
const valuationRoutes = require("./valuation/valuation.routes");
const aiRoutes = require("./ai/ai.routes");
const newsRoutes = require("./news/news.routes");
const identityRoutes = require("./identity/identity.routes");
const watchlistRoutes = require("./watchlist/watchlist.routes");
const portfolioRoutes = require("./portfolio/portfolio.routes");
const portfolioAnalyticsRoutes = require("./portfolio/portfolio.analytics.routes");
const portfolioTransactionRoutes = require("./portfolio/transaction.routes");
const portfolioScenarioRoutes = require("./portfolio/portfolio.scenario.routes");
const alertRoutes = require("./alerts/alert.routes");
const earningsRoutes = require("./earnings/earnings.routes");
const industryRoutes = require("./industry/industry.routes");

connectDB();

app.use(helmet());

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // same-origin / server-to-server / curl requests carry no Origin header
    if (env.frontendOrigins.length > 0) return env.frontendOrigins.includes(origin);
    return !env.isProduction; // dev fallback: allow any origin only outside production
};

app.use(
    cors({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        // See config/corsOptions.js for what's listed and why - kept in its
        // own module (not inlined here) so backend/__tests__/corsMethods.test.js
        // can verify it covers every route's actual HTTP method without
        // booting this whole server file (which connects to MongoDB and
        // calls app.listen() as a side effect of being required).
        methods: ALLOWED_CORS_METHODS,
        credentials: false,
    })
);

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "100kb" }));
app.use(generalLimiter);

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.send("Backend Running...");
});

app.use("/api/company", companyRoutes);
app.use("/api/financials", financialsRoutes);
app.use("/api/ratios", ratioRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/valuation", valuationRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/identity", identityRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/portfolio/analytics", portfolioAnalyticsRoutes);
app.use("/api/portfolio/transactions", portfolioTransactionRoutes);
app.use("/api/portfolio/scenarios", portfolioScenarioRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/industry", industryRoutes);

app.use((err, req, res, next) => {
    const fallbackStatusCode = err.message === "Not allowed by CORS" ? 403 : 500;
    return sendServiceError(res, err, fallbackStatusCode);
});

const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} (${env.nodeEnv})`);
});

// Guard against slow/stalled clients and connections holding sockets open.
// Kept above env.aiRequestTimeoutMs (see config/env.js) so a slow LLM
// provider's own clean timeout error can fire before Express kills the
// connection first with a generic one.
server.requestTimeout = 95_000;
server.headersTimeout = 100_000;

process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
});

process.on("uncaughtException", (error) => {
    logger.error({ err: error }, "Uncaught exception");
    process.exit(1);
});

module.exports = server;

/**
 * Alert Service
 *
 * Orchestrates the Alert Engine: gathers a user's tracked tickers (Watchlist
 * union Portfolio), pulls already-cached/DB-only data from the existing
 * Market, Financial, Analysis, News, and Portfolio services (no direct
 * external-provider calls anywhere in this file - see
 * research/engineering/ScheduledMonitoring.md), runs the deterministic
 * engine, and persists whatever's genuinely new via alert.deduplicator.js.
 * Also owns the read-side: list/filter, read/dismiss, unread count, and the
 * small per-ticker helpers the Watchlist/Company Dashboard integrations use.
 */

const Alert = require("./alert.model");
const PortfolioAlertSnapshot = require("./portfolioAlertSnapshot.model");
const Watchlist = require("../watchlist/watchlist.model");
const marketService = require("../market/market.service");
const financialsService = require("../financials/financials.service");
const newsService = require("../news/news.service");
const portfolioService = require("../portfolio/portfolio.service");
const engine = require("./alert.engine");
const dedup = require("./alert.deduplicator");
const repository = require("./alert.repository");
const { THRESHOLDS } = require("./alert.rules");
const logger = require("../utils/logger");

class AlertNotFoundError extends Error {
    constructor() {
        super("Alert not found.");
        this.name = "AlertNotFoundError";
        this.statusCode = 404;
    }
}

/**
 * A user's tracked tickers = Watchlist union Portfolio holdings. Fetches
 * the full portfolio (not just tickers) once here so runMonitoring can
 * reuse its already-fetched holdings/summary for Portfolio rules instead
 * of fetching live quotes for the same tickers twice.
 */
const getTrackedTickers = async (userId) => {
    const [watchlist, portfolio] = await Promise.all([
        Watchlist.findOne({ userId }).select("companies.ticker").lean(),
        portfolioService.getPortfolio(userId),
    ]);

    const watchlistTickers = (watchlist?.companies || []).map((company) => company.ticker);
    const portfolioTickers = (portfolio.holdings || []).map((holding) => holding.ticker);

    return { tickers: [...new Set([...watchlistTickers, ...portfolioTickers])], portfolio };
};

/**
 * Market/Financial/Business/News candidates for one ticker. Each data
 * source is independently best-effort - a failure in one (e.g. a ticker
 * with no imported financials yet) degrades that category for this ticker,
 * it never fails the whole monitoring run, matching the degrade-not-fail
 * pattern used throughout Athena (see watchlist.service.js's buildWatchlistRow).
 */
const evaluateTicker = async (ticker) => {
    const newsSince = new Date(Date.now() - THRESHOLDS.news.lookbackDays * 24 * 60 * 60 * 1000);

    const [bars, statements, articles] = await Promise.all([
        marketService.getHistoricalPrices(ticker, "1m").catch(() => []),
        financialsService.getFinancialStatementsByTicker(ticker).catch(() => []),
        newsService.getImportantArticlesSince(ticker, newsSince, THRESHOLDS.news.importantCategories),
    ]);

    return [
        ...engine.evaluateMarketRules({ ticker, bars }),
        ...engine.evaluateFinancialRules({ ticker, statements }),
        ...engine.evaluateBusinessRules({ ticker, statements }),
        ...engine.evaluateNewsRules({ ticker, articles }),
    ];
};

/** Portfolio candidates for the whole account, plus persisting the per-ticker value snapshot the next run compares against. */
const evaluatePortfolio = async (userId, portfolio) => {
    const tickers = [...new Set((portfolio.holdings || []).map((holding) => holding.ticker))];
    if (tickers.length === 0) {
        return [];
    }

    const snapshots = await PortfolioAlertSnapshot.find({ userId, ticker: { $in: tickers } }).lean();
    const previousSnapshots = new Map(snapshots.map((snapshot) => [snapshot.ticker, snapshot]));

    const { candidates, snapshotUpdates } = engine.evaluatePortfolioRules({
        holdings: portfolio.holdings,
        summary: portfolio.summary,
        previousSnapshots,
    });

    await Promise.all(
        snapshotUpdates.map((update) =>
            PortfolioAlertSnapshot.findOneAndUpdate(
                { userId, ticker: update.ticker },
                {
                    currentValue: update.currentValue,
                    returnPercent: update.returnPercent,
                    weightPercent: update.weightPercent,
                    observedAt: new Date(),
                },
                { upsert: true }
            )
        )
    );

    return candidates;
};

/**
 * POST /api/alerts/monitor - the only place Alerts get created. Inserts
 * are done one at a time (not Promise.all) so a burst of many tracked
 * tickers doesn't fire dozens of concurrent writes at once; each insert is
 * cheap (one indexed write) and dedup.insertIfNew already tolerates the
 * unique-index race, so this is a deliberate throttle, not a missed
 * optimization.
 */
const runMonitoring = async (userId) => {
    const { tickers, portfolio } = await getTrackedTickers(userId);

    const perTickerResults = await Promise.all(
        tickers.map((ticker) =>
            evaluateTicker(ticker).catch((error) => {
                logger.warn({ err: error, ticker }, "Alert monitoring failed for one ticker; skipping it");
                return [];
            })
        )
    );
    const portfolioCandidates = await evaluatePortfolio(userId, portfolio);

    const allCandidates = [...perTickerResults.flat(), ...portfolioCandidates];

    const createdAlerts = [];
    for (const candidate of allCandidates) {
        const alert = await dedup.insertIfNew(Alert, { ...candidate, userId });
        if (alert) {
            createdAlerts.push(alert);
        }
    }

    return {
        tickersMonitored: tickers,
        alertsCreated: createdAlerts.length,
        alerts: createdAlerts,
        generatedAt: new Date().toISOString(),
    };
};

/** GET /api/alerts */
const getAlerts = async (userId, filters) => {
    const { alerts, total } = await repository.findAlerts(userId, filters);
    return { alerts, total, page: filters.page, limit: filters.limit };
};

/** PATCH /api/alerts/:id/read */
const markAsRead = async (userId, alertId) => {
    const alert = await repository.markRead(userId, alertId);
    if (!alert) {
        throw new AlertNotFoundError();
    }
    return alert;
};

/** PATCH /api/alerts/:id/dismiss */
const dismissAlert = async (userId, alertId) => {
    const alert = await repository.dismiss(userId, alertId);
    if (!alert) {
        throw new AlertNotFoundError();
    }
    return alert;
};

/** GET /api/alerts/unread-count */
const getUnreadCount = async (userId) => ({ count: await repository.countUnread(userId) });

/** Powers the Watchlist's and Portfolio's compact "N alerts" indicators - one aggregate query for every tracked ticker at once, instead of one GET /api/alerts call per ticker. */
const getAlertCountsByTicker = (userId, tickers) => repository.countByTicker(userId, tickers);

module.exports = {
    runMonitoring,
    getAlerts,
    markAsRead,
    dismissAlert,
    getUnreadCount,
    getAlertCountsByTicker,
    AlertNotFoundError,
};

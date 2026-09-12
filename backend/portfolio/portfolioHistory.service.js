/**
 * Portfolio History Service
 *
 * The I/O layer between the raw Transaction ledger and everything that
 * consumes reconstructed history (the /holdings history+as-of endpoints,
 * and portfolio.analytics.service's transaction-aware return series).
 * Mirrors the "Transactions -> Position Ledger -> Historical Holdings ->
 * Historical Portfolio Value -> Historical Returns" pipeline: this module
 * owns everything up through Historical Returns, using
 * holdingsReconstruction.calculator.js (pure) for the replay math and
 * market.service for historical prices - portfolio.analytics.service then
 * hands the resulting {date, return} series to the *same* calculator
 * functions (volatility/Sharpe/drawdown) it already used for the legacy
 * "today's weights backward" series, unmodified. Historical analytics never
 * reads a Transaction row directly - see PortfolioCalculationAssumptions.md.
 *
 * CASH FLOWS - READ BEFORE CHANGING THE RETURN SERIES LOGIC
 * -----------------------------------------------------------
 * Athena has no cash ledger - a BUY's funding source and a SELL's proceeds
 * destination are both untracked. That makes a naive V(t)/V(t-1)-1 across a
 * transaction day indistinguishable from a real investment gain/loss: a BUY
 * makes value jump up for reasons that have nothing to do with market
 * movement, and a SELL makes it drop for the same reason. Rather than
 * fabricate a time-weighted or money-weighted return (explicitly out of
 * scope - no cash-flow data exists to compute either correctly), any day
 * whose reconstructed holdings differ from the prior day is EXCLUDED from
 * the return series entirely - a documented gap, not a distorted number.
 * This means volatility/Sharpe/drawdown built from this series systematically
 * under-observe periods surrounding trades. See PortfolioCalculationAssumptions.md.
 */

const Transaction = require("./transaction.model");
const marketService = require("../market/market.service");
const reconstructionCalculator = require("./holdingsReconstruction.calculator");

const NO_TRANSACTIONS_REASON = "No transaction history recorded for this user - cannot reconstruct historical holdings.";

/**
 * Earliest date Athena can vouch for reconstructed holdings - before this,
 * no ledger exists, so no historical position is known (never assumed to
 * equal today's holdings).
 * @param {string|null} [portfolioId] - scopes to one account when given; aggregates across every account when omitted, same default as portfolio.service.js's getPortfolio.
 */
const getReconstructionStatus = async (userId, portfolioId = null) => {
    const filter = portfolioId ? { userId, portfolioId } : { userId };
    const [earliest, transactionCount] = await Promise.all([
        Transaction.findOne(filter).sort({ transactionDate: 1, createdAt: 1 }).lean(),
        Transaction.countDocuments(filter),
    ]);

    if (!earliest) {
        return { hasTransactions: false, analyticsStartDate: null, transactionCount: 0 };
    }

    return {
        hasTransactions: true,
        analyticsStartDate: reconstructionCalculator.toDateKey(earliest.transactionDate),
        transactionCount,
    };
};

/** Reconstructed holdings as of a given date (inclusive). Empty holdings + hasTransactionHistory:false means "no ledger," not "confirmed empty portfolio." */
const getHoldingsAt = async (userId, dateString, portfolioId = null) => {
    const status = await getReconstructionStatus(userId, portfolioId);
    const asOfDateKey = reconstructionCalculator.toDateKey(dateString);

    if (!status.hasTransactions) {
        return { asOfDate: asOfDateKey, holdings: {}, hasTransactionHistory: false, analyticsStartDate: null, beforeAnalyticsStartDate: null };
    }

    const filter = portfolioId ? { userId, portfolioId } : { userId };
    const transactions = await Transaction.find(filter).lean();
    const holdings = reconstructionCalculator.getHoldingsAt(transactions, dateString);

    return {
        asOfDate: asOfDateKey,
        holdings,
        hasTransactionHistory: true,
        analyticsStartDate: status.analyticsStartDate,
        beforeAnalyticsStartDate: asOfDateKey < status.analyticsStartDate,
    };
};

const getHoldingsTimeline = async (userId, portfolioId = null) => {
    const status = await getReconstructionStatus(userId, portfolioId);
    if (!status.hasTransactions) {
        return { hasTransactionHistory: false, analyticsStartDate: null, timeline: [] };
    }

    const filter = portfolioId ? { userId, portfolioId } : { userId };
    const transactions = await Transaction.find(filter).lean();
    return {
        hasTransactionHistory: true,
        analyticsStartDate: status.analyticsStartDate,
        timeline: reconstructionCalculator.buildHoldingsTimeline(transactions),
    };
};

/** Sums quantity x close price per ticker on one date. Returns null (not 0) if any held ticker is missing a price that day - a missing price must exclude the day, never silently understate value. */
const valueHoldingsAt = (holdings, priceByTickerByDate, dateKey) => {
    const tickers = Object.keys(holdings);
    if (tickers.length === 0) {
        return 0;
    }

    let total = 0;
    for (const ticker of tickers) {
        const price = priceByTickerByDate.get(ticker)?.get(dateKey);
        if (typeof price !== "number") {
            return null;
        }
        total += holdings[ticker] * price;
    }
    return total;
};

/**
 * Builds a transaction-aware {date, return}[] series for the requested
 * analytics window - the reconstructed-history counterpart to
 * portfolio.analytics.calculator.js's buildPortfolioReturnSeries. Any date
 * pair spanning a transaction, a missing price for a held ticker, or a
 * zero-value (no holdings yet) period is excluded rather than guessed at -
 * counts are returned so the caller can disclose exactly how much of the
 * window was usable.
 */
const buildTransactionAwareReturnSeries = async (userId, window) => {
    const status = await getReconstructionStatus(userId);

    if (!status.hasTransactions) {
        return {
            available: false,
            reason: NO_TRANSACTIONS_REASON,
            series: [],
            analyticsStartDate: null,
            windowClipped: false,
            excludedTransactionDays: 0,
            excludedMissingPriceDays: 0,
            excludedZeroValueDays: 0,
            tickersInvolved: [],
        };
    }

    const transactions = await Transaction.find({ userId }).lean();
    const timeline = reconstructionCalculator.buildHoldingsTimeline(transactions);
    const tickersInvolved = [...new Set(transactions.map((t) => t.ticker))];

    const historicalEntries = await Promise.all(
        tickersInvolved.map(async (ticker) => [ticker, await marketService.getHistoricalPrices(ticker, window).catch(() => [])])
    );

    const priceByTickerByDate = new Map();
    const allDates = new Set();
    historicalEntries.forEach(([ticker, bars]) => {
        const byDate = new Map();
        (bars || []).forEach((bar) => {
            if (typeof bar.close === "number") {
                byDate.set(bar.date, bar.close);
                allDates.add(bar.date);
            }
        });
        priceByTickerByDate.set(ticker, byDate);
    });

    const sortedDates = [...allDates].sort();
    const windowClipped = sortedDates.length > 0 && sortedDates[0] < status.analyticsStartDate;
    const tradingDates = sortedDates.filter((date) => date >= status.analyticsStartDate);

    const series = [];
    let excludedTransactionDays = 0;
    let excludedMissingPriceDays = 0;
    let excludedZeroValueDays = 0;

    for (let i = 1; i < tradingDates.length; i += 1) {
        const prevDate = tradingDates[i - 1];
        const date = tradingDates[i];

        const prevHoldings = reconstructionCalculator.getHoldingsAtFromTimeline(timeline, prevDate);
        const holdings = reconstructionCalculator.getHoldingsAtFromTimeline(timeline, date);

        if (!reconstructionCalculator.holdingsEqual(prevHoldings, holdings)) {
            excludedTransactionDays += 1;
            continue;
        }

        const prevValue = valueHoldingsAt(prevHoldings, priceByTickerByDate, prevDate);
        const value = valueHoldingsAt(holdings, priceByTickerByDate, date);

        if (prevValue === null || value === null) {
            excludedMissingPriceDays += 1;
            continue;
        }

        if (prevValue === 0) {
            excludedZeroValueDays += 1;
            continue;
        }

        series.push({ date, return: value / prevValue - 1 });
    }

    return {
        available: true,
        reason: null,
        series,
        analyticsStartDate: status.analyticsStartDate,
        windowClipped,
        excludedTransactionDays,
        excludedMissingPriceDays,
        excludedZeroValueDays,
        tickersInvolved,
    };
};

/** Cheap deterministic string that changes the instant a user's transaction ledger changes - same pattern as portfolio.analytics.service's buildPortfolioVersion, used to extend the analytics cache key. */
const getTransactionsVersion = async (userId) => {
    const rows = await Transaction.find({ userId })
        .select("ticker type quantity price transactionDate updatedAt -_id")
        .lean();

    if (rows.length === 0) {
        return "none";
    }

    const stamp = (value) => value?.toISOString?.() ?? value;
    return rows
        .map((r) => `${r.ticker}:${r.type}:${r.quantity}:${r.price}:${stamp(r.transactionDate)}:${stamp(r.updatedAt)}`)
        .sort()
        .join("|");
};

module.exports = {
    getReconstructionStatus,
    getHoldingsAt,
    getHoldingsTimeline,
    buildTransactionAwareReturnSeries,
    getTransactionsVersion,
};
